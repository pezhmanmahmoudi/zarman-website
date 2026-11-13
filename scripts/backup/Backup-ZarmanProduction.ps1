<#
.SYNOPSIS
  Read-only, verified, encrypted backup of the Zarman Exchange production database and Storage files.

.DESCRIPTION
  Everything done against production is read-only: SELECT/COPY TO inside READ ONLY transactions,
  pg_dump / pg_dumpall (which only read), and Storage list + download. Nothing is created, changed,
  reset or deleted in Supabase.

  Steps (any failure stops the run, archives nothing and wipes the plaintext):
    1  Access check: every table/sequence/schema pg_dump needs must be readable. Unreadable customer,
       financial, Auth or Storage data (schemas public, auth, storage, supabase_migrations) = FAIL.
       Unreadable Supabase-managed tables = FAIL unless -AllowManagedExclusions, and then each one is
       listed in the report as NOT BACKED UP.
    2  Per-table row counts + content checksums BEFORE the dump.
    3  pg_dumpall --roles-only --no-role-passwords; pg_dump --format=custom --create of the whole database.
    4  Checksums AFTER the dump, catalog definition fingerprint, extension inventory, database
       settings and the Storage inventory (storage.buckets / storage.objects).
    5  Dump completeness: every table has its data section in the archive.
    6  Restore test into a temporary local PostgreSQL 17 cluster (127.0.0.1, random password):
       roles.sql must apply with zero errors; pg_restore runs with --exit-on-error --single-transaction.
       Only entries belonging to Supabase-only extensions that a standard server cannot install
       (identified from the catalog, listed in the report) are left out. Then every table's content
       checksum and every object's definition and permissions must equal production.
    7  Storage: every file downloaded and verified against size, MD5/ETag and content type
       (backup-storage.mjs).
    8  Two 7-Zip AES-256 archives with encrypted file names. The passphrase is typed into 7-Zip's own
       hidden prompt (never on a command line or in a log). Each archive is tested; SHA-256 recorded.
    9  Plaintext working files (EFS-encrypted, owner-only) are overwritten and deleted.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup\Backup-ZarmanProduction.ps1 -DbHost aws-1-ap-southeast-2.pooler.supabase.com
#>
[CmdletBinding()]
param(
  # Supabase Dashboard -> Connect -> Session pooler (port 5432). Not the transaction pooler (6543).
  [Parameter(Mandatory = $true)] [string]$DbHost,
  [int]$DbPort = 5432,
  [string]$ProjectRef = 'kkibwbmufjkyqdldlkbh',
  [string]$DbUser,
  [string]$DbName = 'postgres',
  [ValidateSet('require', 'verify-ca', 'verify-full', 'disable')] [string]$SslMode = 'require',
  [string]$OutputRoot = (Join-Path $env:USERPROFILE 'ZarmanBackups'),
  [string]$PgBin,
  [string]$SevenZip = 'C:\Program Files\7-Zip\7z.exe',
  [string]$StorageEnvFile,
  [switch]$SkipStorage,
  # Opt-in: allow Supabase-managed (non-customer) tables that cannot be read to be left out. Each is listed.
  [switch]$AllowManagedExclusions,
  # Opt-in: run even though neither BitLocker nor EFS protects the temporary plaintext files.
  [switch]$AcceptUnencryptedDisk,
  [int]$RestorePort = 55432,
  # ---- Rehearsal/test aids. Refused unless -DbHost is a loopback address (never usable on production).
  [string]$RehearsalDbSecretVariable,
  [string]$RehearsalArchiveSecretVariable,
  [string[]]$TreatExtensionsAsUnavailable = @()
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ZarmanBackup.psm1') -Force -DisableNameChecking

if (-not $DbUser) { $DbUser = "postgres.$ProjectRef" }
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $StorageEnvFile) { $StorageEnvFile = Join-Path $RepoRoot '.env.local' }
$SqlDir = Join-Path $PSScriptRoot 'sql'
$Stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$Label = "zarman-prod_$Stamp"
$Target = Join-Path $OutputRoot $Label
$Work = Join-Path $Target '_work'                  # EFS-encrypted, owner-only, wiped at the end
$DbDir = Join-Path $Work 'database'
$StorageDir = Join-Path $Work 'storage'
$ClusterDir = Join-Path $Work 'restore-cluster'
$DiagDir = Join-Path $Target 'diagnostics'           # kept only on failure (EFS, owner-only)
$ReportFile = Join-Path $Target "${Label}_REPORT.txt"
$Utf8 = New-Object System.Text.UTF8Encoding $false

$Lines = New-Object System.Collections.Generic.List[string]
$Failures = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]
$Exclusions = New-Object System.Collections.Generic.List[string]
$NotRestoreTested = New-Object System.Collections.Generic.List[string]
$State = @{ ClusterStarted = $false; Archived = $false; Tools = $null; ClusterEnv = $null }

function Say([string]$Text, [string]$Color = '') {
  if ($Color) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }
  $Lines.Add($Text) | Out-Null
}
function Fail([string]$Text) { $Failures.Add($Text) | Out-Null; Say "  FAIL  $Text" 'Red' }
function Stop-Run([string]$Text) { throw [System.Exception]::new($Text) }

function Find-PgTool([string]$Name) {
  $candidates = @()
  if ($PgBin) { $candidates += (Join-Path $PgBin "$Name.exe") }
  $candidates += (Join-Path $env:USERPROFILE "pgsql\bin\$Name.exe")
  $candidates += @(Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin' -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Parent.Name -replace '\D', '') } -Descending | ForEach-Object { Join-Path $_.FullName "$Name.exe" })
  foreach ($c in $candidates) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  Stop-Run "Cannot find $Name.exe. Pass -PgBin <folder containing pg_dump.exe>."
}

function Read-HiddenSecret([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '')
}

$Rehearsal = [bool]($RehearsalDbSecretVariable -or $RehearsalArchiveSecretVariable -or $TreatExtensionsAsUnavailable.Count)
if ($Rehearsal -and -not (Test-LoopbackHost $DbHost)) {
  throw 'Rehearsal options are only accepted against a local (loopback) test database, never against production.'
}

try {
  # =========================================================================== 0. preflight
  $fullRoot = [System.IO.Path]::GetFullPath($OutputRoot)
  if ($fullRoot.StartsWith($RepoRoot, [StringComparison]::OrdinalIgnoreCase)) { Stop-Run "Refusing to write backups inside the git repository ($RepoRoot)." }
  foreach ($cloud in @($env:OneDrive, $env:OneDriveCommercial, $env:OneDriveConsumer)) {
    if ($cloud -and $fullRoot.StartsWith($cloud, [StringComparison]::OrdinalIgnoreCase)) { Stop-Run "Refusing to write into a OneDrive-synced folder ($cloud)." }
  }
  if (-not (Test-Path -LiteralPath $SevenZip)) { Stop-Run "7-Zip not found at $SevenZip." }
  $tools = @{}
  foreach ($t in @('pg_dump', 'pg_dumpall', 'pg_restore', 'psql', 'initdb', 'pg_ctl')) { $tools[$t] = Find-PgTool $t }
  $State.Tools = $tools
  $toolVersion = (Invoke-Native $tools.pg_dump @('--version')).StdOut.Trim()
  $toolMajor = [int]([regex]::Match($toolVersion, '(\d+)\.').Groups[1].Value)
  if ($toolMajor -lt 17) { Stop-Run "PostgreSQL 17+ client tools are required (found: $toolVersion)." }
  if (-not $SkipStorage) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Stop-Run 'Node.js is required for the Storage backup.' }
    if (-not (Test-Path -LiteralPath $StorageEnvFile)) { Stop-Run "Storage credentials file not found: $StorageEnvFile" }
  }
  if (-not (Test-TcpPortFree $RestorePort)) { Stop-Run "Local port $RestorePort is in use; pass -RestorePort <free port>." }

  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  if (-not (Set-OwnerOnlyAcl $Target)) { Stop-Run "Could not restrict permissions on $Target." }
  New-Item -ItemType Directory -Force -Path $Work | Out-Null
  $efs = Enable-EfsFolder $Work
  $bitlocker = (Get-BitLockerProtection $Target) -eq 1
  New-Item -ItemType Directory -Force -Path $DbDir, $StorageDir | Out-Null

  Say "Zarman Exchange production backup   $Label"
  Say "Started            $(Get-Date -Format o)"
  Say "Source             $DbUser@${DbHost}:$DbPort/$DbName  sslmode=$SslMode  (read-only)"
  Say "Tools              $toolVersion; $(Split-Path $SevenZip -Leaf) at $SevenZip"
  Say "Output folder      $Target  (owner-only permissions)"
  Say ("Plaintext at rest  EFS {0}; BitLocker {1}" -f $(if ($efs) { 'ON' } else { 'unavailable' }), $(if ($bitlocker) { 'ON' } else { 'off' }))
  if (-not $efs -and -not $bitlocker) {
    if (-not $AcceptUnencryptedDisk) { Stop-Run 'Neither EFS nor BitLocker protects the temporary plaintext. Use -OutputRoot on a BitLocker drive, or pass -AcceptUnencryptedDisk.' }
    $Warnings.Add('Temporary plaintext was not encrypted at rest (-AcceptUnencryptedDisk).') | Out-Null
  }

  # =========================================================================== secrets
  if ($RehearsalDbSecretVariable) { $dbPassword = [Environment]::GetEnvironmentVariable($RehearsalDbSecretVariable) }
  else { $dbPassword = Read-HiddenSecret 'Supabase database password (hidden)' }
  $prodEnv = @{ PGHOST = $DbHost; PGPORT = "$DbPort"; PGUSER = $DbUser; PGDATABASE = $DbName; PGSSLMODE = $SslMode
                PGPASSWORD = $dbPassword; PGCLIENTENCODING = 'UTF8'; PGAPPNAME = 'zarman-backup-readonly'; PGCONNECT_TIMEOUT = '20' }
  $log = Join-Path $DbDir 'backup.log'

  function Invoke-Sql([hashtable]$Env, [string]$SqlFile, [string]$OutFile, [string]$Database, [switch]$Unaligned) {
    $a = @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', (Join-Path $SqlDir $SqlFile))
    if ($Unaligned) { $a = @('-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', (Join-Path $SqlDir $SqlFile)) }
    if ($Database) { $a += @('-d', $Database) }
    $r = Invoke-Native $tools.psql $a -Environment $Env -StdoutFile $OutFile -StderrFile $log
    if ($r.ExitCode -ne 0) { Stop-Run "Query $SqlFile failed: $(($r.StdErr -split "`n")[0].Trim())" }
  }

  # =========================================================================== 1. connect + access
  Say ''
  Say '[1/9] Connecting and checking read access'
  $probe = Invoke-Native $tools.psql @('-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
    "SELECT current_user || ' | PostgreSQL ' || current_setting('server_version') || ' | server_version_num=' || current_setting('server_version_num')") -Environment $prodEnv
  if ($probe.ExitCode -ne 0) { Stop-Run "Cannot connect: $(($probe.StdErr -split "`n")[0].Trim())" }
  Say "      connected as $($probe.StdOut.Trim())"
  $serverMajor = [int]([regex]::Match($probe.StdOut, 'server_version_num=(\d+)').Groups[1].Value) / 10000
  if ([int][Math]::Floor($serverMajor) -gt $toolMajor) { Stop-Run "pg_dump $toolMajor is older than the server ($serverMajor)." }

  Invoke-Sql $prodEnv 'access-check.sql' (Join-Path $DbDir 'access-check.csv')
  $blocked = @(Import-Csv (Join-Path $DbDir 'access-check.csv'))
  $excludeArgs = @()
  $excludedScopes = @()
  foreach ($b in $blocked) {
    $isSchema = $b.object_name -eq '(schema)'
    $name = if ($isSchema) { "schema $($b.schema_name)" } else { "$($b.schema_name).$($b.object_name)" }
    if ($b.class -eq 'required') { Fail "cannot read $name (customer/financial/Auth/Storage data) - backup would be incomplete" ; continue }
    if (-not $AllowManagedExclusions) { Fail "cannot read Supabase-managed $name - rerun with -AllowManagedExclusions to leave it out explicitly"; continue }
    $Exclusions.Add("$name (Supabase-managed; not readable by $DbUser) - NOT BACKED UP") | Out-Null
    if ($isSchema) { $excludeArgs += "--exclude-schema=$($b.schema_name)"; $excludedScopes += $b.schema_name }
    else { $excludeArgs += "--exclude-table=$name"; $excludedScopes += $name }
  }
  if ($Failures.Count) { Stop-Run 'Required data is not readable; nothing was backed up.' }
  Say ("      every table, sequence and schema is readable{0}" -f $(if ($Exclusions.Count) { " except $($Exclusions.Count) explicitly excluded managed object(s)" } else { '' }))

  # =========================================================================== 2-4. snapshot + dump
  Say '[2/9] Production checksums before the dump'
  Invoke-Sql $prodEnv 'table-checksums.sql' (Join-Path $DbDir 'prod-checksums-before.csv')
  $before = Import-TableChecksums (Join-Path $DbDir 'prod-checksums-before.csv')

  Say '[3/9] Dumping roles and the whole database'
  $r = Invoke-Native $tools.pg_dumpall @('--roles-only', '--no-role-passwords', '-l', $DbName, '-f', (Join-Path $DbDir 'roles.sql')) -Environment $prodEnv -StderrFile $log
  if ($r.ExitCode -ne 0) { Stop-Run "pg_dumpall --roles-only failed: $(($r.StdErr -split "`n")[0].Trim())" }
  $dumpFile = Join-Path $DbDir 'full.dump'
  $dumpArgs = @('--format=custom', '--compress=6', '--create', '--no-password', '--lock-wait-timeout=30s', '--file', $dumpFile) + $excludeArgs
  $r = Invoke-Native $tools.pg_dump $dumpArgs -Environment $prodEnv -StderrFile $log
  if ($r.ExitCode -ne 0) { Stop-Run "pg_dump failed: $(($r.StdErr -split "`n")[0].Trim())" }
  Say ("      full.dump {0:N1} MB, roles.sql written" -f ((Get-Item $dumpFile).Length / 1MB))

  Say '[4/9] Production checksums after the dump, catalog fingerprint, inventories'
  Invoke-Sql $prodEnv 'table-checksums.sql' (Join-Path $DbDir 'prod-checksums-after.csv')
  Invoke-Sql $prodEnv 'catalog-fingerprint.sql' (Join-Path $DbDir 'prod-catalog-fingerprint.csv')
  Invoke-Sql $prodEnv 'extension-members.sql' (Join-Path $DbDir 'prod-extensions.csv')
  Invoke-Sql $prodEnv 'database-settings.sql' (Join-Path $DbDir 'prod-database-settings.csv')
  if (-not $SkipStorage) { Invoke-Sql $prodEnv 'storage-inventory.sql' (Join-Path $StorageDir 'storage-inventory.json') -Unaligned }
  $dbPassword = $null; $prodEnv.PGPASSWORD = $null           # production access ends here (Storage uses the API)
  $after = Import-TableChecksums (Join-Path $DbDir 'prod-checksums-after.csv')
  $prodFingerprint = Import-Fingerprint (Join-Path $DbDir 'prod-catalog-fingerprint.csv')
  $extensions = @(Import-Csv (Join-Path $DbDir 'prod-extensions.csv'))
  $dbSettings = @(Import-Csv (Join-Path $DbDir 'prod-database-settings.csv'))
  $rowsTotal = ($after.Values | Measure-Object -Property Rows -Sum).Sum
  Say "      $($after.Count) tables / $rowsTotal rows checksummed; $($prodFingerprint.Count) catalog objects fingerprinted"

  # =========================================================================== 5. dump completeness
  Say '[5/9] Checking the dump is complete'
  $toc = Invoke-Native $tools.pg_restore @('--list', $dumpFile)
  if ($toc.ExitCode -ne 0) { Stop-Run "full.dump is not a readable archive: $(($toc.StdErr -split "`n")[0].Trim())" }
  $tocLines = @($toc.StdOut -split "`r?`n")
  [System.IO.File]::WriteAllLines((Join-Path $DbDir 'full.dump.toc.txt'), [string[]]$tocLines, $Utf8)
  $excludedTables = @($after.Keys | Where-Object { Test-InScope $_ $excludedScopes })
  $missingData = @(Find-MissingTableData -TocLines $tocLines -Tables @($after.Keys | Where-Object { $excludedTables -notcontains $_ }))
  foreach ($m in $missingData) { Fail "table $m has no data section in full.dump" }
  if ($missingData.Count) { Stop-Run 'The dump is incomplete.' }
  # Database-level entries only show in create mode; every production ALTER DATABASE ... SET must be in it.
  $createSql = (Invoke-Native $tools.pg_restore @('--create', '--schema-only', '--file', '-', $dumpFile)).StdOut
  $settingRows = @($dbSettings | Where-Object { $_.k -like 'setting:*' })
  foreach ($s in $settingRows) {
    $name = $s.k.Substring(8)
    if ($createSql -notmatch ('(?m)^ALTER DATABASE \S+ SET "?' + [regex]::Escape($name) + '"? TO ')) { Fail "database setting $name is missing from the dump" }
  }
  $hasDbProps = ($settingRows.Count -eq 0) -or (@($Failures | Where-Object { $_ -like 'database setting*' }).Count -eq 0)
  $createSql = $null
  $r = Invoke-Native $tools.pg_restore @('--schema-only', '--file', (Join-Path $DbDir 'schema.sql'), $dumpFile)
  if ($r.ExitCode -ne 0) { Stop-Run "Could not extract schema.sql: $(($r.StdErr -split "`n")[0].Trim())" }
  if ($Failures.Count) { Stop-Run 'The dump is incomplete.' }
  Say "      all $($after.Count - $excludedTables.Count) tables have data sections; $($settingRows.Count) database-level setting(s) present: $hasDbProps"

  # =========================================================================== 6. restore test
  Say '[6/9] Restore test (temporary local PostgreSQL 17, 127.0.0.1 only)'
  $restoreLog = Join-Path $DbDir 'restore-test.log'
  $clusterSecret = New-RandomSecret
  $pwFile = Join-Path $Work 'cluster.pw'
  [System.IO.File]::WriteAllText($pwFile, $clusterSecret, $Utf8)
  # Bootstrapped as "supabase_admin", exactly like a Supabase cluster: since PostgreSQL 16 only the
  # bootstrap superuser can be named as grantor of the "GRANTED BY supabase_admin" memberships in roles.sql.
  $r = Invoke-Native $tools.initdb @('-D', $ClusterDir, '-U', 'supabase_admin', '--pwfile', $pwFile, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C', '--no-instructions') -StderrFile $restoreLog
  Remove-PlaintextSecurely $pwFile | Out-Null
  if ($r.ExitCode -ne 0) { Stop-Run "initdb failed: $(($r.StdErr -split "`n")[0].Trim())" }
  [System.IO.File]::AppendAllText((Join-Path $ClusterDir 'postgresql.conf'), "`nlisten_addresses = '127.0.0.1'`nport = $RestorePort`nfsync = off`nmax_connections = 20`n", $Utf8)
  $ctlExit = Invoke-ConsoleProcess $tools.pg_ctl @('-D', $ClusterDir, '-l', (Join-Path $Work 'restore-server.log'), '-w', '-t', '90', 'start') -StdoutFile (Join-Path $Work 'pg_ctl-start.out') -StderrFile (Join-Path $Work 'pg_ctl-start.err')
  if ($ctlExit -ne 0) { Stop-Run 'The local restore-test server did not start.' }
  $State.ClusterStarted = $true
  $localEnv = @{ PGHOST = '127.0.0.1'; PGPORT = "$RestorePort"; PGUSER = 'supabase_admin'; PGPASSWORD = $clusterSecret; PGCLIENTENCODING = 'UTF8'; PGSSLMODE = 'disable' }
  $State.ClusterEnv = $localEnv

  # roles.sql must apply with zero errors (all roles, attributes, memberships, settings). The only line
  # not replayed is "CREATE ROLE supabase_admin;" because the bootstrap role already exists; its
  # attributes and settings are still applied by the ALTER ROLE statements that follow it.
  $rolesSql = [System.IO.File]::ReadAllLines((Join-Path $DbDir 'roles.sql'), $Utf8)
  $bootstrapCreate = @($rolesSql | Where-Object { $_ -ceq 'CREATE ROLE supabase_admin;' })
  if ($bootstrapCreate.Count -gt 1) { Stop-Run 'roles.sql contains an unexpected repeated CREATE ROLE supabase_admin.' }
  $rolesForTest = Join-Path $DbDir 'roles.restore-test.sql'
  [System.IO.File]::WriteAllLines($rolesForTest, [string[]]@($rolesSql | Where-Object { $_ -cne 'CREATE ROLE supabase_admin;' }), $Utf8)
  $r = Invoke-Native $tools.psql @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres', '-f', $rolesForTest) -Environment $localEnv -StderrFile $restoreLog
  if ($r.ExitCode -ne 0) { Stop-Run "roles.sql did not apply cleanly in the restore test: $(($r.StdErr -split "`n")[0].Trim())" }

  $provider = ($dbSettings | Where-Object { $_.k -eq 'locale_provider' }).v
  $icu = ($dbSettings | Where-Object { $_.k -eq 'icu_locale' }).v
  $createDb = if ($provider -eq 'i' -and $icu) { "CREATE DATABASE zarman_restore_test TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE '$icu' LOCALE 'C'" }
              else { "CREATE DATABASE zarman_restore_test TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'" }
  $r = Invoke-Native $tools.psql @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres', '-c', $createDb) -Environment $localEnv -StderrFile $restoreLog
  if ($r.ExitCode -ne 0) { Stop-Run "Could not create the restore-test database: $(($r.StdErr -split "`n")[0].Trim())" }

  # Extensions the local server cannot install are Supabase-only; their entries are left out by catalog identity.
  $r = Invoke-Native $tools.psql @('-X', '-A', '-t', '-d', 'postgres', '-c', 'SELECT name FROM pg_available_extensions ORDER BY 1') -Environment $localEnv
  $localAvailable = @($r.StdOut -split "`r?`n" | Where-Object { $_ })
  $prodExtensions = @($extensions | Where-Object { $_.member_kind -eq 'extension' })
  $unavailable = @($prodExtensions | Where-Object { $localAvailable -notcontains $_.extension -or $TreatExtensionsAsUnavailable -contains $_.extension } | ForEach-Object { $_.extension })
  $selection = Select-RestoreList -TocLines $tocLines -Members $extensions -UnavailableExtensions $unavailable
  $listFile = Join-Path $DbDir 'restore-test.list'
  [System.IO.File]::WriteAllLines($listFile, [string[]]$selection.Lines, $Utf8)
  foreach ($x in $selection.Excluded) { if ($x.Reason -notlike 'database-level*') { $NotRestoreTested.Add("$($x.Entry)  [$($x.Reason)]") | Out-Null } }

  $r = Invoke-Native $tools.pg_restore @('--exit-on-error', '--single-transaction', '--no-password', '-L', $listFile, '-d', 'zarman_restore_test', $dumpFile) -Environment $localEnv -StderrFile $restoreLog
  if ($r.ExitCode -ne 0 -or $r.StdErr -match '(?im)^pg_restore: error') {
    $where = [regex]::Match($r.StdErr, 'pg_restore: from TOC entry [^\r\n]+').Value
    Stop-Run "pg_restore failed (exit $($r.ExitCode)) $where - full error text is in restore-test.log (diagnostics folder)."
  }
  Say "      roles and database restored with zero errors ($($selection.Excluded.Count) TOC entries not applicable locally, listed below)"

  Invoke-Sql $localEnv 'table-checksums.sql' (Join-Path $DbDir 'restored-checksums.csv') -Database 'zarman_restore_test'
  Invoke-Sql $localEnv 'catalog-fingerprint.sql' (Join-Path $DbDir 'restored-catalog-fingerprint.csv') -Database 'zarman_restore_test'
  $restored = Import-TableChecksums (Join-Path $DbDir 'restored-checksums.csv')
  $notRestorableTables = @($extensions | Where-Object { $unavailable -contains $_.extension -and $_.member_kind -eq 'table' } | ForEach-Object { "$($_.schema_name).$($_.member_name)" })
  $cmpData = Compare-TableChecksums -Before $before -After $after -Restored $restored -Excluded $excludedTables -NotRestorable $notRestorableTables
  foreach ($f in $cmpData.Failures) { Fail $f }
  foreach ($s in $cmpData.Skipped) { $NotRestoreTested.Add("table data $s") | Out-Null }
  $cmpCatalog = Compare-Fingerprint -Production $prodFingerprint -Restored (Import-Fingerprint (Join-Path $DbDir 'restored-catalog-fingerprint.csv')) -ExcludedScopes $excludedScopes
  if ($cmpCatalog.Excluded) { $NotRestoreTested.Add("$($cmpCatalog.Excluded) catalog object(s) inside the excluded scope(s) above") | Out-Null }
  foreach ($f in $cmpCatalog.Failures) { Fail "catalog: $f" }
  foreach ($a in $cmpCatalog.AclNotDumped) { $NotRestoreTested.Add("$a - privileges (owner matches); they equal the extension's initial privileges, which pg_dump never dumps and Supabase recreates") | Out-Null }
  Say "      data: $($cmpData.Identical.Count) tables identical to production (row count + content checksum), $($cmpData.Changed.Count) changed while dumping (within range)"
  foreach ($c in $cmpData.Changed) { Say "            changed during dump: $c" }
  Say "      catalog: $($cmpCatalog.Compared) objects compared by definition and permissions, $($cmpCatalog.Failures.Count) differences"
  if ($Failures.Count) { Stop-Run 'The restored copy does not match production.' }

  # =========================================================================== 7. storage
  $storageSummary = $null
  if ($SkipStorage) {
    Say '[7/9] Storage: SKIPPED (-SkipStorage)'
  } else {
    Say '[7/9] Storage: downloading and verifying every file'
    $node = (Get-Command node).Source
    $r = Invoke-Native $node @((Join-Path $PSScriptRoot 'backup-storage.mjs'), '--inventory', (Join-Path $StorageDir 'storage-inventory.json'), '--out', $StorageDir, '--env', $StorageEnvFile) -StderrFile (Join-Path $StorageDir 'storage-stderr.log')
    $summaryLine = @($r.StdOut -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') }) | Select-Object -Last 1
    if (-not $summaryLine) { Stop-Run "Storage backup did not complete (exit $($r.ExitCode)): $(($r.StdErr -split "`n")[0].Trim())" }
    $storageSummary = $summaryLine | ConvertFrom-Json
    foreach ($p in $storageSummary.buckets.PSObject.Properties) { Say ("      bucket {0}: {1}/{2} files verified, {3:N0} bytes" -f $p.Name, $p.Value.verified, $p.Value.objects, $p.Value.bytes) }
    foreach ($p in $storageSummary.failure_reasons.PSObject.Properties) { Fail "storage: $($p.Value) x $($p.Name)" }
    if ($storageSummary.warnings -gt 0) { $Warnings.Add("$($storageSummary.warnings) Storage file(s) have a multipart ETag: verified by size and listing only, SHA-256 recorded.") | Out-Null }
    if ($r.ExitCode -ne 0 -or $Failures.Count -or $storageSummary.verified -ne $storageSummary.expected) { Stop-Run 'Storage verification failed.' }
    Say "      $($storageSummary.verified)/$($storageSummary.expected) files verified (size, MD5 = ETag, content type, SHA-256 read-back)"
  }

  # =========================================================================== 8. encrypt
  Say '[8/9] Encrypting (7-Zip AES-256, encrypted file names)'
  $passArg = '-p'
  if ($RehearsalArchiveSecretVariable) { $passArg = "-p$([Environment]::GetEnvironmentVariable($RehearsalArchiveSecretVariable))" }
  else {
    Say '      7-Zip will ask for the passphrase (input hidden). Use ONE long passphrase for both archives' 'Yellow'
    Say '      and save it in your password manager first; it cannot be recovered.' 'Yellow'
  }
  $sets = @(, @('database', $DbDir))
  if (-not $SkipStorage) { $sets += , @('storage', $StorageDir) }
  $archives = @()
  foreach ($set in $sets) {
    $archive = Join-Path $Target "${Label}_$($set[0]).7z"
    $fileCount = @(Get-ChildItem -LiteralPath $set[1] -Recurse -File).Count
    Write-Host ''
    Write-Host "      Creating $([IO.Path]::GetFileName($archive)): at 'Enter password' type the passphrase, Enter; at 'Verify password' type it again, Enter." -ForegroundColor Cyan
    & $SevenZip a -t7z -mhe=on -mx=5 -bsp0 $passArg $archive (Join-Path $set[1] '*')
    if ($LASTEXITCODE -ne 0) { Stop-Run "7-Zip could not create $archive (exit $LASTEXITCODE)." }
    if ($RehearsalArchiveSecretVariable) {
      # Automated rehearsal: output captured so the file count can be checked too.
      $testOut = Join-Path $Work "7z-test-$($set[0]).txt"
      $testExit = Invoke-ConsoleProcess $SevenZip @('t', $passArg, $archive) -StdoutFile $testOut -StderrFile "$testOut.err"
      $testText = (Get-Content -LiteralPath $testOut -Raw) + (Get-Content -LiteralPath "$testOut.err" -Raw -ErrorAction SilentlyContinue)
      $reported = [regex]::Match($testText, '(?m)^Files:\s*(\d+)')
      $nFiles = if ($reported.Success) { [int]$reported.Groups[1].Value } elseif ($testText -match 'Everything is Ok') { 1 } else { -1 }
      if ($testExit -ne 0 -or $testText -notmatch 'Everything is Ok' -or $nFiles -ne $fileCount) {
        Stop-Run "Archive test failed for $([IO.Path]::GetFileName($archive)) (exit $testExit; files $nFiles of $fileCount). Wrong passphrase or damaged archive."
      }
    } else {
      # Interactive: 7-Zip must own the console to show and read its password prompt, so its output is
      # not captured. Its exit code is 0 only if the passphrase is right and every file's CRC checks out.
      $testExit = -1
      for ($attempt = 1; $attempt -le 3 -and $testExit -ne 0; $attempt++) {
        Write-Host "      Testing $([IO.Path]::GetFileName($archive)) (attempt $attempt of 3): at 'Enter password' type the passphrase, Enter." -ForegroundColor Cyan
        & $SevenZip t $archive
        $testExit = $LASTEXITCODE
        if ($testExit -ne 0 -and $attempt -lt 3) { Write-Host '      Test did not pass (wrong passphrase?). Try again.' -ForegroundColor Yellow }
      }
      if ($testExit -ne 0) { Stop-Run "Archive test failed for $([IO.Path]::GetFileName($archive)) (7-Zip exit $testExit). Wrong passphrase or damaged archive." }
    }
    Say ("      {0}: {1:N1} MB, {2} files, integrity test OK" -f [IO.Path]::GetFileName($archive), ((Get-Item $archive).Length / 1MB), $fileCount)
    $archives += $archive
  }
  $sums = foreach ($a in $archives) { $h = Get-FileHash -Algorithm SHA256 -LiteralPath $a; "$($h.Hash.ToLower())  $([IO.Path]::GetFileName($a))" }
  [System.IO.File]::WriteAllLines((Join-Path $Target "${Label}_SHA256SUMS.txt"), [string[]]$sums, $Utf8)
  $State.Archived = $true
}
catch {
  if ($_.Exception.Message) { $Failures.Add($_.Exception.Message) | Out-Null; Say "  FAIL  $($_.Exception.Message)" 'Red' }
}
finally {
  $dbPassword = $null
  if ($State.ClusterStarted) {
    $null = Invoke-ConsoleProcess $State.Tools.pg_ctl @('-D', $ClusterDir, '-m', 'immediate', '-w', 'stop') -StdoutFile (Join-Path $Work 'pg_ctl-stop.out') -StderrFile (Join-Path $Work 'pg_ctl-stop.err')
  }
  # On failure keep only the logs (EFS-encrypted, owner-only) for diagnosis; data files are always wiped.
  if (-not $State.Archived -and (Test-Path -LiteralPath $DbDir)) {
    New-Item -ItemType Directory -Force -Path $DiagDir | Out-Null
    $null = Enable-EfsFolder $DiagDir
    foreach ($f in @('backup.log', 'restore-test.log', 'access-check.csv', 'restore-test.list')) {
      $src = Join-Path $DbDir $f; if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $DiagDir }
    }
    $src = Join-Path $Work 'restore-server.log'; if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $DiagDir }
  }
  if (Test-Path -LiteralPath $Work) {
    $wiped = Remove-PlaintextSecurely $Work
    if (Test-Path -LiteralPath $Work) { Say "WARNING: could not delete $Work - delete it manually now." 'Red' }
    else { $Lines.Add("Plaintext          $wiped working file(s) overwritten and deleted") | Out-Null }
  }

  # =========================================================================== 9. report
  $result = if ($Failures.Count) { 'FAILED' }
            elseif ($Exclusions.Count) { 'PASS WITH EXCLUSIONS' }
            elseif ($SkipStorage) { 'PASS - DATABASE ONLY (Storage skipped)' }
            elseif ($Warnings.Count) { 'PASS WITH WARNINGS' }
            else { 'PASS' }
  $out = New-Object System.Collections.Generic.List[string]
  $out.Add("RESULT: $result") | Out-Null
  $out.Add('') | Out-Null
  $out.AddRange($Lines)
  $out.Add('') | Out-Null
  if ($Failures.Count) { $out.Add('FAILURES') | Out-Null; foreach ($f in $Failures) { $out.Add("  - $f") | Out-Null }; $out.Add('') | Out-Null
    if (Test-Path -LiteralPath $DiagDir) { $out.Add("Diagnostics (EFS-encrypted logs, may contain data fragments): $DiagDir - delete after review.") | Out-Null; $out.Add('') | Out-Null } }
  if ($Warnings.Count) { $out.Add('WARNINGS') | Out-Null; foreach ($w in $Warnings) { $out.Add("  - $w") | Out-Null }; $out.Add('') | Out-Null }
  $out.Add('EXCLUDED FROM THE BACKUP') | Out-Null
  if ($Exclusions.Count) { foreach ($x in $Exclusions) { $out.Add("  - $x") | Out-Null } } else { $out.Add('  none - every table, sequence and schema was dumped') | Out-Null }
  $out.Add('') | Out-Null
  $out.Add('IN THE BACKUP BUT NOT RESTORE-TESTED LOCALLY (Supabase-only extensions; Supabase provides them)') | Out-Null
  if ($NotRestoreTested.Count) { foreach ($x in $NotRestoreTested) { $out.Add("  - $x") | Out-Null } } else { $out.Add('  none') | Out-Null }
  $out.Add('') | Out-Null
  $out.Add('WHAT THIS BACKUP IS - AND IS NOT') | Out-Null
  foreach ($l in @(
    'A PASS means: a verified, encrypted copy of the production DATABASE (every schema incl. auth and storage metadata,',
    'all rows, RLS policies, functions, triggers, grants, publications, roles without passwords) and of every STORAGE FILE.',
    'Restoring it proved that the data and catalog reproduce exactly in PostgreSQL 17.',
    '',
    'It is NOT a turnkey clone of the Supabase project. Restoring into a new project needs these separately:',
    '  - Role passwords (Supabase never exports them; new ones are set on the new project).',
    '  - Auth configuration: providers, redirect URLs, SMTP, email templates, MFA/password policy, JWT signing keys.',
    '    Users, password hashes, identities and MFA factors ARE in the dump; sessions/refresh tokens are,',
    '    but become invalid under a new project''s JWT keys (users sign in again).',
    '  - API keys (anon/publishable, service role) and the app''s environment variables (e.g. Vercel).',
    '  - Storage files must be uploaded through the Storage API to the same bucket/path; storage.objects rows',
    '    in the dump only describe them. Bucket settings are in storage.buckets.',
    '  - Platform settings: network restrictions, SSL enforcement, custom domains, compute size, PITR/daily',
    '    backups, logs, Realtime/Edge Function settings, Vault encryption key (vault.secrets is empty).',
    '  - Supabase-managed extensions listed above are installed by the platform, not from this dump.'
  )) { $out.Add($l) | Out-Null }
  $out.Add('') | Out-Null
  $out.Add("Finished           $(Get-Date -Format o)") | Out-Null
  if (Test-Path -LiteralPath $Target) { [System.IO.File]::WriteAllLines($ReportFile, $out.ToArray(), $Utf8) }

  Write-Host ''
  $color = if ($result -like 'PASS*') { 'Green' } else { 'Red' }
  Write-Host "RESULT: $result" -ForegroundColor $color
  if (Test-Path -LiteralPath $ReportFile) { Write-Host "Report: $ReportFile" }
  if ($Failures.Count) { exit 1 }
}

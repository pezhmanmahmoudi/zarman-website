<#
.SYNOPSIS
  Validates the backup kit locally with synthetic data only (never touches production).
  Part A: unit tests of the parsing/comparison logic.
  Part B: end-to-end rehearsals of Backup-ZarmanProduction.ps1 against a throw-away local "fake
          Supabase" PostgreSQL 17 cluster and a mock Storage API, including failure scenarios.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup\tests\Test-BackupKit.ps1
#>
param([switch]$UnitOnly, [string]$PgBin = (Join-Path $env:USERPROFILE 'pgsql\bin'))

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$KitDir = Resolve-Path (Join-Path $PSScriptRoot '..')
Import-Module (Join-Path $KitDir 'ZarmanBackup.psm1') -Force -DisableNameChecking
$script:Passed = 0
$script:Failed = New-Object System.Collections.Generic.List[string]

function Check([string]$Name, [bool]$Condition, [string]$Detail = '') {
  if ($Condition) { $script:Passed++; Write-Host "  ok    $Name" -ForegroundColor Green }
  else { $script:Failed.Add("$Name $Detail") | Out-Null; Write-Host "  FAIL  $Name $Detail" -ForegroundColor Red }
}
function T([int64]$rows, [string]$md5) { [pscustomobject]@{ Rows = $rows; Md5 = $md5 } }

# =============================================================================== Part A: unit tests
Write-Host 'Part A - unit tests'

$e = Get-TocEntry '4236; 0 0 ACL extensions FUNCTION hypopg_reset() postgres'
Check 'TOC: parses ACL entry' ($e.Desc -eq 'ACL' -and $e.Namespace -eq 'extensions' -and $e.Rest -eq 'FUNCTION hypopg_reset() postgres')
$e = Get-TocEntry '5001; 0 17208 TABLE DATA vault secrets supabase_admin'
Check 'TOC: parses multi-word TABLE DATA entry' ($e.Desc -eq 'TABLE DATA' -and $e.Namespace -eq 'vault' -and $e.Oid -eq 17208)
$e = Get-TocEntry '13; 0 0 DATABASE PROPERTIES - postgres postgres'
Check 'TOC: parses DATABASE PROPERTIES' ($e.Desc -eq 'DATABASE PROPERTIES')
Check 'TOC: comment lines are not entries' ($null -eq (Get-TocEntry '; Archive created at 2026-11-13'))

$toc = @(
  ';', '; Selected TOC Entries:', ';',
  '3; 2615 16385 SCHEMA - extensions postgres',
  '4; 3079 16400 EXTENSION - hypopg ',
  '5; 0 0 COMMENT - EXTENSION hypopg ',
  '6; 3079 16410 EXTENSION - pgcrypto ',
  '7; 1255 16420 FUNCTION extensions grant_pg_net_access() supabase_admin',
  '8; 0 0 ACL extensions FUNCTION hypopg_reset() postgres',
  '9; 0 0 ACL extensions FUNCTION hypopg_reset_index() postgres',
  '10; 0 0 ACL public FUNCTION hypopg_reset() postgres',
  '11; 0 17208 TABLE DATA vault secrets supabase_admin',
  '12; 1262 5 DATABASE - postgres postgres',
  '13; 0 0 DATABASE PROPERTIES - postgres postgres',
  '14; 0 0 ACL - SCHEMA vault supabase_admin',
  '15; 0 16999 TABLE DATA public profiles postgres',
  '16; 0 0 ACL extensions TABLE pg_stat_statements postgres',
  '17; 1255 17208 FUNCTION public set_updated_at() postgres'
)
$members = @(
  [pscustomobject]@{ extension = 'hypopg'; member_kind = 'extension'; schema_name = 'extensions'; member_name = 'hypopg'; member_oid = '16400'; member_classid = '3079' },
  [pscustomobject]@{ extension = 'hypopg'; member_kind = 'function'; schema_name = 'extensions'; member_name = 'hypopg_reset'; member_oid = '16401'; member_classid = '1255' },
  [pscustomobject]@{ extension = 'hypopg'; member_kind = 'function'; schema_name = 'extensions'; member_name = 'hypopg_reset_index'; member_oid = '16402'; member_classid = '1255' },
  [pscustomobject]@{ extension = 'supabase_vault'; member_kind = 'extension'; schema_name = 'vault'; member_name = 'supabase_vault'; member_oid = '16500'; member_classid = '3079' },
  [pscustomobject]@{ extension = 'supabase_vault'; member_kind = 'table'; schema_name = 'vault'; member_name = 'secrets'; member_oid = '17208'; member_classid = '1259' },
  [pscustomobject]@{ extension = 'pg_stat_statements'; member_kind = 'view'; schema_name = 'extensions'; member_name = 'pg_stat_statements'; member_oid = '16601'; member_classid = '1259' }
)
$sel = Select-RestoreList -TocLines $toc -Members $members -UnavailableExtensions @('hypopg', 'supabase_vault')
$excludedIds = @($sel.Lines | Where-Object { $_ -like ';EXCLUDED*' } | ForEach-Object { [int](($_ -replace '^;EXCLUDED\s*', '') -split ';')[0] })
Check 'restore list: excludes exactly the Supabase-only and database-level entries' ((($excludedIds | Sort-Object) -join ',') -eq '4,5,8,9,11,12,13') "got $($excludedIds -join ',')"
Check 'restore list: keeps a same-named function in another schema' (@($sel.Lines | Where-Object { $_ -eq '10; 0 0 ACL public FUNCTION hypopg_reset() postgres' }).Count -eq 1)
Check 'restore list: keeps grants on members of installable extensions' (@($sel.Lines | Where-Object { $_ -like '16;*' }).Count -eq 1)
Check 'restore list: keeps a public function whose OID equals an extension table OID (other catalog)' (@($sel.Lines | Where-Object { $_ -like '17;*' }).Count -eq 1)
Check 'restore list: every exclusion has a reason' (@($sel.Excluded | Where-Object { -not $_.Reason }).Count -eq 0 -and $sel.Excluded.Count -eq 7)
Check 'dump completeness: finds tables without a data section' ((@(Find-MissingTableData -TocLines $toc -Tables @('public.profiles', 'public.transactions')) -join ',') -eq 'public.transactions')

$b = @{ 'public.a' = (T 5 'x'); 'public.b' = (T 3 'y'); 'auth.refresh_tokens' = (T 10 'r1'); 'vault.secrets' = (T 0 'e') }
$a = @{ 'public.a' = (T 5 'x'); 'public.b' = (T 3 'y'); 'auth.refresh_tokens' = (T 12 'r2'); 'vault.secrets' = (T 0 'e') }
$c = Compare-TableChecksums -Before $b -After $a -Restored @{ 'public.a' = (T 5 'x'); 'public.b' = (T 3 'y'); 'auth.refresh_tokens' = (T 11 'r3') } -NotRestorable @('vault.secrets')
Check 'checksums: identical tables pass, a table that changed during the dump passes within range' ($c.Failures.Count -eq 0 -and $c.Identical.Count -eq 2 -and $c.Changed.Count -eq 1 -and $c.Skipped.Count -eq 1)
$c = Compare-TableChecksums -Before $b -After $a -Restored @{ 'public.a' = (T 5 'DIFFERENT'); 'public.b' = (T 3 'y'); 'auth.refresh_tokens' = (T 12 'r2') } -NotRestorable @('vault.secrets')
Check 'checksums: same row count but different content fails' ($c.Failures.Count -eq 1 -and $c.Failures[0] -match 'checksum mismatch')
$c = Compare-TableChecksums -Before $b -After $a -Restored @{ 'public.a' = (T 5 'x'); 'auth.refresh_tokens' = (T 12 'r2') } -NotRestorable @('vault.secrets')
Check 'checksums: missing table fails' ($c.Failures.Count -eq 1 -and $c.Failures[0] -match 'public.b is missing')
$c = Compare-TableChecksums -Before $b -After $a -Restored @{ 'public.a' = (T 5 'x'); 'public.b' = (T 3 'y'); 'auth.refresh_tokens' = (T 99 'z') } -NotRestorable @('vault.secrets')
Check 'checksums: changed table outside the before/after range fails' ($c.Failures.Count -eq 1)
$c = Compare-TableChecksums -Before $b -After $a -Restored @{ 'public.a' = (T 5 'x'); 'public.b' = (T 3 'y'); 'auth.refresh_tokens' = (T 12 'r2'); 'public.extra' = (T 1 'q') } -NotRestorable @('vault.secrets')
Check 'checksums: unexpected extra table fails' ($c.Failures.Count -eq 1 -and $c.Failures[0] -match 'public.extra')
$c = Compare-TableChecksums -Before $b -After $a -Restored @{ 'public.a' = (T 5 'x'); 'auth.refresh_tokens' = (T 12 'r2') } -Excluded @('public.b') -NotRestorable @('vault.secrets')
Check 'checksums: explicitly excluded table is reported, not failed' ($c.Failures.Count -eq 0 -and ($c.Skipped -join ' ') -match 'public.b \(excluded')

$p = @([pscustomobject]@{ kind = 'policy'; identity = 'public.t.p1'; detail = 'cmd=r using=abc' }, [pscustomobject]@{ kind = 'function'; identity = 'public.f()'; detail = 'def=1 acl=anon:EXECUTE' })
Check 'fingerprint: identical catalogs pass' ((Compare-Fingerprint -Production $p -Restored $p).Failures.Count -eq 0)
$r = @([pscustomobject]@{ kind = 'policy'; identity = 'public.t.p1'; detail = 'cmd=r using=abd' }, [pscustomobject]@{ kind = 'function'; identity = 'public.f()'; detail = 'def=1 acl=anon:EXECUTE' })
Check 'fingerprint: changed policy expression fails' ((Compare-Fingerprint -Production $p -Restored $r).Failures[0] -eq 'different policy public.t.p1')
$r = @([pscustomobject]@{ kind = 'function'; identity = 'public.f()'; detail = 'def=1 acl=ANON:EXECUTE' })
$cf = Compare-Fingerprint -Production $p -Restored $r
Check 'fingerprint: missing object and case-different grant both fail' ($cf.Failures.Count -eq 2)
$px = @($p) + @([pscustomobject]@{ kind = 'relation'; identity = 'realtime.schema_migrations'; detail = 'x' }, [pscustomobject]@{ kind = 'index'; identity = 'realtime.schema_migrations.schema_migrations_pkey'; detail = 'y' }, [pscustomobject]@{ kind = 'relation'; identity = 'realtime.schema_migrations_old'; detail = 'z' })
$cf = Compare-Fingerprint -Production $px -Restored $p -ExcludedScopes @('realtime.schema_migrations')
Check 'fingerprint: objects inside an explicit exclusion are counted, a similarly named table is still compared' ($cf.Excluded -eq 2 -and $cf.Failures.Count -eq 1 -and $cf.Failures[0] -eq 'missing relation realtime.schema_migrations_old')
$sp = @([pscustomobject]@{ kind = 'schema'; identity = 'graphql'; detail = 'owner=supabase_admin acl=anon:USAGE,supabase_admin:CREATE,supabase_admin:USAGE acl_source=extension-initial' })
$cf = Compare-Fingerprint -Production $sp -Restored @([pscustomobject]@{ kind = 'schema'; identity = 'graphql'; detail = 'owner=supabase_admin acl=supabase_admin:CREATE,supabase_admin:USAGE' })
Check 'fingerprint: extension-initial schema privileges (never dumped) are reported, not failed' ($cf.Failures.Count -eq 0 -and $cf.AclNotDumped.Count -eq 1)
$cf = Compare-Fingerprint -Production $sp -Restored @([pscustomobject]@{ kind = 'schema'; identity = 'graphql'; detail = 'owner=postgres acl=postgres:CREATE,postgres:USAGE' })
Check 'fingerprint: extension-initial schema with a different owner still fails' ($cf.Failures.Count -eq 1 -and $cf.AclNotDumped.Count -eq 0)
$cf = Compare-Fingerprint -Production @([pscustomobject]@{ kind = 'schema'; identity = 'public'; detail = 'owner=pg_database_owner acl=anon:USAGE' }) -Restored @([pscustomobject]@{ kind = 'schema'; identity = 'public'; detail = 'owner=pg_database_owner acl=' })
Check 'fingerprint: an ordinary schema with different privileges still fails' ($cf.Failures.Count -eq 1)

$scratch = Join-Path $env:TEMP ('zarman-kit-unit-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path "$scratch\a\b" -Force | Out-Null
Check 'EFS: working folders are encrypted at rest' (Enable-EfsFolder $scratch)
[System.IO.File]::WriteAllText("$scratch\a\b\secret.txt", 'synthetic plaintext')
Check 'EFS: files created inside inherit encryption' ([bool]((Get-Item "$scratch\a\b\secret.txt").Attributes -band [IO.FileAttributes]::Encrypted))
Check 'ACL: owner-only permissions applied' (Set-OwnerOnlyAcl $scratch)
$aclRules = @((Get-Acl $scratch).Access | Where-Object { -not $_.IsInherited })
Check 'ACL: only the current user is granted access' ($aclRules.Count -eq 1 -and $aclRules[0].IdentityReference.Value -eq [Security.Principal.WindowsIdentity]::GetCurrent().Name)
Check 'wipe: plaintext overwritten and deleted' ((Remove-PlaintextSecurely $scratch) -eq 1 -and -not (Test-Path $scratch))

if ($UnitOnly) {
  Write-Host ''; Write-Host "Unit tests: $script:Passed passed, $($script:Failed.Count) failed"
  if ($script:Failed.Count) { exit 1 } else { exit 0 }
}

# =============================================================================== Part B: end-to-end
Write-Host ''
Write-Host 'Part B - end-to-end rehearsals (synthetic database + mock Storage)'
$Root = Join-Path $env:TEMP ('zarman-kit-e2e-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $Root | Out-Null
$null = Enable-EfsFolder $Root
$SourceDir = Join-Path $Root 'fake-supabase'
$SourcePort = 55431
$AdminPw = 'synthetic-superuser-' + [guid]::NewGuid().ToString('N')
$env:ZARMAN_TEST_DB_PW = 'synthetic-rehearsal-db-password'
$env:ZARMAN_TEST_ARCHIVE_PW = 'Synthetic-Archive-Passphrase-' + [guid]::NewGuid().ToString('N')
$adminEnv = @{ PGHOST = '127.0.0.1'; PGPORT = "$SourcePort"; PGUSER = 'supabase_admin'; PGPASSWORD = $AdminPw; PGDATABASE = 'postgres'; PGCLIENTENCODING = 'UTF8' }
$Mock = $null
$BackupScript = Join-Path $KitDir 'Backup-ZarmanProduction.ps1'
$SevenZip = 'C:\Program Files\7-Zip\7z.exe'

function Pg([string]$Name) { Join-Path $PgBin "$Name.exe" }
function Sql([string]$Command) {
  $r = Invoke-Native (Pg 'psql') @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', $Command) -Environment $adminEnv
  if ($r.ExitCode -ne 0) { throw "fixture SQL failed: $($r.StdErr)" }
}
function Start-Mock([string[]]$Flags = @()) {
  if ($script:Mock) { Stop-Process -Id $script:Mock.Id -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 300 }
  $log = Join-Path $Root ("mock-" + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.log')
  $argList = @("`"$(Join-Path $PSScriptRoot 'mock-storage-server.mjs')`"", '--fixture', "`"$(Join-Path $Root 'storage-fixture.json')`"") + $Flags
  $script:Mock = Start-Process -FilePath (Get-Command node).Source -ArgumentList $argList -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  for ($i = 0; $i -lt 50; $i++) {
    Start-Sleep -Milliseconds 200
    $m = [regex]::Match((Get-Content $log -Raw -ErrorAction SilentlyContinue) + '', 'LISTENING (\d+)')
    if ($m.Success) {
      [System.IO.File]::WriteAllText((Join-Path $Root 'storage.env'), "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$($m.Groups[1].Value)`nSUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key`n")
      return
    }
  }
  throw 'mock Storage server did not start'
}
function Invoke-Backup([string]$Name, [string[]]$Extra = @(), [string]$HostName = '127.0.0.1') {
  $out = Join-Path $Root "out-$Name"
  $log = Join-Path $Root "run-$Name.log"
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $BackupScript, '-DbHost', $HostName, '-DbPort', "$SourcePort", '-DbUser', 'postgres',
    '-SslMode', 'disable', '-OutputRoot', $out, '-StorageEnvFile', (Join-Path $Root 'storage.env'), '-PgBin', $PgBin,
    '-RehearsalDbSecretVariable', 'ZARMAN_TEST_DB_PW', '-RehearsalArchiveSecretVariable', 'ZARMAN_TEST_ARCHIVE_PW',
    '-TreatExtensionsAsUnavailable', 'pg_stat_statements') + $Extra
  $exitCode = Invoke-ConsoleProcess 'powershell.exe' $argList -StdoutFile $log -StderrFile "$log.err"
  $folder = @(Get-ChildItem $out -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
  $report = ''
  if ($folder.Count) { $rf = @(Get-ChildItem $folder[0].FullName -Filter '*_REPORT.txt'); if ($rf.Count) { $report = Get-Content $rf[0].FullName -Raw -Encoding UTF8 } }
  [pscustomobject]@{
    Exit = $exitCode; Report = $report; Folder = $(if ($folder.Count) { $folder[0].FullName } else { $null })
    Console = (Get-Content $log -Raw -ErrorAction SilentlyContinue) + (Get-Content "$log.err" -Raw -ErrorAction SilentlyContinue)
    Archives = @(if ($folder.Count) { Get-ChildItem $folder[0].FullName -Filter '*.7z' })
  }
}
function Assert-NoPlaintext($run, [string]$Scenario) {
  Check "$Scenario - no plaintext working folder left" (-not $run.Folder -or -not (Test-Path (Join-Path $run.Folder '_work')))
  foreach ($marker in @('example.invalid', 'SYNTHETIC-PASSPORT', 'SYNTHETICTOTPSECRET', ([string][char]0x067E + [char]0x0698 + [char]0x0645 + [char]0x0627 + [char]0x0646))) {
    Check "$Scenario - report contains no customer data ($marker)" ($run.Report -notmatch [regex]::Escape($marker))
  }
}

try {
  # ---- fake Supabase cluster (ICU en-US, like production)
  $pwFile = Join-Path $Root 'admin.pw'; [System.IO.File]::WriteAllText($pwFile, $AdminPw)
  $r = Invoke-Native (Pg 'initdb') @('-D', $SourceDir, '-U', 'supabase_admin', '--pwfile', $pwFile, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale-provider=icu', '--icu-locale=en-US', '--locale=C', '--no-instructions')
  Remove-Item $pwFile
  if ($r.ExitCode -ne 0) { throw "initdb (fake Supabase) failed: $($r.StdErr)" }
  [System.IO.File]::AppendAllText((Join-Path $SourceDir 'postgresql.conf'), "`nlisten_addresses = '127.0.0.1'`nport = $SourcePort`nfsync = off`n")
  $ctlExit = Invoke-ConsoleProcess (Pg 'pg_ctl') @('-D', $SourceDir, '-l', (Join-Path $Root 'fake-supabase.log'), '-w', 'start') -StdoutFile (Join-Path $Root 'ctl.out') -StderrFile (Join-Path $Root 'ctl.err')
  if ($ctlExit -ne 0) { throw 'fake Supabase cluster did not start' }
  $r = Invoke-Native (Pg 'psql') @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', (Join-Path $PSScriptRoot 'fixtures\fake-supabase.sql')) -Environment $adminEnv
  if ($r.ExitCode -ne 0) { throw "fixture load failed: $($r.StdErr)" }
  Write-Host '  fake Supabase database loaded'

  # ---- synthetic Storage files (+ matching storage.buckets / storage.objects rows)
  $rng = New-Object System.Random 1234
  $files = @(
    @{ bucket = 'customer-kyc-evidence'; name = 'u1/passport-front.jpg'; type = 'image/jpeg'; size = 60000 },
    @{ bucket = 'customer-kyc-evidence'; name = 'u1/proof of address.pdf'; type = 'application/pdf'; size = 25000 },
    @{ bucket = 'exchange-request-receipts'; name = 'requests/r-1/receipt.png'; type = 'image/png'; size = 1 },
    @{ bucket = 'exchange-request-receipts'; name = 'requests/r-2/nested/deep/receipt.png'; type = 'image/png'; size = 4096 },
    @{ bucket = 'exchange-request-receipts'; name = 'requests/r-3/invoice: final?.pdf'; type = 'application/pdf'; size = 2048 },
    @{ bucket = 'kyc-documents'; name = ('u2/' + [char]0x0645 + [char]0x062F + [char]0x0631 + [char]0x06A9 + '.txt'); type = 'text/plain'; size = 300 }
  )
  $objects = @()
  $storageSql = @()
  foreach ($f in $files) {
    $bytes = New-Object byte[] $f.size; $rng.NextBytes($bytes)
    $md5 = -join ([System.Security.Cryptography.MD5]::Create().ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    $id = [guid]::NewGuid().ToString()
    $objects += @{ bucket = $f.bucket; name = $f.name; mimetype = $f.type; base64 = [Convert]::ToBase64String($bytes); id = $id }
    $meta = (@{ size = $f.size; mimetype = $f.type; eTag = "`"$md5`""; contentLength = $f.size } | ConvertTo-Json -Compress) -replace "'", "''"
    $storageSql += "INSERT INTO storage.buckets (id, name, public) VALUES ('$($f.bucket)', '$($f.bucket)', false) ON CONFLICT DO NOTHING;"
    $storageSql += "INSERT INTO storage.objects (id, bucket_id, name, metadata) VALUES ('$id', '$($f.bucket)', '$($f.name -replace "'", "''")', '$meta'::jsonb);"
  }
  # Non-ASCII names must go through a UTF-8 file: Windows converts command-line arguments to the ANSI code page.
  $storageSqlFile = Join-Path $Root 'storage-rows.sql'
  [System.IO.File]::WriteAllLines($storageSqlFile, [string[]]$storageSql, (New-Object System.Text.UTF8Encoding $false))
  $r = Invoke-Native (Pg 'psql') @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $storageSqlFile) -Environment $adminEnv
  if ($r.ExitCode -ne 0) { throw "storage rows failed: $($r.StdErr)" }
  $fixture = @{ buckets = @(@{ id = 'customer-kyc-evidence'; public = $false }, @{ id = 'exchange-request-receipts'; public = $false }, @{ id = 'kyc-documents'; public = $false }); objects = $objects }
  [System.IO.File]::WriteAllText((Join-Path $Root 'storage-fixture.json'), ($fixture | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))
  Start-Mock

  # ---- S1: everything readable and intact -> PASS
  Write-Host 'Scenario S1: complete backup'
  $s1 = Invoke-Backup 's1'
  Check 'S1 - exit code 0' ($s1.Exit -eq 0) "exit=$($s1.Exit)`n$($s1.Console)"
  Check 'S1 - RESULT: PASS' ($s1.Report -match '(?m)^RESULT: PASS\r?$')
  Check 'S1 - two encrypted archives' ($s1.Archives.Count -eq 2)
  Check 'S1 - nothing excluded' ($s1.Report -match 'none - every table, sequence and schema was dumped')
  Check 'S1 - Supabase-only extension entries listed as not restore-tested' ($s1.Report -match 'pg_stat_statements')
  Check 'S1 - restore test verified data and catalog' ($s1.Report -match 'tables identical to production' -and $s1.Report -match 'objects compared by definition and permissions, 0 differences')
  Check 'S1 - every Storage file verified' ($s1.Report -match '6/6 files verified')
  Check 'S1 - limitations section present' ($s1.Report -match 'It is NOT a turnkey clone of the Supabase project')
  Assert-NoPlaintext $s1 'S1'
  if ($s1.Archives.Count -eq 2) {
    $sums = Get-Content (Get-ChildItem $s1.Folder -Filter '*_SHA256SUMS.txt').FullName
    $sumOk = $true; foreach ($line in $sums) { $h, $n = $line -split '  '; if ((Get-FileHash (Join-Path $s1.Folder $n) -Algorithm SHA256).Hash.ToLower() -ne $h) { $sumOk = $false } }
    Check 'S1 - SHA-256 checksums match' $sumOk
    $wrong = Invoke-Native $SevenZip @('l', '-pwrong-passphrase', $s1.Archives[0].FullName)
    Check 'S1 - archive cannot be listed with a wrong passphrase' ($wrong.ExitCode -ne 0 -and $wrong.StdOut -notmatch 'full\.dump')
    $x = Join-Path $Root 'extract'
    $ok = Invoke-Native $SevenZip @('x', "-p$env:ZARMAN_TEST_ARCHIVE_PW", "-o$x", $s1.Archives[0].FullName)
    $ok2 = Invoke-Native $SevenZip @('x', "-p$env:ZARMAN_TEST_ARCHIVE_PW", "-o$x\storage", ($s1.Archives | Where-Object Name -like '*_storage.7z').FullName)
    Check 'S1 - archives decrypt with the passphrase' ($ok.ExitCode -eq 0 -and $ok2.ExitCode -eq 0)
    $tocText = (Invoke-Native (Pg 'pg_restore') @('--list', (Join-Path $x 'full.dump'))).StdOut
    Check 'S1 - dump contains Auth users, MFA factors and Storage metadata' ($tocText -match 'TABLE DATA auth users' -and $tocText -match 'TABLE DATA auth mfa_factors' -and $tocText -match 'TABLE DATA storage objects')
    $createText = (Invoke-Native (Pg 'pg_restore') @('--create', '--schema-only', '--file', '-', (Join-Path $x 'full.dump'))).StdOut
    Check 'S1 - dump records the database-level settings' ($createText -match 'ALTER DATABASE \S+ SET "app\.settings\.jwt_exp" TO ''3600''')
    $manifest = Get-Content (Join-Path $x 'storage\storage-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Check 'S1 - manifest has per-file MD5 and SHA-256 for every file' (@($manifest.objects | Where-Object { $_.verified -and $_.sha256 -and $_.md5 }).Count -eq 6)
    $odd = @($manifest.objects | Where-Object { $_.name -eq 'requests/r-3/invoice: final?.pdf' })
    Check 'S1 - Windows-illegal Storage name stored percent-encoded, original name kept' ($odd.Count -eq 1 -and $odd[0].stored_as -eq 'files/exchange-request-receipts/requests/r-3/invoice%3A final%3F.pdf' -and (Test-Path -LiteralPath (Join-Path $x "storage\$($odd[0].stored_as)")))
    $persian = @($manifest.objects | Where-Object { $_.bucket -eq 'kyc-documents' })
    Check 'S1 - non-ASCII Storage name round-trips' ($persian.Count -eq 1 -and $persian[0].verified -and (Test-Path -LiteralPath (Join-Path $x "storage\$($persian[0].stored_as)")))
    Remove-PlaintextSecurely $x | Out-Null
  }

  # ---- S2: a Supabase-managed table becomes unreadable
  Sql 'REVOKE pg_read_all_data FROM postgres'
  Sql 'GRANT SELECT ON ALL TABLES IN SCHEMA realtime, vault, supabase_migrations, storage, auth TO postgres'
  Sql 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA realtime, auth, public TO postgres'
  Sql 'REVOKE SELECT ON realtime.schema_migrations FROM postgres'
  Write-Host 'Scenario S2: unreadable Supabase-managed table, no opt-in'
  $s2 = Invoke-Backup 's2'
  Check 'S2 - fails' ($s2.Exit -ne 0 -and $s2.Report -match '(?m)^RESULT: FAILED')
  Check 'S2 - names the unreadable table' ($s2.Report -match 'realtime\.schema_migrations')
  Check 'S2 - no archive created' ($s2.Archives.Count -eq 0)
  Assert-NoPlaintext $s2 'S2'
  Write-Host 'Scenario S2b: same, with -AllowManagedExclusions'
  $s2b = Invoke-Backup 's2b' @('-AllowManagedExclusions')
  Check 'S2b - PASS WITH EXCLUSIONS' ($s2b.Exit -eq 0 -and $s2b.Report -match '(?m)^RESULT: PASS WITH EXCLUSIONS') "exit=$($s2b.Exit)`n$($s2b.Console)"
  Check 'S2b - each exclusion listed explicitly as NOT BACKED UP' ($s2b.Report -match '- realtime\.schema_migrations \(Supabase-managed[^\r\n]*NOT BACKED UP' -and $s2b.Report -match '- schema pgbouncer \(Supabase-managed[^\r\n]*NOT BACKED UP')
  Check 'S2b - everything else still verified' ($s2b.Report -match 'objects compared by definition and permissions, 0 differences' -and $s2b.Report -match '6/6 files verified')
  Assert-NoPlaintext $s2b 'S2b'

  # ---- S3: required (Auth) data unreadable -> must fail even with the opt-in
  Sql 'REVOKE SELECT ON auth.mfa_factors FROM postgres'
  Write-Host 'Scenario S3: unreadable Auth table'
  $s3 = Invoke-Backup 's3' @('-AllowManagedExclusions')
  Check 'S3 - fails' ($s3.Exit -ne 0 -and $s3.Report -match '(?m)^RESULT: FAILED')
  Check 'S3 - names the required table' ($s3.Report -match 'auth\.mfa_factors')
  Check 'S3 - no archive created' ($s3.Archives.Count -eq 0)
  Assert-NoPlaintext $s3 'S3'
  Sql 'GRANT pg_read_all_data TO postgres WITH ADMIN OPTION'

  # ---- S4 / S5: Storage integrity problems
  Start-Mock @('--tamper', 'customer-kyc-evidence/u1/passport-front.jpg')
  Write-Host 'Scenario S4: a Storage file does not match its checksum'
  $s4 = Invoke-Backup 's4'
  Check 'S4 - fails on MD5/ETag mismatch' ($s4.Exit -ne 0 -and $s4.Report -match 'md5_etag_mismatch')
  Check 'S4 - no archive created' ($s4.Archives.Count -eq 0)
  Assert-NoPlaintext $s4 'S4'
  Start-Mock @('--extra', 'kyc-documents/u9/not-in-database.txt')
  Write-Host 'Scenario S5: Storage holds a file the database does not know'
  $s5 = Invoke-Backup 's5'
  Check 'S5 - fails on unexpected object' ($s5.Exit -ne 0 -and $s5.Report -match 'object_not_in_database')
  Assert-NoPlaintext $s5 'S5'
  Start-Mock

  # ---- S6: an object that cannot be restored -> restore test must fail
  $ts = Join-Path $Root 'tablespace'; New-Item -ItemType Directory $ts | Out-Null
  Sql "CREATE TABLESPACE synthetic_ts LOCATION '$($ts -replace '\\', '/')'"
  Sql 'CREATE TABLE public.restore_breaker (id int) TABLESPACE synthetic_ts; INSERT INTO public.restore_breaker VALUES (1); ALTER TABLE public.restore_breaker OWNER TO postgres'
  Write-Host 'Scenario S6: restore error'
  $s6 = Invoke-Backup 's6'
  Check 'S6 - fails' ($s6.Exit -ne 0 -and $s6.Report -match '(?m)^RESULT: FAILED')
  Check 'S6 - reports the pg_restore failure' ($s6.Report -match 'pg_restore failed')
  Check 'S6 - no archive created' ($s6.Archives.Count -eq 0)
  $diag = if ($s6.Folder) { Join-Path $s6.Folder 'diagnostics' } else { '' }
  Check 'S6 - diagnostics kept EFS-encrypted' ($diag -and (Test-Path "$diag\restore-test.log") -and [bool]((Get-Item "$diag\restore-test.log").Attributes -band [IO.FileAttributes]::Encrypted))
  Assert-NoPlaintext $s6 'S6'
  Sql 'DROP TABLE public.restore_breaker'
  Sql 'DROP TABLESPACE synthetic_ts'

  # ---- S7: rehearsal switches are refused against a non-local host
  Write-Host 'Scenario S7: rehearsal options against a remote host'
  $s7 = Invoke-Backup 's7' @() 'db.example.invalid'
  Check 'S7 - refused before connecting' ($s7.Exit -ne 0 -and $s7.Console -match 'only accepted against a local')
}
finally {
  if ($Mock) { Stop-Process -Id $Mock.Id -Force -ErrorAction SilentlyContinue }
  if (Test-Path $SourceDir) {
    $null = Invoke-ConsoleProcess (Pg 'pg_ctl') @('-D', $SourceDir, '-m', 'immediate', '-w', 'stop') -StdoutFile (Join-Path $Root 'ctl-stop.out') -StderrFile (Join-Path $Root 'ctl-stop.err')
  }
  Remove-Item Env:ZARMAN_TEST_DB_PW, Env:ZARMAN_TEST_ARCHIVE_PW -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  Remove-PlaintextSecurely $Root | Out-Null
}

Write-Host ''
Write-Host "Backup kit tests: $script:Passed passed, $($script:Failed.Count) failed"
foreach ($f in $script:Failed) { Write-Host "  - $f" -ForegroundColor Red }
if ($script:Failed.Count) { exit 1 } else { exit 0 }

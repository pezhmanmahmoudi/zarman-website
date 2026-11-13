<#
.SYNOPSIS
  Applies security migration 72 to production and verifies the result, or rolls it back.

.DESCRIPTION
  1. Refuses to run unless a production backup from the last 24 hours reports "RESULT: PASS"
     (C:\Users\<you>\ZarmanBackups\zarman-prod_*\*_REPORT.txt).
  2. Asks for the database password once (hidden). It is passed to psql only as an environment
     variable of the child process - never on a command line, in a file or in a log.
  3. Applies the migration in ONE transaction (it has its own BEGIN/COMMIT): either every change is
     applied or none is. It changes policies, grants, functions and indexes only - no rows.
  4. Runs scripts/verify-security-72.sql (read-only) and prints PASS/FAIL per check.
  A log (counts and PASS/FAIL only, no customer data) is written next to the backups.

  -Rollback applies supabase/rollbacks/20261113_72_security_rls_hardening.ROLLBACK.sql instead
  (restores the exact previous policies and grants, and re-opens the vulnerabilities).
  -VerifyOnly runs only the read-only verification.
#>
[CmdletBinding()]
param(
  [string]$DbHost = 'aws-1-ap-southeast-2.pooler.supabase.com',
  [int]$DbPort = 5432,
  [ValidateSet("require", "verify-full", "disable")][string]$SslMode = "require",
  [string]$ProjectRef = 'kkibwbmufjkyqdldlkbh',
  [string]$BackupRoot = (Join-Path $env:USERPROFILE 'ZarmanBackups'),
  [string]$PgBin,
  [switch]$Rollback,
  [switch]$VerifyOnly,
  # Proceed without a passing backup report (the migration changes no rows; the rollback is exact). Logged.
  [switch]$SkipBackupCheck,
  # Local rehearsal only (refused for any non-loopback host): name of an environment variable holding the password.
  [string]$RehearsalSecretVariable
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $PSScriptRoot 'backup\ZarmanBackup.psm1') -Force
if ($RehearsalSecretVariable -and -not (Test-LoopbackHost $DbHost)) { throw '-RehearsalSecretVariable is only accepted for a local (loopback) rehearsal server.' }

$migration = Join-Path $repo 'supabase\migrations\20261113_72_security_rls_hardening.APPLY_MANUALLY.sql'
$rollbackFile = Join-Path $repo 'supabase\rollbacks\20261113_72_security_rls_hardening.ROLLBACK.sql'
$verify = Join-Path $repo 'scripts\verify-security-72.sql'
$psql = @($(if ($PgBin) { Join-Path $PgBin 'psql.exe' }), (Join-Path $env:USERPROFILE 'pgsql\bin\psql.exe')) +
  @(Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | ForEach-Object FullName) |
  Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $psql) { throw 'psql.exe not found. Pass -PgBin <folder containing psql.exe>.' }
foreach ($f in $migration, $rollbackFile, $verify) { if (-not (Test-Path -LiteralPath $f)) { throw "Missing $f" } }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$mode = if ($Rollback) { 'rollback' } elseif ($VerifyOnly) { 'verify' } else { 'apply' }
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$log = Join-Path $BackupRoot "security-72_${mode}_$stamp.log"
function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color; Add-Content -LiteralPath $log -Value $Text -Encoding UTF8 }

# 1. Backup gate (not needed for a read-only verification).
if ($SkipBackupCheck -and -not $VerifyOnly) {
  Say 'WARNING: backup check skipped at the operator''s request (-SkipBackupCheck).' 'Yellow'
} elseif (-not $VerifyOnly) {
  $report =Get-ChildItem -Path $BackupRoot -Filter '*_REPORT.txt' -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-24) -and (Get-Content -LiteralPath $_.FullName -TotalCount 1) -match '^RESULT: PASS' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $report) { throw "No production backup with 'RESULT: PASS' from the last 24 hours in $BackupRoot. Run scripts\backup\Backup-ZarmanProduction.ps1 first." }
  Say "Backup verified: $($report.FullName)" 'Green'
}

# 2. Password, child processes only.
$secure = if ($RehearsalSecretVariable) { ConvertTo-SecureString ([Environment]::GetEnvironmentVariable($RehearsalSecretVariable)) -AsPlainText -Force }
          else { Read-Host 'Supabase database password (hidden)' -AsSecureString }
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $childEnv = @{ PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr); PGCLIENTENCODING = 'UTF8'; PGCONNECT_TIMEOUT = '20' } }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$conn = "host=$DbHost port=$DbPort dbname=postgres user=postgres.$ProjectRef sslmode=$SslMode application_name=zarman-security-72"

function Invoke-Psql([string]$File) {
  $r = Invoke-Native -FilePath $psql -Arguments @($conn, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $File) -Environment $childEnv
  foreach ($line in (($r.StdOut + "`n" + $r.StdErr) -split "`r?`n")) {
    $text = $line -replace '^psql:(?:[A-Za-z]:)?[^:]*:\d+:\s*', '' -replace '^(NOTICE|ERROR|WARNING):\s+', ''
    if (-not $text.Trim()) { continue }
    $color = if ($text -match '^PASS|RESULT: PASS') { 'Green' } elseif ($text -match '^FAIL|RESULT: FAILED|ERROR|error') { 'Red' } else { 'Gray' }
    Say "  $text" $color
  }
  $r.ExitCode
}

try {
  Say "Zarman security migration 72 - $mode - $(Get-Date -Format o)" 'Cyan'
  Say "Target: postgres.$ProjectRef@${DbHost}:$DbPort"
  if (-not $VerifyOnly) {
    $file = if ($Rollback) { $rollbackFile } else { $migration }
    Say "`nApplying $(Split-Path -Leaf $file) (single transaction)..." 'Cyan'
    $code = Invoke-Psql $file
    if ($code -ne 0) {
      Say "NOT APPLIED: psql exited $code. The transaction was rolled back; production is unchanged." 'Red'
      Say "If the error is a lock timeout, run the same command again in a minute." 'Yellow'
      exit 1
    }
    Say "Applied and committed." 'Green'
  }
  Say "`nVerifying (read-only)..." 'Cyan'
  $code = Invoke-Psql $verify
  if ($Rollback) {
    Say "`nRollback applied. The checks above are expected to FAIL: the previous (vulnerable) access rules are back." 'Yellow'
    exit 0
  }
  if ($code -ne 0) {
    Say "`nVERIFICATION FAILED. To restore the previous state immediately:" 'Red'
    Say "  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Apply-SecurityMigration72.ps1 -Rollback" 'Yellow'
    exit 2
  }
  Say "`nSecurity migration 72 is live and verified." 'Green'
  Say "Log: $log"
} finally {
  $childEnv.Clear()
}

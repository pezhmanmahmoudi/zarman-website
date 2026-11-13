# Helper functions for Backup-ZarmanProduction.ps1 (Windows PowerShell 5.1 compatible).
# Pure functions here are unit-tested by tests\Test-BackupKit.ps1.
Set-StrictMode -Version 2

$script:Utf8 = New-Object System.Text.UTF8Encoding $false

# ---------------------------------------------------------------------------- processes
function ConvertTo-ArgumentString {
  param([string[]]$Arguments)
  if (-not $Arguments) { return '' }
  ($Arguments | ForEach-Object {
    if ($_ -eq '') { '""' }
    elseif ($_ -notmatch '[\s"]') { $_ }
    else { '"' + (($_ -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"' }
  }) -join ' '
}

# Runs a console program with stdout/stderr captured as UTF-8. -Environment values exist only in the
# child process (used for PGPASSWORD), never in this session, a file, or a command line.
function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [hashtable]$Environment,
    [string]$StdoutFile,
    [string]$StderrFile
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = ConvertTo-ArgumentString $Arguments
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = $script:Utf8
  $psi.StandardErrorEncoding = $script:Utf8
  if ($Environment) { foreach ($k in $Environment.Keys) { $psi.EnvironmentVariables[$k] = [string]$Environment[$k] } }
  $process = [System.Diagnostics.Process]::Start($psi)
  $outTask = $process.StandardOutput.ReadToEndAsync()
  $errTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $out = $outTask.Result
  $err = $errTask.Result
  if ($StdoutFile) { [System.IO.File]::WriteAllText($StdoutFile, $out, $script:Utf8) }
  if ($StderrFile -and $err) { [System.IO.File]::AppendAllText($StderrFile, $err, $script:Utf8) }
  [pscustomobject]@{ ExitCode = $process.ExitCode; StdOut = $out; StdErr = $err }
}

# Starts a program that shares this console (so it can prompt, or so a server it launches keeps running)
# and waits for that program only, not for processes it leaves running. Returns its exit code.
# Touching .Handle before waiting is required in Windows PowerShell 5.1 or ExitCode stays empty.
function Invoke-ConsoleProcess {
  param([Parameter(Mandatory = $true)][string]$FilePath, [string[]]$Arguments = @(), [string]$StdoutFile, [string]$StderrFile)
  $quoted = @($Arguments | ForEach-Object { ConvertTo-ArgumentString @($_) })
  $params = @{ FilePath = $FilePath; NoNewWindow = $true; PassThru = $true }
  if ($quoted.Count) { $params.ArgumentList = $quoted }
  if ($StdoutFile) { $params.RedirectStandardOutput = $StdoutFile }
  if ($StderrFile) { $params.RedirectStandardError = $StderrFile }
  $process = Start-Process @params
  $null = $process.Handle
  $process.WaitForExit()
  return [int]$process.ExitCode
}

function Test-LoopbackHost {
  param([string]$HostName)
  return @('localhost', '127.0.0.1', '::1') -contains $HostName.ToLowerInvariant()
}

function Test-TcpPortFree {
  param([int]$Port)
  $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
  try { $listener.Start(); return $true } catch { return $false } finally { try { $listener.Stop() } catch { } }
}

# ---------------------------------------------------------------------------- CSV helpers
function Import-TableChecksums {
  param([string]$Path)
  $map = @{}
  foreach ($row in (Import-Csv -LiteralPath $Path -Encoding UTF8)) {
    $map["$($row.schema_name).$($row.table_name)"] = [pscustomobject]@{ Rows = [int64]$row.row_count; Md5 = [string]$row.content_md5 }
  }
  return $map
}

function Import-Fingerprint {
  param([string]$Path)
  return @(Import-Csv -LiteralPath $Path -Encoding UTF8)
}

# ---------------------------------------------------------------------------- comparisons
# Compares table contents of the restored copy with production, taken before and after the dump.
# A table whose rows and checksum did not change while pg_dump ran must be restored byte-identical.
# A table that changed during the dump (e.g. Auth refresh tokens) must restore with a row count in
# the before..after range; it is reported, never silently accepted.
function Compare-TableChecksums {
  param(
    [hashtable]$Before, [hashtable]$After, [hashtable]$Restored,
    [string[]]$Excluded = @(), [string[]]$NotRestorable = @()
  )
  $identical = New-Object System.Collections.Generic.List[string]
  $changed = New-Object System.Collections.Generic.List[string]
  $skipped = New-Object System.Collections.Generic.List[string]
  $failures = New-Object System.Collections.Generic.List[string]
  $keys = @($Before.Keys) + @($After.Keys) | Sort-Object -Unique
  foreach ($key in $keys) {
    if ($Excluded -contains $key) { $skipped.Add("$key (excluded from the backup)") | Out-Null; continue }
    $b = $Before[$key]; $a = $After[$key]; $r = $Restored[$key]
    if ($NotRestorable -contains $key) {
      $n = if ($a) { $a.Rows } else { $b.Rows }
      $skipped.Add("$key ($n rows in the dump; its extension is not installable locally)") | Out-Null
      continue
    }
    if ($b -and $a -and $b.Rows -eq $a.Rows -and $b.Md5 -eq $a.Md5) {
      if (-not $r) { $failures.Add("table $key is missing from the restored copy") | Out-Null }
      elseif ($r.Rows -ne $a.Rows) { $failures.Add("table $key restored $($r.Rows) rows, production has $($a.Rows)") | Out-Null }
      elseif ($r.Md5 -ne $a.Md5) { $failures.Add("table $key restored with different content than production (checksum mismatch)") | Out-Null }
      else { $identical.Add($key) | Out-Null }
      continue
    }
    # Changed, created or dropped while the dump ran.
    $counts = @(); if ($b) { $counts += $b.Rows }; if ($a) { $counts += $a.Rows }
    $lo = ($counts | Measure-Object -Minimum).Minimum; $hi = ($counts | Measure-Object -Maximum).Maximum
    if (-not $r) {
      if ($b -and $a) { $failures.Add("table $key is missing from the restored copy") | Out-Null }
      else { $changed.Add("$key (created or dropped during the dump)") | Out-Null }
    } elseif ($r.Rows -lt $lo -or $r.Rows -gt $hi) {
      $failures.Add("table $key restored $($r.Rows) rows; production moved from $(if ($b) { $b.Rows } else { 'absent' }) to $(if ($a) { $a.Rows } else { 'absent' }) during the dump") | Out-Null
    } else {
      $changed.Add("$key (rows $(if ($b) { $b.Rows } else { '-' }) -> $(if ($a) { $a.Rows } else { '-' }); restored $($r.Rows))") | Out-Null
    }
  }
  foreach ($key in ($Restored.Keys | Sort-Object)) {
    if (-not $Before.ContainsKey($key) -and -not $After.ContainsKey($key)) { $failures.Add("table $key exists in the restored copy but not in production") | Out-Null }
  }
  [pscustomobject]@{ Identical = $identical.ToArray(); Changed = $changed.ToArray(); Skipped = $skipped.ToArray(); Failures = $failures.ToArray() }
}

# Every catalog object (definition + permissions) must match exactly. -ExcludedScopes lists explicitly
# excluded schemas ("pgbouncer") or tables ("realtime.schema_migrations"): objects inside them are not
# in the dump by design, so they are counted as excluded instead of compared.
function Test-InScope {
  param([string]$Identity, [string[]]$Scopes)
  foreach ($s in $Scopes) { if ($Identity -ceq $s -or $Identity.StartsWith("$s.", [StringComparison]::Ordinal)) { return $true } }
  return $false
}

function Compare-Fingerprint {
  param([object[]]$Production, [object[]]$Restored, [string[]]$ExcludedScopes = @())
  $prod = @{}; foreach ($r in $Production) { $prod["$($r.kind)|$($r.identity)"] = $r }
  $rest = @{}; foreach ($r in $Restored) { $rest["$($r.kind)|$($r.identity)"] = $r }
  $failures = New-Object System.Collections.Generic.List[string]
  $excluded = 0
  foreach ($k in ($prod.Keys | Sort-Object)) {
    $p = $prod[$k]
    if (Test-InScope $p.identity $ExcludedScopes) { $excluded++; continue }
    if (-not $rest.ContainsKey($k)) { $failures.Add("missing $($p.kind) $($p.identity)") | Out-Null }
    elseif ($rest[$k].detail -cne $p.detail) { $failures.Add("different $($p.kind) $($p.identity)") | Out-Null }
  }
  foreach ($k in ($rest.Keys | Sort-Object)) {
    if (-not $prod.ContainsKey($k)) { $failures.Add("unexpected $($rest[$k].kind) $($rest[$k].identity) in the restored copy") | Out-Null }
  }
  [pscustomobject]@{ Compared = $prod.Count - $excluded; Excluded = $excluded; Failures = $failures.ToArray() }
}

# ---------------------------------------------------------------------------- pg_restore TOC
$script:TocDescriptions = @(
  'PUBLICATION TABLES IN SCHEMA', 'MATERIALIZED VIEW DATA', 'TEXT SEARCH CONFIGURATION', 'TEXT SEARCH DICTIONARY',
  'TEXT SEARCH TEMPLATE', 'TEXT SEARCH PARSER', 'FOREIGN DATA WRAPPER', 'DATABASE PROPERTIES', 'PROCEDURAL LANGUAGE',
  'SEQUENCE OWNED BY', 'MATERIALIZED VIEW', 'PUBLICATION TABLE', 'OPERATOR FAMILY', 'OPERATOR CLASS', 'CHECK CONSTRAINT',
  'FOREIGN SERVER', 'FOREIGN TABLE', 'SECURITY LABEL', 'LARGE OBJECT', 'BLOB METADATA', 'EVENT TRIGGER', 'ACCESS METHOD',
  'FK CONSTRAINT', 'SEQUENCE SET', 'USER MAPPING', 'TABLE ATTACH', 'INDEX ATTACH', 'ROW SECURITY', 'DEFAULT ACL',
  'SHELL TYPE', 'TABLE DATA', 'BLOBS'
)

function Get-TocEntry {
  param([string]$Line)
  $m = [regex]::Match($Line, '^\s*(\d+);\s+(\d+)\s+(\d+)\s+(.+)$')
  if (-not $m.Success) { return $null }
  $rest = $m.Groups[4].Value
  $desc = $null
  foreach ($d in $script:TocDescriptions) { if ($rest.StartsWith("$d ")) { $desc = $d; break } }
  if (-not $desc) { $desc = ($rest -split ' ', 2)[0] }
  $afterDesc = $rest.Substring([Math]::Min($rest.Length, $desc.Length + 1))
  $parts = $afterDesc -split ' ', 2
  [pscustomobject]@{
    Line = $Line; DumpId = [int]$m.Groups[1].Value; CatalogOid = [int64]$m.Groups[2].Value; Oid = [int64]$m.Groups[3].Value
    Desc = $desc; Namespace = $parts[0]; Rest = $(if ($parts.Count -gt 1) { $parts[1] } else { '' })
  }
}

# Builds the pg_restore -L list. Leaves out only (a) database-level entries, which apply only when a
# new database is created, and (b) entries that belong to extensions that cannot be installed in the
# local test server, identified by catalog OID or by member name, never by error message.
function Select-RestoreList {
  param([string[]]$TocLines, [object[]]$Members, [string[]]$UnavailableExtensions = @())
  $unavailableOids = @{}
  $memberNames = @{}
  foreach ($m in $Members) {
    if ($UnavailableExtensions -notcontains $m.extension) { continue }
    # OIDs are unique only within one catalog, so the key is catalog + OID (as in the TOC).
    $unavailableOids["$([int64]$m.member_classid)/$([int64]$m.member_oid)"] = $m.extension
    $memberNames["$($m.schema_name)|$($m.member_name)"] = $m.extension
  }
  $kept = New-Object System.Collections.Generic.List[string]
  $excluded = New-Object System.Collections.Generic.List[object]
  foreach ($line in $TocLines) {
    $e = Get-TocEntry $line
    if (-not $e) { $kept.Add($line) | Out-Null; continue }
    $reason = $null
    if ($e.Desc -eq 'DATABASE' -or $e.Desc -eq 'DATABASE PROPERTIES') {
      $reason = 'database-level entry (applies only when creating a new database; recorded in the dump)'
    } elseif ($e.Oid -ne 0 -and $unavailableOids.ContainsKey("$(if ($e.CatalogOid -eq 0 -and $e.Desc -in @('TABLE DATA', 'SEQUENCE SET')) { 1259 } else { $e.CatalogOid })/$($e.Oid)")) {
      # TABLE DATA / SEQUENCE SET entries carry catalog 0 and the relation's pg_class (1259) OID.
      $cat = if ($e.CatalogOid -eq 0) { 1259 } else { $e.CatalogOid }
      $reason = "belongs to extension $($unavailableOids["$cat/$($e.Oid)"]) (not installable in a standard PostgreSQL server)"
    } else {
      $tm = [regex]::Match($e.Rest, '^(?:EXTENSION) "?([^" ]+)"?(?: |$)')
      if ($e.Desc -in @('COMMENT', 'ACL', 'SECURITY LABEL') -and $tm.Success -and $UnavailableExtensions -contains $tm.Groups[1].Value) {
        $reason = "belongs to extension $($tm.Groups[1].Value) (not installable in a standard PostgreSQL server)"
      }
      if (-not $reason -and $e.Desc -in @('COMMENT', 'ACL', 'SECURITY LABEL')) {
        $om = [regex]::Match($e.Rest, '^(?:FUNCTION|PROCEDURE|AGGREGATE|TABLE|SEQUENCE|VIEW|MATERIALIZED VIEW|TYPE|DOMAIN|COLUMN|SCHEMA) "?([^"(. ]+)"?')
        if ($om.Success) {
          $ns = if ($e.Rest.StartsWith('SCHEMA ')) { '-' } else { $e.Namespace }
          $key = "$ns|$($om.Groups[1].Value)"
          if ($e.Rest.StartsWith('SCHEMA ')) { $key = "-|$($om.Groups[1].Value)" }
          if ($memberNames.ContainsKey($key)) { $reason = "belongs to extension $($memberNames[$key]) (not installable in a standard PostgreSQL server)" }
        }
      }
    }
    if ($reason) {
      $kept.Add(";EXCLUDED $line") | Out-Null
      $excluded.Add([pscustomobject]@{ Entry = "$($e.Desc) $($e.Namespace) $($e.Rest)".Trim(); Reason = $reason }) | Out-Null
    } else { $kept.Add($line) | Out-Null }
  }
  [pscustomobject]@{ Lines = $kept.ToArray(); Excluded = $excluded.ToArray() }
}

# Tables (schema.table) whose data must be in the dump, checked against the TOC.
function Find-MissingTableData {
  param([string[]]$TocLines, [string[]]$Tables)
  $present = @{}
  foreach ($line in $TocLines) {
    $e = Get-TocEntry $line
    if ($e -and $e.Desc -eq 'TABLE DATA') { $present["$($e.Namespace).$(($e.Rest -split ' ')[0])"] = $true }
  }
  return @($Tables | Where-Object { -not $present.ContainsKey($_) })
}

# ---------------------------------------------------------------------------- local protection
# 1 = BitLocker protection on, anything else = off/unknown. Works without administrator rights.
function Get-BitLockerProtection {
  param([string]$Path)
  $drive = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path))
  try { return [int](New-Object -ComObject Shell.Application).NameSpace($drive).Self.ExtendedProperty('System.Volume.BitLockerProtection') } catch { return 0 }
}

# Marks a folder for EFS so every file created in it is encrypted at rest with the user's key, then
# proves it with a probe file.
function Enable-EfsFolder {
  param([string]$Path)
  $null = & cipher.exe /e /s:"$Path" 2>&1
  $probe = Join-Path $Path '.efs-probe'
  [System.IO.File]::WriteAllText($probe, 'probe')
  $encrypted = [bool]((Get-Item -LiteralPath $probe).Attributes -band [System.IO.FileAttributes]::Encrypted)
  Remove-Item -LiteralPath $probe -Force
  return $encrypted
}

# Owner-only access: removes inherited permissions and grants full control to the current user only.
function Set-OwnerOnlyAcl {
  param([string]$Path)
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $null = & icacls.exe "$Path" /inheritance:r /grant:r "*${sid}:(OI)(CI)F" 2>&1
  return ($LASTEXITCODE -eq 0)
}

# Overwrites every file with zeros before deleting it. On SSDs and EFS this is best effort; the files
# are EFS-encrypted at rest in the first place.
function Remove-PlaintextSecurely {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  $buffer = New-Object byte[] 1048576
  $count = 0
  foreach ($file in (Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue)) {
    try {
      $file.Attributes = [System.IO.FileAttributes]::Normal
      $stream = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
      try {
        $remaining = $stream.Length
        while ($remaining -gt 0) { $n = [int][Math]::Min($remaining, $buffer.Length); $stream.Write($buffer, 0, $n); $remaining -= $n }
        $stream.Flush($true)
      } finally { $stream.Dispose() }
      $count++
    } catch { }
  }
  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
  return $count
}

Export-ModuleMember -Function *

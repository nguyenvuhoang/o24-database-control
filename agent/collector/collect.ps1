param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9._-]{1,80}$')][string]$AgentId,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9_-]{1,80}$')][string]$Instance,
    [Parameter(Mandatory = $true)][string]$BackupDirectory
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$jobNames = @('backup_log_full_emi_cms', 'emi_cms_bk_and_cp_ltc_server', 'clean_up_backup_log')
$dbNames = @('o24act', 'o24nch', 'o24wfo', 'o24cbg', 'o24cth', 'o24dts', 'o24cms', 'o24stl')
function Convert-Date($date) {
    if ($null -eq $date -or $date -eq [datetime]::MinValue -or $date.Year -lt 2000) { return $null }
    return $date.ToString('o')
}
$jobs = @(
    foreach ($jobName in $jobNames) {
        try {
            $task = Get-ScheduledTask -TaskName $jobName -ErrorAction Stop
            $info = $task | Get-ScheduledTaskInfo
            [pscustomobject]@{
                name = $jobName
                state = [string]$task.State
                lastRun = Convert-Date $info.LastRunTime
                nextRun = Convert-Date $info.NextRunTime
                lastResult = [long]$info.LastTaskResult
                runAs = [string]$task.Principal.UserId
            }
        } catch {
            [pscustomobject]@{name=$jobName; state='NOT_FOUND'; lastRun=$null; nextRun=$null; lastResult=$null; runAs=''}
        }
    }
)
$dbRows = @()
try {
    $dbList = ($dbNames | ForEach-Object { "'$_'" }) -join ','
    $sql = @"
SET NOCOUNT ON;
SELECT d.name, d.state_desc, d.recovery_model_desc,
ISNULL(CONVERT(varchar(33), f.backup_finish_date, 126), ''),
ISNULL(CONVERT(varchar(33), l.backup_finish_date, 126), '')
FROM sys.databases d
OUTER APPLY (SELECT TOP 1 backup_finish_date FROM msdb.dbo.backupset WHERE database_name = d.name AND type='D' ORDER BY backup_finish_date DESC) f
OUTER APPLY (SELECT TOP 1 backup_finish_date FROM msdb.dbo.backupset WHERE database_name = d.name AND type='L' ORDER BY backup_finish_date DESC) l
WHERE d.name IN ($dbList)
ORDER BY d.name;
"@
    $lines = & sqlcmd -S "localhost\$Instance" -E -b -W -h -1 -s '|' -Q $sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $($lines -join ' ')" }
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $p = ([string]$line).Split('|')
        if ($p.Length -ne 5) { continue }
        $full = if ($p[3].Trim()) { "$($p[3].Trim())" } else { $null }
        $log = if ($p[4].Trim()) { "$($p[4].Trim())" } else { $null }
        $dbRows += [pscustomobject]@{
            name=$p[0].Trim(); state=$p[1].Trim(); recovery=$p[2].Trim();
            lastFull=$full; lastLog=$log
        }
    }
} catch {
    [Console]::Error.WriteLine("SQL collector failed: $($_.Exception.Message)")
}
$artifacts = @()
$logLines = @()
if (Test-Path -LiteralPath $BackupDirectory) {
    $artifacts = @(
        Get-ChildItem -LiteralPath $BackupDirectory -Filter '*.zip' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 5 |
        ForEach-Object { [pscustomobject]@{name=$_.Name; bytes=[long]$_.Length; modifiedAt=$_.LastWriteTime.ToString('o')} }
    )
    $logDir = Join-Path $BackupDirectory 'Log'
    if (Test-Path -LiteralPath $logDir) {
        $lastLog = Get-ChildItem -LiteralPath $logDir -Filter 'BK_EMI_CMS_SQLSERVER_PRO_*.log' -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($lastLog) { $logLines = @(Get-Content -LiteralPath $lastLog.FullName -Tail 16 -ErrorAction SilentlyContinue) }
    }
}
$diskFree = $null
try {
    $drive = (Get-Item -LiteralPath $BackupDirectory -ErrorAction Stop).PSDrive
    $diskFree = [math]::Round($drive.Free / 1GB, 2)
} catch {}
$payload = [ordered]@{
    agentId = $AgentId
    serverName = $env:COMPUTERNAME
    collectedAt = (Get-Date).ToString('o')
    instance = $Instance
    jobs = @($jobs)
    databases = @($dbRows)
    artifacts = @($artifacts)
    logLines = @($logLines)
    diskFreeGB = $diskFree
}
$payload | ConvertTo-Json -Depth 8 -Compress

param(
    [Parameter(Mandatory = $true)][string]$ApiUrl,
    [Parameter(Mandatory = $true)][string]$Token,
    [string]$AgentId = 'emi-cms-live',
    [string]$Instance = 'CMSLIVE',
    [string]$BackupDirectory = 'D:\Backup\EMI_CMS'
)
$ErrorActionPreference = 'Stop'
$json = & "$PSScriptRoot\collect.ps1" -AgentId $AgentId -Instance $Instance -BackupDirectory $BackupDirectory
if ($LASTEXITCODE -ne 0 -or -not $json) { throw 'Collector did not return valid telemetry' }
Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers @{Authorization="Bearer $Token"} -Body $json -ContentType 'application/json; charset=utf-8'

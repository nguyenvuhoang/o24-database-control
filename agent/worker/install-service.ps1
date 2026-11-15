param([string]$InstallDir = 'C:\O24\database-monitor-agent')
$ErrorActionPreference = 'Stop'
$exe = Join-Path $InstallDir 'O24.DatabaseMonitor.Agent.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "Missing executable: $exe" }
if (Get-Service -Name 'O24DatabaseMonitorAgent' -ErrorAction SilentlyContinue) { throw 'Service already installed' }
New-Service -Name 'O24DatabaseMonitorAgent' -BinaryPathName "`"$exe`"" -DisplayName 'O24 Database Monitoring Agent' -StartupType Automatic -Description 'Read-only SQL backup and Task Scheduler telemetry'
Write-Host 'Installed. Configure the service account and O24_MONITOR_AGENT_TOKEN securely before starting.'

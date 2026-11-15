# O24 Database Control Center (MVP v0.1)

Read-only backup monitoring for Windows SQL Server CMSLIVE. Next.js dashboard + PostgreSQL + .NET 8 Windows Worker, PowerShell collector. Agent reports outbound HTTPS only. No remote job control.

## Requirements
- Web: Node.js 22+, Docker Compose (local PostgreSQL); on deployment, persistent PostgreSQL and HTTPS.
- Agent: Windows Server, .NET 8 SDK for build, .NET 8 runtime for service, PowerShell 5.1, `sqlcmd` on PATH, account permitted to query Task Scheduler, `sys.databases` and `msdb.dbo.backupset`.
- Windows host can reach the Web API through HTTPS; agent does not need inbound ports.

## Local setup
1. `Copy-Item .env.example .env` and change `POSTGRES_PASSWORD` to a strong random value.
2. `docker compose up -d` (first initialization creates schema; if DB volume already existed, execute `web/db/schema.sql` manually).
3. `cd web; Copy-Item .env.example .env.local`; configure `DATABASE_URL`, `AGENT_TOKEN` (unique 32+ chars), dashboard user/password.
4. `npm install; npm run dev`; open http://localhost:3000, enter dashboard Basic Auth credentials.
5. To quickly test ingestion, run collector on Windows: `powershell.exe -NoProfile -File .\agent\collector\collect.ps1 -AgentId emi-cms-live -Instance CMSLIVE -BackupDirectory D:\Backup\EMI_CMS` from the repository root; verify JSON output.

## Windows Agent service
1. From `agent/worker`: `dotnet restore; dotnet publish -c Release -r win-x64 --self-contained false -o C:\O24\database-monitor-agent`.
2. Edit `C:\O24\database-monitor-agent\appsettings.json`: `Monitor:ApiUrl` to your HTTPS URL ending `/api/ingest`; choose `AgentId` and keep `CMSLIVE`.
3. Set machine-level environment variable `O24_MONITOR_AGENT_TOKEN` matching `web/AGENT_TOKEN`; secure permissions and restart the service after setting it. For better isolation in production, run service under a dedicated service account and load token from a protected store. Never commit tokens.
4. Run `agent/worker/install-service.ps1` as Administrator. Set the service Log On account in `services.msc` to a minimally privileged identity that can query Task Scheduler and SQL msdb, then start service. LocalSystem may not have database permissions; prefer a dedicated account.
5. `Get-Service O24DatabaseMonitorAgent`; inspect Windows Event Viewer > Application or service console during troubleshooting.

## Caveats / next milestones
- V0.1 gives snapshots and 15s dashboard refresh. `Ready` and exit code 0 do not prove backup integrity.
- Full / Log backup freshness is informational; missing FULL and LOG should have separate per-job policies.
- ZIP is listed from local disk only; no remote LTC SHA256 validation yet.
- Backup log tail may include paths or other sensitive information. Never include secrets in log. Dashboard uses HTTP Basic Auth; deploy ONLY behind TLS and restrict access with network policies/SSO.
- `agent/collector/collect.ps1` trusts configured server names, currently hardcoded for 8 EMI databases and three Task Scheduler jobs.
- Telemetry is append-only; add retention (30-90 days), job-events model, deduplication, Telegram alert engine and Linux agent in V1.1.
- Agent token is single shared token for MVP; production multi-agent rollout should use per-agent scoped tokens and rotation.
- Collector SQL dates use SQL Server local time; front-end renders in viewer timezone. In V1.1 include explicit timezone from SQL Server.

## One-off telemetry test without installing agent
On Windows CMSLIVE, after configuring web and opening the API endpoint:

```powershell
& .\agent\collector\send-once.ps1 -ApiUrl 'https://YOUR-HOST/api/ingest' -Token '<AGENT_TOKEN>'
```

Use `http://localhost:3000/api/ingest` only for local non-production testing. The token may remain in shell history; for production use the Windows service with protected configuration instead.

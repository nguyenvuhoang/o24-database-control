# Login screen patch for O24 Database Control Center

1. Extract ZIP into `C:\O24\o24-database-monitor`, keeping `web/` paths, and allow overwrite for `web/proxy.ts`.
2. Add `SESSION_SECRET` (at least 32 random characters) to `web/.env.local`. Leave existing DATABASE_URL, AGENT_TOKEN, DASHBOARD_USER and DASHBOARD_PASSWORD unchanged, but ensure DASHBOARD_PASSWORD >= 12 characters.
3. Stop Next.js with Ctrl+C, run `npm run dev` from `web`.
4. Open `http://localhost:3000/login`, sign in with DASHBOARD_USER/DASHBOARD_PASSWORD.
5. Existing `/api/ingest` bearer token authentication remains unchanged.

To generate a random session secret in PowerShell:

```powershell
$bytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Security: This MVP still needs centralized rate limiting, audit trails and MFA before public internet exposure. Run behind HTTPS and restrict access. Avoid exposing the development server to the internet.

O24 Database Control Center - navigation + full width patch

Copy the web/ directory into C:\O24\o24-database-monitor\web and allow overwrite.
This patch only changes frontend navigation and layout.
It preserves your current globals.css, Quicksand font, authentication, API, database and Agent.
Routes: /, /backup-jobs, /databases, /agents, /events.
Event History currently shows recent log lines from the latest snapshot, not persisted events.
Run npm run build then npm run dev.

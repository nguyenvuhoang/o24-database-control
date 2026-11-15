CREATE TABLE IF NOT EXISTS monitor_agent_snapshots (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_monitor_snapshots_agent_time ON monitor_agent_snapshots(agent_id, received_at DESC);
CREATE INDEX IF NOT EXISTS ix_monitor_snapshots_received_at ON monitor_agent_snapshots(received_at DESC);

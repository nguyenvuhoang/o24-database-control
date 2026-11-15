import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { pool } from '../../../lib/db';
import type { Snapshot } from '../../../lib/types';

export const runtime = 'nodejs';

function tokenMatches(provided: string | null) {
  const expected = process.env.AGENT_TOKEN;
  if (!expected || expected.length < 32 || !provided?.startsWith('Bearer ')) return false;
  const a = Buffer.from(provided.substring(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!tokenMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (Number(request.headers.get('content-length') || 0) > 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  let data: Snapshot;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 1024 * 1024) throw new Error('Too large');
    data = JSON.parse(raw);
    if (!data || typeof data !== 'object' ||
        typeof data.agentId !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(data.agentId) ||
        typeof data.serverName !== 'string' || data.serverName.length > 120 ||
        typeof data.instance !== 'string' || data.instance.length > 120 ||
        !Array.isArray(data.jobs) || data.jobs.length > 100 ||
        !Array.isArray(data.databases) || data.databases.length > 200 ||
        !Array.isArray(data.artifacts) || data.artifacts.length > 50 ||
        !Array.isArray(data.logLines) || data.logLines.length > 100 ||
        !data.collectedAt || isNaN(Date.parse(data.collectedAt))) throw new Error('Invalid payload');
    for (const job of data.jobs) if (typeof job.name !== 'string' || job.name.length > 200) throw new Error('Invalid job');
    for (const db of data.databases) if (typeof db.name !== 'string' || db.name.length > 200) throw new Error('Invalid database');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  try {
    await pool.query(
      'INSERT INTO monitor_agent_snapshots (agent_id, server_name, collected_at, payload) VALUES ($1, $2, $3, $4::jsonb)',
      [data.agentId, data.serverName, data.collectedAt, JSON.stringify(data)]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }
}

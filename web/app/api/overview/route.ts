import { NextResponse } from 'next/server';
import { pool } from '../../../lib/db';
import type { ServerSnapshot, Snapshot } from '../../../lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query<{received_at: Date; payload: Snapshot}>(`
      SELECT DISTINCT ON (agent_id) received_at, payload
      FROM monitor_agent_snapshots
      ORDER BY agent_id, received_at DESC
    `);
    const servers: ServerSnapshot[] = result.rows.map(row => ({
      receivedAt: row.received_at.toISOString(),
      online: Date.now() - new Date(row.received_at).getTime() < 180000,
      snapshot: row.payload
    }));
    return NextResponse.json({ servers, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

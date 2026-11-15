import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createSession, SESSION_COOKIE, sessionMaxAge } from '../../../../lib/session';
export const runtime = 'nodejs';

function equals(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPass = process.env.DASHBOARD_PASSWORD;
  if (!expectedUser || !expectedPass || expectedPass.length < 12) return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 });
  let body: { username?: string; password?: string };
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) throw Error('Too large');
    body = await request.json();
  } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const username = typeof body?.username === 'string' ? body.username.slice(0, 256) : '';
  const password = typeof body?.password === 'string' ? body.password.slice(0, 512) : '';
  if (!equals(username, expectedUser) || !equals(password, expectedPass)) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: sessionMaxAge
  });
  return response;
}

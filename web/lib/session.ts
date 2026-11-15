import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'o24_monitor_session';
const MAX_AGE = 8 * 60 * 60;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return value;
}
function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}
export function createSession() {
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function validateSession(token?: string) {
  if (!token || token.length > 2048) return false;
  try {
    const [payload, supplied, extra] = token.split('.');
    if (!payload || !supplied || extra) return false;
    const a = Buffer.from(supplied);
    const b = Buffer.from(signature(payload));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.v === 1 && Number.isInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000) && data.exp <= Math.floor(Date.now() / 1000) + MAX_AGE;
  } catch { return false; }
}
export const sessionMaxAge = MAX_AGE;

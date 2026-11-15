 'use client';
import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) { setError(response.status === 401 ? 'Tài khoản hoặc mật khẩu không đúng.' : 'Không thể đăng nhập. Kiểm tra cấu hình máy chủ.'); return; }
      window.location.replace('/');
    } catch { setError('Không thể kết nối tới máy chủ.'); }
    finally { setLoading(false); }
  }
  return <main className="login-page"><div className="login-orb login-orb-one"/><div className="login-orb login-orb-two"/>
    <div className="login-card">
      <div className="login-logo"><span>◈</span><div><strong>O24 Control</strong><small>DATABASE MONITORING</small></div></div>
      <div className="login-kicker">SECURE OPERATIONS WORKSPACE</div>
      <h1>Welcome back</h1><p>Đăng nhập để giám sát máy chủ, database và trạng thái backup Production.</p>
      <form onSubmit={submit}>
        <label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" required maxLength={256}/>
        <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required maxLength={512}/>
        {error && <div role="alert" className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in to Dashboard  →'}</button>
      </form>
      <div className="login-footer">Read-only telemetry <span>•</span> No remote database operations</div>
    </div>
  </main>;
}

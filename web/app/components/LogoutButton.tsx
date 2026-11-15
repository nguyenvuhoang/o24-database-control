 'use client';
export default function LogoutButton() {
  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
    finally { window.location.replace('/login'); }
  }
  return <button type="button" onClick={logout} className="logout-button">Sign out</button>;
}

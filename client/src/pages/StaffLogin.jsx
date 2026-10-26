import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const result = await apiRequest('/staff/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      if (!result?.token) throw new Error('Staff login token missing');
      sessionStorage.setItem('nexus_staff_token', result.token);
      navigate('/staff/dashboard', { replace: true });
    } catch (err) { setError(err.message || 'Unable to sign in'); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout staff-auth"><section className="auth-story"><span className="eyebrow">NEXUS CRM · ADMISSIONS TEAM</span><h1>Every student journey, in one place.</h1><p>Review applications, verify supporting documents and make informed admissions decisions.</p></section><div className="auth-card">
    <section className="panel">
      <span className="eyebrow">TEAM ACCESS</span><h1>Staff sign in</h1>
      <p className="muted">Access the recruitment dashboard using your staff account.</p>
      <form onSubmit={submit} className="form-stack">
        <label>Email<input type="email" required autoComplete="username" value={email}
          onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={password}
          onChange={e => setPassword(e.target.value)} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section></div>
  </main>;
}

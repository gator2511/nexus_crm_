import React, {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {apiRequest} from '../api.js';

export default function Signup() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 12 || password.length > 128) {
      setError('Use a password between 12 and 128 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiRequest('/student/signup', {
        method: 'POST',
        body: JSON.stringify({token, password}),
      });
      setComplete(true);
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message || 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="page narrow"><section className="panel">
    <h1>Create student account</h1>
    {complete ? <>
      <p role="status" className="success">Account created successfully. You can now log in.</p>
      <Link to="/login">Go to student login</Link>
    </> : !token ? <>
      <p role="alert" className="error">A private signup invitation is required. Please use the link emailed after your course enquiry.</p>
      <Link to="/enquiry">Submit a course enquiry</Link>
    </> : <>
      <p className="muted">Choose a password for your student portal. Your invitation is valid for 24 hours and can only be used once.</p>
      <form className="form-stack" onSubmit={submit}>
        <label htmlFor="password">Password (minimum 12 characters)
          <input id="password" type="password" autoComplete="new-password" minLength={12} maxLength={128}
            value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <label htmlFor="confirm">Confirm password
          <input id="confirm" type="password" autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button disabled={loading}>{loading ? 'Creating account…' : 'Create student account'}</button>
      </form>
    </>}
  </section></main>;
}

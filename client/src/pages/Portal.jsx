import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudentProfile } from '../api.js';
import ApplicationSection from './ApplicationSection.jsx';
import DocumentReviewStatus from './DocumentReviewStatus.jsx';

export default function Portal() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('nexus_token')) {
      navigate('/login', { replace: true }); return;
    }
    getStudentProfile()
      .then(result => setStudent(result.student || result))
      .catch(err => {
        if (err.status === 401) {
          localStorage.removeItem('nexus_token');
          navigate('/login', { replace: true });
        } else { setError(err.message); }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function logout() {
    localStorage.removeItem('nexus_token');
    navigate('/login', { replace: true });
  }
  if (loading) return <main className="page narrow"><p>Loading student portal…</p></main>;
  if (error) return <main className="page narrow"><section className="panel">
    <h2>Unable to load student details</h2><p role="alert" className="error">{error}</p>
    <button onClick={logout}>Return to login</button>
  </section></main>;

  return <main className="page wide">
    <div className="page-heading"><div><h1>Student portal</h1>
      <p className="muted">Welcome, {student?.full_name || student?.email || 'Student'}.</p></div>
      <button className="secondary" onClick={logout}>Sign out</button></div>
    <section className="panel"><h2>Your profile</h2><p>Email: {student?.email || 'Not available'}</p>
      <p>Current recruitment stage: {student?.stage || 'Awaiting update'}</p></section>
    <section className="panel"><h2>Application</h2><ApplicationSection /></section>
    <DocumentReviewStatus />
  </main>;
}

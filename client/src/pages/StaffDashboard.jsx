import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';

const labels = [
  'Enquiry', 'Qualification review', 'Qualified', 'Application',
  'Offer', 'Enrolled', 'Closed',
];

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const token = sessionStorage.getItem('nexus_staff_token');
    if (!token) { navigate('/staff/login', { replace: true }); return; }
    setLoading(true); setError('');
    try {
      const result = await apiRequest('/staff/dashboard', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setData(result);
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem('nexus_staff_token');
        navigate('/staff/login', { replace: true }); return;
      }
      setError(err.message || 'Unable to load dashboard');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function logout() {
    sessionStorage.removeItem('nexus_staff_token');
    navigate('/staff/login', { replace: true });
  }

  return <main className="page wide">
    <div className="page-heading">
      <div><h1>Recruitment dashboard</h1><p className="muted">Live prospect pipeline from Nexus CRM.</p></div>
      <div className="actions"><button type="button" className="secondary" onClick={load}>Refresh</button>
      <button type="button" className="secondary" onClick={logout}>Sign out</button></div>
    </div>
    {loading && <p role="status">Loading dashboard…</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!loading && data && <>
      <section className="stats" aria-label="Overview">
        {[
          ['Total prospects', data.summary.totalProspects],
          ['Active prospects', data.summary.activeProspects],
          ['Enrolled', data.summary.enrolledProspects],
          ['Closed', data.summary.closedProspects],
        ].map(([label, value]) => <article className="stat" key={label}>
          <span className="muted">{label}</span><strong>{value}</strong>
        </article>)}
      </section>
      <section className="panel"><h2>Recruitment pipeline</h2><div className="pipeline">
        {labels.map(label => <div key={label} className="pipeline-item">
          <span>{label}</span><strong>{data.summary.stageCounts[label] || 0}</strong>
        </div>)}
      </div></section>
      <section className="panel"><h2>Recent enquiries</h2>
        {!data.recentProspects?.length ? <p className="muted">No prospects recorded yet.</p> :
          <div className="table-scroll"><table><thead><tr><th>Student</th><th>Email</th><th>Stage</th><th>Created</th></tr></thead><tbody>
          {data.recentProspects.map(p => <tr key={p.id}><td>{p.full_name}</td><td>{p.email}</td><td>{p.stage}</td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </main>;
}

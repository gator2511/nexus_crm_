import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';
import ProgramCriteria from './ProgramCriteria.jsx';

const labels = [
  'Enquiry', 'Qualification review', 'Qualified', 'Application',
  'Offer', 'Enrolled', 'Closed',
];

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState([]);
  const [documents, setDocuments] = useState({});
  const [actionError, setActionError] = useState('');

  async function load() {
    const token = sessionStorage.getItem('nexus_staff_token');
    if (!token) { navigate('/staff/login', { replace: true }); return; }
    setLoading(true); setError('');
    try {
      const result = await apiRequest('/staff/dashboard', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setData(result);
      const queue = await apiRequest('/staff/pending-review', {headers: {Authorization: 'Bearer ' + token}});
      setReview(queue.prospects || []);
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem('nexus_staff_token');
        navigate('/staff/login', { replace: true }); return;
      }
      setError(err.message || 'Unable to load dashboard');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function showDocuments(prospectId) {
    try {
      setActionError('');
      const result = await apiRequest('/staff/prospects/' + prospectId + '/documents', {
        headers: {Authorization: 'Bearer ' + sessionStorage.getItem('nexus_staff_token')},
      });
      setDocuments(prev => ({...prev,[prospectId]:result.documents || []}));
    } catch (err) { setActionError(err.message); }
  }
  async function viewDocument(docId) {
    setActionError('');
    try {
      const response=await fetch('/api/staff/documents/'+docId+'/view',{
        headers:{Authorization:'Bearer '+sessionStorage.getItem('nexus_staff_token')}
      });
      if(!response.ok)throw new Error('Unable to open document ('+response.status+')');
      const file=await response.blob();
      const url=URL.createObjectURL(file);
      const tab=window.open(url,'_blank','noopener,noreferrer');
      if(!tab){URL.revokeObjectURL(url);throw new Error('Allow pop-ups to preview student documents');}
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(err){setActionError(err.message)}
  }
  async function finalDecision(applicationId,decision) {
    const note=window.prompt('Reason for final '+decision.toLowerCase()+' decision:');
    if(!note?.trim())return;
    try{
      setActionError('');
      await apiRequest('/staff/applications/'+applicationId+'/decision',{
        method:'POST',
        headers:{Authorization:'Bearer '+sessionStorage.getItem('nexus_staff_token')},
        body:JSON.stringify({decision,note})
      });
      await load();
      setDocuments({});
    }catch(err){setActionError(err.message)}
  }
  async function decide(docId, action) {
    const reason = action === 'reject' ? window.prompt('Explain why the student must replace this document:') : null;
    if (action === 'reject' && !reason?.trim()) return;
    try {
      setActionError('');
      await apiRequest('/staff/documents/' + docId + '/' + action, {
        method:'POST',
        headers:{Authorization: 'Bearer ' + sessionStorage.getItem('nexus_staff_token')},
        ...(action === 'reject' ? {body:JSON.stringify({reason})} : {}),
      });
      const openIds = Object.keys(documents);
      await load();
      for (const id of openIds) await showDocuments(id);
    } catch (err) { setActionError(err.message); }
  }
  async function reviewEligibility(prospectId,decision) {
    const note=window.prompt('Enter the reason for this '+decision.toLowerCase()+' decision:');
    if(!note?.trim()) return;
    try {
      setActionError('');
      await apiRequest('/staff/prospects/'+prospectId+'/qualification-decision',{
        method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('nexus_staff_token')},
        body:JSON.stringify({decision,note})
      });
      await load();
    }catch(err){setActionError(err.message)}
  }
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
      <section className="panel"><h2>Pending review</h2>
        <p className="muted">Students needing academic review or document corrections.</p>
        {actionError && <p role="alert" className="error">{actionError}</p>}
        {!review.length ? <p>No pending review cases.</p> : review.map(p =>
          <div key={p.id} className="panel">
            <strong>{p.full_name}</strong> — {p.email}
            <p>Qualification: {p.qualification_result || 'Not assessed'} · Rejected documents: {p.rejected_documents}</p>
            {['Fail','Review'].includes(p.qualification_result) && !p.qualification_decision && <>
              <button type="button" onClick={()=>reviewEligibility(p.id,'Approved')}>Approve eligibility</button>
              <button type="button" className="secondary" onClick={()=>reviewEligibility(p.id,'Rejected')}>Reject eligibility</button>
            </>}
            <button type="button" className="secondary" onClick={() => showDocuments(p.id)}>Review documents</button>
            {documents[p.id] && <ul>{documents[p.id].map(d =>
              <li key={d.id}>{d.document_type}: {d.status} <button type="button" className="secondary" onClick={()=>viewDocument(d.id)}>View document</button>
                {d.rejection_reason && <span> — {d.rejection_reason}</span>}
                {d.status === 'Pending' && <>
                  <button type="button" onClick={() => decide(d.id,'verify')}>Verify</button>
                  <button type="button" className="secondary" onClick={() => decide(d.id,'reject')}>Reject</button>
                </>}
              </li>)}</ul>}
            {documents[p.id]?.some(d=>d.application_status==='Under review') && (()=>{
              const appDocs=documents[p.id].filter(d=>d.application_status==='Under review');
              const allVerified=appDocs.length>0 && appDocs.every(d=>d.status==='Verified');
              const appId=appDocs[0]?.application_id;
              return <div className="actions">
                <button type="button" disabled={!allVerified} onClick={()=>finalDecision(appId,'Accepted')}>Final approve</button>
                <button type="button" className="secondary" onClick={()=>finalDecision(appId,'Rejected')}>Final reject</button>
                {!allVerified&&<p className="muted">Verify every document before final approval.</p>}
              </div>;
            })()}
          </div>)}
      </section>
      <ProgramCriteria />
      <section className="panel"><h2>Recent enquiries</h2>
        {!data.recentProspects?.length ? <p className="muted">No prospects recorded yet.</p> :
          <div className="table-scroll"><table><thead><tr><th>Student</th><th>Email</th><th>Stage</th><th>Created</th></tr></thead><tbody>
          {data.recentProspects.map(p => <tr key={p.id}><td>{p.full_name}</td><td>{p.email}</td><td>{p.stage}</td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </main>;
}

import React,{useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {apiRequest} from '../api.js';
import ApplicationSection from './ApplicationSection.jsx';
import EligibilitySection from './EligibilitySection.jsx';
import DocumentReviewStatus from './DocumentReviewStatus.jsx';

const STEPS=['Enquiry','Review','Qualified','Application','Offer','Enrolled'];

function resolveStep(j) {
  if(j.enrolled || j.stage==='Enrolled')return 5;
  if(j.application_status==='Accepted' || j.stage==='Offer')return 4;
  if(j.application_status || j.stage==='Application')return 3;
  if(j.auto_result==='Pass' || j.qualification_decision==='Approved' || j.stage==='Qualified')return 2;
  if(j.qualification_submitted_at || j.stage==='Qualification review')return 1;
  return 0;
}

export default function Portal(){
  const navigate=useNavigate();
  const [journey,setJourney]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState('');
  const [accepting,setAccepting]=useState(false);
  const refresh=useCallback(async()=>{
    const result=await apiRequest('/student/journey');
    setJourney(result.journey);
  },[]);
  useEffect(()=>{
    if(!localStorage.getItem('nexus_token')){navigate('/login',{replace:true});return;}
    refresh().catch(err=>{
      if(err.status===401){localStorage.removeItem('nexus_token');navigate('/login',{replace:true});}
      else setError(err.message);
    }).finally(()=>setLoading(false));
  },[refresh,navigate]);
  function logout(){localStorage.removeItem('nexus_token');navigate('/login',{replace:true});}
  async function acceptOffer(){
    setAccepting(true);setActionError('');
    try{
      await apiRequest('/student/offer/accept',{method:'POST'});
      await refresh();
    }catch(e){setActionError(e.message)}finally{setAccepting(false)}
  }
  async function declineOffer(){
    if(!window.confirm('Decline your admission offer? This will close your application.'))return;
    setAccepting(true);setActionError('');
    try{await apiRequest('/student/offer/decline',{method:'POST'});await refresh();}
    catch(e){setActionError(e.message)}finally{setAccepting(false)}
  }
  async function downloadOffer(){
    setActionError('');
    try{
      const response=await fetch('/api/student/offer',{
        headers:{Authorization:'Bearer '+localStorage.getItem('nexus_token')}
      });
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Offer letter unavailable');}
      const url=URL.createObjectURL(await response.blob());
      const link=document.createElement('a');link.href=url;link.download='RIC-offer.pdf';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setActionError(e.message)}
  }
  if(loading)return <main className="page narrow"><p>Loading your application…</p></main>;
  if(error)return <main className="page narrow"><section className="panel"><h2>Unable to load student journey</h2><p role="alert" className="error">{error}</p><button onClick={logout}>Return to login</button></section></main>;
  const step=resolveStep(journey||{});
  return <main className="page narrow student-journey">
    <div className="page-heading"><div><h1>Hi {journey?.full_name?.split(' ')[0]||'Student'}</h1>
      <p className="muted">{journey?.program_name||'Your course application'}</p></div>
      <button type="button" className="secondary" onClick={logout}>Log out</button></div>
    <nav className="journey-progress" aria-label="Application progress">
      {STEPS.map((label,i)=><div key={label} className={'journey-step '+(i<step?'done':i===step?'current':'future')}
        aria-current={i===step?'step':undefined}>
        <span className="journey-marker">{i<step?'✓':i+1}</span>
        <span className="journey-label">{label}</span>
      </div>)}
    </nav>
    {journey?.stage==='Closed'?<section className="panel"><h2>Application closed</h2><p>{journey.closed_reason||'Contact admissions for further information.'}</p></section>:
    step<=1?<EligibilitySection onCompleted={refresh}/>:
    step===2?<section className="panel">
      <h2>You're qualified to apply</h2>
      <p>Your preliminary eligibility assessment is saved. Continue by completing your enrolment details and submitting the required documents.</p>
      <ApplicationSection onUpdated={refresh}/>
    </section>:
    step===3?<section className="panel">
      <h2>{journey.application_status==='Draft'?'Complete your application':'We are checking your documents'}</h2>
      {journey.application_status==='Submitted'&&<p className="muted">Submitted {journey.application_submitted_at?new Date(journey.application_submitted_at).toLocaleDateString():''}. Staff will check your documents before the final decision.</p>}
      <ApplicationSection onUpdated={refresh}/>
      {journey.application_status!=='Draft'&&<DocumentReviewStatus/>}
    </section>:
    step===4?<section className="panel"><h2>Your offer</h2>
      <p>Your application has been accepted. Download your offer letter and accept it to complete enrolment.</p>
      <div className="actions"><button type="button" className="secondary" onClick={downloadOffer}>Download offer letter</button>
      <button type="button" disabled={accepting} onClick={acceptOffer}>{accepting?'Processing…':'Accept offer'}</button>
      <button type="button" className="secondary" disabled={accepting} onClick={declineOffer}>Decline offer</button></div>
      {actionError&&<p role="alert" className="error">{actionError}</p>}
    </section>:
    <section className="panel"><h2>You are enrolled</h2><p>Your offer has been accepted and your enrolment is recorded. Welcome to RIC.</p><button type="button" className="secondary" onClick={downloadOffer}>Download offer letter (PDF)</button></section>}
    {step>=2&&step<5&&<button type="button" className="secondary" onClick={()=>refresh().catch(e=>setActionError(e.message))}>Refresh progress</button>}
    {actionError&&step!==4&&<p role="alert" className="error">{actionError}</p>}
  </main>;
}

import React,{useEffect,useState} from 'react';
import {apiRequest} from '../api.js';
import {validateDocument} from '../validation.js';

export default function ApplicationSection({onUpdated}){
 const [info,setInfo]=useState(null),[form,setForm]=useState({date_of_birth:'',nationality:'',emergency_contact_name:'',emergency_contact_phone:'',intake_id:'',study_mode:''});
 const [docs,setDocs]=useState([]),[files,setFiles]=useState({}),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const data=await apiRequest('/student/application/status');setInfo(data);const uploaded=await apiRequest('/student/documents');setDocs(uploaded.documents||[]);if(data.application)setForm(previous=>({...previous,...Object.fromEntries(Object.keys(previous).map(k=>[k,k==='date_of_birth'&&data.application[k]?String(data.application[k]).slice(0,10):data.application[k]||'']))}));}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');
  try{await apiRequest('/student/application',{method:'POST',body:JSON.stringify(form)});
   setMessage('Application draft saved. Upload all required documents.');await load();await onUpdated?.();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function upload(type){
  const file=files[type];if(!file)return;
  const validation=validateDocument(file);if(validation){setError(validation);return;}
  setBusy(true);setError('');setMessage('');
  try{
   const contentBase64=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error('File read failed'));
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);
   });
   await apiRequest('/student/documents',{method:'POST',body:JSON.stringify({
    filename:file.name,mime_type:file.type,document_type:type,contentBase64
   })});
   setMessage(type+' uploaded for staff verification.');await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function continueToReview(){
  setBusy(true);setError('');setMessage('');
  try{
   await apiRequest('/student/application/continue',{method:'POST'});
   setMessage('Your verified application has been sent for final admissions review.');
   await load();await onUpdated?.();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function submit(){
  setBusy(true);setError('');setMessage('');
  try{await apiRequest('/student/application/submit',{method:'POST'});
   setMessage('Application submitted successfully. Staff will verify your documents.');await load();await onUpdated?.();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(!info)return <section><p>Loading application status…</p>{error&&<p role="alert" className="error">{error}</p>}</section>;
 if(!info.eligible)return <section><h2>Your application</h2>
   <p>Stage 2 is locked until you pass the preliminary assessment or staff approve your eligibility.</p>
   <button type="button" className="secondary" onClick={load}>Check eligibility status</button></section>;
 const locked=!!info.application&&info.application.status!=='Draft';
 return <section><h2>Step 2 — Application and documents</h2>
  <p className="muted">Application status: {info.application?.status||'Not started'}</p>
  <p>You meet the preliminary entry requirements. Complete your details and upload supporting documents to apply.</p>
  {!locked&&<form className="form-stack" onSubmit={save}>
    <h3>Enrolment details</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"12px"}}>
      <label>Date of birth *<input required type="date" value={form.date_of_birth} onChange={e=>setForm(p=>({...p,date_of_birth:e.target.value}))}/></label>
      <label>Nationality *<input required value={form.nationality} onChange={e=>setForm(p=>({...p,nationality:e.target.value}))}/></label>
      <label>Emergency contact name *<input required value={form.emergency_contact_name} onChange={e=>setForm(p=>({...p,emergency_contact_name:e.target.value}))}/></label>
      <label>Emergency contact phone *<input required type="tel" value={form.emergency_contact_phone} onChange={e=>setForm(p=>({...p,emergency_contact_phone:e.target.value}))}/></label>
      <label>Intake *<select required value={form.intake_id} onChange={e=>setForm(p=>({...p,intake_id:e.target.value}))}>
        <option value="">Select intake</option>
        {(info.intakes||[]).map(i=><option key={i.id} value={i.id}>{i.name} (starts {String(i.start_date).slice(0,10)})</option>)}
      </select></label>
      <label>Study mode *<select required value={form.study_mode} onChange={e=>setForm(p=>({...p,study_mode:e.target.value}))}>
        <option value="">Select study mode</option><option>On campus</option><option>Online</option><option>Blended</option>
      </select></label>
    </div>
    {!info.intakes?.length&&<p className="error">No open intakes are configured for your program. Please contact admissions.</p>}
    <button type="submit" disabled={busy||!info.intakes?.length}>{busy?'Saving…':'Save draft'}</button>
  </form>}
  {info.application&&<div>
   <h3>Documents</h3><p className="muted">PDF, JPG or PNG, up to 10 MB each.</p>
   {!info.requiredDocuments?.length?<p>No program document requirements are configured. Staff should confirm the checklist.</p>:
    <ul>{info.requiredDocuments.map(d=><li key={d.document_type}>
      <strong>{d.document_type}</strong>{d.is_required?' (required)':' (optional)'}<p className="muted">{docs.find(item=>item.document_type===d.document_type)?.status||'Not uploaded yet'}</p>
      {!locked&&<><input type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label={'Upload '+d.document_type}
       onChange={e=>setFiles(p=>({...p,[d.document_type]:e.target.files?.[0]}))}/>
       <button type="button" disabled={busy||!files[d.document_type]} onClick={()=>upload(d.document_type)}>Upload document</button></>}
     </li>)}</ul>}
   {!locked&&<button type="button" disabled={busy||!info.requiredDocuments?.length||!info.intakes?.length}
      onClick={submit}>{busy?'Submitting…':'Submit application for review'}</button>}
  </div>}
  {info.application?.status==='Submitted' && <>
    {info.canContinue ?
      <button type="button" disabled={busy} onClick={continueToReview}>
        {busy?'Continuing…':'Continue to next stage'}
      </button> :
      <p className="muted">The next stage unlocks once staff verifies every required document.</p>}
  </>}
  {info.application?.status==='Under review'&&
   <div role="status"><h3>Stage 3 — Final admissions review</h3>
    <p>All required documents have been verified. Your application is now awaiting a final staff decision.</p>
   </div>}
  {error&&<p role="alert" className="error">{error}</p>}
  {message&&<p role="status" className="success">{message}</p>}
  <button type="button" className="secondary" onClick={load}>Refresh application status</button>
 </section>;
}

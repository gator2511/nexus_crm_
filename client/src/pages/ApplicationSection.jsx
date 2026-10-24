import React,{useEffect,useState} from 'react';
import {apiRequest} from '../api.js';
import {validateDocument} from '../validation.js';

export default function ApplicationSection(){
 const [info,setInfo]=useState(null),[form,setForm]=useState({qualification:'',institution:'',graduationYear:''});
 const [files,setFiles]=useState({}),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setInfo(await apiRequest('/student/application/status'));}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');
  try{await apiRequest('/student/application',{method:'POST',body:JSON.stringify(form)});
   setMessage('Application draft saved. Upload all required documents.');await load();
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
 async function submit(){
  setBusy(true);setError('');setMessage('');
  try{await apiRequest('/student/application/submit',{method:'POST'});
   setMessage('Application submitted successfully. Staff will verify your documents.');await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(!info)return <section><p>Loading application status…</p>{error&&<p role="alert" className="error">{error}</p>}</section>;
 if(!info.eligible)return <section><h2>Step 2 — Application and documents</h2>
   <p>Stage 2 is locked until you pass the preliminary assessment or staff approve your eligibility.</p>
   <button type="button" className="secondary" onClick={load}>Check eligibility status</button></section>;
 const locked=!!info.application&&info.application.status!=='Draft';
 return <section><h2>Step 2 — Application and documents</h2>
  <p className="muted">Application status: {info.application?.status||'Not started'}</p>
  {!locked&&<form className="form-stack" onSubmit={save}>
   <label>Qualification title<input required value={form.qualification} onChange={e=>setForm(p=>({...p,qualification:e.target.value}))}/></label>
   <label>Institution<input required value={form.institution} onChange={e=>setForm(p=>({...p,institution:e.target.value}))}/></label>
   <label>Graduation year<input type="number" min="1950" max={new Date().getFullYear()+1} value={form.graduationYear} onChange={e=>setForm(p=>({...p,graduationYear:e.target.value}))}/></label>
   <button disabled={busy}>{busy?'Saving…':'Save application draft'}</button>
  </form>}
  {info.application&&<div>
   <h3>Document checklist</h3>
   {!info.requiredDocuments?.length?<p>No program document requirements are configured. Staff should confirm the checklist.</p>:
    <ul>{info.requiredDocuments.map(d=><li key={d.document_type}>
      <strong>{d.document_type}</strong>{d.is_required?' (required)':' (optional)'}
      {!locked&&<><input type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label={'Upload '+d.document_type}
       onChange={e=>setFiles(p=>({...p,[d.document_type]:e.target.files?.[0]}))}/>
       <button type="button" disabled={busy||!files[d.document_type]} onClick={()=>upload(d.document_type)}>Upload document</button></>}
     </li>)}</ul>}
   {!locked&&<button type="button" disabled={busy||!info.requiredDocuments?.length}
      onClick={submit}>{busy?'Submitting…':'Submit application for review'}</button>}
  </div>}
  {error&&<p role="alert" className="error">{error}</p>}
  {message&&<p role="status" className="success">{message}</p>}
  <button type="button" className="secondary" onClick={load}>Refresh application status</button>
 </section>;
}

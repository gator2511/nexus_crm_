import React,{useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {studentLogin} from '../api.js';

export default function Login(){
 const navigate=useNavigate();
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e){
  e.preventDefault();setError('');setBusy(true);
  try{const data=await studentLogin({email:email.trim(),password});
   if(!data?.token)throw new Error('Unable to create your session.');
   localStorage.setItem('nexus_token',data.token);navigate('/portal',{replace:true});
  }catch(e){setError(e.message||'Unable to sign in. Check your credentials.');}
  finally{setBusy(false)}
 }
 return <main className="auth-layout">
  <section className="auth-story" aria-label="Student admissions">
   <span className="eyebrow">NEXUS CRM · STUDENT ADMISSIONS</span>
   <h1>Your next chapter starts here.</h1>
   <p>One secure place to manage your course enquiry, eligibility review, application and admission offer.</p>
   <div className="auth-story-steps"><span>01 · Apply</span><span>02 · Get reviewed</span><span>03 · Enrol</span></div>
  </section>
  <section className="auth-card">
   <span className="eyebrow">STUDENT PORTAL</span>
   <h2>Welcome back</h2>
   <p className="muted">Sign in to continue your application where you left off.</p>
   <form className="form-stack" onSubmit={submit}>
    <label htmlFor="student-email">Email address<input id="student-email" type="email" required autoComplete="username" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label htmlFor="student-password">Password
     <span className="password-field"><input id="student-password" type={show?'text':'password'} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?'Hide':'Show'}</button></span>
    </label>
    {error&&<p role="alert" className="error">{error}</p>}
    <button type="submit" disabled={busy} className="auth-submit">{busy?'Signing in…':'Sign in to your portal'}</button>
   </form>
   <p className="auth-footnote">New to RIC? <Link to="/enquiry">Start a course enquiry</Link></p>
   <p className="auth-footnote">Recruitment team? <Link to="/staff/login">Staff sign in</Link></p>
  </section>
 </main>;
}

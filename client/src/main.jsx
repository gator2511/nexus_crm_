import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link,NavLink,useLocation} from 'react-router-dom';
import Enquiry from './pages/Enquiry.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Portal from './pages/Portal.jsx';
import StaffLogin from './pages/StaffLogin.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import './styles.css';

function LockIcon(){return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>}
function SiteHeader(){
 const [open,setOpen]=useState(false);
 const {pathname}=useLocation();
 React.useEffect(()=>setOpen(false),[pathname]);
 const active=({isActive})=>isActive?'nav-link active':'nav-link';
 return <header className="modern-header">
  <div className="header-inner">
   <Link className="modern-brand" to="/" aria-label="Nexus CRM home"><span className="brand-symbol">N<span className="brand-spark">✦</span></span><span className="brand-wordmark">Nexus<span>CRM</span><small>STUDENT ADMISSIONS</small></span></Link>
   <button className="mobile-menu-toggle" type="button" aria-expanded={open} aria-controls="nexus-navigation" aria-label={open?'Close navigation':'Open navigation'} onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button>
   <nav id="nexus-navigation" className={'modern-nav'+(open?' is-open':'')} aria-label="Main navigation">
    <NavLink end to="/" className={active}>Home</NavLink>
    <NavLink to="/enquiry" className={active}>Course Enquiry</NavLink>
    <NavLink to="/login" className={active}><span>Student</span><span className="nav-secure"><LockIcon/> Login</span></NavLink>
    <NavLink to="/staff/login" className={active}><span>Staff</span><span className="nav-secure"><LockIcon/> Login</span></NavLink>
   </nav>
  </div>
 </header>;
}
function Home(){
 return <main className="home-page">
  <section className="home-hero">
   <div className="home-hero-copy"><span className="home-kicker"><span className="pulse-dot"/> Student recruitment, made simple</span>
    <h1>One clear path from <span>enquiry to enrolment.</span></h1>
    <p>Nexus CRM brings students and admissions teams together. Explore programs, check preliminary eligibility, submit documents and follow every step of your application in one place.</p>
    <div className="home-actions"><Link className="home-button primary" to="/enquiry">Enquire about a course <span aria-hidden="true">↗</span></Link><Link className="home-button outline" to="/login">Continue my application</Link></div>
    <p className="home-note">Already part of the admissions team? <Link to="/staff/login">Staff sign in</Link></p>
   </div>
   <div className="home-visual" aria-label="Six stages of the admissions journey">
    <div className="home-visual-top"><span className="home-status-icon">✦</span><span>YOUR ADMISSIONS JOURNEY</span><span className="home-status-chip">6 steps</span></div>
    {['Enquiry','Review','Qualified','Application','Offer','Enrolled'].map((name,i)=><div className={'home-visual-step '+(i<3?'complete':i===3?'inprogress':'')} key={name}><span className="home-step-marker">{i<3?'✓':String(i+1).padStart(2,'0')}</span><span>{name}</span><span className="home-step-state">{i<3?'Completed':i===3?'In progress':'Upcoming'}</span></div>)}
    <div className="home-visual-foot">Your progress is saved securely so you can return anytime.</div>
   </div>
  </section>
  <section className="home-features" aria-label="How Nexus CRM helps"><div className="home-section-heading"><span className="eyebrow">BUILT FOR A BETTER EXPERIENCE</span><h2>Everything in one connected journey</h2></div>
   <div className="home-feature-grid"><article className="home-feature"><span className="home-feature-icon">01</span><h3>For future students</h3><p>Enquire, check entry requirements and resume your application without losing progress.</p><Link to="/enquiry">Start an enquiry</Link></article>
    <article className="home-feature"><span className="home-feature-icon">02</span><h3>Documents & decisions</h3><p>Upload supporting documents and follow their verification status as admissions staff review them.</p><Link to="/login">Go to student login</Link></article>
    <article className="home-feature"><span className="home-feature-icon">03</span><h3>For admissions teams</h3><p>Review applications, verify documents and coordinate decisions through a dedicated staff dashboard.</p><Link to="/staff/login">Staff access</Link></article></div>
  </section>
 </main>;
}
function App(){
 return <BrowserRouter><SiteHeader/><Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/enquiry" element={<Enquiry/>}/>
  <Route path="/login" element={<Login/>}/>
  <Route path="/signup" element={<Signup/>}/>
  <Route path="/portal" element={<Portal/>}/>
  <Route path="/staff/login" element={<StaffLogin/>}/>
  <Route path="/staff/dashboard" element={<StaffDashboard/>}/>
  <Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/">Return home</Link></main>}/>
 </Routes></BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);

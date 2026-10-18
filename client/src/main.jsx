import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Enquiry from './pages/Enquiry.jsx';
import Login from './pages/Login.jsx';
import Portal from './pages/Portal.jsx';
import StaffLogin from './pages/StaffLogin.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import './styles.css';

function App() {
  return <BrowserRouter>
    <header className="site-header">
      <Link className="brand" to="/">Nexus CRM</Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link to="/enquiry">Course enquiry</Link>
        <Link to="/login">Student login</Link>
        <Link to="/portal">Student portal</Link>
        <Link to="/staff/dashboard">Staff dashboard</Link>
      </nav>
    </header>
    <Routes>
      <Route path="/" element={<Navigate to="/enquiry" replace />} />
      <Route path="/enquiry" element={<Enquiry />} />
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/staff/dashboard" element={<StaffDashboard />} />
      <Route path="*" element={<main className="page"><h1>Page not found</h1></main>} />
    </Routes>
  </BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

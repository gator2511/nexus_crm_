import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';


function App() {
  const [status, setStatus] = useState('Checking the API…');
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setStatus(d.ok ? 'API is running' : 'API problem'))
      .catch(() => setStatus('Cannot reach the API'));
  }, []);
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Nexus CRM</h1>
      <p>{status}</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
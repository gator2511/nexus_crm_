import React, {useEffect, useState} from 'react';
import {apiRequest} from '../api.js';
import {validateDocument} from '../validation.js';

export default function DocumentReviewStatus() {
  const [documents,setDocuments] = useState([]);
  const [error,setError] = useState('');
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(null);
  async function load() {
    try {
      const response = await apiRequest('/student/documents');
      setDocuments(response.documents || []);
    } catch (err) {setError(err.message);}
  }
  useEffect(() => {load();}, []);

  async function replace(doc, file) {
    if (!file) return;
    const issue = validateDocument(file);
    if (issue) {setError(issue);return;}
    setBusy(doc.id);setError('');setStatus('');
    try {
      const contentBase64 = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read document'));
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(file);
      });
      await apiRequest('/student/documents',{
        method:'POST',
        body:JSON.stringify({
          filename:file.name,mime_type:file.type,
          document_type:doc.document_type,contentBase64
        }),
      });
      setStatus('Replacement uploaded. Staff will review the new document.');
      await load();
    } catch (err) {setError(err.message);}
    finally {setBusy(null);}
  }

  return <section className="panel">
    <h2>Document review status</h2>
    <p className="muted">You can replace a rejected document. Staff will review the replacement.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {status && <p role="status" className="success">{status}</p>}
    {!documents.length ? <p>No uploaded documents yet.</p> : <ul>
      {documents.map(doc => <li key={doc.id}>
        <strong>{doc.document_type}</strong> — {doc.status}
        {doc.rejection_reason && <p>Reason: {doc.rejection_reason}</p>}
        {doc.status === 'Rejected' && <label>
          Replace document (PDF, JPG or PNG; 10 MB maximum)
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy!==null}
            onChange={e => replace(doc,e.target.files?.[0])}/>
        </label>}
      </li>)}
    </ul>}
    <button className="secondary" type="button" onClick={load}>Refresh status</button>
  </section>;
}

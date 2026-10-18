import React, { useState } from 'react';
import { apiRequest } from '../api.js';
import { validateDocument } from '../validation.js';

export default function ApplicationSection() {
  const [form, setForm] = useState({ qualification: '', institution: '', graduationYear: '' });
  const [document, setDocument] = useState(null);
  const [documentType, setDocumentType] = useState('Academic transcript');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  function update(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); }
  function chooseFile(e) {
    const file = e.target.files?.[0] || null;
    const error = file ? validateDocument(file) : '';
    setDocument(error ? null : file);
    setStatus(error || '');
  }
  async function uploadFile(file) {
    const contentBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read selected document'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return apiRequest('/student/documents', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name, mime_type: file.type,
        document_type: documentType, contentBase64,
      }),
    });
  }
  async function submit(e) {
    e.preventDefault(); setStatus('');
    if (!form.qualification.trim() || !form.institution.trim()) {
      setStatus('Qualification and institution are required.'); return;
    }
    setBusy(true);
    try {
      const created = await apiRequest('/student/application', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (document) {
        await uploadFile(document);
        setStatus('Application draft saved and supporting document uploaded. Upload all other required documents before final submission.');
      } else {
        setStatus('Application draft saved. Add required documents before submitting.');
      }
      if (!created?.applicationId) throw new Error('Application ID missing from response');
    } catch (error) { setStatus(error.message || 'Unable to save application'); }
    finally { setBusy(false); }
  }
  return <section>
    <h2>Application details</h2>
    <form onSubmit={submit} className="form-stack">
      <label>Qualification<input required name="qualification" value={form.qualification} onChange={update} /></label>
      <label>Institution<input required name="institution" value={form.institution} onChange={update} /></label>
      <label>Graduation year<input type="number" min="1950" name="graduationYear" value={form.graduationYear} onChange={update} /></label>
      <label>Document type
        <select value={documentType} onChange={e => setDocumentType(e.target.value)}>
          <option>Academic transcript</option>
          <option>Passport or photo ID</option>
          <option>English test result</option>
        </select>
      </label>
      <label>Supporting document (PDF, JPG or PNG; maximum 10 MB)
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={chooseFile} />
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save application draft'}</button>
      {status && <p role="status">{status}</p>}
    </form>
  </section>;
}

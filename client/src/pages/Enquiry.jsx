import React, { useEffect, useState } from 'react';
import { apiRequest, submitEnquiry } from '../api.js';
import { validateEnquiry } from '../validation.js';

const fields = [
  ['full_name', 'Full name', 'text'],
  ['email', 'Email address', 'email'],
  ['phone', 'Phone number', 'tel'],
  ['address', 'Address', 'text'],
];

export default function Enquiry() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', address: '',
    program_id: '', message: '', consent: false,
  });
  const [programs, setPrograms] = useState([]);
  const [programError, setProgramError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    apiRequest('/programs')
      .then(result => { if (active) setPrograms(result.programs || []); })
      .catch(err => { if (active) setProgramError(err.message || 'Unable to load programs'); });
    return () => { active = false; };
  }, []);

  function update(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  }

  async function submit(e) {
    e.preventDefault();
    const nextErrors = validateEnquiry(form);
    if (!form.consent) nextErrors.consent = 'Consent is required';
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setLoading(true); setStatus(null);
    try {
      const result = await submitEnquiry(form);
      const emailState = result.brochureEmailStatus;
      setStatus({ ok: true, text: emailState === 'Sent'
        ? 'Enquiry submitted. Your brochure email has been sent.'
        : 'Enquiry submitted. Brochure email was not confirmed; please contact admissions if needed.' });
      setForm({ full_name: '', email: '', phone: '', address: '',
        program_id: '', message: '', consent: false });
    } catch (err) {
      setStatus({ ok: false, text: err.message || 'Unable to submit enquiry.' });
      if (err.details) setErrors(err.details);
    } finally { setLoading(false); }
  }

  return <main className="page narrow">
    <section className="panel">
      <h1>Enquire about a program</h1>
      <p className="muted">Complete the form and select the course you're interested in.</p>
      <form className="form-stack" onSubmit={submit} noValidate>
        {fields.map(([name, label, type]) => <label key={name} htmlFor={name}>
          {label}
          <input id={name} name={name} type={type} value={form[name]}
            onChange={update} aria-invalid={!!errors[name]} required />
          {errors[name] && <span role="alert" className="error">{errors[name]}</span>}
        </label>)}
        <label htmlFor="program_id">Program
          <select id="program_id" name="program_id" required value={form.program_id}
            onChange={update} disabled={!!programError || !programs.length}
            aria-invalid={!!errors.program_id}>
            <option value="">{programs.length ? 'Select a program' : 'No programs available'}</option>
            {programs.map(program => <option key={program.id} value={program.id}>
              {program.name}{program.discipline ? ' — ' + program.discipline : ''}
            </option>)}
          </select>
          {errors.program_id && <span role="alert" className="error">{errors.program_id}</span>}
          {programError && <span role="alert" className="error">Unable to load programs: {programError}</span>}
        </label>
        <label htmlFor="message">Message (optional)
          <textarea id="message" name="message" rows="3"
            value={form.message} onChange={update} />
        </label>
        <label style={{ display:'flex',alignItems:'flex-start',gap:10,fontWeight:400 }}>
          <input style={{ width:'auto',marginTop:4 }} type="checkbox" name="consent"
            checked={form.consent} onChange={update} />
          I consent to being contacted about my course enquiry.
        </label>
        {errors.consent && <span role="alert" className="error">{errors.consent}</span>}
        <button disabled={loading || !!programError || !programs.length}>
          {loading ? 'Submitting…' : 'Submit enquiry'}
        </button>
        {status && <p role="status" className={status.ok ? 'success' : 'error'}>{status.text}</p>}
      </form>
    </section>
  </main>;
}

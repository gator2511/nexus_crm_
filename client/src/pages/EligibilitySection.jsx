import React, {useEffect,useState} from 'react';
import {apiRequest} from '../api.js';

const initial = {program_id:'',qualification_level:'',highest_qualification:'',
  institution:'',year_completed:'',result:'',english_test:'IELTS',
  english_score:'',test_date:''};
const levels = [
  [1,'Year 12'],[2,'Certificate'],[3,'Diploma'],[4,'Bachelor'],[5,'Master']
];
export default function EligibilitySection() {
  const [form,setForm] = useState(initial);
  const [programs,setPrograms] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [result,setResult] = useState(null);
  const [locked,setLocked] = useState(false);
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    Promise.all([apiRequest('/programs'),apiRequest('/student/qualification/status')])
      .then(([programData,status])=>{
        setPrograms(programData.programs || []);
        if(status.completed && status.qualification){
          const q=status.qualification;
          setLocked(true);
          setForm({...initial,program_id:q.program_id || '',qualification_level:'',
            highest_qualification:q.highest_qualification || '',institution:q.institution || '',
            year_completed:q.year_completed || '',result:q.result || '',
            english_test:q.english_test || 'IELTS',english_score:q.english_score ?? '',
            test_date:q.test_date ? String(q.test_date).slice(0,10) : ''});
          setResult({status:q.decision || q.auto_result,reason:q.auto_reasons?.reason || 'Saved assessment'});
        }
      }).catch(err => setError(err.message)).finally(()=>setLoading(false));
  },[]);
  function change(e) {setForm(previous => ({...previous,[e.target.name]:e.target.value}));setResult(null);}
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const data = await apiRequest('/student/qualification/assess',{
        method:'POST',body:JSON.stringify({
          ...form,qualification_level:Number(form.qualification_level),
          english_score:Number(form.english_score),
          year_completed:form.year_completed ? Number(form.year_completed) : null
        })
      });
      setResult(data.assessment);
      setLocked(true);
    } catch(err) {setError(err.message || 'Assessment could not be completed');}
    finally {setBusy(false);}
  }
  return <section className="panel">
    <h2>Step 1 — Academic and English eligibility</h2>
    <p className="muted">Enter your qualifications and English test score. Results are preliminary and subject to staff verification.</p>
    {loading && <p role="status">Loading saved Stage 1 information…</p>}
    {locked && <p role="status">Stage 1 completed — your saved information is locked. Continue with Step 2 below.</p>}
    <form className="form-stack" onSubmit={submit}>
      <fieldset disabled={locked || loading || busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
      <label>Enquired program
        <select required name="program_id" value={form.program_id} onChange={change}>
          <option value="">Select your program</option>
          {programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Highest qualification level
        <select required name="qualification_level" value={form.qualification_level} onChange={change}>
          <option value="">Select qualification level</option>
          {levels.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Qualification title <input required name="highest_qualification" value={form.highest_qualification} onChange={change}/></label>
      <label>Institution <input required name="institution" value={form.institution} onChange={change}/></label>
      <label>Completion year <input required type="number" min="1950" max={new Date().getFullYear()+1}
        name="year_completed" value={form.year_completed} onChange={change}/></label>
      <label>Academic result (e.g. GPA / percentage)
        <input name="result" value={form.result} onChange={change}/>
      </label>
      <label>English-language test
        <select name="english_test" value={form.english_test} onChange={change}>
          <option>IELTS</option><option>PTE</option><option>TOEFL</option>
        </select>
      </label>
      <label>English test score
        <input required type="number" step="0.1" min="0" name="english_score" value={form.english_score} onChange={change}/>
      </label>
      <label>Test date <input type="date" name="test_date" value={form.test_date} onChange={change}/></label>
      {!locked && <button disabled={busy || !programs.length}>{busy?'Assessing…':'Submit eligibility assessment'}</button>}
      </fieldset>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div role="status">
      <h3>Preliminary outcome: {result.status}</h3>
      <p>{result.reason}</p>
      <p>{result.status==='Pass'
        ? 'You may continue with your application and upload required documents.'
        : 'Your eligibility requires staff review. Your details have been sent to the review queue.'}</p>
    </div>}
  </section>;
}

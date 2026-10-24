import React,{useEffect,useState} from 'react';
import {apiRequest} from '../api.js';

const tests=['IELTS','PTE','TOEFL'];
export default function ProgramCriteria() {
  const [programs,setPrograms]=useState([]);
  const [selected,setSelected]=useState('');
  const [level,setLevel]=useState('4');
  const [scores,setScores]=useState({IELTS:'',PTE:'',TOEFL:''});
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [role,setRole]=useState('');
  const auth=()=>({Authorization:'Bearer '+sessionStorage.getItem('nexus_staff_token')});
  async function load(){
    try {
      const [result,me]=await Promise.all([
        apiRequest('/staff/program-criteria',{headers:auth()}),
        apiRequest('/staff/me',{headers:auth()})
      ]);
      setPrograms(result.programs || []);
      setRole(me.staff?.role || '');
    }catch(e){setError(e.message);}
  }
  useEffect(()=>{load();},[]);
  function choose(id){
    setSelected(id);setError('');setMessage('');
    const program=programs.find(p=>p.id===id);
    setLevel(String(program?.min_qualification_level ?? 4));
    setScores(Object.fromEntries(tests.map(t=>[t,
      program?.language_requirements?.[t] === undefined?'':String(program.language_requirements[t])
    ])));
  }
  async function save(e){
    e.preventDefault();setError('');setMessage('');setSaving(true);
    try{
      const thresholds={};
      for(const test of tests) if(scores[test].trim()!=='') thresholds[test]=Number(scores[test]);
      const result=await apiRequest('/staff/program-criteria/'+selected,{
        method:'PUT',headers:auth(),
        body:JSON.stringify({min_qualification_level:Number(level),language_requirements:thresholds})
      });
      setPrograms(previous=>previous.map(p=>p.id===selected?result.program:p));
      setMessage('Criteria saved. New preliminary assessments will use these thresholds.');
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  }
  return <section className="panel">
    <h2>Program eligibility criteria</h2>
    <p className="muted">Configured thresholds are used for preliminary assessments. Existing decisions are not recalculated.</p>
    {role && role!=='manager' && <p>Only managers can edit criteria.</p>}
    <form className="form-stack" onSubmit={save}>
      <label>Program
        <select value={selected} onChange={e=>choose(e.target.value)}>
          <option value="">Select program</option>
          {programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {selected && <>
        <label>Minimum qualification level
          <select value={level} disabled={role!=='manager'} onChange={e=>setLevel(e.target.value)}>
            <option value="1">Year 12</option><option value="2">Certificate</option>
            <option value="3">Diploma</option><option value="4">Bachelor</option>
            <option value="5">Master</option>
          </select>
        </label>
        {tests.map(test=><label key={test}>Minimum {test} score (leave blank if not accepted)
          <input type="number" min="0" max={test==='IELTS'?9:test==='PTE'?90:120}
            step={test==='IELTS'?'0.5':'1'} value={scores[test]}
            disabled={role!=='manager'}
            onChange={e=>setScores(prev=>({...prev,[test]:e.target.value}))}/>
        </label>)}
        {role==='manager' && <button disabled={saving}>{saving?'Saving…':'Save criteria'}</button>}
      </>}
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="success">{message}</p>}
  </section>;
}

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { getDashboardSummary } from '../dashboard.js';
import { createStaffToken, requireStaff } from '../staffAuth.js';

export const staffRouter = Router();

staffRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== 'string' || !password)
      return res.status(400).json({ message: 'Email and password are required' });
    const { rows } = await query(
      'SELECT id, full_name, email, role, password_hash FROM staff_user WHERE lower(email)=$1 AND is_active=TRUE LIMIT 1',
      [email]
    );
    const staff = rows[0];
    const placeholder = '$2b$10$abcdefghijklmnopqrstuuWfI5RrBmGi0eznKGdbHylQeDfcAxO8C';
    const valid = await bcrypt.compare(password, staff?.password_hash || placeholder);
    if (!staff || !valid) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: createStaffToken(staff.id), staff: {
      id: staff.id, full_name: staff.full_name, email: staff.email, role: staff.role,
    } });
  } catch (error) { next(error); }
});

staffRouter.use(requireStaff);
staffRouter.get('/me', (req, res) => res.json({ staff: req.staff }));
staffRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const [prospects, recent] = await Promise.all([
      query('SELECT stage FROM prospect'),
      query(`SELECT p.id, p.full_name, p.email, p.stage, p.created_at
             FROM prospect p ORDER BY p.created_at DESC LIMIT 10`),
    ]);
    res.json({
      summary: getDashboardSummary(prospects.rows),
      recentProspects: recent.rows,
    });
  } catch (error) { next(error); }
});

const STAGES = ['Enquiry','Qualification review','Qualified','Application','Offer','Enrolled','Closed'];
const TRANSITIONS = {
  'Enquiry': ['Qualification review','Closed'],
  'Qualification review': ['Qualified','Closed'],
  'Qualified': ['Application','Closed'],
  'Application': ['Offer','Closed'],
  'Offer': ['Enrolled','Closed'],
  'Enrolled': [],
  'Closed': [],
};

staffRouter.get('/prospects', async (_req,res,next) => {
  try {
    const {rows} = await query('SELECT id,full_name,email,stage,created_at FROM prospect ORDER BY created_at DESC LIMIT 100');
    res.json({prospects:rows});
  } catch(err){next(err);}
});

staffRouter.post('/prospects/:id/stage', async (req,res,next) => {
  try {
    const {stage,closed_reason:reason} = req.body || {};
    if (!STAGES.includes(stage)) return res.status(422).json({message:'Invalid stage'});
    const {withTransaction} = await import('../db.js');
    const result = await withTransaction(async client => {
      const found = await client.query('SELECT id,stage FROM prospect WHERE id=$1 FOR UPDATE',[req.params.id]);
      if (!found.rowCount) return {errorCode:404,message:'Prospect not found'};
      const previous = found.rows[0].stage;
      if (!TRANSITIONS[previous].includes(stage)) return {errorCode:422,message:'Invalid stage transition'};
      if ((stage === 'Closed') !== !!reason)
        return {errorCode:422,message:'Closed stage requires a reason'};
      const validReasons = ['No response','Not eligible','Application rejected','Offer declined','Offer lapsed','Withdrawn'];
      if(reason && !validReasons.includes(reason))
        return {errorCode:422,message:'Invalid closed reason'};
      await client.query('UPDATE prospect SET stage=$1,closed_reason=$2 WHERE id=$3',[stage,reason||null,req.params.id]);
      await client.query(`INSERT INTO stage_history(prospect_id,from_stage,to_stage,closed_reason,changed_by_type,changed_by_id)
        VALUES($1,$2,$3,$4,'staff',$5)`,[req.params.id,previous,stage,reason||null,req.staff.id]);
      return {stage,previous};
    });
    if(result.errorCode) return res.status(result.errorCode).json(result);
    res.json(result);
  } catch(err){next(err);}
});

staffRouter.get('/prospects/:id/history', async(req,res,next)=>{
  try {
    const found = await query('SELECT id FROM prospect WHERE id=$1',[req.params.id]);
    if (!found.rowCount) return res.status(404).json({message:'Prospect not found'});
    const {rows} = await query(`SELECT from_stage,to_stage,closed_reason,changed_by_type,changed_at
      FROM stage_history WHERE prospect_id=$1 ORDER BY changed_at,id`,[req.params.id]);
    res.json({history:rows});
  } catch(err){next(err);}
});

staffRouter.get('/reports', async (_req,res,next) => {
  try {
    const {rows} = await query('SELECT stage, COUNT(*)::int AS count FROM prospect GROUP BY stage ORDER BY stage');
    const total = rows.reduce((sum,row)=>sum+row.count,0);
    res.json({totalProspects:total,byStage:rows});
  } catch(err){next(err);}
});

staffRouter.post('/jobs/run', async(req,res,next) => {
  try {
    if (req.staff.role !== 'manager') return res.status(403).json({message:'Manager permission required'});
    const {rows} = await query(`UPDATE task SET escalated_at=NOW()
      WHERE status='Open' AND due_at<NOW() AND escalated_at IS NULL
      RETURNING id`);
    res.json({escalated:rows.length});
  } catch(err){next(err);}
});

staffRouter.post('/documents/:id/reject', async(req,res,next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) return res.status(422).json({message:'Rejection reason required'});
    const {rows} = await query(`UPDATE document SET status='Rejected', rejection_reason=$1,
      verified_by=$2,verified_at=NOW() WHERE id=$3 AND issued=FALSE
      RETURNING id,status`,[reason,req.staff.id,req.params.id]);
    if(!rows.length) return res.status(404).json({message:'Student document not found'});
    res.json(rows[0]);
  } catch(err){next(err);}
});

/** Work queue is derived from current qualification and document decisions.
 * This avoids treating a correctable document rejection as academic ineligibility.
 */
staffRouter.get('/pending-review', async (_req, res, next) => {
  try {
    const {rows} = await query(`
      SELECT p.id, p.full_name, p.email, p.stage,
             q.auto_result AS qualification_result,
             COALESCE(COUNT(d.id) FILTER (WHERE d.status='Rejected'),0)::int AS rejected_documents,
             COALESCE(COUNT(d.id) FILTER (WHERE d.status='Pending'),0)::int AS pending_documents
      FROM prospect p
      LEFT JOIN qualification q ON q.prospect_id=p.id
      LEFT JOIN application a ON a.prospect_id=p.id
      LEFT JOIN document d ON d.application_id=a.id AND d.issued=FALSE
      WHERE p.stage <> 'Closed'
      GROUP BY p.id,p.full_name,p.email,p.stage,q.auto_result
      HAVING q.auto_result IN ('Fail','Review')
          OR COUNT(d.id) FILTER (WHERE d.status IN ('Rejected','Pending') AND a.status IN ('Submitted','Under review')) > 0
      ORDER BY p.full_name
    `);
    res.json({prospects:rows});
  } catch (error) { next(error); }
});

staffRouter.get('/prospects/:id/documents', async (req, res, next) => {
  try {
    const {rows} = await query(`
      SELECT d.id,d.document_type,d.file_name,d.status,d.rejection_reason,d.uploaded_at,
             a.status AS application_status
      FROM document d JOIN application a ON a.id=d.application_id
      WHERE a.prospect_id=$1 AND d.issued=FALSE ORDER BY d.uploaded_at DESC`,
    [req.params.id]);
    res.json({documents:rows});
  } catch (error) { next(error); }
});

staffRouter.post('/documents/:id/verify', async (req, res, next) => {
  try {
    const {rows} = await query(`
      UPDATE document SET status='Verified', rejection_reason=NULL,
        verified_by=$1,verified_at=NOW()
      WHERE id=$2 AND issued=FALSE AND status='Pending'
      RETURNING id,status`,[req.staff.id,req.params.id]);
    if (!rows.length) return res.status(409).json({message:'Pending student document not found'});
    res.json(rows[0]);
  } catch (error) { next(error); }
});

/** Program entry thresholds. Only managers can change admissions criteria. */
staffRouter.get('/program-criteria', async (_req,res,next) => {
  try {
    const {rows}=await query(`SELECT id,name,discipline,is_active,min_qualification_level,language_requirements
      FROM program ORDER BY name,id`);
    res.json({programs:rows});
  } catch(error){next(error);}
});

staffRouter.put('/program-criteria/:id', async (req,res,next) => {
  try {
    if(req.staff.role!=='manager') return res.status(403).json({message:'Manager permission required'});
    const level=req.body?.min_qualification_level;
    const language=req.body?.language_requirements;
    if(!Number.isInteger(level)||level<1||level>5||
       !language||typeof language!=='object'||Array.isArray(language)||
       Object.keys(language).some(k=>!['IELTS','PTE','TOEFL'].includes(k))||
       !Object.keys(language).length)
      return res.status(422).json({message:'Select qualification level 1–5 and at least one English threshold'});
    const ranges={IELTS:[0,9],PTE:[0,90],TOEFL:[0,120]};
    for(const [test,score] of Object.entries(language)){
      if(typeof score!=='number'||!Number.isFinite(score)||score<ranges[test][0]||score>ranges[test][1])
        return res.status(422).json({message:'Invalid score for '+test});
    }
    const {withTransaction}=await import('../db.js');
    const result=await withTransaction(async client=>{
      const previous=await client.query('SELECT * FROM program WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!previous.rowCount) return null;
      const updated=await client.query(`
        UPDATE program SET min_qualification_level=$1,language_requirements=$2::jsonb
        WHERE id=$3 RETURNING id,name,discipline,is_active,min_qualification_level,language_requirements
      `,[level,JSON.stringify(language),req.params.id]);
      await client.query(`
        INSERT INTO audit_log(actor_type,actor_id,action,detail)
        VALUES('staff',$1,'program_criteria_updated',$2::jsonb)
      `,[req.staff.id,JSON.stringify({program_id:req.params.id,before:{
        min_qualification_level:previous.rows[0].min_qualification_level,
        language_requirements:previous.rows[0].language_requirements
      },after:{min_qualification_level:level,language_requirements:language}})]);
      return updated.rows[0];
    });
    if(!result) return res.status(404).json({message:'Program not found'});
    res.json({program:result});
  } catch(error){next(error);}
});

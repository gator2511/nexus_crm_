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

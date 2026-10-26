/** Kenil Gevariya — student login and current-user routes. */
import {Router} from 'express';
import bcrypt from 'bcryptjs';
import {query} from '../db.js';
import {createStudentToken, requireStudent} from '../auth.js';
export const studentAuthRouter = Router();
 
studentAuthRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({message: 'Email and password are required'});
    }
    const result = await query(
      'SELECT id,password_hash FROM student_user WHERE lower(email)=$1 LIMIT 1', [email]);
    // Dummy comparison reduces account enumeration through timing differences.
    const fallbackHash = '$2b$10$abcdefghijklmnopqrstuuWfI5RrBmGi0eznKGdbHylQeDfcAxO8C';
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user?.password_hash || fallbackHash);
    if (!user || !valid) return res.status(401).json({message: 'Invalid credentials'});
    await query('UPDATE student_user SET last_login_at=NOW() WHERE id=$1', [user.id]);
    return res.json({token: createStudentToken(user.id), tokenType: 'Bearer',
      expiresIn: 8 * 60 * 60});
  } catch (err) { next(err); }
});
 
studentAuthRouter.get('/me', requireStudent, async (req, res, next) => {
  try {
    const result = await query('SELECT id,email,created_at FROM student_user WHERE id=$1',
      [req.student.id]);
    if (!result.rowCount) return res.status(401).json({message: 'Account unavailable'});
    return res.json({student: result.rows[0]});
  } catch (err) { next(err); }
});

/** Student portal journey overview, reconstructed from persisted records. */
studentAuthRouter.get('/journey',requireStudent,async(req,res,next)=>{
  try{
    const {rows}=await query(`
      SELECT p.id,p.full_name,p.email,p.stage,p.closed_reason,
        pr.name AS program_name,
        q.auto_result,q.decision AS qualification_decision,q.submitted_at AS qualification_submitted_at,
        a.status AS application_status,a.submitted_date AS application_submitted_at,
        a.id AS application_id,a.offer_expires_at,
        EXISTS(SELECT 1 FROM enrolment en WHERE en.application_id=a.id) AS enrolled
      FROM prospect p
      LEFT JOIN LATERAL (
        SELECT program_id FROM enquiry WHERE prospect_id=p.id
        ORDER BY enquiry_date DESC LIMIT 1
      ) e ON TRUE
      LEFT JOIN qualification q ON q.prospect_id=p.id
      LEFT JOIN LATERAL (
        SELECT id,status,submitted_date,offer_expires_at FROM application
        WHERE prospect_id=p.id ORDER BY created_at DESC LIMIT 1
      ) a ON TRUE
      LEFT JOIN program pr ON pr.id=COALESCE(q.program_id,e.program_id)
      WHERE p.user_id=$1 LIMIT 1`,[req.student.id]);
    if(!rows.length)return res.status(404).json({message:'Student profile not found'});
    res.json({journey:rows[0]});
  }catch(err){next(err)}
});

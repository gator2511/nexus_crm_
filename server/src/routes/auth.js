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

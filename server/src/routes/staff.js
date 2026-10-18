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

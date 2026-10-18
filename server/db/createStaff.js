/**
 * Run locally after applying db/schema.sql.
 * Required environment variables:
 *   INITIAL_STAFF_EMAIL, INITIAL_STAFF_PASSWORD, INITIAL_STAFF_NAME
 * Optional INITIAL_STAFF_ROLE: recruiter | manager
 * Example: node db/createStaff.js
 * Never commit credentials or paste passwords into source code.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const email = (process.env.INITIAL_STAFF_EMAIL || '').trim().toLowerCase();
const name = (process.env.INITIAL_STAFF_NAME || '').trim();
const password = process.env.INITIAL_STAFF_PASSWORD || '';
const role = process.env.INITIAL_STAFF_ROLE || 'manager';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name || password.length < 12 || !['manager', 'recruiter'].includes(role)) {
  console.error('Provide INITIAL_STAFF_EMAIL, INITIAL_STAFF_NAME, INITIAL_STAFF_PASSWORD (12+ chars), and valid INITIAL_STAFF_ROLE.');
  process.exitCode = 1;
} else {
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO staff_user(full_name,email,role,password_hash)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(email) DO NOTHING
       RETURNING id`,
      [name, email, role, hash]
    );
    if (result.rowCount) console.log('Staff account created:', email);
    else console.log('Staff email already exists; account was not changed.');
  } catch (error) {
    console.error('Staff account setup failed:', error.message);
    process.exitCode = 1;
  }
}
await pool.end();

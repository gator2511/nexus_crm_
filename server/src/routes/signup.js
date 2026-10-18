/** Kenil Gevariya — signup via pre-issued, single-use, hashed tokens.
 * Issue tokens ONLY using a verified-email workflow; do not expose a public
 * endpoint that grants tokens based on an unverified email address.
 */
import {Router} from 'express';
import {createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {withTransaction} from '../db.js';
export const studentSignupRouter = Router();
const hashToken = t => createHash('sha256').update(t).digest('hex');
 
studentSignupRouter.post('/signup', async (req, res, next) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== 'string' || token.length < 32 ||
        typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(422).json({message: 'Valid signup token and password required'});
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await withTransaction(async client => {
      const issued = await client.query(
        `SELECT st.id,p.id AS prospect_id,p.email,p.user_id
         FROM signup_token st JOIN prospect p ON p.id=st.prospect_id
         WHERE st.token_hash=$1 AND st.used_at IS NULL AND st.expires_at>NOW()
         FOR UPDATE OF st`, [hashToken(token)]);
      if (!issued.rowCount || issued.rows[0].user_id) return null;
      const current = issued.rows[0];
      const user = await client.query(
        `INSERT INTO student_user(email,password_hash)
         VALUES($1,$2) RETURNING id`, [current.email, passwordHash]);
      await client.query('UPDATE prospect SET user_id=$1 WHERE id=$2',
        [user.rows[0].id, current.prospect_id]);
      await client.query('UPDATE signup_token SET used_at=NOW() WHERE id=$1', [current.id]);
      return user.rows[0].id;
    });
    if (!result) return res.status(400).json({message: 'Token invalid, expired or used'});
    return res.status(201).json({message: 'Student account created'});
  } catch(err) { next(err); }
});

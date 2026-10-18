import { createHmac, timingSafeEqual } from 'node:crypto';
import { query } from './db.js';

const TTL = 8 * 60 * 60;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return value;
}
const sign = data => createHmac('sha256', secret()).update(data).digest('base64url');

export function createStaffToken(staffId) {
  const payload = Buffer.from(JSON.stringify({
    sub: staffId, role: 'staff', exp: Math.floor(Date.now() / 1000) + TTL,
  })).toString('base64url');
  return payload + '.' + sign(payload);
}

export function verifyStaffToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  const expected = Buffer.from(sign(payload), 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.role !== 'staff' || typeof data.sub !== 'string' ||
        !Number.isFinite(data.exp) || data.exp <= Date.now() / 1000) return null;
    return data.sub;
  } catch { return null; }
}

export async function requireStaff(req, res, next) {
  try {
    const match = /^Bearer (\S+)$/i.exec(req.get('authorization') || '');
    const staffId = verifyStaffToken(match?.[1]);
    if (!staffId) return res.status(401).json({ message: 'Staff authentication required' });
    const { rows } = await query(
      'SELECT id, full_name, email, role FROM staff_user WHERE id=$1 AND is_active=TRUE',
      [staffId]
    );
    if (!rows.length) return res.status(401).json({ message: 'Staff account unavailable' });
    req.staff = rows[0];
    next();
  } catch (error) { next(error); }
}

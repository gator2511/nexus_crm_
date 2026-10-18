/** Kenil Gevariya — signed student session tokens (no external JWT package). */
import {createHmac, timingSafeEqual} from 'node:crypto';
const TTL_SECONDS = 8 * 60 * 60;
 
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return value;
}
function sign(data) {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}
export function createStudentToken(studentId) {
  const payload = Buffer.from(JSON.stringify({sub: studentId, role: 'student',
    exp: Math.floor(Date.now()/1000) + TTL_SECONDS})).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyStudentToken(token) {
  if (typeof token !== 'string') return null;
  const pieces = token.split('.');
  if (pieces.length !== 2) return null;
  const [payload, signature] = pieces;
  const actual = Buffer.from(signature, 'base64url');
  const expected = Buffer.from(sign(payload), 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.role !== 'student' || !data.sub || !Number.isFinite(data.exp) ||
        data.exp <= Date.now()/1000) return null;
    return {id: data.sub};
  } catch { return null; }
}
export function requireStudent(req, res, next) {
  try {
    const match = /^Bearer (\S+)$/i.exec(req.get('authorization') || '');
    const student = verifyStudentToken(match?.[1]);
    if (!student) return res.status(401).json({message: 'Student authentication required'});
    req.student = student;
    next();
  } catch (err) { next(err); }
}

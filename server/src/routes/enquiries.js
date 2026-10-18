/** Kenil Gevariya — public enquiry endpoint and brochure delivery. */
import {Router} from 'express';
import {randomBytes, createHash} from 'node:crypto';
import {withTransaction, query} from '../db.js';
import {validateEnquiry} from '../validate.js';
import {sendBrochureEmail, sendEmail} from '../email.js';
 
export const enquiryRouter = Router();
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
 
export function validatePublicEnquiry(body = {}) {
  const result = validateEnquiry(body);
  if (!UUID.test(String(body.program_id || ''))) {
    result.errors.program_id = 'A valid program UUID is required';
  }
  if (body.consent !== true) result.errors.consent = 'Consent is required';
  return {valid: Object.keys(result.errors).length === 0, errors: result.errors};
}
 
enquiryRouter.post('/', async (req, res, next) => {
  try {
    const input = req.body || {};
    const v = validatePublicEnquiry(input);
    if (!v.valid) return res.status(422).json({message: 'Invalid enquiry', errors: v.errors});
 
    const stored = await withTransaction(async client => {
      const programs = await client.query(
        'SELECT id, name, brochure_url FROM program WHERE id=$1 AND is_active=TRUE',
        [input.program_id],
      );
      if (!programs.rowCount) return {notFound: true};
      const program = programs.rows[0];
      const email = input.email.trim().toLowerCase();
      // Reuse prospect for repeat enquiries instead of violating unique email index.
      const p = await client.query(
        `INSERT INTO prospect(full_name,email,phone,address,consent_at)
         VALUES($1,$2,$3,$4,NOW())
         ON CONFLICT (lower(email)) DO UPDATE SET
           full_name=EXCLUDED.full_name, phone=EXCLUDED.phone,
           address=EXCLUDED.address, consent_at=EXCLUDED.consent_at
         RETURNING id`,
        [input.full_name.trim(), email, input.phone.trim(), input.address.trim()],
      );
      const prospectId = p.rows[0].id;
      const e = await client.query(
        `INSERT INTO enquiry(prospect_id,program_id,source,message)
         VALUES($1,$2,'Website',$3) RETURNING id`,
        [prospectId, program.id, input.message || null],
      );
      // Generate a one-time registration invitation only for unregistered prospects.
      // Never expose this token in the HTTP response.
      const existing = await client.query('SELECT user_id FROM prospect WHERE id=$1', [prospectId]);
      let signupToken = null;
      if (!existing.rows[0].user_id) {
        signupToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(signupToken).digest('hex');
        await client.query(
          'INSERT INTO signup_token(prospect_id, token_hash, expires_at) VALUES($1,$2,NOW() + INTERVAL \'24 hours\')',
          [prospectId, tokenHash],
        );
      }
      return {prospectId, enquiryId: e.rows[0].id, program,
        signupToken, email, name: input.full_name.trim()};
    });
    if (stored.notFound) return res.status(404).json({message: 'Program not found'});
 
    // Deliver email only after the database transaction commits.
    // A failed email must never be reported as Sent.
    let delivery;
    try {
      delivery = await sendBrochureEmail({to: stored.email, name: stored.name,
        programName: stored.program.name, brochureUrl: stored.program.brochure_url});
    } catch (error) {
      delivery = {status: 'Failed', reason: 'Email provider request failed'};
      console.error('Brochure delivery error', error);
    }
    await query(
      `INSERT INTO email_log(prospect_id,template,to_email,subject,body,status)
       VALUES($1,'Course brochure',$2,$3,$4,$5)`,
      [stored.prospectId, stored.email, `Your ${stored.program.name} course brochure`,
        `Brochure: ${stored.program.brochure_url || 'not configured'}`,
        delivery.status === 'Sent' ? 'Sent' :
          delivery.status === 'NotConfigured' ? 'Logged' : 'Failed'],
    ).catch(err => console.error('Unable to record email log', err));
 
    // Only deliver an invitation to the email address supplied in the enquiry.
    // The URL must be an explicitly configured, trusted HTTPS frontend origin.
    let signupEmailStatus = 'NotRequired';
    const publicUrl = process.env.PUBLIC_APP_URL;
    if (stored.signupToken) {
      if (!publicUrl || !/^https:\/\/[^/]+\/?$/.test(publicUrl)) {
        signupEmailStatus = 'NotConfigured';
      } else {
        try {
          const signupUrl = new URL('/signup', publicUrl);
          signupUrl.searchParams.set('token', stored.signupToken);
          const sent = await sendEmail({
            to: stored.email,
            subject: 'Create your Nexus CRM student account',
            text: `Hello ${stored.name},\\n\\nYour enquiry has been received. To create your student account and choose your password, open this private link within 24 hours:\\n${signupUrl.href}\\n\\nIf you did not request this, ignore this email.\\n\\nRIC Admissions Team`,
          });
          signupEmailStatus = sent.status;
        } catch (error) {
          console.error('Signup invitation delivery failed', error);
          signupEmailStatus = 'Failed';
        }
      }
      await query(
        `INSERT INTO email_log(prospect_id,template,to_email,subject,body,status)
         VALUES($1,'Student signup',$2,'Create your student account',$3,$4)`,
        [stored.prospectId, stored.email,
          'Signup invitation; token intentionally omitted from logs',
          signupEmailStatus === 'Sent' ? 'Sent' : signupEmailStatus === 'Failed' ? 'Failed' : 'Logged'],
      ).catch(err => console.error('Unable to log signup invitation', err));
    }
    return res.status(201).json({message: 'Enquiry recorded',
      enquiryId: stored.enquiryId, prospectId: stored.prospectId,
      brochureEmailStatus: delivery.status, signupEmailStatus});
  } catch (err) { next(err); }
});

/** Kenil Gevariya — Resend email delivery for Nexus CRM. */
const EMAIL_API = 'https://api.resend.com/emails';
 
export async function sendEmail({to, subject, text}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    return {status: 'NotConfigured', reason: 'RESEND_API_KEY or MAIL_FROM missing'};
  }
  const response = await fetch(EMAIL_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({from, to: [to], subject, text}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {status: 'Failed', reason: body.message || `HTTP ${response.status}`};
  }
  return {status: 'Sent', providerId: body.id};
}
 
export async function sendBrochureEmail({to, name, programName, brochureUrl}) {
  if (!brochureUrl || !/^https:\/\//i.test(brochureUrl)) {
    return {status: 'NotConfigured', reason: 'HTTPS brochure URL missing'};
  }
  return sendEmail({
    to,
    subject: `Your ${programName} course brochure`,
    text: `Hello ${name},\n\nThank you for your enquiry about ${programName}.\n` +
      `View the course brochure here: ${brochureUrl}\n\nRIC Admissions Team`,
  });
}

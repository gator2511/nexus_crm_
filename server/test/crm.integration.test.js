/**
 * Real backend integration checks using an isolated PostgreSQL database.
 * GitHub Actions provisions and resets its own disposable database.
 * These checks never send live brochure email (Resend is not configured in CI).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { query, pool } from '../src/db.js';
import { createStudentToken } from '../src/auth.js';
import { createStaffToken } from '../src/staffAuth.js';
import { generateOfferLetter } from '../src/offerLetter.js';

let server, origin, programId, prospectId, applicationId, documentId;
let studentToken, staffToken, brochureStatus, enquiryId;
const email = 'integration.student@example.invalid';
const password = 'Student-Test-Password-123!';

async function request(path, method='GET', body, token) {
  const res = await fetch(origin + path, {
    method,
    headers: {
      ...(body !== undefined ? {'content-type':'application/json'} : {}),
      ...(token ? {authorization:'Bearer ' + token} : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.arrayBuffer();
  return {status:res.status,data,headers:res.headers};
}

before(async () => {
  // No destructive reset here; CI prepares a dedicated disposable test database.
  const programs = await query('SELECT id FROM program WHERE is_active=TRUE AND min_qualification_level=4 AND (language_requirements->>'IELTS')::numeric=6.5 ORDER BY name LIMIT 1');
  assert.ok(programs.rowCount, 'Test database must contain active programs');
  programId = programs.rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const user = await query(
    'INSERT INTO student_user(email,password_hash) VALUES($1,$2) RETURNING id',
    [email,hash]
  );
  studentToken = createStudentToken(user.rows[0].id);
  const prospect = await query(
    `INSERT INTO prospect(user_id,full_name,email,phone,address,stage,consent_at)
     VALUES($1,'Integration Student',$2,'0400000000','Test Street','Qualified',NOW()) RETURNING id`,
    [user.rows[0].id,email]
  );
  prospectId = prospect.rows[0].id;
  await query('INSERT INTO enquiry(prospect_id,program_id) VALUES($1,$2)',
    [prospectId,programId]);
  const staff = await query(
    "SELECT id FROM staff_user WHERE role='manager' AND is_active=TRUE LIMIT 1"
  );
  assert.ok(staff.rowCount, 'Test database must contain demo manager');
  staffToken = createStaffToken(staff.rows[0].id);
  server = createApp().listen(0);
  await new Promise(resolve=>server.once('listening',resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve=>server.close(resolve));
  await pool.end();
});

test('INF-01 health endpoint returns 200', async()=>{
  const r=await request('/api/health');
  assert.equal(r.status,200); assert.deepEqual(r.data,{ok:true});
});
test('INF-02 unknown API route returns 404',async()=>{
  assert.equal((await request('/api/undefined-route')).status,404);
});
test('INF-03 malformed JSON returns 400',async()=>{
  const r=await fetch(origin+'/api/health',{
    method:'POST',headers:{'content-type':'application/json'},body:'{'
  });
  assert.equal(r.status,400);
});
test('INF-04 oversized JSON returns 413',async()=>{
  const r=await request('/api/enquiries','POST',{payload:'x'.repeat(60000)});
  assert.equal(r.status,413);
});

test('TC-101 valid enquiry is saved to PostgreSQL',async()=>{
  const r=await request('/api/enquiries','POST',{
    full_name:'New Enquirer',email:'new.enquirer@example.invalid',
    phone:'0400123456',address:'1 Test Road',program_id:programId,
    consent:true,message:'Interested in applying'
  });
  assert.equal(r.status,201);
  assert.ok(r.data.enquiryId);
  enquiryId=r.data.enquiryId;
  brochureStatus=r.data.brochureEmailStatus;
  const saved=await query('SELECT id FROM enquiry WHERE id=$1',[enquiryId]);
  assert.equal(saved.rowCount,1);
});
test('TC-102 malformed email is rejected',async()=>{
  const r=await request('/api/enquiries','POST',{
    full_name:'New Enquirer',email:'invalid-email',phone:'0400123456',
    address:'1 Test Road',program_id:programId,consent:true
  });
  assert.equal(r.status,422); assert.ok(r.data.errors.email);
});
test('TC-103 required enquiry fields are validated',async()=>{
  const r=await request('/api/enquiries','POST',{program_id:programId,consent:true});
  assert.equal(r.status,422); assert.ok(r.data.errors.full_name);
});
test('TC-104 student login returns signed token',async()=>{
  const r=await request('/api/student/login','POST',{email,password});
  assert.equal(r.status,200); assert.equal(typeof r.data.token,'string');
});
test('TC-105 wrong password returns 401',async()=>{
  const r=await request('/api/student/login','POST',{email,password:'wrong'});
  assert.equal(r.status,401);
});
test('TC-106 qualified student receives preliminary Pass',async()=>{
  const r=await request('/api/student/qualification/assess','POST',
    {program_id:programId,qualification_level:5,english_test:'IELTS',english_score:8},studentToken);
  assert.equal(r.status,200); assert.equal(r.data.assessment.status,'Pass');
});
test('TC-107 low qualification receives preliminary Fail',async()=>{
  const r=await request('/api/student/qualification/assess','POST',
    {program_id:programId,qualification_level:1,english_test:'IELTS',english_score:8},studentToken);
  assert.equal(r.status,200); assert.equal(r.data.assessment.status,'Fail');
});
test('TC-108 borderline IELTS score requires Review',async()=>{
  const r=await request('/api/student/qualification/assess','POST',
    {program_id:programId,qualification_level:5,english_test:'IELTS',english_score:6},studentToken);
  assert.equal(r.status,200); assert.equal(r.data.assessment.status,'Review');
});
test('TC-109 illegal recruitment stage transition returns 422',async()=>{
  const r=await request('/api/staff/prospects/'+prospectId+'/stage','POST',
    {stage:'Enrolled'},staffToken);
  assert.equal(r.status,422);
});
test('TC-110 submission checks documents and accepts complete draft',async()=>{
  const draft=await request('/api/student/application','POST',{
    qualification:'Bachelor',institution:'Test University',graduationYear:2024
  },studentToken);
  assert.equal(draft.status,200);
  applicationId=draft.data.applicationId;
  const blocked=await request('/api/student/application/submit','POST',{},studentToken);
  assert.equal(blocked.status,422);
  assert.ok(blocked.data.missingDocuments.length>0);
  const required=await query(
    'SELECT document_type FROM program_document_type WHERE program_id=$1 AND is_required',
    [programId]
  );
  for(const row of required.rows){
    const uploaded=await request('/api/student/documents','POST',{
      filename:'support.pdf',mime_type:'application/pdf',
      document_type:row.document_type,
      contentBase64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')
    },studentToken);
    assert.equal(uploaded.status,201);
    documentId=uploaded.data.documentId;
  }
  const submitted=await request('/api/student/application/submit','POST',{},studentToken);
  assert.equal(submitted.status,200); assert.equal(submitted.data.status,'Submitted');
});
test('TC-111 unsupported executable upload is rejected',async()=>{
  const r=await request('/api/student/documents','POST',{
    filename:'malware.exe',mime_type:'application/octet-stream',
    document_type:'Passport or photo ID',contentBase64:'YWJj'
  },studentToken);
  assert.equal(r.status,422);
});
test('TC-112 oversized document declaration is rejected',async()=>{
  const r=await request('/api/student/documents','POST',{
    filename:'big.pdf',size:11000000
  },studentToken);
  assert.equal(r.status,413);
});
test('TC-113 brochure delivery is accurately recorded',async()=>{
  assert.equal(brochureStatus,'NotConfigured');
  const {rows}=await query(
    "SELECT status FROM email_log WHERE template='Course brochure' ORDER BY sent_at DESC LIMIT 1"
  );
  assert.equal(rows[0].status,'Logged');
});
test('TC-114 staff prospect API blocks anonymous requests',async()=>{
  const r=await request('/api/staff/prospects');
  assert.equal(r.status,401);
});
test('TC-115 approved offer PDF can be downloaded by its student',async()=>{
  const pdf=await generateOfferLetter({
    status:'Approved',studentName:'Integration Student',
    programName:'Test Course',applicationId
  });
  assert.ok(pdf.subarray(0,5).toString()==='%PDF-');
  await query("UPDATE application SET status='Accepted' WHERE id=$1",[applicationId]);
  await query("UPDATE prospect SET stage='Offer' WHERE id=$1",[prospectId]);
  await query(
    `INSERT INTO document(application_id,document_type,issued,file_name,mime_type,size_bytes,content,status)
     VALUES($1,'Offer letter',TRUE,'offer.pdf','application/pdf',$2,$3,'Verified')`,
    [applicationId,pdf.length,pdf]
  );
  const r=await request('/api/student/offer','GET',undefined,studentToken);
  assert.equal(r.status,200);
  assert.equal(r.headers.get('content-type'),'application/pdf');
  assert.equal(Buffer.from(r.data).subarray(0,5).toString(),'%PDF-');
});
test('TC-116 authenticated staff can retrieve recruitment report',async()=>{
  const r=await request('/api/staff/reports','GET',undefined,staffToken);
  assert.equal(r.status,200); assert.ok(r.data.totalProspects>=2);
});
test('TC-117 manager can run task escalation',async()=>{
  const r=await request('/api/staff/jobs/run','POST',{},staffToken);
  assert.equal(r.status,200); assert.equal(typeof r.data.escalated,'number');
});
test('TC-118 staff can retrieve stage audit history',async()=>{
  const r=await request('/api/staff/prospects/'+prospectId+'/history','GET',undefined,staffToken);
  assert.equal(r.status,200); assert.ok(Array.isArray(r.data.history));
});
test('TC-119 staff document rejection records reason',async()=>{
  const r=await request('/api/staff/documents/'+documentId+'/reject','POST',
    {reason:'Document unclear'},staffToken);
  assert.equal(r.status,200); assert.equal(r.data.status,'Rejected');
});
test('TC-120 student can accept issued offer exactly once',async()=>{
  const r=await request('/api/student/offer/accept','POST',{},studentToken);
  assert.equal(r.status,200); assert.equal(r.data.status,'Enrolled');
  const count=await query('SELECT count(*)::int AS count FROM enrolment WHERE application_id=$1',[applicationId]);
  assert.equal(count.rows[0].count,1);
  const repeat=await request('/api/student/offer/accept','POST',{},studentToken);
  assert.notEqual(repeat.status,200);
});

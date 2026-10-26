import PDFDocument from 'pdfkit';
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

const STAGES = ['Enquiry','Qualification review','Qualified','Application','Offer','Enrolled','Closed'];
const TRANSITIONS = {
  'Enquiry': ['Qualification review','Closed'],
  'Qualification review': ['Qualified','Closed'],
  'Qualified': ['Application','Closed'],
  'Application': ['Offer','Closed'],
  'Offer': ['Enrolled','Closed'],
  'Enrolled': [],
  'Closed': [],
};

staffRouter.get('/prospects', async (_req,res,next) => {
  try {
    const {rows} = await query('SELECT id,full_name,email,stage,created_at FROM prospect ORDER BY created_at DESC LIMIT 100');
    res.json({prospects:rows});
  } catch(err){next(err);}
});

staffRouter.post('/prospects/:id/stage', async (req,res,next) => {
  try {
    const {stage,closed_reason:reason} = req.body || {};
    if (!STAGES.includes(stage)) return res.status(422).json({message:'Invalid stage'});
    const {withTransaction} = await import('../db.js');
    const result = await withTransaction(async client => {
      const found = await client.query('SELECT id,stage FROM prospect WHERE id=$1 FOR UPDATE',[req.params.id]);
      if (!found.rowCount) return {errorCode:404,message:'Prospect not found'};
      const previous = found.rows[0].stage;
      if (!TRANSITIONS[previous].includes(stage)) return {errorCode:422,message:'Invalid stage transition'};
      if ((stage === 'Closed') !== !!reason)
        return {errorCode:422,message:'Closed stage requires a reason'};
      const validReasons = ['No response','Not eligible','Application rejected','Offer declined','Offer lapsed','Withdrawn'];
      if(reason && !validReasons.includes(reason))
        return {errorCode:422,message:'Invalid closed reason'};
      await client.query('UPDATE prospect SET stage=$1,closed_reason=$2 WHERE id=$3',[stage,reason||null,req.params.id]);
      await client.query(`INSERT INTO stage_history(prospect_id,from_stage,to_stage,closed_reason,changed_by_type,changed_by_id)
        VALUES($1,$2,$3,$4,'staff',$5)`,[req.params.id,previous,stage,reason||null,req.staff.id]);
      return {stage,previous};
    });
    if(result.errorCode) return res.status(result.errorCode).json(result);
    res.json(result);
  } catch(err){next(err);}
});

staffRouter.get('/prospects/:id/history', async(req,res,next)=>{
  try {
    const found = await query('SELECT id FROM prospect WHERE id=$1',[req.params.id]);
    if (!found.rowCount) return res.status(404).json({message:'Prospect not found'});
    const {rows} = await query(`SELECT from_stage,to_stage,closed_reason,changed_by_type,changed_at
      FROM stage_history WHERE prospect_id=$1 ORDER BY changed_at,id`,[req.params.id]);
    res.json({history:rows});
  } catch(err){next(err);}
});

staffRouter.get('/reports', async (_req,res,next) => {
  try {
    const {rows} = await query('SELECT stage, COUNT(*)::int AS count FROM prospect GROUP BY stage ORDER BY stage');
    const total = rows.reduce((sum,row)=>sum+row.count,0);
    res.json({totalProspects:total,byStage:rows});
  } catch(err){next(err);}
});

staffRouter.post('/jobs/run', async(req,res,next) => {
  try {
    if (req.staff.role !== 'manager') return res.status(403).json({message:'Manager permission required'});
    const {rows} = await query(`UPDATE task SET escalated_at=NOW()
      WHERE status='Open' AND due_at<NOW() AND escalated_at IS NULL
      RETURNING id`);
    res.json({escalated:rows.length});
  } catch(err){next(err);}
});

staffRouter.post('/documents/:id/reject', async(req,res,next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) return res.status(422).json({message:'Rejection reason required'});
    const {rows} = await query(`UPDATE document SET status='Rejected', rejection_reason=$1,
      verified_by=$2,verified_at=NOW() WHERE id=$3 AND issued=FALSE AND status='Pending'
      RETURNING id,status`,[reason,req.staff.id,req.params.id]);
    if(!rows.length) return res.status(404).json({message:'Student document not found'});
    res.json(rows[0]);
  } catch(err){next(err);}
});

/** Work queue is derived from current qualification and document decisions.
 * This avoids treating a correctable document rejection as academic ineligibility.
 */
staffRouter.get('/pending-review', async (_req, res, next) => {
  try {
    const {rows} = await query(`
      SELECT p.id, p.full_name, p.email, p.stage,
             q.auto_result AS qualification_result, q.decision AS qualification_decision,
             COALESCE(COUNT(d.id) FILTER (WHERE d.status='Rejected'),0)::int AS rejected_documents,
             COALESCE(COUNT(d.id) FILTER (WHERE d.status='Pending'),0)::int AS pending_documents
      FROM prospect p
      LEFT JOIN qualification q ON q.prospect_id=p.id
      LEFT JOIN application a ON a.prospect_id=p.id
      LEFT JOIN document d ON d.application_id=a.id AND d.issued=FALSE
      WHERE p.stage <> 'Closed'
      GROUP BY p.id,p.full_name,p.email,p.stage,q.auto_result,q.decision
      HAVING (q.auto_result IN ('Fail','Review') AND q.decision IS NULL)
          OR COUNT(d.id) FILTER (WHERE a.status IN ('Submitted','Under review')) > 0
      ORDER BY p.full_name
    `);
    res.json({prospects:rows});
  } catch (error) { next(error); }
});

staffRouter.get('/prospects/:id/documents', async (req, res, next) => {
  try {
    const {rows} = await query(`
      SELECT d.id,d.document_type,d.file_name,d.status,d.rejection_reason,d.uploaded_at,
             a.id AS application_id,a.status AS application_status
      FROM document d JOIN application a ON a.id=d.application_id
      WHERE a.prospect_id=$1 AND d.issued=FALSE ORDER BY d.uploaded_at DESC`,
    [req.params.id]);
    res.json({documents:rows});
  } catch (error) { next(error); }
});

staffRouter.post('/documents/:id/verify', async (req, res, next) => {
  try {
    const {rows} = await query(`
      UPDATE document SET status='Verified', rejection_reason=NULL,
        verified_by=$1,verified_at=NOW()
      WHERE id=$2 AND issued=FALSE AND status='Pending'
      RETURNING id,status`,[req.staff.id,req.params.id]);
    if (!rows.length) return res.status(409).json({message:'Pending student document not found'});
    res.json(rows[0]);
  } catch (error) { next(error); }
});

/** Program entry thresholds. Only managers can change admissions criteria. */
staffRouter.get('/program-criteria', async (_req,res,next) => {
  try {
    const {rows}=await query(`SELECT id,name,discipline,is_active,min_qualification_level,language_requirements
      FROM program ORDER BY name,id`);
    res.json({programs:rows});
  } catch(error){next(error);}
});

staffRouter.put('/program-criteria/:id', async (req,res,next) => {
  try {
    if(req.staff.role!=='manager') return res.status(403).json({message:'Manager permission required'});
    const level=req.body?.min_qualification_level;
    const language=req.body?.language_requirements;
    if(!Number.isInteger(level)||level<1||level>5||
       !language||typeof language!=='object'||Array.isArray(language)||
       Object.keys(language).some(k=>!['IELTS','PTE','TOEFL'].includes(k))||
       !Object.keys(language).length)
      return res.status(422).json({message:'Select qualification level 1–5 and at least one English threshold'});
    const ranges={IELTS:[0,9],PTE:[0,90],TOEFL:[0,120]};
    for(const [test,score] of Object.entries(language)){
      if(typeof score!=='number'||!Number.isFinite(score)||score<ranges[test][0]||score>ranges[test][1])
        return res.status(422).json({message:'Invalid score for '+test});
    }
    const {withTransaction}=await import('../db.js');
    const result=await withTransaction(async client=>{
      const previous=await client.query('SELECT * FROM program WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!previous.rowCount) return null;
      const updated=await client.query(`
        UPDATE program SET min_qualification_level=$1,language_requirements=$2::jsonb
        WHERE id=$3 RETURNING id,name,discipline,is_active,min_qualification_level,language_requirements
      `,[level,JSON.stringify(language),req.params.id]);
      await client.query(`
        INSERT INTO audit_log(actor_type,actor_id,action,detail)
        VALUES('staff',$1,'program_criteria_updated',$2::jsonb)
      `,[req.staff.id,JSON.stringify({program_id:req.params.id,before:{
        min_qualification_level:previous.rows[0].min_qualification_level,
        language_requirements:previous.rows[0].language_requirements
      },after:{min_qualification_level:level,language_requirements:language}})]);
      return updated.rows[0];
    });
    if(!result) return res.status(404).json({message:'Program not found'});
    res.json({program:result});
  } catch(error){next(error);}
});

staffRouter.post('/prospects/:id/qualification-decision',async(req,res,next)=>{
  try{
    const decision=req.body?.decision;
    const note=typeof req.body?.note==='string'?req.body.note.trim():'';
    if(!['Approved','Rejected'].includes(decision)||!note)
      return res.status(422).json({message:'Decision and review note required'});
    const {withTransaction}=await import('../db.js');
    const updated=await withTransaction(async client=>{
      const found=await client.query(`SELECT p.id,p.stage,q.id AS qualification_id,q.auto_result
        FROM prospect p JOIN qualification q ON q.prospect_id=p.id
        WHERE p.id=$1 FOR UPDATE OF p,q`,[req.params.id]);
      if(!found.rowCount)return null;
      const row=found.rows[0];
      await client.query(`UPDATE qualification SET decision=$1,reviewed_by=$2,
        review_note=$3,decided_at=NOW() WHERE id=$4`,
        [decision,req.staff.id,note,row.qualification_id]);
      if(decision==='Approved' && row.stage==='Qualification review'){
        await client.query("UPDATE prospect SET stage='Qualified' WHERE id=$1",[row.id]);
        await client.query(`INSERT INTO stage_history(prospect_id,from_stage,to_stage,changed_by_type,changed_by_id)
          VALUES($1,'Qualification review','Qualified','staff',$2)`,[row.id,req.staff.id]);
      }
      await client.query(`INSERT INTO audit_log(prospect_id,actor_type,actor_id,action,detail)
        VALUES($1,'staff',$2,'qualification_decision',$3::jsonb)`,
        [row.id,req.staff.id,JSON.stringify({decision,note})]);
      return {decision,stage:decision==='Approved'?'Qualified':row.stage};
    });
    if(!updated)return res.status(404).json({message:'Qualification record not found'});
    res.json(updated);
  }catch(error){next(error);}
});


/** Generate a PDF from database-backed admissions fields. */
function createOfferPdf(data,expiresAt){
  return new Promise((resolve,reject)=>{
    const pdf=new PDFDocument({size:'A4',margin:58});
    const chunks=[];
    pdf.on('data',chunk=>chunks.push(chunk));
    pdf.on('error',reject);
    pdf.on('end',()=>resolve(Buffer.concat(chunks)));
    pdf.fontSize(23).fillColor('#244a91').text('RIC | OFFER OF ADMISSION');
    pdf.moveDown(0.5).strokeColor('#d9e2f1').moveTo(58,pdf.y).lineTo(537,pdf.y).stroke();
    pdf.moveDown(1).fillColor('#222').fontSize(11);
    pdf.text('Issue date: '+new Date().toLocaleDateString('en-AU'));
    pdf.text('Reference: '+data.application_id);
    pdf.moveDown();
    pdf.text('Dear '+data.full_name+',');
    pdf.moveDown();
    pdf.text('We are pleased to offer you admission to the following program, subject to the institution\'s enrolment terms and published policies.');
    pdf.moveDown();
    for(const [label,value] of [
      ['Student name',data.full_name],['Student email',data.email],
      ['Program',data.program_name],['Intake',data.intake_name],
      ['Commencement',data.start_date?new Date(data.start_date).toLocaleDateString('en-AU'):'To be confirmed'],
      ['Study mode',data.study_mode],['Offer valid until',new Date(expiresAt).toLocaleDateString('en-AU')]
    ]) pdf.text(label+': '+(value||'Not specified'),{lineGap:5});
    pdf.moveDown();
    pdf.text('Log in to the Nexus CRM student portal to accept or decline this offer before the expiry date.');
    pdf.moveDown(2);pdf.text('Admissions Team\nRIC');
    pdf.end();
  });
}

staffRouter.get('/prospects/:id/admissions',async(req,res,next)=>{
  try{
    const {rows}=await query(`
      SELECT p.id,p.full_name,p.email,p.phone,p.address,p.stage,
        pr.name AS program_name, q.highest_qualification,q.institution,
        q.year_completed,q.result,q.language_test_type,q.language_score,
        q.test_date,q.auto_result,q.decision AS qualification_decision,
        a.id AS application_id,a.status AS application_status,a.date_of_birth,
        a.nationality,a.emergency_contact_name,a.emergency_contact_phone,
        a.study_mode,a.submitted_date,i.name AS intake_name,i.start_date
      FROM prospect p
      LEFT JOIN qualification q ON q.prospect_id=p.id
      LEFT JOIN LATERAL (
        SELECT * FROM application WHERE prospect_id=p.id ORDER BY created_at DESC LIMIT 1
      ) a ON TRUE
      LEFT JOIN LATERAL (
        SELECT program_id FROM enquiry WHERE prospect_id=p.id ORDER BY enquiry_date DESC LIMIT 1
      ) e ON TRUE
      LEFT JOIN program pr ON pr.id=COALESCE(a.program_id,q.program_id,e.program_id)
      LEFT JOIN intake i ON i.id=a.intake_id
      WHERE p.id=$1`,[req.params.id]);
    if(!rows.length)return res.status(404).json({message:'Student not found'});
    res.json({admissions:rows[0]});
  }catch(error){next(error)}
});

/** Return actual document bytes only to authenticated staff. */
staffRouter.get('/documents/:id/view', async(req,res,next)=>{
  try{
    const {rows}=await query(`SELECT file_name,mime_type,content
      FROM document WHERE id=$1 AND issued=FALSE`,[req.params.id]);
    if(!rows.length)return res.status(404).json({message:'Document not found'});
    const doc=rows[0];
    res.set('Content-Type',doc.mime_type);
    res.set('Content-Disposition','inline; filename="student-document"');
    res.set('Cache-Control','no-store');
    res.set('X-Content-Type-Options','nosniff');
    res.send(doc.content);
  }catch(error){next(error)}
});

/** Staff's final decision is separate from verifying individual documents. */
staffRouter.post('/applications/:id/decision',async(req,res,next)=>{
  try{
    const decision=req.body?.decision;
    const note=typeof req.body?.note==='string'?req.body.note.trim():'';
    if(!['Accepted','Rejected'].includes(decision)||!note)
      return res.status(422).json({message:'Decision and justification required'});
    const {withTransaction}=await import('../db.js');
    const result=await withTransaction(async client=>{
      const found=await client.query(`
        SELECT a.*,p.stage,p.id AS prospect_id,p.full_name,p.email,
          pr.name AS program_name,i.name AS intake_name,i.start_date
        FROM application a JOIN prospect p ON p.id=a.prospect_id
        JOIN program pr ON pr.id=a.program_id
        LEFT JOIN intake i ON i.id=a.intake_id
        WHERE a.id=$1 FOR UPDATE OF a,p`,[req.params.id]);
      if(!found.rowCount)return {errorCode:404,message:'Application not found'};
      const app=found.rows[0];
      if(!['Submitted','Under review'].includes(app.status))
        return {errorCode:409,message:'Application must be submitted and awaiting review'};
      if(decision==='Accepted'){
        const docs=await client.query(`
          SELECT pdt.document_type,d.status FROM program_document_type pdt
          LEFT JOIN document d ON d.application_id=$1
            AND d.document_type=pdt.document_type AND d.issued=FALSE
          WHERE pdt.program_id=$2 AND pdt.is_required`,[app.id,app.program_id]);
        if(!docs.rows.length||docs.rows.some(d=>d.status!=='Verified'))
          return {errorCode:409,message:'Verify all required documents before issuing an offer'};
        if(!app.intake_id||!app.study_mode)
          return {errorCode:409,message:'Application intake and study mode are required'};
        const expires=new Date(Date.now()+14*24*60*60*1000);
        const pdf=await createOfferPdf({...app,application_id:app.id},expires);
        await client.query(`INSERT INTO document(application_id,document_type,issued,file_name,mime_type,size_bytes,content,status,verified_by,verified_at)
          VALUES($1,'Offer letter',TRUE,'RIC-offer.pdf','application/pdf',$2,$3,'Verified',$4,NOW())`,
          [app.id,pdf.length,pdf,req.staff.id]);
        await client.query(`UPDATE application
          SET status='Accepted',decision_by=$1,decision_note=$2,decided_at=NOW(),offer_expires_at=$3
          WHERE id=$4`,[req.staff.id,note,expires,app.id]);
        if(app.stage!=='Offer'){
          await client.query("UPDATE prospect SET stage='Offer' WHERE id=$1",[app.prospect_id]);
          await client.query(`INSERT INTO stage_history(prospect_id,from_stage,to_stage,changed_by_type,changed_by_id)
            VALUES($1,$2,'Offer','staff',$3)`,[app.prospect_id,app.stage,req.staff.id]);
        }
      }else{
        await client.query(`UPDATE application SET status='Rejected',decision_by=$1,decision_note=$2,decided_at=NOW()
          WHERE id=$3`,[req.staff.id,note,app.id]);
        await client.query("UPDATE prospect SET stage='Closed',closed_reason='Application rejected' WHERE id=$1",[app.prospect_id]);
        await client.query(`INSERT INTO stage_history(prospect_id,from_stage,to_stage,closed_reason,changed_by_type,changed_by_id)
          VALUES($1,$2,'Closed','Application rejected','staff',$3)`,[app.prospect_id,app.stage,req.staff.id]);
      }
      await client.query(`INSERT INTO audit_log(prospect_id,actor_type,actor_id,action,detail)
        VALUES($1,'staff',$2,'application_decision',$3::jsonb)`,
        [app.prospect_id,req.staff.id,JSON.stringify({application_id:app.id,decision,note})]);
      return {status:decision};
    });
    if(result.errorCode)return res.status(result.errorCode).json({message:result.message});
    res.json(result);
  }catch(error){next(error)}
});

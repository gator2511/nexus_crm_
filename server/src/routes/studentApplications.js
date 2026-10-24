/**
 * Authenticated student application and document endpoints.
 * Database owns student/application associations; callers cannot select another prospect.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireStudent } from '../auth.js';

export const studentApplicationsRouter = Router();
studentApplicationsRouter.use(requireStudent);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function currentProspect(client, userId) {
  const result = await client.query('SELECT id,stage FROM prospect WHERE user_id=$1', [userId]);
  return result.rows[0] || null;
}

function enrolmentDetails(body, complete=false) {
  const fields=['nationality','emergency_contact_name','emergency_contact_phone'];
  const out={};
  for(const field of fields){
    if(body?.[field]!==undefined && (typeof body[field]!=='string'||body[field].trim().length>150)) return null;
    out[field]=typeof body?.[field]==='string' ? body[field].trim() : '';
  }
  const dob=body?.date_of_birth instanceof Date ? body.date_of_birth.toISOString().slice(0,10) : (body?.date_of_birth || '');
  if(dob && (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || dob>=new Date().toISOString().slice(0,10)))return null;
  const intake=body?.intake_id || null;
  if(intake && !UUID.test(intake))return null;
  const study=body?.study_mode || null;
  if(study && !['On campus','Online','Blended'].includes(study))return null;
  if(complete && (!dob||!out.nationality||!out.emergency_contact_name||!out.emergency_contact_phone||!intake||!study))return null;
  return {...out,date_of_birth:dob||null,intake_id:intake,study_mode:study};
}

studentApplicationsRouter.post('/application', async (req,res,next)=>{
  try{
    const details=enrolmentDetails(req.body);
    if(!details)return res.status(422).json({message:'Invalid enrolment details'});
    const result=await withTransaction(async client=>{
      const prospect=await currentProspect(client,req.student.id);
      if(!prospect)return {errorCode:404,message:'Student prospect not found'};
      const qual=await client.query('SELECT program_id,auto_result,decision FROM qualification WHERE prospect_id=$1',[prospect.id]);
      if(!qual.rowCount || qual.rows[0].decision==='Rejected' ||
         (qual.rows[0].auto_result!=='Pass' && qual.rows[0].decision!=='Approved'))
        return {errorCode:403,message:'Eligibility approval required'};
      const programId=qual.rows[0].program_id;
      if(details.intake_id){
        const check=await client.query('SELECT id FROM intake WHERE id=$1 AND program_id=$2 AND is_open=TRUE',[details.intake_id,programId]);
        if(!check.rowCount)return {errorCode:422,message:'Choose an available intake for your program'};
      }
      const existing=await client.query('SELECT id,status FROM application WHERE prospect_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',[prospect.id]);
      let app=existing.rows[0];
      if(app && app.status!=='Draft')return {errorCode:409,message:'Application already submitted'};
      if(!app){
        const created=await client.query('INSERT INTO application(prospect_id,program_id) VALUES($1,$2) RETURNING id,status',[prospect.id,programId]);
        app=created.rows[0];
      }
      await client.query(`UPDATE application SET date_of_birth=$1,nationality=$2,
        emergency_contact_name=$3,emergency_contact_phone=$4,intake_id=$5,study_mode=$6
        WHERE id=$7`,[details.date_of_birth,details.nationality,
        details.emergency_contact_name,details.emergency_contact_phone,
        details.intake_id,details.study_mode,app.id]);
      return {applicationId:app.id,status:app.status};
    });
    if(result.errorCode)return res.status(result.errorCode).json({message:result.message});
    res.json(result);
  }catch(err){next(err)}
});

studentApplicationsRouter.post('/application/submit', async (req, res, next) => {
  try {
    const result = await withTransaction(async client => {
      const prospect = await currentProspect(client, req.student.id);
      if (!prospect) return { errorCode: 404, message: 'Student prospect not found' };
      const eligible = await client.query(`SELECT auto_result,decision FROM qualification WHERE prospect_id=$1`,[prospect.id]);
      if (!eligible.rowCount || (eligible.rows[0].auto_result !== 'Pass' && eligible.rows[0].decision !== 'Approved') || eligible.rows[0].decision === 'Rejected') return {errorCode:403,message:'Eligibility approval required'};
      const found = await client.query(
        `SELECT a.*,q.highest_qualification,q.institution
         FROM application a LEFT JOIN qualification q ON q.prospect_id=a.prospect_id
         WHERE a.prospect_id=$1 ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF a`,
        [prospect.id]
      );
      const app = found.rows[0];
      if (!app) return { errorCode: 404, message: 'Application draft not found' };
      if (app.status !== 'Draft') return { errorCode: 409, message: 'Application is not a draft' };
      if (!app.highest_qualification || !app.institution)
        return { errorCode: 422, message: 'Qualification details are incomplete' };
      if(!enrolmentDetails(app,true))return {errorCode:422,message:'Complete all required enrolment fields before submission'};
      const required = await client.query(
        `SELECT pdt.document_type FROM program_document_type pdt
         JOIN application a ON a.program_id=pdt.program_id WHERE a.id=$1 AND pdt.is_required`,
        [app.id]
      );
      const docs = await client.query(
        `SELECT document_type FROM document WHERE application_id=$1
         AND status IN ('Pending','Verified') AND issued=FALSE`, [app.id]
      );
      const present = new Set(docs.rows.map(d => d.document_type));
      const missing = required.rows.map(d => d.document_type).filter(t => !present.has(t));
      if (missing.length) return { errorCode: 422, message: 'Required documents missing', missingDocuments: missing };
      await client.query(
        `UPDATE application SET status='Submitted',submitted_date=NOW() WHERE id=$1`, [app.id]
      );
      const stage = await client.query(
        `UPDATE prospect SET stage='Application' WHERE id=$1 AND stage IN ('Qualified','Qualification review','Application')
         RETURNING id`, [prospect.id]
      );
      if (stage.rowCount && prospect.stage !== 'Application') await client.query(
        `INSERT INTO stage_history(prospect_id,from_stage,to_stage,changed_by_type,changed_by_id)
         VALUES($1,$2,'Application','student',$3)`,
        [prospect.id, prospect.stage, req.student.id]
      );
      return { applicationId: app.id, status: 'Submitted' };
    });
    if (result.errorCode) return res.status(result.errorCode).json(result);
    return res.status(200).json(result);
  } catch (error) { next(error); }
});

studentApplicationsRouter.post('/documents', async (req, res, next) => {
  try {
    const { filename, mime_type: mimeType, document_type: documentType, contentBase64 } = req.body || {};
    const maxBytes = 10 * 1024 * 1024;
    if (typeof req.body?.size === 'number' && req.body.size > maxBytes)
      return res.status(413).json({ message: 'Maximum document size is 10 MB' });
    if (typeof filename !== 'string' || !/\.(pdf|png|jpe?g)$/i.test(filename) ||
        !['application/pdf','image/png','image/jpeg'].includes(mimeType) ||
        typeof documentType !== 'string' || !documentType.trim() ||
        typeof contentBase64 !== 'string' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64))
      return res.status(422).json({ message: 'Invalid document type or content' });
    const content = Buffer.from(contentBase64, 'base64');
    if (!content.length || content.length > maxBytes)
      return res.status(413).json({ message: 'Document is empty or exceeds 10 MB' });
    const magicOk = mimeType === 'application/pdf' ? content.subarray(0, 5).toString() === '%PDF-' :
      mimeType === 'image/png' ? content.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex')) :
      content.subarray(0, 3).equals(Buffer.from('ffd8ff','hex'));
    if (!magicOk) return res.status(422).json({ message: 'Document content does not match the selected type' });

    const result = await withTransaction(async client => {
      const prospect = await currentProspect(client, req.student.id);
      if (!prospect) return { errorCode: 404, message: 'Student prospect not found' };
      const eligible = await client.query(`SELECT auto_result,decision FROM qualification WHERE prospect_id=$1`,[prospect.id]);
      if (!eligible.rowCount || (eligible.rows[0].auto_result !== 'Pass' && eligible.rows[0].decision !== 'Approved') || eligible.rows[0].decision === 'Rejected') return {errorCode:403,message:'Eligibility approval required'};
      const selected = await client.query(
        `SELECT id,program_id,status FROM application WHERE prospect_id=$1 AND status IN ('Draft','Submitted','Under review')
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [prospect.id]
      );
      if (!selected.rows.length) return { errorCode: 409, message: 'Draft or submitted application required' };
      const app = selected.rows[0];
      if (app.status !== 'Draft') {
        const replacement = await client.query(
          "SELECT id FROM document WHERE application_id=$1 AND document_type=$2 AND status='Rejected' AND issued=FALSE",
          [app.id, documentType]
        );
        if (!replacement.rowCount) return { errorCode: 409, message: 'Only rejected documents can be replaced after submission' };
      }
      const allowed = await client.query(
        'SELECT id FROM program_document_type WHERE program_id=$1 AND document_type=$2',
        [app.program_id, documentType]
      );
      if (!allowed.rowCount) return { errorCode: 422, message: 'Document type not required by program' };
      const saved = await client.query(
        `INSERT INTO document(application_id,document_type,file_name,mime_type,size_bytes,content,status)
         VALUES($1,$2,$3,$4,$5,$6,'Pending')
         ON CONFLICT(application_id,document_type) WHERE NOT issued DO UPDATE SET
           file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,
           size_bytes=EXCLUDED.size_bytes,content=EXCLUDED.content,status='Pending',
           rejection_reason=NULL,verified_by=NULL,verified_at=NULL RETURNING id`,
        [app.id, documentType, filename, mimeType, content.length, content]
      );
      return { documentId: saved.rows[0].id, status: 'Pending' };
    });
    if (result.errorCode) return res.status(result.errorCode).json(result);
    return res.status(201).json(result);
  } catch (error) { next(error); }
});

studentApplicationsRouter.get('/documents', async (req, res, next) => {
  try {
    const {rows} = await query(`
      SELECT d.id,d.document_type,d.file_name,d.status,d.rejection_reason,d.uploaded_at
      FROM document d
      JOIN application a ON a.id=d.application_id
      JOIN prospect p ON p.id=a.prospect_id
      WHERE p.user_id=$1 AND d.issued=FALSE ORDER BY d.uploaded_at DESC
    `,[req.student.id]);
    res.json({documents:rows});
  } catch (error) { next(error); }
});

studentApplicationsRouter.get('/application/status', async(req,res,next)=>{
  try{
    const prospect=await query('SELECT id,stage FROM prospect WHERE user_id=$1',[req.student.id]);
    if(!prospect.rowCount)return res.status(404).json({message:'Student prospect not found'});
    const id=prospect.rows[0].id;
    const [q,app,required,intakes]=await Promise.all([
      query('SELECT auto_result,decision FROM qualification WHERE prospect_id=$1',[id]),
      query('SELECT id,program_id,status,date_of_birth,nationality,emergency_contact_name,emergency_contact_phone,intake_id,study_mode FROM application WHERE prospect_id=$1 ORDER BY created_at DESC LIMIT 1',[id]),
      query(`SELECT pdt.document_type,pdt.is_required FROM program_document_type pdt
        WHERE pdt.program_id=(
          SELECT e.program_id FROM enquiry e WHERE e.prospect_id=$1
          ORDER BY e.enquiry_date DESC LIMIT 1
        )
        ORDER BY pdt.document_type`,[id]),
      query(`SELECT i.id,i.name,i.start_date FROM intake i WHERE i.is_open=TRUE AND i.program_id=(SELECT program_id FROM qualification WHERE prospect_id=$1) ORDER BY i.start_date`,[id])
    ]);
    const qual=q.rows[0];
    const eligible=!!qual && qual.decision!=='Rejected' && (qual.auto_result==='Pass'||qual.decision==='Approved');
    const application=app.rows[0]||null;
    let verifiedDocuments=false;
    if(application && required.rows.some(d=>d.is_required)){
      const docs=await query(`SELECT document_type,status FROM document
        WHERE application_id=$1 AND issued=FALSE`,[application.id]);
      verifiedDocuments=required.rows.filter(d=>d.is_required).every(d=>
        docs.rows.some(doc=>doc.document_type===d.document_type && doc.status==='Verified'));
    }
    const canContinue=eligible && !!application &&
      ['Submitted','Under review','Accepted'].includes(application.status) && verifiedDocuments;
    res.json({eligible,eligibility:qual||null,application,
      requiredDocuments:required.rows,intakes:intakes.rows,
      verifiedDocuments,canContinue});
  }catch(error){next(error);}
});

/** Students can request final admissions review only after all required documents are verified. */
studentApplicationsRouter.post('/application/continue',async(req,res,next)=>{
  try{
    const result=await withTransaction(async client=>{
      const found=await client.query(`SELECT a.id,a.status,a.program_id,p.id AS prospect_id
        FROM application a JOIN prospect p ON p.id=a.prospect_id
        WHERE p.user_id=$1 ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF a`,[req.student.id]);
      if(!found.rowCount)return {errorCode:404,message:'Application not found'};
      const app=found.rows[0];
      if(app.status==='Under review')return {status:app.status};
      if(app.status!=='Submitted')return {errorCode:409,message:'Submit your application before continuing'};
      const q=await client.query(`SELECT auto_result,decision FROM qualification
        WHERE prospect_id=$1`,[app.prospect_id]);
      const eligibility=q.rows[0];
      if(!eligibility||eligibility.decision==='Rejected'||
        (eligibility.auto_result!=='Pass'&&eligibility.decision!=='Approved'))
        return {errorCode:403,message:'Eligibility approval required'};
      const docs=await client.query(`SELECT pdt.document_type,d.status
        FROM program_document_type pdt LEFT JOIN document d
        ON d.application_id=$1 AND d.document_type=pdt.document_type AND d.issued=FALSE
        WHERE pdt.program_id=$2 AND pdt.is_required`,[app.id,app.program_id]);
      if(!docs.rows.length || docs.rows.some(d=>d.status!=='Verified'))
        return {errorCode:409,message:'All required documents must be verified before continuing'};
      await client.query("UPDATE application SET status='Under review' WHERE id=$1",[app.id]);
      await client.query(`INSERT INTO audit_log(prospect_id,actor_type,actor_id,action,detail)
        VALUES($1,'student',$2,'requested_final_application_review',$3::jsonb)`,
        [app.prospect_id,req.student.id,JSON.stringify({application_id:app.id})]);
      return {status:'Under review'};
    });
    if(result.errorCode)return res.status(result.errorCode).json({message:result.message});
    res.json(result);
  }catch(error){next(error)}
});

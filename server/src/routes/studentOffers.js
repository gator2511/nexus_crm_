import { Router } from 'express';
import { withTransaction, query } from '../db.js';
import { requireStudent } from '../auth.js';

export const studentOffersRouter = Router();
studentOffersRouter.use(requireStudent);

studentOffersRouter.get('/offer', async (req, res, next) => {
  try {
    const found = await query(
      `SELECT d.content,d.file_name,d.mime_type FROM document d
       JOIN application a ON a.id=d.application_id
       JOIN prospect p ON p.id=a.prospect_id
       WHERE p.user_id=$1 AND a.status='Accepted' AND d.issued=TRUE
         AND d.mime_type='application/pdf' AND d.document_type='Offer letter'
       ORDER BY d.uploaded_at DESC LIMIT 1`, [req.student.id]
    );
    if (!found.rowCount) return res.status(404).json({ message: 'No issued offer available' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="RIC-offer.pdf"');
    return res.send(found.rows[0].content);
  } catch (error) { next(error); }
});

studentOffersRouter.post('/offer/accept', async (req, res, next) => {
  try {
    const result = await withTransaction(async client => {
      const found = await client.query(
        `SELECT a.id,a.offer_expires_at,p.id AS prospect_id,p.stage
         FROM application a JOIN prospect p ON p.id=a.prospect_id
         WHERE p.user_id=$1 AND a.status='Accepted'
         ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF a,p`, [req.student.id]
      );
      if (!found.rowCount) return { errorCode: 404, message: 'Accepted offer not found' };
      const offer = found.rows[0];
      if (offer.offer_expires_at && new Date(offer.offer_expires_at) < new Date())
        return { errorCode: 409, message: 'Offer has expired' };
      const letter = await client.query(
        `SELECT id FROM document WHERE application_id=$1 AND issued=TRUE
         AND document_type='Offer letter' AND mime_type='application/pdf' LIMIT 1`, [offer.id]
      );
      if (!letter.rowCount) return { errorCode: 409, message: 'Offer letter has not been issued' };
      const enrolment = await client.query(
        'INSERT INTO enrolment(application_id) VALUES($1) ON CONFLICT(application_id) DO NOTHING RETURNING id', [offer.id]
      );
      if (!enrolment.rowCount) return { errorCode: 409, message: 'Offer already accepted' };
      await client.query("UPDATE prospect SET stage='Enrolled' WHERE id=$1", [offer.prospect_id]);
      await client.query(
        `INSERT INTO stage_history(prospect_id,from_stage,to_stage,changed_by_type,changed_by_id)
         VALUES($1,$2,'Enrolled','student',$3)`,
        [offer.prospect_id, offer.stage, req.student.id]
      );
      return { status: 'Enrolled', enrolmentId: enrolment.rows[0].id };
    });
    if (result.errorCode) return res.status(result.errorCode).json(result);
    return res.status(200).json(result);
  } catch (error) { next(error); }
});

studentOffersRouter.post('/offer/decline',async(req,res,next)=>{
  try{
    const result=await withTransaction(async client=>{
      const found=await client.query(`
        SELECT a.id,p.id AS prospect_id,p.stage FROM application a
        JOIN prospect p ON p.id=a.prospect_id
        WHERE p.user_id=$1 AND a.status='Accepted'
        ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF a,p`,[req.student.id]);
      if(!found.rowCount)return {errorCode:404,message:'Active offer not found'};
      const offer=found.rows[0];
      await client.query("UPDATE application SET status='Withdrawn' WHERE id=$1",[offer.id]);
      await client.query("UPDATE prospect SET stage='Closed',closed_reason='Offer declined' WHERE id=$1",[offer.prospect_id]);
      await client.query(`INSERT INTO stage_history(prospect_id,from_stage,to_stage,closed_reason,changed_by_type,changed_by_id)
        VALUES($1,$2,'Closed','Offer declined','student',$3)`,[offer.prospect_id,offer.stage,req.student.id]);
      await client.query(`INSERT INTO audit_log(prospect_id,actor_type,actor_id,action,detail)
        VALUES($1,'student',$2,'offer_declined',$3::jsonb)`,[offer.prospect_id,req.student.id,JSON.stringify({application_id:offer.id})]);
      return {status:'Declined'};
    });
    if(result.errorCode)return res.status(result.errorCode).json({message:result.message});
    res.json(result);
  }catch(error){next(error)}
});

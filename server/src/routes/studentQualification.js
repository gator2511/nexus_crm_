
/**
 * Nexus CRM - Student Qualification API
 * Module owner: Abhimanyu Patel
 */

import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { assessQualification } from "../qualificationService.js";

/**
 * Authentication middleware must set req.student.id
 * from a verified session or token.
 */
export function createStudentQualificationRouter(requireStudent) {
  if (typeof requireStudent !== "function") {
    throw new Error("Student authentication middleware is required");
  }

  const router = Router();

  router.use(requireStudent);

  // Persisted Stage 1 submission is the source of truth across logins.
  router.get("/status", async (req,res,next) => {
    try {
      const {rows}=await query(`
        SELECT q.program_id,pr.name AS program_name,q.highest_qualification,
          q.institution,q.year_completed,q.result,
          q.language_test_type AS english_test,q.language_score AS english_score,
          q.test_date,q.auto_result,q.auto_reasons,q.decision,q.submitted_at
        FROM qualification q JOIN prospect p ON p.id=q.prospect_id
        JOIN program pr ON pr.id=q.program_id
        WHERE p.user_id=$1 LIMIT 1`,[req.student.id]);
      res.json({completed:rows.length>0,qualification:rows[0]||null});
    }catch(error){next(error)}
  });

  router.post("/assess", async (req, res, next) => {
    try {
      const studentId = req.student?.id;
      const programId = req.body?.program_id;

      if (!studentId) {
        return res.status(401).json({
          message: "Student authentication required",
        });
      }

      if (!programId) {
        return res.status(400).json({
          message: "Program ID is required",
        });
      }

      // Only assess programs the authenticated student
      // has actually enquired about.
      const result = await query(
        `SELECT pr.id, pr.name,
                pr.min_qualification_level,
                pr.language_requirements
         FROM prospect p
         JOIN enquiry e ON e.prospect_id = p.id
         JOIN program pr ON pr.id = e.program_id
         WHERE p.user_id = $1
           AND pr.id = $2
           AND pr.is_active = TRUE
         LIMIT 1`,
        [studentId, programId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Program enquiry not found",
        });
      }

      const assessment = assessQualification(
        req.body,
        result.rows[0]
      );

      if (assessment.status === "Invalid") {
        return res.status(400).json(assessment);
      }

      const saved = await withTransaction(async client => {
        const found = await client.query(
          'SELECT id,stage FROM prospect WHERE user_id=$1 FOR UPDATE', [studentId]
        );
        if (!found.rowCount) return null;
        const prospect = found.rows[0];
        const existing=await client.query('SELECT id FROM qualification WHERE prospect_id=$1 FOR UPDATE',[prospect.id]);
        if(existing.rowCount)return {alreadyCompleted:true};
        const details = req.body;
        await client.query(`
          INSERT INTO qualification
            (prospect_id,program_id,highest_qualification,institution,year_completed,
             result,language_test_type,language_score,test_date,intake_id,
             submitted_at,auto_result,auto_reasons)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11,$12::jsonb)
          ON CONFLICT(prospect_id) DO UPDATE SET
            program_id=EXCLUDED.program_id,
            highest_qualification=EXCLUDED.highest_qualification,
            institution=EXCLUDED.institution,year_completed=EXCLUDED.year_completed,
            result=EXCLUDED.result,language_test_type=EXCLUDED.language_test_type,
            language_score=EXCLUDED.language_score,test_date=EXCLUDED.test_date,
            intake_id=EXCLUDED.intake_id,submitted_at=EXCLUDED.submitted_at,
            auto_result=EXCLUDED.auto_result,auto_reasons=EXCLUDED.auto_reasons,
            decision=NULL,reviewed_by=NULL,review_note=NULL,decided_at=NULL
        `,[prospect.id,programId,details.highest_qualification || null,
           details.institution || null, details.year_completed || null,
           details.result || null, String(details.english_test).toUpperCase(),
           Number(details.english_score),details.test_date || null,
           details.intake_id || null,assessment.status,
           JSON.stringify({reason:assessment.reason})]);
        const target = assessment.status === 'Pass' ? 'Qualified' : 'Qualification review';
        if (prospect.stage === 'Enquiry' || prospect.stage === 'Qualification review' ||
            prospect.stage === 'Qualified') {
          if (prospect.stage !== target) {
            await client.query('UPDATE prospect SET stage=$1 WHERE id=$2',[target,prospect.id]);
            await client.query(`
              INSERT INTO stage_history(prospect_id,from_stage,to_stage,changed_by_type,changed_by_id)
              VALUES($1,$2,$3,'student',$4)`,[prospect.id,prospect.stage,target,studentId]);
          }
        }
        return {stage:target};
      });
      if (!saved) return res.status(404).json({message:'Student prospect not found'});
      if(saved.alreadyCompleted)return res.status(409).json({message:'Stage 1 has already been submitted and is locked'});
      return res.status(200).json({
        programId, assessment, preliminary:true, saved:true, stage:saved.stage
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

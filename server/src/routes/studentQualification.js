
/**
 * Nexus CRM - Student Qualification API
 * Module owner: Abhimanyu Patel
 */

import { Router } from "express";
import { query } from "../db.js";
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

      return res.status(200).json({
        programId,
        assessment,
        preliminary: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

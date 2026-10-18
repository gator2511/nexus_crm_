
/**
 * Nexus CRM - Qualification Assessment Service
 * Module owner: Abhimanyu Patel
 */

import { checkEligibility } from "./criteria.js";
import { validateQualification } from "./validate.js";

/**
 * Maps PostgreSQL program requirements to the
 * eligibility engine's expected field names.
 */
export function mapProgramCriteria(program) {
  if (!program) {
    throw new Error("Program is required");
  }

  const requirements = program.language_requirements;

  if (
    !requirements ||
    typeof requirements !== "object" ||
    Array.isArray(requirements)
  ) {
    throw new Error(
      "Program language requirements are not configured"
    );
  }

  if (
    program.min_qualification_level === null ||
    program.min_qualification_level === undefined
  ) {
    throw new Error(
      "Program qualification requirement is not configured"
    );
  }

  return {
    required_level: program.min_qualification_level,
    min_ielts: requirements.IELTS,
    min_pte: requirements.PTE,
    min_toefl: requirements.TOEFL,
  };
}

/**
 * Assess submitted student qualifications.
 *
 * Returns a preliminary automatic assessment.
 * Does not issue a final admission decision.
 */
export function assessQualification(student, program) {
  const validation = validateQualification(student);

  if (!validation.valid) {
    return {
      status: "Invalid",
      errors: validation.errors,
    };
  }

  const criteria = mapProgramCriteria(program);
  const result = checkEligibility(student, criteria);

  return {
    status: result.status,
    reason: result.reason,
    requiresStaffReview: result.status !== "Pass",
  };
}

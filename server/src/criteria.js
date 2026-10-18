
/**
 * Nexus CRM - Student Eligibility Assessment
 * Module owner: Abhimanyu Patel
 *
 * Evaluates applicant qualifications against program
 * entry requirements.
 */

const ENGLISH_TESTS = ["IELTS", "PTE", "TOEFL"];

export function checkEligibility(student, program) {
  if (!student || !program) {
    throw new Error("Student and program data are required");
  }

  const requiredLevel = Number(program.required_level);
  const studentLevel = Number(student.qualification_level);

  if (!Number.isFinite(requiredLevel) ||
      !Number.isFinite(studentLevel)) {
    throw new Error("Valid qualification levels are required");
  }

  const testType = String(student.english_test || "").toUpperCase();

  if (!ENGLISH_TESTS.includes(testType)) {
    return {
      status: "Review",
      reason: "English test requires manual verification",
    };
  }

  const score = Number(student.english_score);

const minimumScores = {
  IELTS: program.min_ielts,
  PTE: program.min_pte,
  TOEFL: program.min_toefl,
};

const configuredMinimum = minimumScores[testType];

if (
  configuredMinimum === null ||
  configuredMinimum === undefined ||
  configuredMinimum === "" ||
  !Number.isFinite(Number(configuredMinimum))
) {
  return {
    status: "Review",
    reason: "English test threshold is not configured",
  };
}

const minimum = Number(configuredMinimum);

  const minimum = minimumScores[testType];
if (
  minimum === null ||
  minimum === undefined ||
  !Number.isFinite(minimum)
) {
  return {
    status: "Review",
    reason: "English test threshold is not configured",
  };
}
  if (!Number.isFinite(score) ||
      !Number.isFinite(minimum)) {
    return {
      status: "Review",
      reason: "English test score requires verification",
    };
  }

  if (studentLevel < requiredLevel) {
    return {
      status: "Fail",
      reason: "Qualification level below program requirement",
    };
  }

  if (score >= minimum) {
    return {
      status: "Pass",
      reason: "Student meets program entry requirements",
    };
  }

  // A provisional near-miss policy.
  // RIC must approve the review threshold for each test.
  const reviewMargins = {
    IELTS: 0.5,
    PTE: 5,
    TOEFL: 5,
  };

  if (score >= minimum - reviewMargins[testType]) {
    return {
      status: "Review",
      reason: "English score requires manual assessment",
    };
  }

  return {
    status: "Fail",
    reason: "English score below program requirement",
  };
}

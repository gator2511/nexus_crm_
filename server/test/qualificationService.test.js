
import test from "node:test";
import assert from "node:assert/strict";

import {
  mapProgramCriteria,
  assessQualification,
} from "../src/qualificationService.js";

const program = {
  min_qualification_level: 3,
  language_requirements: {
    IELTS: 6.5,
    PTE: 58,
    TOEFL: 79,
  },
};

test("TC-216: Database criteria are mapped correctly", () => {
  const result = mapProgramCriteria(program);

  assert.equal(result.required_level, 3);
  assert.equal(result.min_ielts, 6.5);
  assert.equal(result.min_pte, 58);
});

test("TC-217: Eligible student passes assessment", () => {
  const result = assessQualification(
    {
      qualification_level: 4,
      english_test: "IELTS",
      english_score: 7,
    },
    program
  );

  assert.equal(result.status, "Pass");
  assert.equal(result.requiresStaffReview, false);
});

test("TC-218: Borderline student requires review", () => {
  const result = assessQualification(
    {
      qualification_level: 3,
      english_test: "IELTS",
      english_score: 6,
    },
    program
  );

  assert.equal(result.status, "Review");
  assert.equal(result.requiresStaffReview, true);
});

test("TC-219: Insufficient qualifications fail", () => {
  const result = assessQualification(
    {
      qualification_level: 2,
      english_test: "IELTS",
      english_score: 7,
    },
    program
  );

  assert.equal(result.status, "Fail");
});

test("TC-220: Invalid student input is rejected", () => {
  const result = assessQualification(
    {
      qualification_level: "",
      english_test: "UNKNOWN",
      english_score: "",
    },
    program
  );

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.english_test);
});

test("TC-221: Missing program requirements are rejected", () => {
  assert.throws(
    () => mapProgramCriteria({
      min_qualification_level: 3,
      language_requirements: null,
    }),
    /not configured/
  );
});

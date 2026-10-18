
import test from "node:test";
import assert from "node:assert/strict";

import { checkEligibility } from "../src/criteria.js";
import {
  validateEnquiry,
  validateQualification,
  validateApplication,
} from "../src/validate.js";

const program = {
  required_level: 3,
  min_ielts: 6.5,
  min_pte: 58,
  min_toefl: 79,
};

test("TC-201: Eligible student passes", () => {
  const result = checkEligibility(
    {
      qualification_level: 3,
      english_test: "IELTS",
      english_score: 7,
    },
    program
  );

  assert.equal(result.status, "Pass");
});

test("TC-202: Low qualification fails", () => {
  const result = checkEligibility(
    {
      qualification_level: 2,
      english_test: "IELTS",
      english_score: 7,
    },
    program
  );

  assert.equal(result.status, "Fail");
});

test("TC-203: Borderline English score requires review", () => {
  const result = checkEligibility(
    {
      qualification_level: 3,
      english_test: "IELTS",
      english_score: 6,
    },
    program
  );

  assert.equal(result.status, "Review");
});

test("TC-204: Invalid enquiry email is rejected", () => {
  const result = validateEnquiry({
    full_name: "Test Student",
    email: "invalid-email",
    phone: "0400000000",
    address: "Adelaide",
    program_id: 1,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.email);
});

test("TC-205: Missing enquiry fields are rejected", () => {
  const result = validateEnquiry({});

  assert.equal(result.valid, false);
  assert.ok(result.errors.full_name);
  assert.ok(result.errors.program_id);
});

test("TC-206: Valid qualification details pass validation", () => {
  const result = validateQualification({
    qualification_level: 3,
    english_test: "PTE",
    english_score: 65,
  });

  assert.equal(result.valid, true);
});

test("TC-207: Invalid English test is rejected", () => {
  const result = validateQualification({
    qualification_level: 3,
    english_test: "UNKNOWN",
    english_score: 65,
  });

  assert.equal(result.valid, false);
});

test("TC-208: Incomplete application is rejected", () => {
  const result = validateApplication({
    qualification: "",
    institution: "",
  });

  assert.equal(result.valid, false);
});

test("TC-209: Valid application details pass validation", () => {
  const result = validateApplication({
    qualification: "Bachelor",
    institution: "Example University",
    graduationYear: 2024,
  });

  assert.equal(result.valid, true);
});

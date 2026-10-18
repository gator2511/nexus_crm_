
import test from "node:test";
import assert from "node:assert/strict";

import {
  checkApplicationCompleteness,
  canSubmitApplication,
} from "../src/application.js";

const validApplication = {
  qualification: "Bachelor",
  institution: "Example University",
  graduationYear: 2024,
};

const requiredTypes = ["Passport", "Transcript"];

test("TC-210: Complete application is accepted", () => {
  const documents = [
    { type: "Passport", status: "Accepted" },
    { type: "Transcript", status: "Accepted" },
  ];

  const result = checkApplicationCompleteness(
    validApplication,
    documents,
    requiredTypes
  );

  assert.equal(result.complete, true);
  assert.equal(result.missingDocuments.length, 0);
});

test("TC-211: Missing document prevents submission", () => {
  const documents = [
    { type: "Passport", status: "Accepted" },
  ];

  const result = checkApplicationCompleteness(
    validApplication,
    documents,
    requiredTypes
  );

  assert.equal(result.complete, false);
  assert.deepEqual(result.missingDocuments, ["Transcript"]);
});

test("TC-212: Rejected document is not accepted", () => {
  const documents = [
    { type: "Passport", status: "Accepted" },
    { type: "Transcript", status: "Rejected" },
  ];

  const result = checkApplicationCompleteness(
    validApplication,
    documents,
    requiredTypes
  );

  assert.equal(result.complete, false);
});

test("TC-213: Incomplete application details are rejected", () => {
  const result = checkApplicationCompleteness(
    {
      qualification: "",
      institution: "",
    },
    [],
    []
  );

  assert.equal(result.complete, false);
  assert.ok(result.errors.qualification);
  assert.ok(result.errors.institution);
});

test("TC-214: Valid application permits submission", () => {
  const documents = [
    { type: "Passport", status: "Accepted" },
    { type: "Transcript", status: "Accepted" },
  ];

  const result = canSubmitApplication(
    validApplication,
    documents,
    requiredTypes
  );

  assert.equal(result.allowed, true);
});

test("TC-215: Missing documents block submission", () => {
  const result = canSubmitApplication(
    validApplication,
    [],
    requiredTypes
  );

  assert.equal(result.allowed, false);
});


import { describe, it, expect } from "vitest";
import {
  validateEnquiry,
  validateDocument,
} from "./validation.js";

const validEnquiry = {
  full_name: "Test Student",
  email: "student@example.com",
  phone: "0400000000",
  address: "Adelaide SA",
  program_id: "1",
};

describe("Student enquiry validation", () => {
  it("TC-101: accepts valid enquiry data", () => {
    expect(validateEnquiry(validEnquiry)).toEqual({});
  });

  it("TC-102: rejects invalid email", () => {
    const errors = validateEnquiry({
      ...validEnquiry,
      email: "invalid-email",
    });

    expect(errors.email).toBeDefined();
  });

  it("TC-103: rejects missing required fields", () => {
    const errors = validateEnquiry({
      ...validEnquiry,
      full_name: "",
      email: "",
    });

    expect(errors.full_name).toBeDefined();
    expect(errors.email).toBeDefined();
  });
});

describe("Document validation", () => {
  it("TC-111: rejects executable files", () => {
    const file = {
      type: "application/x-msdownload",
      size: 1024,
    };

    expect(validateDocument(file)).not.toBeNull();
  });

  it("TC-112: rejects files exceeding 10 MB", () => {
    const file = {
      type: "application/pdf",
      size: 11 * 1024 * 1024,
    };

    expect(validateDocument(file)).not.toBeNull();
  });

  it("accepts a valid PDF document", () => {
    const file = {
      type: "application/pdf",
      size: 1024,
    };

    expect(validateDocument(file)).toBeNull();
  });
});


/**
 * Nexus CRM - Input Validation
 * Module owner: Abhimanyu Patel
 */

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEnquiry(data = {}) {
  const errors = {};

  if (!required(data.full_name)) {
    errors.full_name = "Full name is required";
  }

  if (!validEmail(data.email || "")) {
    errors.email = "Valid email address is required";
  }

  if (!required(data.phone)) {
    errors.phone = "Phone number is required";
  }

  if (!required(data.address)) {
    errors.address = "Address is required";
  }

  if (!data.program_id) {
    errors.program_id = "Program selection is required";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateQualification(data = {}) {
  const errors = {};

  if (data.qualification_level === undefined ||
      data.qualification_level === null ||
      data.qualification_level === "") {
    errors.qualification_level = "Qualification level is required";
  }

  if (!["IELTS", "PTE", "TOEFL"].includes(
    String(data.english_test || "").toUpperCase()
  )) {
    errors.english_test = "Valid English test is required";
  }

  if (data.english_score === undefined ||
      data.english_score === null ||
      data.english_score === "" ||
      !Number.isFinite(Number(data.english_score))) {
    errors.english_score = "Valid English score is required";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateApplication(data = {}) {
  const errors = {};

  if (!required(data.qualification)) {
    errors.qualification = "Qualification is required";
  }

  if (!required(data.institution)) {
    errors.institution = "Institution is required";
  }

  if (data.graduationYear &&
      (!Number.isInteger(Number(data.graduationYear)) ||
       Number(data.graduationYear) < 1950 ||
       Number(data.graduationYear) > new Date().getFullYear() + 1)) {
    errors.graduationYear = "Enter a valid graduation year";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}


export function validateEnquiry(form) {
  const errors = {};

  if (!form.full_name?.trim()) {
    errors.full_name = "Full name is required";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || "")) {
    errors.email = "Enter a valid email address";
  }

  if (!form.phone?.trim()) {
    errors.phone = "Phone number is required";
  }

  if (!form.address?.trim()) {
    errors.address = "Address is required";
  }

  if (!form.program_id) {
    errors.program_id = "Select a program";
  }

  return errors;
}

export function validateDocument(file) {
  if (!file) {
    return "Please select a document";
  }

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.type)) {
    return "Only PDF, JPG and PNG files are accepted.";
  }

  if (file.size > 10 * 1024 * 1024) {
    return "Maximum file size is 10 MB.";
  }

  return null;
}


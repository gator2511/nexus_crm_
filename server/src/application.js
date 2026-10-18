
/**
 * Nexus CRM - Application Completeness Rules
 * Module owner: Abhimanyu Patel
 */

import { validateApplication } from "./validate.js";

export function checkApplicationCompleteness(
  application,
  documents = [],
  requiredDocumentTypes = []
) {
  const validation = validateApplication(application);

  const missingDocuments = requiredDocumentTypes.filter(
    (type) =>
      !documents.some(
        (doc) =>
          doc.type === type &&
          doc.status === "Accepted"
      )
  );

  const errors = { ...validation.errors };

  if (missingDocuments.length > 0) {
    errors.documents =
      `Missing accepted documents: ${missingDocuments.join(", ")}`;
  }

  return {
    complete: validation.valid && missingDocuments.length === 0,
    errors,
    missingDocuments,
  };
}

export function canSubmitApplication(
  application,
  documents,
  requiredDocumentTypes
) {
  const result = checkApplicationCompleteness(
    application,
    documents,
    requiredDocumentTypes
  );

  return {
    allowed: result.complete,
    reason: result.complete
      ? "Application ready for submission"
      : "Application information or documents are incomplete",
    errors: result.errors,
  };
}


/**
 * Nexus CRM - PDF Offer Letter Generator
 * Module owner: Abhimanyu Patel
 */

import PDFDocument from "pdfkit";

/**
 * Generate a PDF offer letter for an approved application.
 * Returns a Buffer containing the PDF.
 */
export function generateOfferLetter(application) {
  return new Promise((resolve, reject) => {
    if (!application ||
        application.status !== "Approved") {
      return reject(
        new Error("Only approved applications can receive an offer")
      );
    }

    const required = [
      "studentName",
      "programName",
      "applicationId",
    ];

    for (const field of required) {
      if (!application[field] ||
          typeof application[field] !== "string") {
        return reject(
          new Error(`Missing or invalid field: ${field}`)
        );
      }
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);

    doc.fontSize(22)
      .text("RIC - Letter of Offer", {
        align: "center",
      });

    doc.moveDown(2);

    doc.fontSize(11)
      .text(`Date: ${new Date().toLocaleDateString("en-AU")}`)
      .moveDown()
      .text(`Application ID: ${application.applicationId}`)
      .moveDown()
      .text(`Dear ${application.studentName},`)
      .moveDown()
      .text(
        `We are pleased to offer you a place in the following program:`
      )
      .moveDown()
      .fontSize(14)
      .text(application.programName)
      .moveDown()
      .fontSize(11)
      .text(
        "This offer is subject to the institution's " +
        "official admission requirements and conditions."
      )
      .moveDown(2)
      .text("Regards,")
      .text("RIC Admissions Team");

    doc.end();
  });
}

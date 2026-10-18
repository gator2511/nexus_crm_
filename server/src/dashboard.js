
/**
 * Nexus CRM - Staff Dashboard Statistics
 * Module owner: Isha
 */

export const PIPELINE_STAGES = [
  "Enquiry",
  "Qualification review",
  "Qualified",
  "Application",
  "Offer",
  "Enrolled",
  "Closed",
];

/**
 * Calculate staff dashboard recruitment statistics.
 *
 * @param {Array} prospects - Prospect records
 * @returns {Object} Dashboard summary
 */
export function getDashboardSummary(prospects = []) {
  if (!Array.isArray(prospects)) {
    throw new TypeError("Prospects must be an array");
  }

  const stageCounts = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, 0])
  );

  for (const prospect of prospects) {
    if (!prospect || !PIPELINE_STAGES.includes(prospect.stage)) {
      throw new Error("Invalid prospect stage");
    }

    stageCounts[prospect.stage]++;
  }

  const totalProspects = prospects.length;
  const closedProspects = stageCounts.Closed;
  const enrolledProspects = stageCounts.Enrolled;

  return {
    totalProspects,
    activeProspects:
      totalProspects - closedProspects - enrolledProspects,
    enrolledProspects,
    closedProspects,
    stageCounts,
  };
}

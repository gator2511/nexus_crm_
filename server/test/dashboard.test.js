
import test from "node:test";
import assert from "node:assert/strict";

import {
  getDashboardSummary,
  PIPELINE_STAGES,
} from "../src/dashboard.js";

test("TC-301: Empty CRM produces zero statistics", () => {
  const result = getDashboardSummary([]);

  assert.equal(result.totalProspects, 0);
  assert.equal(result.activeProspects, 0);
  assert.equal(result.enrolledProspects, 0);
});

test("TC-302: Dashboard counts all recruitment stages", () => {
  const prospects = PIPELINE_STAGES.map(
    (stage) => ({ stage })
  );

  const result = getDashboardSummary(prospects);

  assert.equal(result.totalProspects, 7);

  for (const stage of PIPELINE_STAGES) {
    assert.equal(result.stageCounts[stage], 1);
  }
});

test("TC-303: Active prospects exclude enrolled and closed", () => {
  const prospects = [
    { stage: "Enquiry" },
    { stage: "Qualified" },
    { stage: "Application" },
    { stage: "Enrolled" },
    { stage: "Closed" },
  ];

  const result = getDashboardSummary(prospects);

  assert.equal(result.totalProspects, 5);
  assert.equal(result.activeProspects, 3);
  assert.equal(result.enrolledProspects, 1);
  assert.equal(result.closedProspects, 1);
});

test("TC-304: Multiple prospects in one stage are counted", () => {
  const prospects = [
    { stage: "Enquiry" },
    { stage: "Enquiry" },
    { stage: "Enquiry" },
  ];

  const result = getDashboardSummary(prospects);

  assert.equal(result.stageCounts.Enquiry, 3);
});

test("TC-305: Invalid stage is rejected", () => {
  assert.throws(
    () => getDashboardSummary([
      { stage: "Unknown" },
    ]),
    /Invalid prospect stage/
  );
});

test("TC-306: Invalid prospect input is rejected", () => {
  assert.throws(
    () => getDashboardSummary("invalid"),
    /Prospects must be an array/
  );
});

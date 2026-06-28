import { createDemoPipelineOrchestrator } from "../app/lib/demo/engine/run-demo-pipeline";
import { DEMO_SCENARIOS } from "../app/lib/demo/data/scenarios";
import { REVIEW_THRESHOLD } from "../app/lib/demo/contracts/confidence-policy";

function padLabel(label: string): string {
  return `${label}:`.padEnd(15, " ");
}

function divider(width = 72): string {
  return "-".repeat(width);
}

async function main(): Promise<void> {
  const pipeline = createDemoPipelineOrchestrator();
  const verbose = process.argv.includes("--verbose");

  console.log("CPT Reimbursement Engine Demo");
  console.log(divider());

  for (const scenario of DEMO_SCENARIOS) {
    const envelope = await pipeline.run(scenario.id);
    const result = envelope.result;
    const confidence = envelope.confidence.overall.toFixed(3);
    const predictedApc = result.predictedApc ?? "null";

    const validationResult = (() => {
      if (scenario.knownCmsOutcome === null) {
        return "NO_PRECEDENT";
      }
      const statusMatch =
        result.predictedStatusIndicator === scenario.knownCmsOutcome.statusIndicator;
      const apcMatch = (result.predictedApc ?? null) === scenario.knownCmsOutcome.apc;
      return statusMatch && apcMatch ? "MATCH" : "MISMATCH";
    })();

    console.log(`Scenario: ${scenario.title} (${scenario.id})`);
    if (validationResult === "NO_PRECEDENT") {
      console.log(
        `${padLabel("Result")}NO PRECEDENT — no CMS payment pathway for this device category`
      );
      console.log(
        `${padLabel("Confidence")}${confidence}  (below the review threshold ${REVIEW_THRESHOLD.toFixed(
          2
        )} — routed to specialist review)`
      );
      console.log(
        `${"Nearest candidate: ".padEnd(15, " ")}${result.selectedCode} (rejected; shown only to prove the engine declined to match)`
      );
    } else {
      console.log(`${padLabel("Top code")}${result.selectedCode}`);
      console.log(`${padLabel("Confidence")}${confidence}`);
      console.log(
        `${padLabel("Prediction")}${result.predictedStatusIndicator} / APC ${predictedApc}`
      );
      console.log(`${padLabel("Validation")}${validationResult}`);
    }

    const modeCounts = envelope.honestyMarkers.reduce(
      (acc, marker) => {
        acc.total += 1;
        if (marker.mode === "computed") acc.computed += 1;
        if (marker.mode === "sourced") acc.sourced += 1;
        if (marker.mode === "simulated") acc.simulated += 1;
        return acc;
      },
      { total: 0, computed: 0, sourced: 0, simulated: 0 }
    );
    console.log(
      `${padLabel("Honesty")}${modeCounts.total} fields — ${modeCounts.computed} computed, ${modeCounts.sourced} sourced, ${modeCounts.simulated} simulated   (--verbose to list)`
    );
    if (verbose) {
      for (const marker of envelope.honestyMarkers) {
        console.log(`  - ${marker.field} [${marker.mode}]`);
      }
    }
    console.log(divider());
  }
}

void main();

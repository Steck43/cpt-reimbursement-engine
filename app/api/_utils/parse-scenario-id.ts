import {
  DEMO_SCENARIOS,
  type DemoScenarioId,
} from "../../lib/demo/data/scenarios";

type ParsedScenarioId =
  | {
      readonly ok: true;
      readonly scenarioId: DemoScenarioId;
    }
  | {
      readonly ok: false;
      readonly error: "scenarioId is required" | "Unknown scenario id";
    };

const VALID_SCENARIO_IDS = new Set<DemoScenarioId>(
  DEMO_SCENARIOS.map((scenario) => scenario.id)
);

export function parseScenarioId(value: unknown): ParsedScenarioId {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "scenarioId is required",
    };
  }

  const candidate = value.trim();
  if (candidate.length === 0) {
    return {
      ok: false,
      error: "scenarioId is required",
    };
  }

  if (!VALID_SCENARIO_IDS.has(candidate as DemoScenarioId)) {
    return {
      ok: false,
      error: "Unknown scenario id",
    };
  }

  return {
    ok: true,
    scenarioId: candidate as DemoScenarioId,
  };
}

import { describe, expect, it } from "vitest";
import type { HonestyMarker } from "../../../lib/demo/contracts/response-envelope";
import type { BusinessModelOverlay } from "../../../lib/demo/data/business-model-overlays";
import {
  buildBusinessModelSectionNarratives,
  findHonestyMarker,
  shouldApplyScenarioResponse,
} from "../demo-shell-model";

describe("demo-shell-model", () => {
  it("maps business-model overlay into sections 7, 8, and 20", () => {
    const overlay: BusinessModelOverlay = {
      scenarioId: "ai-ecg",
      strategyTierValue: "Strategy tier proof",
      retentionMechanism: "Retention signal",
      revenueProtectionFrame: "Protection framing",
    };

    const sections = buildBusinessModelSectionNarratives({
      overlay,
      revenueProtectionDelta: 6050.4,
    });

    expect(sections["7"]).toBe("Strategy tier proof");
    expect(sections["8"]).toBe("Retention signal");
    expect(sections["20"]).toContain("Protection framing");
    expect(sections["20"]).toContain("$6,050");
  });

  it("preserves computed vs simulated honesty semantics", () => {
    const markers: readonly HonestyMarker[] = [
      {
        field: "result.validationStatement",
        mode: "computed",
        note: "Computed from match booleans.",
      },
      {
        field: "result.overlay",
        mode: "simulated",
        note: "Simulated for narrative preview.",
      },
    ];

    const computed = findHonestyMarker(markers, ["result.validationStatement"]);
    const simulated = findHonestyMarker(markers, ["result.overlay"]);

    expect(computed?.mode).toBe("computed");
    expect(simulated?.mode).toBe("simulated");
  });

  it("blocks stale or aborted scenario responses", () => {
    expect(
      shouldApplyScenarioResponse({
        requestId: 3,
        latestRequestId: 3,
        aborted: false,
      })
    ).toBe(true);
    expect(
      shouldApplyScenarioResponse({
        requestId: 2,
        latestRequestId: 3,
        aborted: false,
      })
    ).toBe(false);
    expect(
      shouldApplyScenarioResponse({
        requestId: 3,
        latestRequestId: 3,
        aborted: true,
      })
    ).toBe(false);
  });
});

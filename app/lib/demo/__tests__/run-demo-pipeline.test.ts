import { describe, expect, it } from "vitest";

import { hasExactResponseEnvelopeKeys } from "../contracts/response-envelope";
import { createDemoPipelineOrchestrator } from "../engine/run-demo-pipeline";
import type { DemoIngestionService } from "../services/ingestion-service";

describe("demo pipeline orchestrator", () => {
  it('composes ingestion, code intelligence, payment, and monitoring with sections ["7","8","20"]', async () => {
    const pipeline = createDemoPipelineOrchestrator();

    const envelope = await pipeline.run("mindmotion-go");

    expect(hasExactResponseEnvelopeKeys(envelope)).toBe(true);
    expect(envelope.result.monitoring.alert.triggered).toBe(true);
    expect(envelope.result.monitoring.revenueProtectionDelta).toBeGreaterThan(0);
    expect(envelope.result.businessModelOverlay.sections).toEqual(["7", "8", "20"]);
    expect(envelope.result.businessModelOverlay.sectionNarrative["7"]).toContain(
      "strategy tier value"
    );
    expect(envelope.result.businessModelOverlay.sectionNarrative["8"]).toContain(
      "retention"
    );
    expect(envelope.result.businessModelOverlay.sectionNarrative["20"]).toContain(
      "proof point"
    );
    expect(envelope.confidence.derivation).toBe("computed");
  });

  it("computes pipeline outputs for all five scenarios with restored hero predictions", async () => {
    const pipeline = createDemoPipelineOrchestrator();

    const aiEcg = await pipeline.run("ai-ecg");
    expect(aiEcg.result.selectedCode).toBeTruthy();
    expect(aiEcg.confidence.derivation).toBe("computed");
    expect(aiEcg.result.predictedStatusIndicator).toBe("E1");
    expect(aiEcg.result.predictedApc).toBeNull();

    const mindMotion = await pipeline.run("mindmotion-go");
    expect(mindMotion.result.predictedStatusIndicator).toBe("S");
    expect(mindMotion.result.predictedApc).toBe("1505");

    const recell = await pipeline.run("recell");
    expect(recell.result.predictedStatusIndicator).toBe("T");
    expect(recell.result.predictedApc).toBe("1567");

    const cochlear = await pipeline.run("cochlear-69930");
    expect(cochlear.result.predictedStatusIndicator).toBe("J1");
    expect(cochlear.result.predictedApc).toBe("5166");

    const bci = await pipeline.run("bci-archetype");
    expect(bci.result.predictedStatusIndicator.length).toBeGreaterThan(0);
  });

  it("emits only pipeline-valid or namespaced honesty marker fields", async () => {
    const pipeline = createDemoPipelineOrchestrator();

    const envelope = await pipeline.run("ai-ecg");

    expect(
      envelope.honestyMarkers.every((marker) => {
        return (
          marker.field === "result" ||
          marker.field === "result.monitoring" ||
          marker.field === "result.businessModelOverlay" ||
          marker.field === "result.warnings" ||
          marker.field === "confidence" ||
          marker.field.startsWith("upstream.")
        );
      })
    ).toBe(true);
    expect(
      envelope.honestyMarkers.some(
        (marker) => marker.field === "result.rankedCandidates"
      )
    ).toBe(false);
    expect(
      envelope.honestyMarkers.some(
        (marker) => marker.field === "result.predictedStatusIndicator"
      )
    ).toBe(false);
  });

  it("propagates ingestion warnings in result and provenance", async () => {
    const ingestionWithWarning: DemoIngestionService = {
      modules: {
        ingestion: "ingestion-service",
        codeIntelligence: "code-intelligence-service",
        paymentModel: "payment-model-service",
        monitoring: "monitoring-service",
        explainability: "explainability-service",
      },
      async loadScenarioSnapshot() {
        return {
          scenario: {
            id: "ai-ecg",
            title: "AI-ECG",
            company: null,
            failureMode: "status-indicator",
            deviceClass: "Extended external ECG monitoring device",
            clinicalArea: "Cardiovascular outpatient monitoring",
            relevantTags: ["cardiac", "ecg", "external", "extended", "electrocardiogram", "recording"],
            knownCmsOutcome: {
              statusIndicator: "E1",
              apc: null,
            },
          },
          overlay: {
            scenarioId: "ai-ecg",
            strategyTierValue:
              "Code-intelligence scoring supports higher-confidence cardiovascular adjudication.",
            retentionMechanism:
              "Monitoring catches policy changes before they erode reimbursement.",
            revenueProtectionFrame:
              "Retrospective variance checks frame recovered revenue at portfolio scale.",
          },
          curatedCodes: [
            {
              code: "0937T",
              descriptor: "External ECG recording more than 15 days less than 30 days",
              codeFamily: "CPT",
              tags: ["cardiac", "ecg", "external", "extended", "electrocardiogram", "recording"],
              statusIndicator: "E1",
              statusLabel: "Not paid under OPPS",
              apc: null,
              apcPayment: 0,
              provenance: "Test fixture",
            },
          ],
          policyEvents: [],
          warnings: [
            {
              code: "fallback-to-all-codes",
              message:
                "No curated code tags matched scenario tags, fallback policy returned all codes.",
              scenarioId: "ai-ecg",
            },
          ],
          generatedAt: "2026-05-31T00:00:00.000Z",
        };
      },
    };

    const pipeline = createDemoPipelineOrchestrator({
      ingestionService: ingestionWithWarning,
    });

    const envelope = await pipeline.run("ai-ecg");

    expect(envelope.result.warnings).toEqual([
      {
        code: "fallback-to-all-codes",
        message:
          "No curated code tags matched scenario tags, fallback policy returned all codes.",
        scenarioId: "ai-ecg",
      },
    ]);
    expect(
      envelope.provenance.some(
        (entry) =>
          entry.source === "run-demo-pipeline" &&
          entry.citation.includes("ingestionWarnings:1")
      )
    ).toBe(true);
  });
});

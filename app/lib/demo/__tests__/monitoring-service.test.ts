import { describe, expect, it } from "vitest";

import { hasExactResponseEnvelopeKeys } from "../contracts/response-envelope";
import { getScenarioById } from "../data/scenarios";
import {
  MonitoringInputError,
  createMonitoringService,
} from "../services/monitoring-service";

describe("monitoring service", () => {
  it("computes rule-event impact deltas, alert state, and revenue protection deltas", async () => {
    const service = createMonitoringService();
    const scenario = getScenarioById("ai-ecg");

    const envelope = await service.evaluate({
      scenario,
      selectedCode: "0733T",
      policyEvents: [
        {
          id: "cms-cardiology-alert",
          feed: "cms",
          summary: "Cardiovascular outpatient payment-rule clarification bulletin.",
          effectiveOn: "2026-01-01",
        },
        {
          id: "ama-orthopedic-note",
          feed: "ama",
          summary: "Orthopedic coding memo update.",
          effectiveOn: "2026-02-15",
        },
      ],
      paymentModelResult: {
        predictedStatusIndicator: "Q1",
        predictedApc: "5734",
        actualCmsStatusIndicator: scenario.knownCmsOutcome.statusIndicator,
        actualCmsApc: scenario.knownCmsOutcome.apc,
        statusIndicatorMatch: false,
        apcMatch: false,
      },
    });

    expect(hasExactResponseEnvelopeKeys(envelope)).toBe(true);
    expect(envelope.result.alert.triggered).toBe(true);
    expect(envelope.result.ruleEventImpactDelta).toBeGreaterThan(0);
    expect(envelope.result.revenueProtectionDelta).toBeGreaterThan(0);
    expect(envelope.result.alert.impactedRuleEventIds).toContain("cms-cardiology-alert");
    expect(envelope.confidence.derivation).toBe("computed");
    expect(envelope.confidence.contributors.map((item) => item.name)).toEqual([
      "descriptorMatch",
      "keywordOverlap",
      "categoryAlignment",
    ]);
  });

  it("keeps low-risk alerts off when rule events and mismatches are absent", async () => {
    const service = createMonitoringService();
    const scenario = getScenarioById("mindmotion-go");

    const envelope = await service.evaluate({
      scenario,
      selectedCode: "97799",
      policyEvents: [],
      paymentModelResult: {
        predictedStatusIndicator: scenario.knownCmsOutcome.statusIndicator,
        predictedApc: scenario.knownCmsOutcome.apc,
        actualCmsStatusIndicator: scenario.knownCmsOutcome.statusIndicator,
        actualCmsApc: scenario.knownCmsOutcome.apc,
        statusIndicatorMatch: true,
        apcMatch: true,
      },
    });

    expect(envelope.result.alert.triggered).toBe(false);
    expect(envelope.result.alert.severity).toBe("low");
    expect(envelope.result.revenueProtectionDelta).toBeGreaterThanOrEqual(0);
  });

  it("keeps impact and revenue deltas at zero for irrelevant events without mismatches", async () => {
    const service = createMonitoringService();
    const scenario = getScenarioById("mindmotion-go");

    const envelope = await service.evaluate({
      scenario,
      selectedCode: "97799",
      policyEvents: [
        {
          id: "ama-irrelevant-001",
          feed: "ama",
          summary: "Veterinary dermatology coding bulletin for canine excision updates.",
          effectiveOn: "2026-03-10",
        },
        {
          id: "cms-irrelevant-002",
          feed: "cms",
          summary: "Podiatry nail-trimming guidance clarification memo.",
          effectiveOn: "2026-04-22",
        },
      ],
      paymentModelResult: {
        predictedStatusIndicator: scenario.knownCmsOutcome.statusIndicator,
        predictedApc: scenario.knownCmsOutcome.apc,
        actualCmsStatusIndicator: scenario.knownCmsOutcome.statusIndicator,
        actualCmsApc: scenario.knownCmsOutcome.apc,
        statusIndicatorMatch: true,
        apcMatch: true,
      },
    });

    expect(envelope.result.alert.triggered).toBe(false);
    expect(envelope.result.alert.severity).toBe("low");
    expect(envelope.result.alert.impactedRuleEventIds).toEqual([]);
    expect(envelope.result.ruleEventImpactDelta).toBe(0);
    expect(envelope.result.revenueProtectionDelta).toBe(314);
  });

  it("throws MonitoringInputError when selected code is missing", async () => {
    const service = createMonitoringService();

    await expect(
      service.evaluate({
        scenario: getScenarioById("recell"),
        selectedCode: "",
        policyEvents: [],
        paymentModelResult: {
          predictedStatusIndicator: "S",
          predictedApc: "1567",
          actualCmsStatusIndicator: "S",
          actualCmsApc: "1567",
          statusIndicatorMatch: true,
          apcMatch: true,
        },
      })
    ).rejects.toBeInstanceOf(MonitoringInputError);
  });

  it("applies failure-mode economics: RECELL largest protectable, AI-ECG exposure, BCI unknown", async () => {
    const service = createMonitoringService();
    const policyEvents = [
      {
        id: "demo-event",
        feed: "cms" as const,
        summary: "Generic policy event",
        effectiveOn: "2026-01-01",
      },
    ];

    const recell = await service.evaluate({
      scenario: getScenarioById("recell"),
      selectedCode: "15013",
      policyEvents,
      paymentModelResult: {
        predictedStatusIndicator: "S",
        predictedApc: "1567",
        actualCmsStatusIndicator: "S",
        actualCmsApc: "1567",
        statusIndicatorMatch: true,
        apcMatch: true,
      },
    });

    const mindMotion = await service.evaluate({
      scenario: getScenarioById("mindmotion-go"),
      selectedCode: "0733T",
      policyEvents,
      paymentModelResult: {
        predictedStatusIndicator: "S",
        predictedApc: "1505",
        actualCmsStatusIndicator: "S",
        actualCmsApc: "1505",
        statusIndicatorMatch: true,
        apcMatch: true,
      },
    });

    const aiEcg = await service.evaluate({
      scenario: getScenarioById("ai-ecg"),
      selectedCode: "0937T",
      policyEvents,
      paymentModelResult: {
        predictedStatusIndicator: "E1",
        predictedApc: null,
        actualCmsStatusIndicator: "E1",
        actualCmsApc: null,
        statusIndicatorMatch: true,
        apcMatch: true,
      },
    });

    const bci = await service.evaluate({
      scenario: getScenarioById("bci-archetype"),
      selectedCode: "69930",
      policyEvents,
      paymentModelResult: {
        predictedStatusIndicator: "J1",
        predictedApc: "5166",
        actualCmsStatusIndicator: null,
        actualCmsApc: null,
        statusIndicatorMatch: false,
        apcMatch: false,
      },
    });

    expect(recell.result.revenueProtectionDelta).toBeGreaterThan(mindMotion.result.revenueProtectionDelta ?? 0);
    expect(aiEcg.result.economicModel.mode).toBe("foregone-revenue-exposure");
    expect(bci.result.economicModel.mode).toBe("unknown-exposure");
    expect(bci.result.revenueProtectionDelta).toBeNull();
  });
});

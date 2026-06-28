import { describe, expect, it } from "vitest";

import { CURATED_CODE_DATA } from "../data/curated-codes";
import {
  BUSINESS_MODEL_OVERLAYS,
  BusinessModelOverlayNotFoundError,
  getBusinessModelOverlayForScenario,
} from "../data/business-model-overlays";
import {
  DEMO_SCENARIOS,
  ScenarioNotFoundError,
  getScenarioById,
} from "../data/scenarios";
import { deriveConfidence } from "../contracts/confidence-policy";
import {
  AmaLicensedCodeDataProvider,
  CuratedCodeDataProvider,
  ProductionPolicyFeedAdapter,
  SeededPolicyFeedProvider,
  UnavailableProviderError,
} from "../contracts/providers";
import { hasExactResponseEnvelopeKeys } from "../contracts/response-envelope";
import {
  createDemoIngestionService,
  createScenarioSnapshotEnvelope,
} from "../services/ingestion-service";

describe("provider seams and monolith scaffolding", () => {
  it("keeps scenario fixtures free of static confidence assignments", () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect("confidence" in scenario).toBe(false);
    }
  });

  it("returns curated code and seeded policy data via injectable providers", async () => {
    const curatedProvider = new CuratedCodeDataProvider(CURATED_CODE_DATA);
    const seededPolicyProvider = new SeededPolicyFeedProvider([
      {
        id: "cms-demo-001",
        feed: "cms",
        summary: "Cardiovascular policy bulletin",
        effectiveOn: "2026-01-01",
      },
    ]);
    const service = createDemoIngestionService({
      codeDataProvider: curatedProvider,
      policyFeedProvider: seededPolicyProvider,
    });

    const snapshot = await service.loadScenarioSnapshot("ai-ecg");

    expect(snapshot.scenario.id).toBe("ai-ecg");
    expect(snapshot.curatedCodes.length).toBeGreaterThan(0);
    expect(snapshot.policyEvents).toHaveLength(1);
    expect(snapshot.overlay.scenarioId).toBe("ai-ecg");
    expect(snapshot.warnings).toHaveLength(0);
  });

  it("keeps internal module boundaries in one backend service object", async () => {
    const service = createDemoIngestionService({
      codeDataProvider: new CuratedCodeDataProvider(CURATED_CODE_DATA),
      policyFeedProvider: new SeededPolicyFeedProvider([]),
    });

    expect(service.modules).toEqual({
      ingestion: "ingestion-service",
      codeIntelligence: "code-intelligence-service",
      paymentModel: "payment-model-service",
      monitoring: "monitoring-service",
      explainability: "explainability-service",
    });
    await expect(service.loadScenarioSnapshot("mindmotion-go")).resolves.toBeTruthy();
  });

  it("surfaces unavailable production adapters through typed seam errors", async () => {
    await expect(new AmaLicensedCodeDataProvider().getCodeData()).rejects.toBeInstanceOf(
      UnavailableProviderError
    );
    await expect(
      new ProductionPolicyFeedAdapter().getPolicyEvents()
    ).rejects.toBeInstanceOf(UnavailableProviderError);
  });

  it("builds response envelopes with derived confidence and locked keys", () => {
    const scenario = getScenarioById("recell");
    const overlay = getBusinessModelOverlayForScenario("recell");
    const confidence = deriveConfidence({
      descriptorMatch: { score: 0.82, rationale: "descriptor token coverage" },
      keywordOverlap: { score: 0.74, rationale: "keyword jaccard overlap" },
      categoryAlignment: { score: 1, rationale: "keyword overlap exists" },
    });

    const envelope = createScenarioSnapshotEnvelope({
      scenario,
      overlay,
      curatedCodes: CURATED_CODE_DATA.slice(0, 2),
      policyEvents: [
        {
          id: "cms-001",
          feed: "cms",
          summary: "Rule bulletin",
          effectiveOn: "2026-01-01",
        },
      ],
      warnings: [
        {
          code: "fallback-to-all-codes",
          message: "Fallback applied.",
          scenarioId: "recell",
        },
      ],
      confidence,
      provenance: [
        {
          source: "curated-codes",
          citation: "internal-cardiovascular-pack-v1",
          observedAt: "2026-05-31T00:00:00.000Z",
        },
      ],
      honestyMarkers: [
        {
          field: "overlay.revenueProtectionFrame",
          mode: "computed",
          note: "Assembled from monolith module outputs.",
        },
      ],
    });

    expect(hasExactResponseEnvelopeKeys(envelope)).toBe(true);
    expect(envelope.confidence.derivation).toBe("computed");
    expect(envelope.result.scenarioId).toBe("recell");
    expect(envelope.result.codeCount).toBe(2);
    expect(envelope.result.policyEventCount).toBe(1);
    expect(envelope.result.warnings).toHaveLength(1);
    expect(BUSINESS_MODEL_OVERLAYS).toContainEqual(overlay);
  });

  it("returns empty matches with warning when scenario tags have no code overlap", async () => {
    const service = createDemoIngestionService({
      codeDataProvider: new CuratedCodeDataProvider([
        {
          code: "99999",
          title: "No overlap code",
          codeFamily: "CPT",
          tags: ["orthopedic"],
        },
      ]),
      policyFeedProvider: new SeededPolicyFeedProvider([]),
    });

    const snapshot = await service.loadScenarioSnapshot("ai-ecg");
    expect(snapshot.curatedCodes).toHaveLength(0);
    expect(snapshot.warnings).toEqual([
      {
        code: "no-tag-matches",
        message: "No curated code tags matched scenario tags.",
        scenarioId: "ai-ecg",
      },
    ]);
  });

  it("uses option-gated fallback to all codes when explicitly enabled", async () => {
    const service = createDemoIngestionService({
      allowFallbackToAllCodes: true,
      codeDataProvider: new CuratedCodeDataProvider([
        {
          code: "99999",
          title: "No overlap code",
          codeFamily: "CPT",
          tags: ["orthopedic"],
        },
      ]),
      policyFeedProvider: new SeededPolicyFeedProvider([]),
    });

    const snapshot = await service.loadScenarioSnapshot("mindmotion-go");
    expect(snapshot.curatedCodes).toHaveLength(1);
    expect(snapshot.warnings).toEqual([
      {
        code: "fallback-to-all-codes",
        message:
          "No curated code tags matched scenario tags, fallback policy returned all codes.",
        scenarioId: "mindmotion-go",
      },
    ]);
  });

  it("throws typed lookup errors for missing scenario and overlay", () => {
    expect(() => getScenarioById("unknown-scenario" as never)).toThrowError(
      ScenarioNotFoundError
    );
    expect(() => getBusinessModelOverlayForScenario("unknown-scenario" as never)).toThrowError(
      BusinessModelOverlayNotFoundError
    );
  });
});

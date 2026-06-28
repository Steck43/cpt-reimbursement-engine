import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_CONTRIBUTOR_WEIGHTS,
  CONFIDENCE_DERIVATION_POLICY,
} from "../contracts/confidence-policy";
import { hasExactResponseEnvelopeKeys } from "../contracts/response-envelope";
import { CURATED_CODE_DATA } from "../data/curated-codes";
import { getScenarioById } from "../data/scenarios";
import {
  CodeIntelligenceInputError,
  createCodeIntelligenceService,
  type RankedCodeCandidate,
} from "../services/code-intelligence-service";

function weightedSum(candidate: RankedCodeCandidate): number {
  return Math.round(
    CONFIDENCE_DERIVATION_POLICY.namedContributors.reduce(
      (sum, name) =>
        sum + candidate.contributors[name] * CONFIDENCE_CONTRIBUTOR_WEIGHTS[name],
      0
    ) * 1000
  ) / 1000;
}

function rankByPolicyWeight(candidates: readonly RankedCodeCandidate[]): readonly string[] {
  return [...candidates]
    .sort((left, right) => weightedSum(right) - weightedSum(left))
    .map((candidate) => candidate.code);
}

describe("code intelligence service", () => {
  it("uses confidence-policy weights for ranking and selected code", async () => {
    const service = createCodeIntelligenceService();
    const scenario = getScenarioById("ai-ecg");

    const envelope = await service.analyze({
      scenario,
      codes: CURATED_CODE_DATA,
    });

    const ranked = envelope.result.rankedCandidates;
    const computedOrder = rankByPolicyWeight(ranked);
    const serviceOrder = ranked.map((candidate) => candidate.code);

    expect(serviceOrder).toEqual(computedOrder);
    expect(envelope.result.selectedCode.code).toBe(computedOrder[0]);
    for (const candidate of ranked) {
      expect(candidate.score).toBe(weightedSum(candidate));
    }
  });

  it("scores, ranks, and selects candidates from runtime inputs", async () => {
    const service = createCodeIntelligenceService();
    const scenario = getScenarioById("ai-ecg");

    const envelope = await service.analyze({
      scenario,
      codes: CURATED_CODE_DATA,
    });

    expect(hasExactResponseEnvelopeKeys(envelope)).toBe(true);
    expect(envelope.result.scenarioId).toBe("ai-ecg");
    expect(envelope.result.rankedCandidates.length).toBeGreaterThan(1);
    expect(envelope.result.selectedCode.code).toBe(envelope.result.rankedCandidates[0]?.code);

    const rankedScores = envelope.result.rankedCandidates.map((candidate) => candidate.score);
    const sorted = [...rankedScores].sort((left, right) => right - left);
    expect(rankedScores).toEqual(sorted);
  });

  it("computes confidence using named contributors from confidence policy", async () => {
    const service = createCodeIntelligenceService();
    const scenario = getScenarioById("mindmotion-go");

    const envelope = await service.analyze({
      scenario,
      codes: CURATED_CODE_DATA,
    });

    expect(envelope.confidence.derivation).toBe("computed");
    expect(envelope.confidence.contributors.map((item) => item.name)).toEqual([
      "descriptorMatch",
      "keywordOverlap",
      "categoryAlignment",
    ]);
    expect(envelope.confidence.contributors.every((item) => item.weight > 0)).toBe(true);

    const selected = envelope.result.selectedCode;
    const expected = Math.round(weightedSum(selected) * 1000) / 1000;
    expect(envelope.confidence.overall).toBe(expected);
  });

  it("keeps confidence computed and variable across different valid inputs", async () => {
    const service = createCodeIntelligenceService();
    const aiScenario = getScenarioById("ai-ecg");
    const recellScenario = getScenarioById("recell");

    const aiEnvelope = await service.analyze({
      scenario: aiScenario,
      codes: CURATED_CODE_DATA,
    });
    const recellEnvelope = await service.analyze({
      scenario: recellScenario,
      codes: CURATED_CODE_DATA,
    });

    expect(aiEnvelope.confidence.derivation).toBe("computed");
    expect(recellEnvelope.confidence.derivation).toBe("computed");
    expect(aiEnvelope.confidence.overall).not.toBe(recellEnvelope.confidence.overall);
  });

  it("routes low-signal inputs to review when nothing clears confidence floor", async () => {
    const service = createCodeIntelligenceService();
    const scenario = getScenarioById("recell");

    const baseline = await service.analyze({
      scenario,
      codes: CURATED_CODE_DATA,
    });

    expect(baseline.confidence.overall).toBeGreaterThan(0);

    await expect(
      service.analyze({
        scenario,
        codes: [
          {
            code: "99999",
            descriptor: "Generic unrelated service",
            codeFamily: "HCPCS",
            tags: ["orthopedic", "transport"],
            statusIndicator: "N",
            statusLabel: "Packaged, no separate payment",
            apc: null,
            apcPayment: 0,
            provenance: "Test fixture",
          },
        ],
      })
    ).rejects.toBeInstanceOf(CodeIntelligenceInputError);
  });

  it("throws CodeIntelligenceInputError when codes list is empty", async () => {
    const service = createCodeIntelligenceService();

    await expect(
      service.analyze({
        scenario: getScenarioById("recell"),
        codes: [],
      })
    ).rejects.toBeInstanceOf(CodeIntelligenceInputError);
  });
});

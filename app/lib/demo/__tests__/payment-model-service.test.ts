import { describe, expect, it } from "vitest";

import { hasExactResponseEnvelopeKeys } from "../contracts/response-envelope";
import { CURATED_CODE_DATA } from "../data/curated-codes";
import { getScenarioById, type DemoScenarioId } from "../data/scenarios";
import { createCodeIntelligenceService } from "../services/code-intelligence-service";
import {
  PaymentModelInputError,
  createPaymentModelService,
  type ScenarioPaymentRuleMap,
} from "../services/payment-model-service";

const scenarioIds: readonly DemoScenarioId[] = [
  "ai-ecg",
  "mindmotion-go",
  "recell",
  "cochlear-69930",
  "bci-archetype",
];

describe("payment model service", () => {
  it("predicts all five scenarios, validates four with CMS outcomes, and marks BCI as no-precedent", async () => {
    const codeService = createCodeIntelligenceService();
    const paymentService = createPaymentModelService();

    for (const scenarioId of scenarioIds) {
      const scenario = getScenarioById(scenarioId);
      const codeEnvelope = await codeService.analyze({
        scenario,
        codes: CURATED_CODE_DATA,
      });

      const envelope = await paymentService.predict({
        scenario,
        selectedCode: codeEnvelope.result.selectedCode.code,
        rankedCandidates: codeEnvelope.result.rankedCandidates,
      });

      expect(hasExactResponseEnvelopeKeys(envelope)).toBe(true);
      expect(envelope.result.predictedStatusIndicator.length).toBeGreaterThan(0);

      if (scenario.knownCmsOutcome === null) {
        expect(envelope.result.hasCmsPrecedent).toBe(false);
        expect(envelope.result.actualCmsStatusIndicator).toBeNull();
        expect(envelope.result.actualCmsApc).toBeNull();
        expect(envelope.result.validationStatement).toContain("no CMS precedent");
        continue;
      }

      expect(envelope.result.hasCmsPrecedent).toBe(true);
      expect(envelope.result.actualCmsStatusIndicator).toBe(scenario.knownCmsOutcome.statusIndicator);
      expect(envelope.result.actualCmsApc).toBe(scenario.knownCmsOutcome.apc);
      expect(envelope.result.statusIndicatorMatch).toBe(true);
      expect(envelope.result.apcMatch).toBe(true);
    }
  });

  it("uses selected-code rule first, then ranked-candidate fallback, then default fallback", async () => {
    const rules: ScenarioPaymentRuleMap = {
      "0733T": { statusIndicator: "S", apc: "1505" },
      "93000": { statusIndicator: "Q1", apc: "5734" },
    };
    const paymentService = createPaymentModelService({
      scenarioPaymentRules: rules,
    });
    const scenario = getScenarioById("mindmotion-go");

    const selectedPathEnvelope = await paymentService.predict({
      scenario,
      selectedCode: "0733T",
      rankedCandidates: [
        {
          code: "93000",
          score: 0.85,
        },
      ],
    });
    expect(selectedPathEnvelope.result.predictedStatusIndicator).toBe("S");
    expect(selectedPathEnvelope.result.predictedApc).toBe("1505");

    const rankedFallbackEnvelope = await paymentService.predict({
      scenario,
      selectedCode: "XXXX0",
      rankedCandidates: [
        {
          code: "93000",
          score: 0.85,
        },
      ],
    });
    expect(rankedFallbackEnvelope.result.predictedStatusIndicator).toBe("Q1");
    expect(rankedFallbackEnvelope.result.predictedApc).toBe("5734");

    const defaultFallbackEnvelope = await paymentService.predict({
      scenario,
      selectedCode: "NONE0",
      rankedCandidates: [
        {
          code: "NONE1",
          score: 0.45,
        },
      ],
    });

    expect(defaultFallbackEnvelope.result.predictedStatusIndicator).toBe("N1");
    expect(defaultFallbackEnvelope.result.predictedApc).toBeNull();
  });

  it("correctly generates validation statements for all match combinations", async () => {
    const scenario = getScenarioById("mindmotion-go");

    const fullMatchService = createPaymentModelService({
      scenarioPaymentRules: {
        "0733T": { statusIndicator: "S", apc: "1505" },
      },
    });
    const fullMismatchService = createPaymentModelService({
      scenarioPaymentRules: {
        "0733T": { statusIndicator: "Q1", apc: "5734" },
      },
    });
    const partialStatusService = createPaymentModelService({
      scenarioPaymentRules: {
        "0733T": { statusIndicator: "S", apc: "9999" },
      },
    });
    const partialApcService = createPaymentModelService({
      scenarioPaymentRules: {
        "0733T": { statusIndicator: "Q1", apc: "1505" },
      },
    });

    const fullMatch = await fullMatchService.predict({
      scenario,
      selectedCode: "0733T",
      rankedCandidates: [{ code: "0733T", score: 0.9 }],
    });
    expect(fullMatch.result.statusIndicatorMatch).toBe(true);
    expect(fullMatch.result.apcMatch).toBe(true);
    expect(fullMatch.result.validationStatement).toBe(
      "Predicted S, matches actual CMS assignment."
    );

    const fullMismatch = await fullMismatchService.predict({
      scenario,
      selectedCode: "0733T",
      rankedCandidates: [{ code: "0733T", score: 0.9 }],
    });
    expect(fullMismatch.result.statusIndicatorMatch).toBe(false);
    expect(fullMismatch.result.apcMatch).toBe(false);
    expect(fullMismatch.result.validationStatement).toBe(
      "Predicted Q1, does not match actual CMS assignment."
    );

    const partialStatus = await partialStatusService.predict({
      scenario,
      selectedCode: "0733T",
      rankedCandidates: [{ code: "0733T", score: 0.9 }],
    });
    expect(partialStatus.result.statusIndicatorMatch).toBe(true);
    expect(partialStatus.result.apcMatch).toBe(false);
    expect(partialStatus.result.validationStatement).toBe(
      "Predicted S, matches CMS status indicator but does not match CMS APC assignment."
    );

    const partialApc = await partialApcService.predict({
      scenario,
      selectedCode: "0733T",
      rankedCandidates: [{ code: "0733T", score: 0.9 }],
    });
    expect(partialApc.result.statusIndicatorMatch).toBe(false);
    expect(partialApc.result.apcMatch).toBe(true);
    expect(partialApc.result.validationStatement).toBe(
      "Predicted Q1, matches CMS APC assignment but does not match CMS status indicator."
    );
  });

  it("keeps confidence policy contributors and shifts contributor values by fallback path", async () => {
    const scenario = getScenarioById("ai-ecg");
    const paymentService = createPaymentModelService({
      scenarioPaymentRules: {
        "0937T": { statusIndicator: "E1", apc: null },
      },
    });

    const selectedPath = await paymentService.predict({
      scenario,
      selectedCode: "0937T",
      rankedCandidates: [
        {
          code: "0937T",
          score: 0.83,
        },
      ],
    });
    const rankedFallback = await paymentService.predict({
      scenario,
      selectedCode: "NO-MAP",
      rankedCandidates: [
        {
          code: "0937T",
          score: 0.83,
        },
      ],
    });
    const defaultFallback = await paymentService.predict({
      scenario,
      selectedCode: "NO-MAP",
      rankedCandidates: [
        {
          code: "NO-MAP-2",
          score: 0.83,
        },
      ],
    });

    expect(selectedPath.confidence.derivation).toBe("computed");
    expect(selectedPath.confidence.contributors.map((item) => item.name)).toEqual([
      "descriptorMatch",
      "keywordOverlap",
      "categoryAlignment",
    ]);
    expect(selectedPath.confidence.contributors.every((item) => item.weight > 0)).toBe(true);

    const getContributor = (
      envelope: Awaited<ReturnType<typeof paymentService.predict>>,
      name: "keywordOverlap" | "categoryAlignment"
    ): number => envelope.confidence.contributors.find((item) => item.name === name)?.score ?? -1;

    expect(getContributor(selectedPath, "keywordOverlap")).toBe(1);
    expect(getContributor(selectedPath, "categoryAlignment")).toBe(1);
    expect(getContributor(rankedFallback, "keywordOverlap")).toBe(0.6);
    expect(getContributor(rankedFallback, "categoryAlignment")).toBe(1);
    expect(getContributor(defaultFallback, "keywordOverlap")).toBe(0.2);
    expect(getContributor(defaultFallback, "categoryAlignment")).toBe(0.5);
  });

  it("emits payment-specific honesty marker fields", async () => {
    const paymentService = createPaymentModelService();
    const scenario = getScenarioById("recell");

    const envelope = await paymentService.predict({
      scenario,
      selectedCode: "15271",
      rankedCandidates: [{ code: "15271", score: 0.9 }],
    });

    expect(envelope.honestyMarkers.map((marker) => marker.field)).toEqual([
      "result.predictedStatusIndicator",
      "result.predictedApc",
      "result.validationStatement",
      "confidence",
    ]);
  });

  it("throws PaymentModelInputError when selected code is missing", async () => {
    const paymentService = createPaymentModelService();
    const scenario = getScenarioById("recell");

    await expect(
      paymentService.predict({
        scenario,
        selectedCode: "",
        rankedCandidates: [],
      })
    ).rejects.toBeInstanceOf(PaymentModelInputError);
  });
});

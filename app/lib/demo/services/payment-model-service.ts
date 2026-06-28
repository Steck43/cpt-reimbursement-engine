import { deriveConfidence } from "../contracts/confidence-policy";
import type {
  HonestyMarker,
  ProvenanceEntry,
  ResponseEnvelope,
} from "../contracts/response-envelope";
import type { DemoScenario, DemoScenarioId } from "../data/scenarios";
import {
  createExplainabilityService,
  type DemoExplainabilityService,
} from "./explainability-service";

export type PaymentRule = {
  readonly statusIndicator: string;
  readonly apc: string | null;
};

export type ScenarioPaymentRuleMap = Readonly<Record<string, PaymentRule>>;

type RankedCandidate = {
  readonly code: string;
  readonly score: number;
};

type PaymentModelInput = {
  readonly scenario: DemoScenario;
  readonly selectedCode: string;
  readonly rankedCandidates: readonly RankedCandidate[];
  readonly generatedAt?: string;
};

export type PaymentModelResult = {
  readonly scenarioId: DemoScenarioId;
  readonly scenarioTitle: string;
  readonly predictedStatusIndicator: string;
  readonly predictedApc: string | null;
  readonly actualCmsStatusIndicator: string | null;
  readonly actualCmsApc: string | null;
  readonly statusIndicatorMatch: boolean;
  readonly apcMatch: boolean;
  readonly hasCmsPrecedent: boolean;
  readonly validationStatement: string;
};

export type PaymentModelEnvelope = ResponseEnvelope<PaymentModelResult>;

type PaymentModelDependencies = {
  readonly explainabilityService: DemoExplainabilityService;
  readonly scenarioPaymentRules: ScenarioPaymentRuleMap;
};

export type DemoPaymentModelService = {
  predict(input: PaymentModelInput): Promise<PaymentModelEnvelope>;
};

export class PaymentModelInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentModelInputError";
  }
}

const DEFAULT_PAYMENT_RULES: ScenarioPaymentRuleMap = {
  "0937T": {
    statusIndicator: "E1",
    apc: null,
  },
  "0764T": {
    statusIndicator: "S",
    apc: "5734",
  },
  "0733T": {
    statusIndicator: "S",
    apc: "1505",
  },
  "15013": {
    statusIndicator: "T",
    apc: "1567",
  },
  C1832: {
    statusIndicator: "N",
    apc: null,
  },
  "69930": {
    statusIndicator: "J1",
    apc: "5166",
  },
  "33361": {
    statusIndicator: "J1",
    apc: "5495",
  },
};

const FALLBACK_PREDICTION: PaymentRule = {
  statusIndicator: "N1",
  apc: null,
};

export function createPaymentModelService(
  overrides: Partial<PaymentModelDependencies> = {}
): DemoPaymentModelService {
  const dependencies = withDefaultDependencies(overrides);

  return {
    async predict(input) {
      if (input.selectedCode.trim().length === 0) {
        throw new PaymentModelInputError("Payment model prediction requires a selected code.");
      }

      const observedAt = input.generatedAt ?? new Date().toISOString();
      const predicted = resolvePrediction(input, dependencies.scenarioPaymentRules);
      const actual = input.scenario.knownCmsOutcome;
      const hasCmsPrecedent = actual !== null;
      const statusIndicatorMatch =
        hasCmsPrecedent &&
        normalizeToken(predicted.statusIndicator) === normalizeToken(actual.statusIndicator);
      const apcMatch =
        hasCmsPrecedent && normalizeToken(predicted.apc) === normalizeToken(actual.apc);
      const predictionPath = resolvePredictionPath(input, dependencies.scenarioPaymentRules);

      const contributors = {
        descriptorMatch: clamp01(input.rankedCandidates[0]?.score ?? 0),
        keywordOverlap: resolveRuleCoverageScore(input, dependencies.scenarioPaymentRules),
        categoryAlignment: (Number(statusIndicatorMatch) + Number(apcMatch)) / 2,
      } as const;

      const confidence = deriveConfidence({
        descriptorMatch: {
          score: contributors.descriptorMatch,
          rationale: `Top candidate score for ${input.scenario.id} was used as descriptor-match confidence.`,
        },
        keywordOverlap: {
          score: contributors.keywordOverlap,
          rationale:
            "Rule coverage score reflects whether the selected or ranked candidates map to known payment rules.",
        },
        categoryAlignment: {
          score: contributors.categoryAlignment,
          rationale:
            "Category alignment reflects agreement between predicted and known CMS payment attributes.",
        },
      });

      return {
        result: {
          scenarioId: input.scenario.id,
          scenarioTitle: input.scenario.title,
          predictedStatusIndicator: predicted.statusIndicator,
          predictedApc: predicted.apc,
          actualCmsStatusIndicator: actual?.statusIndicator ?? null,
          actualCmsApc: actual?.apc ?? null,
          statusIndicatorMatch,
          apcMatch,
          hasCmsPrecedent,
          validationStatement: buildValidationStatement({
            predictedStatusIndicator: predicted.statusIndicator,
            hasCmsPrecedent,
            statusIndicatorMatch,
            apcMatch,
          }),
        },
        confidence,
        provenance: buildPaymentProvenance({
          scenario: input.scenario,
          selectedCode: input.selectedCode,
          candidateCount: input.rankedCandidates.length,
          predictionPath,
          observedAt,
          explainabilityService: dependencies.explainabilityService,
          contributors,
        }),
        honestyMarkers: buildPaymentHonestyMarkers({
          predictionPath,
          statusIndicatorMatch,
          apcMatch,
        }),
      };
    },
  };
}

function withDefaultDependencies(
  overrides: Partial<PaymentModelDependencies>
): PaymentModelDependencies {
  return {
    explainabilityService: overrides.explainabilityService ?? createExplainabilityService(),
    scenarioPaymentRules: overrides.scenarioPaymentRules ?? DEFAULT_PAYMENT_RULES,
  };
}

function resolvePrediction(
  input: PaymentModelInput,
  paymentRules: ScenarioPaymentRuleMap
): PaymentRule {
  const selectedRule = paymentRules[input.selectedCode];
  if (selectedRule) {
    return selectedRule;
  }

  for (const candidate of input.rankedCandidates) {
    const candidateRule = paymentRules[candidate.code];
    if (candidateRule) {
      return candidateRule;
    }
  }

  return FALLBACK_PREDICTION;
}

// Coverage score: how directly the payment prediction is grounded in a known rule.
// Three ordinal tiers, not a continuous measure.
//   1.0  selected (top) code maps to a payment rule. Prediction rests on a direct hit.
//   0.6  selected code has no rule but a lower-ranked candidate does. Prediction is
//        supported by a fallback, so confidence drops.
//   0.2  no candidate maps to any rule. Prediction is weakly grounded, floored here so
//        it can never present as well-supported.
// The magnitudes are deliberate steps (full, fallback, floor), spaced so a fallback hit
// and a no-rule case stay clearly separated downstream.
function resolveRuleCoverageScore(
  input: PaymentModelInput,
  paymentRules: ScenarioPaymentRuleMap
): number {
  if (paymentRules[input.selectedCode]) {
    return 1;
  }

  if (input.rankedCandidates.some((candidate) => paymentRules[candidate.code])) {
    return 0.6;
  }

  return 0.2;
}

function resolvePredictionPath(
  input: PaymentModelInput,
  paymentRules: ScenarioPaymentRuleMap
): "selected-code-rule" | "ranked-candidate-fallback" | "default-fallback" {
  if (paymentRules[input.selectedCode]) {
    return "selected-code-rule";
  }

  if (input.rankedCandidates.some((candidate) => paymentRules[candidate.code])) {
    return "ranked-candidate-fallback";
  }

  return "default-fallback";
}

function buildValidationStatement(input: {
  readonly predictedStatusIndicator: string;
  readonly hasCmsPrecedent: boolean;
  readonly statusIndicatorMatch: boolean;
  readonly apcMatch: boolean;
}): string {
  if (!input.hasCmsPrecedent) {
    return `Predicted ${input.predictedStatusIndicator}, no CMS precedent available for historical validation.`;
  }

  if (input.statusIndicatorMatch && input.apcMatch) {
    return `Predicted ${input.predictedStatusIndicator}, matches actual CMS assignment.`;
  }

  if (!input.statusIndicatorMatch && !input.apcMatch) {
    return `Predicted ${input.predictedStatusIndicator}, does not match actual CMS assignment.`;
  }

  if (input.statusIndicatorMatch) {
    return `Predicted ${input.predictedStatusIndicator}, matches CMS status indicator but does not match CMS APC assignment.`;
  }

  return `Predicted ${input.predictedStatusIndicator}, matches CMS APC assignment but does not match CMS status indicator.`;
}

function buildPaymentHonestyMarkers(input: {
  readonly predictionPath: "selected-code-rule" | "ranked-candidate-fallback" | "default-fallback";
  readonly statusIndicatorMatch: boolean;
  readonly apcMatch: boolean;
}): readonly HonestyMarker[] {
  return [
    {
      field: "result.predictedStatusIndicator",
      mode: "computed",
      note: `Predicted status indicator was computed using ${input.predictionPath}.`,
    },
    {
      field: "result.predictedApc",
      mode: "computed",
      note: `Predicted APC was computed using ${input.predictionPath}.`,
    },
    {
      field: "result.validationStatement",
      mode: "computed",
      note: `Validation statement was computed from statusIndicatorMatch=${input.statusIndicatorMatch} and apcMatch=${input.apcMatch}.`,
    },
    {
      field: "confidence",
      mode: "computed",
      note: "Confidence uses weighted named contributors from the confidence derivation policy.",
    },
  ];
}

function buildPaymentProvenance(input: {
  readonly scenario: DemoScenario;
  readonly selectedCode: string;
  readonly candidateCount: number;
  readonly predictionPath: "selected-code-rule" | "ranked-candidate-fallback" | "default-fallback";
  readonly observedAt: string;
  readonly explainabilityService: DemoExplainabilityService;
  readonly contributors: Readonly<Record<"descriptorMatch" | "keywordOverlap" | "categoryAlignment", number>>;
}): readonly ProvenanceEntry[] {
  const explainabilityProvenance = input.explainabilityService.buildProvenance({
    scenario: input.scenario,
    selectedCode: input.selectedCode,
    candidateCount: input.candidateCount,
    contributors: input.contributors,
    observedAt: input.observedAt,
  });

  return [
    {
      source: "payment-model-service",
      citation: [
        `scenario:${input.scenario.id}`,
        `selected:${input.selectedCode}`,
        `predictionPath:${input.predictionPath}`,
      ].join("; "),
      observedAt: input.observedAt,
    },
    ...explainabilityProvenance,
  ];
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function normalizeToken(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

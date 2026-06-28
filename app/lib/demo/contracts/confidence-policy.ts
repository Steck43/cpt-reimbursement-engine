import type {
  ConfidenceContributor,
  ConfidenceContributorName,
  DerivedConfidence,
} from "./response-envelope";

export const CONFIDENCE_POLICY_VERSION = "2026-06-foundation";
export const CONFIDENCE_FLOOR = 0.04;
export const REVIEW_THRESHOLD = 0.3;

export const CONFIDENCE_CONTRIBUTOR_WEIGHTS: Readonly<
  Record<ConfidenceContributorName, number>
> = {
  descriptorMatch: 0.55,
  keywordOverlap: 0.3,
  categoryAlignment: 0.15,
};

export type ConfidenceContributorInput = {
  readonly score: number;
  readonly rationale: string;
};

export type ConfidenceComputationInput = Readonly<
  Record<ConfidenceContributorName, ConfidenceContributorInput>
>;

export type ConfidencePolicy = {
  readonly policyVersion: typeof CONFIDENCE_POLICY_VERSION;
  readonly derivationRule: "computed-only";
  readonly disallowedPractices: readonly [
    "scenario-assigned-confidence-values",
    "manual-overrides-without-computation"
  ];
  readonly namedContributors: readonly ConfidenceContributorName[];
};

export const CONFIDENCE_DERIVATION_POLICY: ConfidencePolicy = {
  policyVersion: CONFIDENCE_POLICY_VERSION,
  derivationRule: "computed-only",
  disallowedPractices: [
    "scenario-assigned-confidence-values",
    "manual-overrides-without-computation",
  ],
  namedContributors: [
    "descriptorMatch",
    "keywordOverlap",
    "categoryAlignment",
  ],
};

const ORDERED_CONTRIBUTORS: readonly ConfidenceContributorName[] =
  CONFIDENCE_DERIVATION_POLICY.namedContributors;

export function deriveConfidence(
  input: ConfidenceComputationInput
): DerivedConfidence {
  const contributors: ConfidenceContributor[] = ORDERED_CONTRIBUTORS.map(
    (name) => {
      const score = clamp01(input[name].score);
      return {
        name,
        score,
        weight: CONFIDENCE_CONTRIBUTOR_WEIGHTS[name],
        rationale: input[name].rationale,
      };
    }
  );

  const overall = contributors.reduce(
    (sum, contributor) => sum + contributor.score * contributor.weight,
    0
  );

  return {
    overall: roundToThree(overall),
    contributors,
    derivation: "computed",
  };
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

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

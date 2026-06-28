import type {
  ConfidenceContributor,
  ConfidenceContributorName,
  DerivedConfidence,
} from "./response-envelope";

export const CONFIDENCE_POLICY_VERSION = "2026-06-foundation";
// CONFIDENCE_FLOOR: candidate inclusion cutoff applied during ranking. A candidate must
// score strictly above 0.04 to stay in the ranked set, which drops noise-level matches
// before selection. This is not a minimum reported confidence. A surviving candidate's
// score is reported as computed.
export const CONFIDENCE_FLOOR = 0.04;
// REVIEW_THRESHOLD: the soft guard, distinct from CONFIDENCE_FLOOR's hard gate. A code
// can clear the floor and still be a weak match. When the selected code scores below
// 0.30, the engine does not suppress the answer, it returns it flagged
// requiresReview: true, and that flag travels in the response envelope so a downstream
// reviewer sees it was low-confidence. The floor decides whether to answer at all. The
// threshold decides whether the answer is trustworthy on its own or needs a human.
export const REVIEW_THRESHOLD = 0.3;

// Three weighted contributors, ordered by signal authority, summing to 1.0.
// descriptorMatch leads at 0.55. The AMA descriptor is the code's definition, so a
// strong descriptor match is the closest thing to ground truth the engine has.
// keywordOverlap at 0.30 is a Jaccard score over tokens: shared tokens between the
// device text and the code descriptor, divided by all distinct tokens across both, so
// unmatched words on either side count against it. It corroborates the descriptor. It
// does not stand on its own. categoryAlignment at 0.15 is the coarsest signal, a
// sanity check against a match drawn from the wrong code family.
//
// Each contributor is a real, independently computed signal that carries weight. The
// confidence value is never assigned by scenario or overridden by hand. See
// CONFIDENCE_DERIVATION_POLICY.disallowedPractices.
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

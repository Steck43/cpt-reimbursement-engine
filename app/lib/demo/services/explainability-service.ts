import { CONFIDENCE_DERIVATION_POLICY } from "../contracts/confidence-policy";
import type { ConfidenceContributorName } from "../contracts/response-envelope";
import type {
  HonestyMarker,
  ProvenanceEntry,
} from "../contracts/response-envelope";
import type { DemoScenario } from "../data/scenarios";

export type ExplainabilityInput = {
  readonly scenario: DemoScenario;
  readonly candidateCount: number;
  readonly selectedCode: string;
  readonly contributors: Readonly<Record<ConfidenceContributorName, number>>;
  readonly observedAt?: string;
};

export type DemoExplainabilityService = {
  buildProvenance(input: ExplainabilityInput): readonly ProvenanceEntry[];
  buildHonestyMarkers(input: ExplainabilityInput): readonly HonestyMarker[];
};

export function createExplainabilityService(): DemoExplainabilityService {
  return {
    buildProvenance(input) {
      const observedAt = input.observedAt ?? new Date().toISOString();
      return [
        {
          source: "code-intelligence-service",
          citation: [
            `scenario:${input.scenario.id}`,
            `selected:${input.selectedCode}`,
            `candidates:${input.candidateCount}`,
          ].join("; "),
          observedAt,
        },
        {
          source: "confidence-derivation-policy",
          citation: formatContributorCitation(input.contributors),
          observedAt,
        },
      ];
    },
    buildHonestyMarkers(input) {
      const basis = [
        `scenario:${input.scenario.id}`,
        `selected:${input.selectedCode}`,
        `candidates:${input.candidateCount}`,
      ].join(", ");
      return [
        {
          field: "result.rankedCandidates",
          mode: "computed",
          note: `Candidate scores are runtime-derived from overlap and consistency components (${basis}).`,
        },
        {
          field: "confidence",
          mode: "computed",
          note: `Confidence uses named contributor scores from runtime analysis (${basis}).`,
        },
      ];
    },
  };
}

function formatContributorCitation(
  contributors: Readonly<Record<ConfidenceContributorName, number>>
): string {
  const ordered: readonly ConfidenceContributorName[] =
    CONFIDENCE_DERIVATION_POLICY.namedContributors;

  return ordered
    .map((name) => `${name}:${roundToThree(contributors[name])}`)
    .join("; ");
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

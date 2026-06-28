import {
  CONFIDENCE_CONTRIBUTOR_WEIGHTS,
  CONFIDENCE_DERIVATION_POLICY,
  CONFIDENCE_FLOOR,
  REVIEW_THRESHOLD,
  deriveConfidence,
  type ConfidenceComputationInput,
} from "../contracts/confidence-policy";
import type { DemoCodeDatum } from "../contracts/providers";
import type { ConfidenceContributorName, ResponseEnvelope } from "../contracts/response-envelope";
import type { DemoScenario } from "../data/scenarios";
import { createExplainabilityService, type DemoExplainabilityService } from "./explainability-service";

type ContributorScores = Readonly<Record<ConfidenceContributorName, number>>;

export type RankedCodeCandidate = DemoCodeDatum & {
  readonly score: number;
  readonly contributors: ContributorScores;
};

export type CodeIntelligenceResult = {
  readonly scenarioId: DemoScenario["id"];
  readonly scenarioTitle: string;
  readonly selectedCode: RankedCodeCandidate;
  readonly rankedCandidates: readonly RankedCodeCandidate[];
};

export type CodeIntelligenceEnvelope = ResponseEnvelope<CodeIntelligenceResult>;

type AnalyzeInput = {
  readonly scenario: DemoScenario;
  readonly codes: readonly DemoCodeDatum[];
  readonly generatedAt?: string;
};

type CodeIntelligenceServiceDependencies = {
  readonly explainabilityService: DemoExplainabilityService;
};

export type DemoCodeIntelligenceService = {
  analyze(input: AnalyzeInput): Promise<CodeIntelligenceEnvelope>;
};

export class CodeIntelligenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeIntelligenceInputError";
  }
}

export function createCodeIntelligenceService(
  overrides: Partial<CodeIntelligenceServiceDependencies> = {}
): DemoCodeIntelligenceService {
  const dependencies = withDefaultDependencies(overrides);

  return {
    async analyze(input) {
      if (input.codes.length === 0) {
        throw new CodeIntelligenceInputError("Code intelligence requires at least one candidate code.");
      }

      const observedAt = input.generatedAt ?? new Date().toISOString();
      const scenarioKeywords = buildScenarioKeywordSet(input.scenario);

      const rankedCandidates = input.codes
        .map((code) => {
          const contributors = scoreContributors({
            code,
            scenarioKeywords,
          });
          return {
            ...code,
            contributors,
            score: deriveCandidateScore(contributors),
          };
        })
        // Drop noise-level candidates before ranking. Anything at or below CONFIDENCE_FLOOR is
        // not a real match and would only pollute the ordered set. Survivors sort by computed
        // score, and the top survivor becomes the selected code.
        .filter((candidate) => candidate.score > CONFIDENCE_FLOOR)
        .sort((left, right) => right.score - left.score);

      const selectedCode = rankedCandidates[0];
      if (!selectedCode) {
        throw new CodeIntelligenceInputError(
          "No candidate exceeded confidence floor; route to specialist review."
        );
      }

      const confidenceInput = toConfidenceInput(selectedCode, input.scenario, rankedCandidates.length);
      const confidence = deriveConfidence(confidenceInput);
      const requiresReview = selectedCode.score < REVIEW_THRESHOLD;
      const explainabilityInput = {
        scenario: input.scenario,
        candidateCount: rankedCandidates.length,
        selectedCode: selectedCode.code,
        contributors: selectedCode.contributors,
        observedAt,
        reviewThreshold: REVIEW_THRESHOLD,
        requiresReview,
      } as const;

      return {
        result: {
          scenarioId: input.scenario.id,
          scenarioTitle: input.scenario.title,
          selectedCode,
          rankedCandidates,
        },
        confidence,
        provenance: dependencies.explainabilityService.buildProvenance(explainabilityInput),
        honestyMarkers: dependencies.explainabilityService.buildHonestyMarkers(explainabilityInput),
      };
    },
  };
}

function withDefaultDependencies(
  overrides: Partial<CodeIntelligenceServiceDependencies>
): CodeIntelligenceServiceDependencies {
  return {
    explainabilityService: overrides.explainabilityService ?? createExplainabilityService(),
  };
}

function deriveCandidateScore(contributors: ContributorScores): number {
  return roundToThree(
    CONFIDENCE_DERIVATION_POLICY.namedContributors.reduce(
      (sum, name) => sum + contributors[name] * CONFIDENCE_CONTRIBUTOR_WEIGHTS[name],
      0
    )
  );
}

function scoreContributors(input: {
  readonly code: DemoCodeDatum;
  readonly scenarioKeywords: ReadonlySet<string>;
}): ContributorScores {
  const descriptorTokens = tokenize(input.code.descriptor);
  const codeKeywords = new Set(input.code.tags.map(normalizeToken));
  const descriptorMatch = computeDescriptorMatch(input.scenarioKeywords, descriptorTokens);
  const keywordOverlap = computeKeywordOverlap(input.scenarioKeywords, codeKeywords);
  const categoryAlignment = keywordOverlap > 0 ? 1 : 0;

  return {
    descriptorMatch: roundToThree(descriptorMatch),
    keywordOverlap: roundToThree(keywordOverlap),
    categoryAlignment: roundToThree(categoryAlignment),
  };
}

function toConfidenceInput(
  selectedCode: RankedCodeCandidate,
  scenario: DemoScenario,
  candidateCount: number
): ConfidenceComputationInput {
  return {
    descriptorMatch: {
      score: selectedCode.contributors.descriptorMatch,
      rationale: `Descriptor match computed from ${candidateCount} evaluated candidates for ${scenario.id}.`,
    },
    keywordOverlap: {
      score: selectedCode.contributors.keywordOverlap,
      rationale: "Jaccard keyword overlap between scenario keywords and code keywords.",
    },
    categoryAlignment: {
      score: selectedCode.contributors.categoryAlignment,
      rationale: "Category alignment is 1 when keyword overlap exists, otherwise 0.",
    },
  };
}

function buildScenarioKeywordSet(scenario: DemoScenario): ReadonlySet<string> {
  const knownOutcomeTokens = scenario.knownCmsOutcome
    ? [
        normalizeToken(scenario.knownCmsOutcome.statusIndicator),
        normalizeToken(scenario.knownCmsOutcome.apc ?? ""),
      ]
    : [];

  return new Set([
    ...scenario.relevantTags.map(normalizeToken),
    ...tokenize(scenario.deviceClass),
    ...tokenize(scenario.clinicalArea),
    ...knownOutcomeTokens,
  ]);
}

function computeDescriptorMatch(
  scenarioKeywords: ReadonlySet<string>,
  descriptorTokens: readonly string[]
): number {
  if (scenarioKeywords.size === 0) {
    return 0;
  }

  const descriptorSet = new Set(descriptorTokens.map(normalizeToken));
  let hits = 0;
  for (const keyword of scenarioKeywords) {
    if (descriptorSet.has(keyword)) {
      hits += 1;
    }
  }

  return hits / scenarioKeywords.size;
}

function computeKeywordOverlap(
  scenarioKeywords: ReadonlySet<string>,
  codeKeywords: ReadonlySet<string>
): number {
  const union = new Set([...scenarioKeywords, ...codeKeywords]).size;
  if (union === 0) {
    return 0;
  }

  let intersection = 0;
  for (const keyword of scenarioKeywords) {
    if (codeKeywords.has(keyword)) {
      intersection += 1;
    }
  }

  return intersection / union;
}

function tokenize(value: string): readonly string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

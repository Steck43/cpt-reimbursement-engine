import {
  CuratedCodeDataProvider,
  SeededPolicyFeedProvider,
  type CodeDataProvider,
  type DemoCodeDatum,
  type PolicyFeedEvent,
  type PolicyFeedProvider,
} from "../contracts/providers";
import type {
  DerivedConfidence,
  HonestyMarker,
  ProvenanceEntry,
  ResponseEnvelope,
} from "../contracts/response-envelope";
import { CURATED_CODE_DATA } from "../data/curated-codes";
import {
  getBusinessModelOverlayForScenario,
  type BusinessModelOverlay,
} from "../data/business-model-overlays";
import {
  getScenarioById,
  type DemoScenario,
  type DemoScenarioId,
} from "../data/scenarios";

export const DEMO_MONOLITH_MODULES = {
  ingestion: "ingestion-service",
  codeIntelligence: "code-intelligence-service",
  paymentModel: "payment-model-service",
  monitoring: "monitoring-service",
  explainability: "explainability-service",
} as const;

type DemoMonolithModules = typeof DEMO_MONOLITH_MODULES;

type IngestionServiceDependencies = {
  readonly codeDataProvider: CodeDataProvider;
  readonly policyFeedProvider: PolicyFeedProvider;
};

type IngestionServiceConfiguration = {
  readonly allowFallbackToAllCodes?: boolean;
};

export type IngestionWarning = {
  readonly code: "no-tag-matches" | "fallback-to-all-codes";
  readonly message: string;
  readonly scenarioId: DemoScenarioId;
};

export type ScenarioSnapshot = {
  readonly scenario: DemoScenario;
  readonly overlay: BusinessModelOverlay;
  readonly curatedCodes: readonly DemoCodeDatum[];
  readonly policyEvents: readonly PolicyFeedEvent[];
  readonly warnings: readonly IngestionWarning[];
  readonly generatedAt: string;
};

export type DemoIngestionService = {
  readonly modules: DemoMonolithModules;
  loadScenarioSnapshot(scenarioId: DemoScenarioId): Promise<ScenarioSnapshot>;
};

export type ScenarioSnapshotEnvelopeResult = {
  readonly scenarioId: DemoScenarioId;
  readonly scenarioTitle: string;
  readonly codeCount: number;
  readonly policyEventCount: number;
  readonly warnings: readonly IngestionWarning[];
  readonly overlay: BusinessModelOverlay;
  readonly generatedAt: string;
};

export type ScenarioSnapshotEnvelopeInput = {
  readonly scenario: DemoScenario;
  readonly overlay: BusinessModelOverlay;
  readonly curatedCodes: readonly DemoCodeDatum[];
  readonly policyEvents: readonly PolicyFeedEvent[];
  readonly warnings: readonly IngestionWarning[];
  readonly confidence: DerivedConfidence;
  readonly provenance: readonly ProvenanceEntry[];
  readonly honestyMarkers: readonly HonestyMarker[];
  readonly generatedAt?: string;
};

const SEEDED_POLICY_EVENTS: readonly PolicyFeedEvent[] = [
  {
    id: "cms-opps-2026-q1-cardiology",
    feed: "cms",
    summary: "Cardiovascular outpatient payment-rule clarification bulletin.",
    effectiveOn: "2026-01-01",
  },
  {
    id: "mac-coverage-2026-q2-neuro",
    feed: "mac",
    summary: "Local neurorehabilitation utilization criteria update.",
    effectiveOn: "2026-04-01",
  },
];

export function createDemoIngestionService(
  options: Partial<IngestionServiceDependencies> & IngestionServiceConfiguration = {}
): DemoIngestionService {
  const dependencies = withDefaultDependencies(options);
  const configuration = withDefaultConfiguration(options);

  return {
    modules: DEMO_MONOLITH_MODULES,
    async loadScenarioSnapshot(scenarioId) {
      const scenario = getScenarioById(scenarioId);
      const overlay = getBusinessModelOverlayForScenario(scenarioId);
      const [codes, policyEvents] = await Promise.all([
        dependencies.codeDataProvider.getCodeData(),
        dependencies.policyFeedProvider.getPolicyEvents(),
      ]);

      const { curatedCodes, warnings } = selectCodesForScenario(codes, scenario, configuration);
      return {
        scenario,
        overlay,
        curatedCodes,
        policyEvents,
        warnings,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

export function createScenarioSnapshotEnvelope(
  input: ScenarioSnapshotEnvelopeInput
): ResponseEnvelope<ScenarioSnapshotEnvelopeResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return {
    result: {
      scenarioId: input.scenario.id,
      scenarioTitle: input.scenario.title,
      codeCount: input.curatedCodes.length,
      policyEventCount: input.policyEvents.length,
      warnings: input.warnings,
      overlay: input.overlay,
      generatedAt,
    },
    confidence: input.confidence,
    provenance: input.provenance,
    honestyMarkers: input.honestyMarkers,
  };
}

function withDefaultDependencies(
  overrides: Partial<IngestionServiceDependencies>
): IngestionServiceDependencies {
  return {
    codeDataProvider:
      overrides.codeDataProvider ?? new CuratedCodeDataProvider(CURATED_CODE_DATA),
    policyFeedProvider:
      overrides.policyFeedProvider ?? new SeededPolicyFeedProvider(SEEDED_POLICY_EVENTS),
  };
}

function withDefaultConfiguration(
  configuration: IngestionServiceConfiguration
): Required<IngestionServiceConfiguration> {
  return {
    allowFallbackToAllCodes: configuration.allowFallbackToAllCodes ?? false,
  };
}

function selectCodesForScenario(
  codes: readonly DemoCodeDatum[],
  scenario: DemoScenario,
  configuration: Required<IngestionServiceConfiguration>
): {
  readonly curatedCodes: readonly DemoCodeDatum[];
  readonly warnings: readonly IngestionWarning[];
} {
  const matched = codes.filter((code) =>
    code.tags.some((tag) => scenario.relevantTags.includes(tag))
  );

  if (matched.length > 0) {
    return {
      curatedCodes: matched,
      warnings: [],
    };
  }

  if (configuration.allowFallbackToAllCodes) {
    return {
      curatedCodes: codes,
      warnings: [
        {
          code: "fallback-to-all-codes",
          message:
            "No curated code tags matched scenario tags, fallback policy returned all codes.",
          scenarioId: scenario.id,
        },
      ],
    };
  }

  return {
    curatedCodes: [],
    warnings: [
      {
        code: "no-tag-matches",
        message: "No curated code tags matched scenario tags.",
        scenarioId: scenario.id,
      },
    ],
  };
}

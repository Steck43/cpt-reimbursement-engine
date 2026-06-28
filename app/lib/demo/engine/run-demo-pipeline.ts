import { deriveConfidence } from "../contracts/confidence-policy";
import type {
  HonestyMarker,
  ProvenanceEntry,
  ResponseEnvelope,
} from "../contracts/response-envelope";
import {
  buildBusinessModelOverlayMapping,
  type BusinessModelOverlayMapping,
} from "../data/business-model-overlays";
import type { DemoScenarioId } from "../data/scenarios";
import {
  createCodeIntelligenceService,
  type DemoCodeIntelligenceService,
} from "../services/code-intelligence-service";
import {
  createDemoIngestionService,
  type IngestionWarning,
  type DemoIngestionService,
} from "../services/ingestion-service";
import {
  createMonitoringService,
  type DemoMonitoringService,
} from "../services/monitoring-service";
import {
  createPaymentModelService,
  type DemoPaymentModelService,
} from "../services/payment-model-service";

type DemoPipelineDependencies = {
  readonly ingestionService: DemoIngestionService;
  readonly codeIntelligenceService: DemoCodeIntelligenceService;
  readonly paymentModelService: DemoPaymentModelService;
  readonly monitoringService: DemoMonitoringService;
};

export type DemoPipelineResult = {
  readonly scenarioId: DemoScenarioId;
  readonly scenarioTitle: string;
  readonly selectedCode: string;
  readonly predictedStatusIndicator: string;
  readonly predictedApc: string | null;
  readonly monitoring: {
    readonly alert: {
      readonly triggered: boolean;
      readonly severity: "low" | "medium" | "high";
      readonly summary: string;
      readonly impactedRuleEventIds: readonly string[];
    };
    readonly ruleEventImpactDelta: number;
    readonly revenueProtectionDelta: number | null;
    readonly economicModel: {
      readonly mode: "protectable-delta" | "foregone-revenue-exposure" | "unknown-exposure";
      readonly perProcedureStake: number | null;
      readonly procedureVolumeAssumption: number;
      readonly note: string;
    };
  };
  readonly businessModelOverlay: BusinessModelOverlayMapping;
  readonly warnings: readonly IngestionWarning[];
};

export type DemoPipelineEnvelope = ResponseEnvelope<DemoPipelineResult>;

export type DemoPipelineOrchestrator = {
  run(scenarioId: DemoScenarioId): Promise<DemoPipelineEnvelope>;
};

export function createDemoPipelineOrchestrator(
  overrides: Partial<DemoPipelineDependencies> = {}
): DemoPipelineOrchestrator {
  const dependencies = withDefaultDependencies(overrides);

  return {
    async run(scenarioId) {
      const snapshot = await dependencies.ingestionService.loadScenarioSnapshot(scenarioId);
      const codeEnvelope = await dependencies.codeIntelligenceService.analyze({
        scenario: snapshot.scenario,
        codes: snapshot.curatedCodes,
        generatedAt: snapshot.generatedAt,
      });
      const paymentEnvelope = await dependencies.paymentModelService.predict({
        scenario: snapshot.scenario,
        selectedCode: codeEnvelope.result.selectedCode.code,
        rankedCandidates: codeEnvelope.result.rankedCandidates,
        generatedAt: snapshot.generatedAt,
      });
      const monitoringEnvelope = await dependencies.monitoringService.evaluate({
        scenario: snapshot.scenario,
        selectedCode: codeEnvelope.result.selectedCode.code,
        policyEvents: snapshot.policyEvents,
        paymentModelResult: {
          predictedStatusIndicator: paymentEnvelope.result.predictedStatusIndicator,
          predictedApc: paymentEnvelope.result.predictedApc,
          actualCmsStatusIndicator: paymentEnvelope.result.actualCmsStatusIndicator,
          actualCmsApc: paymentEnvelope.result.actualCmsApc,
          statusIndicatorMatch: paymentEnvelope.result.statusIndicatorMatch,
          apcMatch: paymentEnvelope.result.apcMatch,
        },
        generatedAt: snapshot.generatedAt,
      });

      const businessModelOverlay = buildBusinessModelOverlayMapping(
        snapshot.overlay,
        monitoringEnvelope.result.revenueProtectionDelta
      );
      const confidence = deriveConfidence({
        descriptorMatch: {
          score: codeEnvelope.confidence.overall,
          rationale: "Code-intelligence confidence contributes descriptor-match confidence at pipeline level.",
        },
        keywordOverlap: {
          score: paymentEnvelope.confidence.overall,
          rationale: "Payment-model confidence contributes keyword-overlap confidence at pipeline level.",
        },
        categoryAlignment: {
          score:
            (Number(paymentEnvelope.result.statusIndicatorMatch) +
              Number(paymentEnvelope.result.apcMatch)) /
            2,
          rationale: "Category alignment reflects computed status/APC agreement against known CMS outcomes.",
        },
      });
      const sourceEnvelopes = [
        {
          source: "code-intelligence-service",
          envelope: codeEnvelope,
        },
        {
          source: "payment-model-service",
          envelope: paymentEnvelope,
        },
        {
          source: "monitoring-service",
          envelope: monitoringEnvelope,
        },
      ] as const;

      return {
        result: {
          scenarioId: snapshot.scenario.id,
          scenarioTitle: snapshot.scenario.title,
          selectedCode: codeEnvelope.result.selectedCode.code,
          predictedStatusIndicator: paymentEnvelope.result.predictedStatusIndicator,
          predictedApc: paymentEnvelope.result.predictedApc,
          monitoring: {
            alert: monitoringEnvelope.result.alert,
            ruleEventImpactDelta: monitoringEnvelope.result.ruleEventImpactDelta,
            revenueProtectionDelta: monitoringEnvelope.result.revenueProtectionDelta,
          },
          businessModelOverlay,
          warnings: snapshot.warnings,
        },
        confidence,
        provenance: collectPipelineProvenance({
          snapshotGeneratedAt: snapshot.generatedAt,
          sourceEnvelopes,
          scenarioId: snapshot.scenario.id,
          warnings: snapshot.warnings,
        }),
        honestyMarkers: collectPipelineHonestyMarkers({
          sourceEnvelopes,
        }),
      };
    },
  };
}

function withDefaultDependencies(
  overrides: Partial<DemoPipelineDependencies>
): DemoPipelineDependencies {
  return {
    ingestionService: overrides.ingestionService ?? createDemoIngestionService(),
    codeIntelligenceService:
      overrides.codeIntelligenceService ?? createCodeIntelligenceService(),
    paymentModelService: overrides.paymentModelService ?? createPaymentModelService(),
    monitoringService: overrides.monitoringService ?? createMonitoringService(),
  };
}

function collectPipelineProvenance(input: {
  readonly snapshotGeneratedAt: string;
  readonly sourceEnvelopes: readonly [
    {
      readonly source:
        | "code-intelligence-service"
        | "payment-model-service"
        | "monitoring-service";
      readonly envelope: ResponseEnvelope<Record<string, unknown>>;
    },
    {
      readonly source:
        | "code-intelligence-service"
        | "payment-model-service"
        | "monitoring-service";
      readonly envelope: ResponseEnvelope<Record<string, unknown>>;
    },
    {
      readonly source:
        | "code-intelligence-service"
        | "payment-model-service"
        | "monitoring-service";
      readonly envelope: ResponseEnvelope<Record<string, unknown>>;
    }
  ];
  readonly scenarioId: DemoScenarioId;
  readonly warnings: readonly IngestionWarning[];
}): readonly ProvenanceEntry[] {
  const entries = input.sourceEnvelopes.flatMap((entry) => entry.envelope.provenance);
  const warningCitation =
    input.warnings.length > 0
      ? `ingestionWarnings:${input.warnings.length}`
      : "ingestionWarnings:0";
  return [
    {
      source: "run-demo-pipeline",
      citation: `scenario:${input.scenarioId}; composed:ingestion+code-intelligence+payment+monitoring; ${warningCitation}`,
      observedAt: input.snapshotGeneratedAt,
    },
    ...entries,
  ];
}

function collectPipelineHonestyMarkers(input: {
  readonly sourceEnvelopes: readonly [
    {
      readonly source:
        | "code-intelligence-service"
        | "payment-model-service"
        | "monitoring-service";
      readonly envelope: ResponseEnvelope<Record<string, unknown>>;
    },
    {
      readonly source:
        | "code-intelligence-service"
        | "payment-model-service"
        | "monitoring-service";
      readonly envelope: ResponseEnvelope<Record<string, unknown>>;
    },
    {
      readonly source:
        | "code-intelligence-service"
        | "payment-model-service"
        | "monitoring-service";
      readonly envelope: ResponseEnvelope<Record<string, unknown>>;
    }
  ];
}): readonly HonestyMarker[] {
  const inherited = input.sourceEnvelopes.flatMap((entry) =>
    entry.envelope.honestyMarkers.map((marker) =>
      namespaceHonestyMarker(entry.source, marker)
    )
  );
  return [
    {
      field: "result",
      mode: "computed",
      note: "Pipeline result is computed by composing ingestion, code intelligence, payment, and monitoring services.",
    },
    {
      field: "result.businessModelOverlay",
      mode: "computed",
      note: 'Business-model overlay is mapped to sections ["7","8","20"] from runtime scenario outputs.',
    },
    {
      field: "result.monitoring",
      mode: "computed",
      note: "Monitoring output is computed from policy events and payment-model comparison data.",
    },
    {
      field: "result.warnings",
      mode: "computed",
      note: "Warnings are propagated from ingestion and surfaced without alteration in pipeline output.",
    },
    {
      field: "confidence",
      mode: "computed",
      note: "Pipeline confidence is derived via confidence-policy contributors only.",
    },
    ...inherited,
  ];
}

function namespaceHonestyMarker(
  source:
    | "code-intelligence-service"
    | "payment-model-service"
    | "monitoring-service",
  marker: HonestyMarker
): HonestyMarker {
  return {
    ...marker,
    field: `upstream.${source}.${marker.field}`,
  };
}

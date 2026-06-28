import type { DemoScenarioId } from "./scenarios";

export class BusinessModelOverlayNotFoundError extends Error {
  readonly scenarioId: string;

  constructor(scenarioId: string) {
    super(`Missing business-model overlay for scenario: ${scenarioId}`);
    this.name = "BusinessModelOverlayNotFoundError";
    this.scenarioId = scenarioId;
  }
}

export type BusinessModelOverlay = {
  readonly scenarioId: DemoScenarioId;
  readonly strategyTierValue: string;
  readonly retentionMechanism: string;
  readonly revenueProtectionFrame: string;
};

export const BUSINESS_MODEL_SECTION_IDS = ["7", "8", "20"] as const;

export type BusinessModelSectionId = (typeof BUSINESS_MODEL_SECTION_IDS)[number];

export type BusinessModelOverlayMapping = {
  readonly sections: readonly BusinessModelSectionId[];
  readonly sectionNarrative: Readonly<Record<BusinessModelSectionId, string>>;
};

// Placeholder narratives: these lines are interim scaffolding until Landen
// provides direct quotations and final wording from business model v0.2.
export const BUSINESS_MODEL_OVERLAYS = [
  {
    scenarioId: "ai-ecg",
    strategyTierValue:
      "Code-intelligence scoring supports higher-confidence cardiovascular adjudication.",
    retentionMechanism:
      "Monitoring catches policy changes before they erode reimbursement.",
    revenueProtectionFrame:
      "Retrospective variance checks frame recovered revenue at portfolio scale.",
  },
  {
    scenarioId: "mindmotion-go",
    strategyTierValue:
      "Rehab coding pathways show unit-economics leverage for longitudinal care.",
    retentionMechanism:
      "Rule alerts reduce renewal churn from avoidable billing denials.",
    revenueProtectionFrame:
      "Intervention timing highlights prevented leakage in recurring therapy episodes.",
  },
  {
    scenarioId: "recell",
    strategyTierValue:
      "Regenerative workflow coding maps complex cases to repeatable payment logic.",
    retentionMechanism:
      "Coverage surveillance anchors retention through policy transparency.",
    revenueProtectionFrame:
      "Case-level deltas roll up to investor-visible protection in burn-service lines.",
  },
  {
    scenarioId: "cochlear-69930",
    strategyTierValue:
      "Coverage-boundary classification extends strategy-tier value into high-cost device pathways.",
    retentionMechanism:
      "Monitoring NCD and OPPS shifts protects renewals when implant economics change quickly.",
    revenueProtectionFrame:
      "Device-intensive drift detection converts high-dollar variance into explainable protection outcomes.",
  },
  {
    scenarioId: "bci-archetype",
    strategyTierValue:
      "No-precedent detection demonstrates strategy-tier value by surfacing uncertainty before launch.",
    retentionMechanism:
      "Explicit no-precedent handling prevents trust erosion from overconfident reimbursement claims.",
    revenueProtectionFrame:
      "No-precedent framing protects downside by separating computed prediction from absent CMS actuals.",
  },
] as const satisfies readonly BusinessModelOverlay[];

export function getBusinessModelOverlayForScenario(
  scenarioId: DemoScenarioId
): BusinessModelOverlay {
  const overlay = BUSINESS_MODEL_OVERLAYS.find(
    (candidate) => candidate.scenarioId === scenarioId
  );
  if (!overlay) {
    throw new BusinessModelOverlayNotFoundError(scenarioId);
  }
  return overlay;
}

export function buildBusinessModelOverlayMapping(
  overlay: BusinessModelOverlay,
  revenueProtectionDelta: number | null
): BusinessModelOverlayMapping {
  const section20DerivedLine =
    revenueProtectionDelta === null
      ? "Derived from monitoring/economics model placeholder: exposure is currently unknown."
      : `Derived from monitoring/economics model placeholder: estimated amount ${formatUsd(revenueProtectionDelta)}.`;

  return {
    sections: BUSINESS_MODEL_SECTION_IDS,
    sectionNarrative: {
      "7": `Section 7 strategy tier value: ${overlay.strategyTierValue}`,
      "8": `Section 8 retention mechanism: ${overlay.retentionMechanism}`,
      "20": `Section 20 asymmetric-bet proof point placeholder: ${overlay.revenueProtectionFrame} ${section20DerivedLine}`,
    },
  };
}

function formatUsd(value: number): string {
  const normalized = Math.max(0, Math.round(value));
  return `$${normalized.toLocaleString("en-US")}`;
}

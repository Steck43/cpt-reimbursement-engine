import type { HonestyMarker } from "../../lib/demo/contracts/response-envelope";
import type { BusinessModelOverlay } from "../../lib/demo/data/business-model-overlays";

export type BusinessModelSectionNarratives = {
  readonly "7": string;
  readonly "8": string;
  readonly "20": string;
};

export function buildBusinessModelSectionNarratives(input: {
  readonly overlay: BusinessModelOverlay;
  readonly revenueProtectionDelta: number | null;
}): BusinessModelSectionNarratives {
  const section20DerivedLine =
    input.revenueProtectionDelta === null
      ? "Derived from monitoring/economics model placeholder: exposure is currently unknown."
      : `Derived from monitoring/economics model placeholder: estimated amount ${formatUsd(input.revenueProtectionDelta)}.`;

  return {
    "7": input.overlay.strategyTierValue,
    "8": input.overlay.retentionMechanism,
    "20": `${input.overlay.revenueProtectionFrame} ${section20DerivedLine}`,
  };
}

export function findHonestyMarker(
  markers: readonly HonestyMarker[],
  fieldCandidates: readonly string[]
): HonestyMarker | null {
  for (const fieldCandidate of fieldCandidates) {
    const marker = markers.find((item) => item.field === fieldCandidate);
    if (marker) {
      return marker;
    }
  }
  return null;
}

export function shouldApplyScenarioResponse(input: {
  readonly requestId: number;
  readonly latestRequestId: number;
  readonly aborted: boolean;
}): boolean {
  return !input.aborted && input.requestId === input.latestRequestId;
}

function formatUsd(value: number): string {
  const normalized = Math.max(0, Math.round(value));
  return `$${normalized.toLocaleString("en-US")}`;
}

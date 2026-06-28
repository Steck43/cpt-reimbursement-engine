export const DEMO_RESPONSE_ENVELOPE_KEYS = [
  "result",
  "confidence",
  "provenance",
  "honestyMarkers",
] as const;

export type ResponseEnvelopeKey = (typeof DEMO_RESPONSE_ENVELOPE_KEYS)[number];

export type ConfidenceContributorName =
  | "descriptorMatch"
  | "keywordOverlap"
  | "categoryAlignment";

export type ConfidenceContributor = {
  readonly name: ConfidenceContributorName;
  readonly score: number;
  readonly weight: number;
  readonly rationale: string;
};

export type DerivedConfidence = {
  readonly overall: number;
  readonly contributors: readonly ConfidenceContributor[];
  readonly derivation: "computed";
};

export type ProvenanceEntry = {
  readonly source: string;
  readonly citation: string;
  readonly observedAt: string;
};

export type HonestyMarker = {
  readonly field: string;
  readonly mode: "computed" | "simulated";
  readonly note: string;
};

export type ResponseEnvelope<TResult extends Record<string, unknown>> = {
  readonly result: TResult;
  readonly confidence: DerivedConfidence;
  readonly provenance: readonly ProvenanceEntry[];
  readonly honestyMarkers: readonly HonestyMarker[];
};

export function hasExactResponseEnvelopeKeys(
  value: unknown
): value is Record<ResponseEnvelopeKey, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const keys = Object.keys(value as Record<string, unknown>).sort();
  const required = [...DEMO_RESPONSE_ENVELOPE_KEYS].sort();
  return (
    keys.length === required.length &&
    keys.every((key, index) => key === required[index])
  );
}

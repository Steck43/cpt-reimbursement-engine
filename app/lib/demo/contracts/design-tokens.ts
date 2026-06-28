export const DESIGN_TOKENS_VERSION = "BursaAI_Design_System_v1.0";

export const DESIGN_COLOR_TOKENS = {
  ink: "#0A0E16",
  surface1: "#111824",
  surface2: "#18212F",
  surface3: "#1F2A3A",
  hairline: "#26303F",
  hairlineBright: "#33414F",
  signal: "#34E2C4",
  signalDim: "#1E8C7A",
  signalGlow: "rgba(52, 226, 196, 0.14)",
  favorable: "#6EE787",
  atRisk: "#F0B429",
  critical: "#FF6B6B",
  criticalBg: "rgba(255, 107, 107, 0.08)",
  text1: "#ECF1F8",
  text2: "#8B97A8",
  text3: "#5C6878",
} as const;

export const TYPOGRAPHY_TOKENS = {
  display: {
    family: "Fraunces",
    usage: "pitch-moment headers and narrative gravitas",
  },
  body: {
    family: "Geist",
    usage: "interface and body copy",
  },
  data: {
    family: "Geist Mono",
    usage: "codes, status indicators, APC values, currency, confidence values",
  },
} as const;

export type SignaturePrimitiveId =
  | "honesty-marker"
  | "provenance-affordance"
  | "prediction-validation"
  | "revenue-protection-reveal";

export type SignaturePrimitiveDefinition = {
  readonly id: SignaturePrimitiveId;
  readonly title: string;
  readonly requiredElements: readonly string[];
};

export const SIGNATURE_PRIMITIVES: readonly SignaturePrimitiveDefinition[] = [
  {
    id: "honesty-marker",
    title: "Honesty marker",
    requiredElements: [
      "Computed or Simulated label",
      "status dot",
      "uppercase monospace presentation",
    ],
  },
  {
    id: "provenance-affordance",
    title: "Provenance affordance",
    requiredElements: [
      "source trail per computed value",
      "dashed top border footer or hover affordance",
      "tertiary monospace text that brightens on hover",
    ],
  },
  {
    id: "prediction-validation",
    title: "Prediction validation",
    requiredElements: [
      "predicted versus actual CMS comparison",
      "explicit match or mismatch statement",
      "favorable indicator for confirmed matches",
    ],
  },
  {
    id: "revenue-protection-reveal",
    title: "Revenue-protection reveal",
    requiredElements: [
      "largest on-screen money figure in Geist Mono",
      "Fraunces stakes header",
      "outcome-keyed radial color wash",
    ],
  },
] as const;

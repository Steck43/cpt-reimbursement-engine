export type DemoScenarioId =
  | "ai-ecg"
  | "mindmotion-go"
  | "recell"
  | "cochlear-69930"
  | "bci-archetype";

export class ScenarioNotFoundError extends Error {
  readonly scenarioId: string;

  constructor(scenarioId: string) {
    super(`Unknown scenario id: ${scenarioId}`);
    this.name = "ScenarioNotFoundError";
    this.scenarioId = scenarioId;
  }
}

export type DemoScenario = {
  readonly id: DemoScenarioId;
  readonly title: string;
  readonly company: string | null;
  readonly failureMode:
    | "status-indicator"
    | "apc-misalignment"
    | "pass-through-cliff"
    | "coverage-boundary"
    | "no-precedent";
  readonly deviceClass: string;
  readonly clinicalArea: string;
  readonly relevantTags: readonly string[];
  readonly knownCmsOutcome: {
    readonly statusIndicator: string;
    readonly apc: string | null;
  } | null;
};

export const DEMO_SCENARIOS = [
  // Status-indicator failure: a code can exist, be FDA-cleared, and still pay $0.
  // Anchored to 0937T (extended external ECG recording, 15 to 30 days), genuinely status
  // E1, not payable under OPPS, per 2025 Addendum B. Deliberately not 0764T/0765T, the
  // AI-ECG service codes. Those were E1, but CMS finalized them to status S (payable, APC
  // 5734) for CY2025 after manufacturer advocacy, so they no longer demonstrate
  // exists-but-pays-zero. The duration-based recording code is the honest current E1
  // exemplar. The descriptor is about duration, not AI, and is described that way.
  {
    id: "ai-ecg",
    title: "AI-ECG",
    company: null,
    failureMode: "status-indicator",
    deviceClass: "Extended external ECG monitoring device",
    clinicalArea: "Cardiovascular outpatient monitoring",
    relevantTags: [
      "cardiac",
      "ecg",
      "external",
      "extended",
      "electrocardiogram",
      "recording",
      "monitoring",
    ],
    knownCmsOutcome: {
      statusIndicator: "E1",
      apc: null,
    },
  },
  {
    id: "mindmotion-go",
    title: "MindMotion GO",
    company: "MindMaze",
    failureMode: "apc-misalignment",
    deviceClass: "Neurorehabilitation motion-capture therapy supply",
    clinicalArea: "Post-stroke rehabilitation",
    relevantTags: ["motion", "kinematic", "neurorehab", "movement", "therapy", "remote", "capture"],
    knownCmsOutcome: {
      statusIndicator: "S",
      apc: "1505",
    },
  },
  {
    id: "recell",
    title: "RECELL",
    company: "Avita Medical",
    failureMode: "pass-through-cliff",
    deviceClass: "Autologous cell suspension autograft procedure workflow",
    clinicalArea: "Burn and wound management",
    relevantTags: ["autograft", "skin", "cell", "suspension", "graft", "preparation", "recell"],
    knownCmsOutcome: {
      statusIndicator: "T",
      apc: "1567",
    },
  },
  {
    id: "cochlear-69930",
    title: "Cochlear 69930",
    company: null,
    failureMode: "coverage-boundary",
    deviceClass: "Cochlear implant with or without mastoidectomy",
    clinicalArea: "Otologic implant surgery",
    relevantTags: ["cochlear", "implant", "hearing", "sensorineural", "prosthetic", "ear", "device"],
    knownCmsOutcome: {
      statusIndicator: "J1",
      apc: "5166",
    },
  },
  // No-precedent: knownCmsOutcome is null on purpose. As of this dataset there is no
  // Category I or III CPT and no APC for an implantable motor-decoding neural interface,
  // a confirmed true absence rather than a missing lookup. This is the anchor that
  // exercises abstain-over-guess. The nearest candidate is cochlear (69930), which the
  // engine must reject rather than report. Device category only, no named company.
  {
    id: "bci-archetype",
    title: "BCI Archetype",
    company: null,
    failureMode: "no-precedent",
    deviceClass: "Implantable neural interface for motor intent decoding",
    clinicalArea: "Neuroprosthetic interface",
    relevantTags: ["neural", "interface", "brain", "implant", "signal", "decoding", "prosthetic"],
    knownCmsOutcome: null,
  },
] as const satisfies readonly DemoScenario[];

export function getScenarioById(id: DemoScenarioId): DemoScenario {
  const scenario = DEMO_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new ScenarioNotFoundError(id);
  }
  return scenario;
}

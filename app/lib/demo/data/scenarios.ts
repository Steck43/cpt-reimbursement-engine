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

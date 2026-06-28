import { NextResponse } from "next/server";

import { parseScenarioId } from "../../_utils/parse-scenario-id";
import { deriveConfidence } from "../../../lib/demo/contracts/confidence-policy";
import type {
  HonestyMarker,
  ProvenanceEntry,
} from "../../../lib/demo/contracts/response-envelope";
import {
  createDemoIngestionService,
  createScenarioSnapshotEnvelope,
} from "../../../lib/demo/services/ingestion-service";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await Promise.resolve(context.params);
    const parsedScenarioId = parseScenarioId(id);
    if (!parsedScenarioId.ok) {
      return NextResponse.json(
        { error: parsedScenarioId.error },
        { status: parsedScenarioId.error === "Unknown scenario id" ? 404 : 400 }
      );
    }

    const ingestionService = createDemoIngestionService();
    const snapshot = await ingestionService.loadScenarioSnapshot(
      parsedScenarioId.scenarioId
    );
    const confidence = deriveConfidence({
      descriptorMatch: {
        score: snapshot.curatedCodes.length > 0 ? 1 : 0,
        rationale: "Descriptor match reflects whether curated code candidates were recovered for the scenario.",
      },
      keywordOverlap: {
        score: normalize(snapshot.curatedCodes.length / 3),
        rationale: "Keyword overlap is normalized from curated candidate volume for this scenario snapshot.",
      },
      categoryAlignment: {
        score: snapshot.policyEvents.length > 0 ? 1 : 0,
        rationale: "Category alignment reflects policy-feed availability used by downstream monitoring.",
      },
    });

    const observedAt = snapshot.generatedAt;
    const provenance: readonly ProvenanceEntry[] = [
      {
        source: "ingestion-service",
        citation: [
          `scenario:${snapshot.scenario.id}`,
          `codes:${snapshot.curatedCodes.length}`,
          `policyEvents:${snapshot.policyEvents.length}`,
          `warnings:${snapshot.warnings.length}`,
        ].join("; "),
        observedAt,
      },
      {
        source: "providers",
        citation: "codeData:CuratedCodeDataProvider; policyFeed:SeededPolicyFeedProvider",
        observedAt,
      },
    ];
    const honestyMarkers: readonly HonestyMarker[] = [
      {
        field: "result",
        mode: "computed",
        note: "Scenario snapshot summary is computed from runtime ingestion outputs.",
      },
      {
        field: "result.overlay",
        mode: "computed",
        note: "Business-model overlay is selected from scenario-linked runtime mapping.",
      },
      {
        field: "result.warnings",
        mode: "computed",
        note: "Warnings are computed during ingestion and surfaced for downstream confidence interpretation.",
      },
      {
        field: "confidence",
        mode: "computed",
        note: "Confidence is derived from runtime ingestion signals and confidence-policy contributors.",
      },
    ];

    const envelope = createScenarioSnapshotEnvelope({
      scenario: snapshot.scenario,
      overlay: snapshot.overlay,
      curatedCodes: snapshot.curatedCodes,
      policyEvents: snapshot.policyEvents,
      warnings: snapshot.warnings,
      confidence,
      provenance,
      honestyMarkers,
      generatedAt: snapshot.generatedAt,
    });

    return NextResponse.json(envelope, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to load scenario" }, { status: 500 });
  }
}

function normalize(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Math.round(value * 1000) / 1000;
}

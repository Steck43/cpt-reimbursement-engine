import { NextResponse } from "next/server";

import { parseScenarioId } from "../_utils/parse-scenario-id";
import { createCodeIntelligenceService } from "../../lib/demo/services/code-intelligence-service";
import { createDemoIngestionService } from "../../lib/demo/services/ingestion-service";

type AnalyzeRequestBody = {
  readonly scenarioId?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    const parsedScenarioId = parseScenarioId(body.scenarioId);
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
    const codeIntelligenceService = createCodeIntelligenceService();
    const envelope = await codeIntelligenceService.analyze({
      scenario: snapshot.scenario,
      codes: snapshot.curatedCodes,
      generatedAt: snapshot.generatedAt,
    });

    return NextResponse.json(envelope, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to analyze scenario" }, { status: 500 });
  }
}

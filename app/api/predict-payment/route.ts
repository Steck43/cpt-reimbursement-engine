import { NextResponse } from "next/server";

import { parseScenarioId } from "../_utils/parse-scenario-id";
import { createCodeIntelligenceService } from "../../lib/demo/services/code-intelligence-service";
import { createDemoIngestionService } from "../../lib/demo/services/ingestion-service";
import { createPaymentModelService } from "../../lib/demo/services/payment-model-service";

type PredictPaymentRequestBody = {
  readonly scenarioId?: string;
  readonly selectedCode?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as PredictPaymentRequestBody;
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
    const codeEnvelope = await codeIntelligenceService.analyze({
      scenario: snapshot.scenario,
      codes: snapshot.curatedCodes,
      generatedAt: snapshot.generatedAt,
    });

    const paymentModelService = createPaymentModelService();
    const envelope = await paymentModelService.predict({
      scenario: snapshot.scenario,
      selectedCode: body.selectedCode?.trim() || codeEnvelope.result.selectedCode.code,
      rankedCandidates: codeEnvelope.result.rankedCandidates,
      generatedAt: snapshot.generatedAt,
    });

    return NextResponse.json(envelope, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to predict payment outcome" }, { status: 500 });
  }
}

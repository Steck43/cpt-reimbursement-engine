import { describe, expect, it } from "vitest";

import { POST as analyzeRoute } from "../analyze/route";
import { POST as monitorImpactRoute } from "../monitor-impact/route";
import { POST as predictPaymentRoute } from "../predict-payment/route";
import { GET as getScenarioRoute } from "../scenarios/[id]/route";
import { hasExactResponseEnvelopeKeys } from "../../lib/demo/contracts/response-envelope";

type RouteEnvelope = {
  readonly result: Record<string, unknown>;
  readonly confidence: {
    readonly derivation: string;
  };
  readonly provenance: readonly unknown[];
  readonly honestyMarkers: readonly {
    readonly field: string;
  }[];
};

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

function expectRouteEnvelope(payload: unknown): RouteEnvelope {
  expect(hasExactResponseEnvelopeKeys(payload)).toBe(true);
  return payload as RouteEnvelope;
}

describe("demo API routes", () => {
  it("returns contract-compliant scenario envelope", async () => {
    const response = await getScenarioRoute(
      new Request("http://localhost/api/scenarios/ai-ecg"),
      { params: { id: "ai-ecg" } }
    );
    const payload = expectRouteEnvelope(await parseJson(response));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      result: {
        scenarioId: "ai-ecg",
        scenarioTitle: "AI-ECG",
      },
    });
    expect(payload.confidence.derivation).toBe("computed");
    expect(payload.honestyMarkers.length).toBeGreaterThan(0);
    expect(payload.result.warnings).toEqual([]);
  });

  it("returns contract-compliant analyze envelope", async () => {
    const response = await analyzeRoute(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ scenarioId: "mindmotion-go" }),
        headers: {
          "content-type": "application/json",
        },
      })
    );
    const payload = expectRouteEnvelope(await parseJson(response));

    expect(response.status).toBe(200);
    expect(payload.result.scenarioId).toBe("mindmotion-go");
    expect(payload.confidence.derivation).toBe("computed");
    expect(
      payload.honestyMarkers.some((marker) => marker.field === "confidence")
    ).toBe(true);
  });

  it("returns contract-compliant predict-payment envelope", async () => {
    const response = await predictPaymentRoute(
      new Request("http://localhost/api/predict-payment", {
        method: "POST",
        body: JSON.stringify({ scenarioId: "ai-ecg" }),
        headers: {
          "content-type": "application/json",
        },
      })
    );
    const payload = expectRouteEnvelope(await parseJson(response));

    expect(response.status).toBe(200);
    expect(payload.result.scenarioId).toBe("ai-ecg");
    expect(payload.result.predictedStatusIndicator).toBeTruthy();
    expect(payload.result.predictedApc).toBeNull();
    expect(
      payload.honestyMarkers.some(
        (marker) => marker.field === "result.predictedStatusIndicator"
      )
    ).toBe(true);
  });

  it("returns contract-compliant monitor-impact envelope", async () => {
    const response = await monitorImpactRoute(
      new Request("http://localhost/api/monitor-impact", {
        method: "POST",
        body: JSON.stringify({ scenarioId: "ai-ecg" }),
        headers: {
          "content-type": "application/json",
        },
      })
    );
    const payload = expectRouteEnvelope(await parseJson(response));

    expect(response.status).toBe(200);
    expect(payload.result.scenarioId).toBe("ai-ecg");
    expect(payload.result.alert).toMatchObject({
      triggered: expect.any(Boolean),
      severity: expect.stringMatching(/^(low|medium|high)$/),
    });
    expect(payload.honestyMarkers.some((marker) => marker.field === "result.alert")).toBe(
      true
    );
  });

  it("returns consistent 400 for missing scenarioId on POST routes", async () => {
    const requests = [
      analyzeRoute(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        })
      ),
      predictPaymentRoute(
        new Request("http://localhost/api/predict-payment", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        })
      ),
      monitorImpactRoute(
        new Request("http://localhost/api/monitor-impact", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        })
      ),
    ] as const;

    for (const response of await Promise.all(requests)) {
      const payload = (await parseJson(response)) as Record<string, unknown>;
      expect(response.status).toBe(400);
      expect(payload.error).toBe("scenarioId is required");
    }
  });

  it("returns 400 for invalid JSON body on POST routes", async () => {
    const requests = [
      analyzeRoute(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: "{",
          headers: { "content-type": "application/json" },
        })
      ),
      predictPaymentRoute(
        new Request("http://localhost/api/predict-payment", {
          method: "POST",
          body: "{",
          headers: { "content-type": "application/json" },
        })
      ),
      monitorImpactRoute(
        new Request("http://localhost/api/monitor-impact", {
          method: "POST",
          body: "{",
          headers: { "content-type": "application/json" },
        })
      ),
    ] as const;

    for (const response of await Promise.all(requests)) {
      const payload = (await parseJson(response)) as Record<string, unknown>;
      expect(response.status).toBe(400);
      expect(payload.error).toBe("Invalid JSON body");
    }
  });

  it("returns consistent 404 for unknown scenario ids where applicable", async () => {
    const postRequests = [
      analyzeRoute(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: JSON.stringify({ scenarioId: "unknown" }),
          headers: { "content-type": "application/json" },
        })
      ),
      predictPaymentRoute(
        new Request("http://localhost/api/predict-payment", {
          method: "POST",
          body: JSON.stringify({ scenarioId: "unknown" }),
          headers: { "content-type": "application/json" },
        })
      ),
      monitorImpactRoute(
        new Request("http://localhost/api/monitor-impact", {
          method: "POST",
          body: JSON.stringify({ scenarioId: "unknown" }),
          headers: { "content-type": "application/json" },
        })
      ),
    ] as const;

    for (const response of await Promise.all(postRequests)) {
      const payload = (await parseJson(response)) as Record<string, unknown>;
      expect(response.status).toBe(404);
      expect(payload.error).toBe("Unknown scenario id");
    }

    const scenarioResponse = await getScenarioRoute(
      new Request("http://localhost/api/scenarios/unknown"),
      { params: { id: "unknown" } }
    );
    const scenarioPayload = (await parseJson(scenarioResponse)) as Record<string, unknown>;
    expect(scenarioResponse.status).toBe(404);
    expect(scenarioPayload.error).toBe("Unknown scenario id");
  });

  it("returns 400 when scenario path param is missing/blank", async () => {
    const response = await getScenarioRoute(
      new Request("http://localhost/api/scenarios/blank"),
      { params: { id: "   " } }
    );
    const payload = (await parseJson(response)) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(payload.error).toBe("scenarioId is required");
  });
});

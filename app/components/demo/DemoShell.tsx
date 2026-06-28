"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ProvenanceEntry,
  ResponseEnvelope,
} from "../../lib/demo/contracts/response-envelope";
import type { DemoScenarioId } from "../../lib/demo/data/scenarios";
import type { ScenarioSnapshotEnvelopeResult } from "../../lib/demo/services/ingestion-service";
import type { CodeIntelligenceResult } from "../../lib/demo/services/code-intelligence-service";
import type { PaymentModelResult } from "../../lib/demo/services/payment-model-service";
import type { MonitoringResult } from "../../lib/demo/services/monitoring-service";
import { BusinessModelOverlay } from "./BusinessModelOverlay";
import { CmsValidationPanel } from "./CmsValidationPanel";
import { PillarStepCard } from "./PillarStepCard";
import { ProvenanceAffordance } from "./ProvenanceAffordance";
import { RevenueProtectionReveal } from "./RevenueProtectionReveal";
import {
  buildBusinessModelSectionNarratives,
  findHonestyMarker,
  shouldApplyScenarioResponse,
} from "./demo-shell-model";

const SCENARIOS: readonly {
  id: DemoScenarioId;
  title: string;
  failureMode: string;
}[] = [
  { id: "ai-ecg", title: "AI-ECG", failureMode: "Status-indicator failure" },
  { id: "mindmotion-go", title: "MindMotion GO", failureMode: "APC misalignment" },
  { id: "recell", title: "RECELL", failureMode: "Pass-through cliff" },
  { id: "cochlear-69930", title: "Cochlear 69930", failureMode: "Coverage boundary" },
  { id: "bci-archetype", title: "BCI Archetype", failureMode: "No precedent" },
] as const;

type DemoState = {
  readonly scenarioEnvelope: ResponseEnvelope<ScenarioSnapshotEnvelopeResult>;
  readonly analyzeEnvelope: ResponseEnvelope<CodeIntelligenceResult>;
  readonly paymentEnvelope: ResponseEnvelope<PaymentModelResult>;
  readonly monitorEnvelope: ResponseEnvelope<MonitoringResult>;
};

export function DemoShell() {
  const [scenarioId, setScenarioId] = useState<DemoScenarioId>("ai-ecg");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const latestRequestIdRef = useRef(0);

  function handleScenarioSelect(nextScenarioId: DemoScenarioId): void {
    if (nextScenarioId === scenarioId) {
      return;
    }
    setLoading(true);
    setError(null);
    setScenarioId(nextScenarioId);
  }

  useEffect(() => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [scenarioEnvelope, analyzeEnvelope] = await Promise.all([
            getJson<ResponseEnvelope<ScenarioSnapshotEnvelopeResult>>(
              `/api/scenarios/${scenarioId}`,
              { method: "GET", signal: controller.signal }
            ),
            getJson<ResponseEnvelope<CodeIntelligenceResult>>("/api/analyze", {
              method: "POST",
              body: JSON.stringify({ scenarioId }),
              signal: controller.signal,
            }),
          ]);

          const selectedCode = analyzeEnvelope.result.selectedCode.code;
          const [paymentEnvelope, monitorEnvelope] = await Promise.all([
            getJson<ResponseEnvelope<PaymentModelResult>>("/api/predict-payment", {
              method: "POST",
              body: JSON.stringify({ scenarioId, selectedCode }),
              signal: controller.signal,
            }),
            getJson<ResponseEnvelope<MonitoringResult>>("/api/monitor-impact", {
              method: "POST",
              body: JSON.stringify({ scenarioId, selectedCode }),
              signal: controller.signal,
            }),
          ]);

          if (
            !shouldApplyScenarioResponse({
              requestId,
              latestRequestId: latestRequestIdRef.current,
              aborted: controller.signal.aborted,
            })
          ) {
            return;
          }

          setDemoState({
            scenarioEnvelope,
            analyzeEnvelope,
            paymentEnvelope,
            monitorEnvelope,
          });
          setError(null);
          setLoading(false);
        } catch (caught) {
          if (isAbortError(caught)) {
            return;
          }
          if (
            !shouldApplyScenarioResponse({
              requestId,
              latestRequestId: latestRequestIdRef.current,
              aborted: controller.signal.aborted,
            })
          ) {
            return;
          }
          const message =
            caught instanceof Error
              ? caught.message
              : "Failed to load demo scenario data.";
          setError(message);
          setDemoState(null);
          setLoading(false);
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [scenarioId]);

  const model = useMemo(() => {
    if (!demoState) {
      return null;
    }

    const allHonestyMarkers = [
      ...demoState.scenarioEnvelope.honestyMarkers,
      ...demoState.analyzeEnvelope.honestyMarkers,
      ...demoState.paymentEnvelope.honestyMarkers,
      ...demoState.monitorEnvelope.honestyMarkers,
    ];
    const provenanceEntries = dedupeProvenance([
      ...demoState.scenarioEnvelope.provenance,
      ...demoState.analyzeEnvelope.provenance,
      ...demoState.paymentEnvelope.provenance,
      ...demoState.monitorEnvelope.provenance,
    ]);

    return {
      selectedCode: demoState.analyzeEnvelope.result.selectedCode,
      rankedCandidates: demoState.analyzeEnvelope.result.rankedCandidates,
      paymentResult: demoState.paymentEnvelope.result,
      monitorResult: demoState.monitorEnvelope.result,
      provenanceEntries,
      sections: buildBusinessModelSectionNarratives({
        overlay: demoState.scenarioEnvelope.result.overlay,
        revenueProtectionDelta: demoState.monitorEnvelope.result.revenueProtectionDelta,
      }),
      markers: {
        codeIntelligence: findHonestyMarker(
          allHonestyMarkers,
          ["result.selectedCode", "result", "upstream.code-intelligence-service.result"]
        ),
        cmsValidation: findHonestyMarker(allHonestyMarkers, [
          "result.validationStatement",
          "upstream.payment-model-service.result.validationStatement",
        ]),
        monitoring: findHonestyMarker(allHonestyMarkers, [
          "result.alert",
          "upstream.monitoring-service.result.alert",
        ]),
        businessModelOverlay: findHonestyMarker(allHonestyMarkers, [
          "result.overlay",
          "result.businessModelOverlay",
        ]),
        revenueReveal: findHonestyMarker(allHonestyMarkers, [
          "result.revenueProtectionDelta",
          "upstream.monitoring-service.result.revenueProtectionDelta",
        ]),
      },
    };
  }, [demoState]);

  return (
    <main className="demo-shell">
      <section className="demo-frame">
        <section className="panel opening-frame">
          <p className="panel-kicker">Bursa.ai reimbursement intelligence</p>
          <h1>
            FDA-cleared does not guarantee paid. This demo shows where reimbursement fails and how the
            engine proves it.
          </h1>
          <p className="intro-copy">
            You are seeing runtime outputs only: CPT/HCPCS mapping, status/APC prediction, CMS
            retrospective validation, monitoring signal, and provenance.
          </p>
        </section>

        <header className="demo-header panel">
          <div>
            <p className="panel-kicker">Five failure-mode taxonomy</p>
            <h2>Select a reimbursement failure mode</h2>
            <p className="intro-copy">
              Each scenario is a distinct failure archetype with anchored code evidence and runtime
              computation.
            </p>
          </div>
          <div className="scenario-picker">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={scenario.id === scenarioId ? "active" : ""}
                onClick={() => handleScenarioSelect(scenario.id)}
              >
                <span>{scenario.failureMode}</span>
                <strong>{scenario.title}</strong>
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <section className="panel loading-panel">Computing scenario outputs...</section>
        ) : null}

        {error ? <section className="panel error-panel">{error}</section> : null}

        {!loading && !error && model ? (
          <>
            <section className="panel validation-hero">
              <p className="panel-kicker">CMS validation headline</p>
              <h2>{model.paymentResult.validationStatement}</h2>
              <p className="validation-hero-detail">
                Predicted {model.paymentResult.predictedStatusIndicator} /{" "}
                {model.paymentResult.predictedApc ?? "No APC"} compared with CMS actual{" "}
                {model.paymentResult.actualCmsStatusIndicator ?? "No precedent"} /{" "}
                {model.paymentResult.actualCmsApc ?? "No APC"}.
              </p>
            </section>

            <section className="pillar-sequence">
              <PillarStepCard
                stepNumber={1}
                title="Code intelligence"
                description="Candidate codes and confidence are mapped from /api/analyze."
                honestyMarker={model.markers.codeIntelligence}
              >
                <p className="highlight-line">
                  Selected code: <strong>{model.selectedCode.code}</strong> (
                  {model.selectedCode.score.toFixed(3)} confidence score)
                </p>
                <ul className="mono-list">
                  {model.rankedCandidates.map((candidate) => (
                    <li key={candidate.code}>
                      <span>{candidate.code}</span>
                      <span>{candidate.descriptor}</span>
                      <span>{candidate.score.toFixed(3)}</span>
                    </li>
                  ))}
                </ul>
              </PillarStepCard>

              <PillarStepCard
                stepNumber={2}
                title="Payment prediction"
                description="Predicted status indicator and APC are validated against known CMS outcomes."
                honestyMarker={model.markers.cmsValidation}
              >
                <CmsValidationPanel
                  paymentResult={model.paymentResult}
                  honestyMarker={model.markers.cmsValidation}
                />
              </PillarStepCard>

              <PillarStepCard
                stepNumber={3}
                title="Monitoring impact"
                description="Policy-event deltas and alert severity are computed from /api/monitor-impact."
                honestyMarker={model.markers.monitoring}
              >
                <div className="monitoring-layout">
                  <div>
                    <span>Alert severity</span>
                    <strong>{model.monitorResult.alert.severity.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span>Triggered</span>
                    <strong>{model.monitorResult.alert.triggered ? "Yes" : "No"}</strong>
                  </div>
                  <div>
                    <span>Revenue-protection delta</span>
                    <strong>
                      {model.monitorResult.revenueProtectionDelta === null
                        ? "Unknown exposure"
                        : `$${model.monitorResult.revenueProtectionDelta.toLocaleString("en-US")}`}
                    </strong>
                  </div>
                </div>
                <p className="monitor-summary">{model.monitorResult.alert.summary}</p>
              </PillarStepCard>
            </section>

            <RevenueProtectionReveal
              revenueProtectionDelta={model.monitorResult.revenueProtectionDelta}
              mode={model.monitorResult.economicModel.mode}
              economicNote={model.monitorResult.economicModel.note}
              stakesFrame={model.sections["20"]}
              honestyMarker={model.markers.revenueReveal}
            />

            <ProvenanceAffordance entries={model.provenanceEntries} />

            <BusinessModelOverlay
              sections={model.sections}
              honestyMarker={model.markers.businessModelOverlay}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}

async function getJson<T>(input: string, init: RequestInit): Promise<T> {
  const requestInit: RequestInit = {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  };

  const response = await fetch(input, requestInit);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

function dedupeProvenance(entries: readonly ProvenanceEntry[]): readonly ProvenanceEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.source}|${entry.citation}|${entry.observedAt}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

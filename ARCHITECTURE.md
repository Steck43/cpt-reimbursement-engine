# Architecture

## One Engine, Two Surfaces

The project uses one pure TypeScript computation engine and exposes it through:

- API surface (`app/api/*`) for programmatic and route-level verification.
- UI surface (`app/components/demo/*`) for investor walkthrough and narrative framing.

Both surfaces consume the same engine outputs and response envelopes. No separate logic
is allowed in the UI that would diverge from engine behavior.

## Single Deployable, Modular Services

For demo delivery speed, Bursa.ai ships as one deployed Next.js application with five
internal service modules:

- ingestion-service
- code-intelligence-service
- payment-model-service
- monitoring-service
- explainability-service

This keeps integration overhead low while preserving explicit module boundaries for
future service extraction.

## Provider Seam

Data access is abstracted behind provider interfaces:

- `CodeDataProvider` (`CuratedCodeDataProvider`, `AmaLicensedCodeDataProvider` placeholder)
- `PolicyFeedProvider` (`SeededPolicyFeedProvider`, production adapter seam)

The seam allows a license-backed data source swap without rewriting engine logic.

## Honesty-Marker System

Every response envelope includes:

- `result`
- `confidence`
- `provenance`
- `honestyMarkers`

Honesty markers label whether fields are computed, sourced, or simulated. This prevents
mixed-truth presentations and makes demo limitations auditable.

## Computed-Never-Hardcoded Rule

Material outputs must come from runtime computation, not scenario literals. This applies
to candidate ranking, confidence, payment prediction, monitoring outputs, and the
business-model section mapping.

Low-signal inputs route to specialist review instead of emitting fabricated certainty.

## AI-ECG Correction Guardrail

- `0937T` is the `E1` not-payable status-indicator anchor.
- `0764T` is payable and must never be described as the `E1` anchor.

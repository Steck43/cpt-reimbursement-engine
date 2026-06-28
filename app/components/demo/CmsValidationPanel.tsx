"use client";

import type { PaymentModelResult } from "../../lib/demo/services/payment-model-service";
import type { HonestyMarker } from "../../lib/demo/contracts/response-envelope";
import { HonestyMarkerBadge } from "./HonestyMarkerBadge";

type CmsValidationPanelProps = {
  readonly paymentResult: PaymentModelResult;
  readonly honestyMarker: HonestyMarker | null;
};

export type CmsValidationState = "full-match" | "partial-match" | "full-mismatch";

export function deriveCmsValidationState(
  paymentResult: Pick<PaymentModelResult, "statusIndicatorMatch" | "apcMatch" | "hasCmsPrecedent">
): CmsValidationState {
  if (!paymentResult.hasCmsPrecedent) {
    return "partial-match";
  }

  if (paymentResult.statusIndicatorMatch && paymentResult.apcMatch) {
    return "full-match";
  }
  if (paymentResult.statusIndicatorMatch || paymentResult.apcMatch) {
    return "partial-match";
  }
  return "full-mismatch";
}

export function CmsValidationPanel({
  paymentResult,
  honestyMarker,
}: CmsValidationPanelProps) {
  const validationState = deriveCmsValidationState(paymentResult);
  const statusClass =
    validationState === "full-match"
      ? "validation-ok"
      : validationState === "partial-match"
        ? "validation-partial"
        : "validation-risk";

  const actualStatus = paymentResult.actualCmsStatusIndicator ?? "No CMS precedent";
  const actualApc = paymentResult.actualCmsApc ?? "No CMS precedent";
  const headlineLabel =
    validationState === "full-match"
      ? "Validation match confirmed"
      : validationState === "partial-match"
        ? "Partial validation match"
        : "Validation mismatch";

  return (
    <section className="panel cms-validation-panel">
      <header className="cms-validation-header">
        <div>
          <p className="panel-kicker">Prediction validation</p>
          <h2>Predicted vs actual CMS assignment</h2>
        </div>
        <HonestyMarkerBadge marker={honestyMarker} />
      </header>

      <p className={`validation-headline ${statusClass}`}>{headlineLabel}</p>

      <div className="validation-grid">
        <div className="validation-cell">
          <span>Predicted status indicator</span>
          <strong>{paymentResult.predictedStatusIndicator}</strong>
        </div>
        <div className="validation-cell">
          <span>Actual CMS status indicator</span>
          <strong>{actualStatus}</strong>
        </div>
        <div className="validation-cell">
          <span>Predicted APC</span>
          <strong>{paymentResult.predictedApc}</strong>
        </div>
        <div className="validation-cell">
          <span>Actual CMS APC</span>
          <strong>{actualApc}</strong>
        </div>
      </div>

      <p className={`validation-statement ${statusClass}`} data-validation-state={validationState}>
        {paymentResult.validationStatement}
      </p>
    </section>
  );
}

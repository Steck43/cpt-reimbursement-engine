"use client";

import type { HonestyMarker } from "../../lib/demo/contracts/response-envelope";
import { HonestyMarkerBadge } from "./HonestyMarkerBadge";

type RevenueProtectionRevealProps = {
  readonly revenueProtectionDelta: number | null;
  readonly mode: "protectable-delta" | "foregone-revenue-exposure" | "unknown-exposure";
  readonly economicNote: string;
  readonly stakesFrame: string;
  readonly honestyMarker: HonestyMarker | null;
};

export function RevenueProtectionReveal({
  revenueProtectionDelta,
  mode,
  economicNote,
  stakesFrame,
  honestyMarker,
}: RevenueProtectionRevealProps) {
  const kicker =
    mode === "foregone-revenue-exposure"
      ? "Foregone-revenue exposure"
      : mode === "unknown-exposure"
        ? "Exposure unknown"
        : "Revenue-protection reveal";

  const valueLabel =
    revenueProtectionDelta === null
      ? "Exposure unknown (no coding pathway)"
      : `$${Math.max(0, Math.round(revenueProtectionDelta)).toLocaleString("en-US")}`;

  return (
    <section className="panel revenue-reveal">
      <header className="reveal-header">
        <div>
          <p className="panel-kicker">{kicker}</p>
          <h2>The computed investor stakes</h2>
        </div>
        <HonestyMarkerBadge marker={honestyMarker} />
      </header>
      <p className="reveal-stakes">{stakesFrame}</p>
      <p className="reveal-value">{valueLabel}</p>
      <p className="monitor-summary">{economicNote}</p>
    </section>
  );
}

"use client";

import type { HonestyMarker } from "../../lib/demo/contracts/response-envelope";

type HonestyMarkerBadgeProps = {
  readonly marker: HonestyMarker | null;
};

export function HonestyMarkerBadge({ marker }: HonestyMarkerBadgeProps) {
  if (!marker) {
    return null;
  }

  return (
    <div className={`honesty-marker ${marker.mode}`}>
      <span className="honesty-dot" aria-hidden="true" />
      <span>{marker.mode === "computed" ? "Computed" : "Simulated"}</span>
    </div>
  );
}

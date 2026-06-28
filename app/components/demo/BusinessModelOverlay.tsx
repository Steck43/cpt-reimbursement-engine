"use client";

import type { HonestyMarker } from "../../lib/demo/contracts/response-envelope";
import { HonestyMarkerBadge } from "./HonestyMarkerBadge";
import type { BusinessModelSectionNarratives } from "./demo-shell-model";

type BusinessModelOverlayProps = {
  readonly sections: BusinessModelSectionNarratives;
  readonly honestyMarker: HonestyMarker | null;
};

export function BusinessModelOverlay({
  sections,
  honestyMarker,
}: BusinessModelOverlayProps) {
  return (
    <section className="panel business-model-overlay">
      <header className="overlay-header">
        <div>
          <p className="panel-kicker">Business-model overlay</p>
          <h2>Sections 7, 8, and 20 mappings</h2>
        </div>
        <HonestyMarkerBadge marker={honestyMarker} />
      </header>

      <div className="overlay-grid">
        <article>
          <span className="overlay-chip">Section 7</span>
          <p>{sections["7"]}</p>
        </article>
        <article>
          <span className="overlay-chip">Section 8</span>
          <p>{sections["8"]}</p>
        </article>
        <article>
          <span className="overlay-chip">Section 20</span>
          <p>{sections["20"]}</p>
        </article>
      </div>
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import type { HonestyMarker } from "../../lib/demo/contracts/response-envelope";
import { HonestyMarkerBadge } from "./HonestyMarkerBadge";

type PillarStepCardProps = {
  readonly stepNumber: number;
  readonly title: string;
  readonly description: string;
  readonly honestyMarker: HonestyMarker | null;
  readonly children: ReactNode;
};

export function PillarStepCard({
  stepNumber,
  title,
  description,
  honestyMarker,
  children,
}: PillarStepCardProps) {
  return (
    <article className="panel pillar-card">
      <header className="pillar-header">
        <div>
          <p className="panel-kicker">Pipeline step {stepNumber}</p>
          <h2>{title}</h2>
          <p className="pillar-copy">{description}</p>
        </div>
        <HonestyMarkerBadge marker={honestyMarker} />
      </header>
      {children}
    </article>
  );
}

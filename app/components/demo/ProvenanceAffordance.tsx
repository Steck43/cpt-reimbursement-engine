"use client";

import type { ProvenanceEntry } from "../../lib/demo/contracts/response-envelope";

type ProvenanceAffordanceProps = {
  readonly entries: readonly ProvenanceEntry[];
};

export function ProvenanceAffordance({ entries }: ProvenanceAffordanceProps) {
  return (
    <section className="panel provenance-affordance">
      <header>
        <p className="panel-kicker">Computation trace</p>
        <h2>Show your work: source-by-source trail</h2>
        <p className="provenance-intro">
          Every field is traceable to a service computation step and timestamped citation.
        </p>
      </header>
      <ul>
        {entries.map((entry) => (
          <li key={`${entry.source}-${entry.citation}-${entry.observedAt}`}>
            <span>{entry.source}</span>
            <span>{entry.citation}</span>
            <span>{entry.observedAt}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

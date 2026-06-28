export type DemoCodeDatum = {
  readonly code: string;
  readonly descriptor: string;
  readonly codeFamily: string;
  readonly tags: readonly string[];
  readonly statusIndicator: string;
  readonly statusLabel: string;
  readonly apc: string | null;
  readonly apcPayment: number;
  readonly deviceOffsetPct?: number;
  readonly deviceOffsetAmt?: number;
  readonly provenance: string;
};

export interface CodeDataProvider {
  getCodeData(): Promise<readonly DemoCodeDatum[]>;
}

export class UnavailableProviderError extends Error {
  readonly providerName: string;
  readonly reason: string;

  constructor(providerName: string, reason: string) {
    super(`${providerName} is unavailable: ${reason}`);
    this.name = "UnavailableProviderError";
    this.providerName = providerName;
    this.reason = reason;
  }
}

export class CuratedCodeDataProvider implements CodeDataProvider {
  constructor(private readonly curatedData: readonly DemoCodeDatum[]) {}

  async getCodeData(): Promise<readonly DemoCodeDatum[]> {
    return this.curatedData;
  }
}

export class AmaLicensedCodeDataProvider implements CodeDataProvider {
  async getCodeData(): Promise<readonly DemoCodeDatum[]> {
    throw new UnavailableProviderError(
      "AmaLicensedCodeDataProvider",
      "Integrate after AMA license confirmation."
    );
  }
}

export type PolicyFeedEvent = {
  readonly id: string;
  readonly feed: "cms" | "ama" | "mac";
  readonly summary: string;
  readonly effectiveOn: string;
};

export interface PolicyFeedProvider {
  getPolicyEvents(): Promise<readonly PolicyFeedEvent[]>;
}

export class SeededPolicyFeedProvider implements PolicyFeedProvider {
  constructor(private readonly seededEvents: readonly PolicyFeedEvent[]) {}

  async getPolicyEvents(): Promise<readonly PolicyFeedEvent[]> {
    return this.seededEvents;
  }
}

export class ProductionPolicyFeedAdapter implements PolicyFeedProvider {
  async getPolicyEvents(): Promise<readonly PolicyFeedEvent[]> {
    throw new UnavailableProviderError(
      "ProductionPolicyFeedAdapter",
      "Integrate after production policy feed readiness."
    );
  }
}

import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_FLOOR,
  REVIEW_THRESHOLD,
  CONFIDENCE_CONTRIBUTOR_WEIGHTS,
  CONFIDENCE_DERIVATION_POLICY,
  deriveConfidence,
} from "../confidence-policy";
import {
  DESIGN_COLOR_TOKENS,
  SIGNATURE_PRIMITIVES,
  TYPOGRAPHY_TOKENS,
} from "../design-tokens";
import {
  AmaLicensedCodeDataProvider,
  CuratedCodeDataProvider,
  ProductionPolicyFeedAdapter,
  SeededPolicyFeedProvider,
  UnavailableProviderError,
} from "../providers";
import {
  DEMO_RESPONSE_ENVELOPE_KEYS,
  hasExactResponseEnvelopeKeys,
} from "../response-envelope";

describe("foundation contracts", () => {
  it("locks the response envelope key set", () => {
    expect(DEMO_RESPONSE_ENVELOPE_KEYS).toEqual([
      "result",
      "confidence",
      "provenance",
      "honestyMarkers",
    ]);

    expect(
      hasExactResponseEnvelopeKeys({
        result: {},
        confidence: {},
        provenance: [],
        honestyMarkers: [],
      })
    ).toBe(true);

    expect(
      hasExactResponseEnvelopeKeys({
        result: {},
        confidence: {},
        provenance: [],
      })
    ).toBe(false);

    expect(
      hasExactResponseEnvelopeKeys({
        result: {},
        confidence: {},
        provenance: [],
        honestyMarkers: [],
        extra: true,
      })
    ).toBe(false);

    expect(
      hasExactResponseEnvelopeKeys({
        result: {},
        confidence: {},
        sources: [],
        honestyMarkers: [],
      })
    ).toBe(false);

    expect(hasExactResponseEnvelopeKeys(null)).toBe(false);
    expect(hasExactResponseEnvelopeKeys([])).toBe(false);
    expect(hasExactResponseEnvelopeKeys("envelope")).toBe(false);
    expect(hasExactResponseEnvelopeKeys(42)).toBe(false);
  });

  it("keeps confidence policy computed-only with deterministic derivation", () => {
    expect(CONFIDENCE_DERIVATION_POLICY.derivationRule).toBe("computed-only");
    expect(CONFIDENCE_DERIVATION_POLICY.namedContributors).toEqual([
      "descriptorMatch",
      "keywordOverlap",
      "categoryAlignment",
    ]);
    expect(CONFIDENCE_CONTRIBUTOR_WEIGHTS).toEqual({
      descriptorMatch: 0.55,
      keywordOverlap: 0.3,
      categoryAlignment: 0.15,
    });
    expect(CONFIDENCE_FLOOR).toBe(0.04);
    expect(REVIEW_THRESHOLD).toBe(0.3);

    const computed = deriveConfidence({
      descriptorMatch: { score: 0.8, rationale: "descriptor token match" },
      keywordOverlap: { score: 0.7, rationale: "keyword overlap" },
      categoryAlignment: { score: 0.9, rationale: "category alignment" },
    });

    expect(computed.derivation).toBe("computed");
    expect(computed.overall).toBe(0.785);
    expect(computed.contributors.map((item) => item.name)).toEqual([
      "descriptorMatch",
      "keywordOverlap",
      "categoryAlignment",
    ]);
    expect(computed.contributors.map((item) => item.weight)).toEqual([0.55, 0.3, 0.15]);
  });

  it("clamps confidence contributor inputs to valid range", () => {
    const computed = deriveConfidence({
      descriptorMatch: { score: -0.2, rationale: "below minimum" },
      keywordOverlap: { score: 1.5, rationale: "above maximum" },
      categoryAlignment: { score: Number.NaN, rationale: "invalid number" },
    });

    expect(computed.contributors.map((item) => item.score)).toEqual([0, 1, 0]);
    expect(computed.overall).toBe(0.3);
  });

  it("exposes provider seams with typed placeholder errors", async () => {
    const curatedProvider = new CuratedCodeDataProvider([
      {
        code: "0733T",
        title: "Demo code",
        codeFamily: "CPT",
        tags: ["demo"],
      },
    ]);
    const seededProvider = new SeededPolicyFeedProvider([
      {
        id: "cms-1809-fc",
        feed: "cms",
        summary: "Demo policy event",
        effectiveOn: "2025-01-01",
      },
    ]);

    await expect(curatedProvider.getCodeData()).resolves.toHaveLength(1);
    await expect(seededProvider.getPolicyEvents()).resolves.toHaveLength(1);
    await expect(new AmaLicensedCodeDataProvider().getCodeData()).rejects.toBeInstanceOf(
      UnavailableProviderError
    );
    await expect(
      new ProductionPolicyFeedAdapter().getPolicyEvents()
    ).rejects.toBeInstanceOf(UnavailableProviderError);

    const amaError = await new AmaLicensedCodeDataProvider()
      .getCodeData()
      .catch((error) => error as UnavailableProviderError);
    expect(amaError.providerName).toBe("AmaLicensedCodeDataProvider");
    expect(amaError.reason).toMatch(/AMA license confirmation/i);
    expect(amaError.message).toMatch(/unavailable/i);

    const feedError = await new ProductionPolicyFeedAdapter()
      .getPolicyEvents()
      .catch((error) => error as UnavailableProviderError);
    expect(feedError.providerName).toBe("ProductionPolicyFeedAdapter");
    expect(feedError.reason).toMatch(/production policy feed readiness/i);
    expect(feedError.message).toMatch(/unavailable/i);

    await expect(new AmaLicensedCodeDataProvider().getCodeData()).rejects.toThrow(
      /AmaLicensedCodeDataProvider/
    );
  });

  it("locks required design tokens and primitives", () => {
    expect(DESIGN_COLOR_TOKENS.signal).toBe("#34E2C4");
    expect(DESIGN_COLOR_TOKENS.favorable).toBe("#6EE787");
    expect(DESIGN_COLOR_TOKENS.atRisk).toBe("#F0B429");
    expect(DESIGN_COLOR_TOKENS.critical).toBe("#FF6B6B");

    expect(TYPOGRAPHY_TOKENS.display.family).toBe("Fraunces");
    expect(TYPOGRAPHY_TOKENS.body.family).toBe("Geist");
    expect(TYPOGRAPHY_TOKENS.data.family).toBe("Geist Mono");

    expect(SIGNATURE_PRIMITIVES.map((item) => item.id)).toEqual([
      "honesty-marker",
      "provenance-affordance",
      "prediction-validation",
      "revenue-protection-reveal",
    ]);
  });
});

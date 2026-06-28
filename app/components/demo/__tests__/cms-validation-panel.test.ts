import { describe, expect, it } from "vitest";
import { deriveCmsValidationState } from "../CmsValidationPanel";

describe("deriveCmsValidationState", () => {
  it("returns full-match only when both checks match", () => {
    expect(
      deriveCmsValidationState({
        hasCmsPrecedent: true,
        statusIndicatorMatch: true,
        apcMatch: true,
      })
    ).toBe("full-match");
  });

  it("returns partial-match when exactly one check matches", () => {
    expect(
      deriveCmsValidationState({
        hasCmsPrecedent: true,
        statusIndicatorMatch: true,
        apcMatch: false,
      })
    ).toBe("partial-match");
    expect(
      deriveCmsValidationState({
        hasCmsPrecedent: true,
        statusIndicatorMatch: false,
        apcMatch: true,
      })
    ).toBe("partial-match");
  });

  it("returns full-mismatch when both checks fail", () => {
    expect(
      deriveCmsValidationState({
        hasCmsPrecedent: true,
        statusIndicatorMatch: false,
        apcMatch: false,
      })
    ).toBe("full-mismatch");
  });

  it("returns partial-match when no CMS precedent is available", () => {
    expect(
      deriveCmsValidationState({
        hasCmsPrecedent: false,
        statusIndicatorMatch: false,
        apcMatch: false,
      })
    ).toBe("partial-match");
  });
});

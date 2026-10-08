import { describe, expect, it } from "vitest";

import { CURATED_CODE_DATA } from "../data/curated-codes";

describe("curated code provenance", () => {
  it("locks 0937T status indicator and CMS provenance against empty or junk values", () => {
    const code0937T = CURATED_CODE_DATA.find((entry) => entry.code === "0937T");

    expect(code0937T).toBeDefined();
    expect(code0937T?.statusIndicator).toBe("E1");
    expect(code0937T?.statusLabel).toBe("Not paid under OPPS");
    expect(code0937T?.provenance.trim().length).toBeGreaterThan(0);
    expect(code0937T?.provenance).toBe("2025 OPPS Addendum B");
    expect(code0937T?.statusIndicator).not.toMatch(/junk|asdf|xx/i);
    expect(code0937T?.provenance).not.toMatch(/junk|asdf|placeholder/i);
  });
});

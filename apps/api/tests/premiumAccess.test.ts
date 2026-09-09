import { describe, expect, it } from "vitest";

import { hasPremiumAccess } from "../src/utils/premiumAccess.ts";

describe("hasPremiumAccess", () => {
  it("uses a conservative allow-list", () => {
    expect(hasPremiumAccess("active")).toBe(true);
    for (const status of ["trialing", "past_due", "paused", "canceled", "unpaid", "incomplete", null]) {
      expect(hasPremiumAccess(status)).toBe(false);
    }
  });
});

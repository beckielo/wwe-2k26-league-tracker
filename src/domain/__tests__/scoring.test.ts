import { describe, expect, it } from "vitest";
import { calculatePoints } from "../scoring";

describe("calculatePoints", () => {
  it("awards three points for a win and one for a draw", () => {
    expect(calculatePoints(7, 2)).toBe(23);
  });

  it("rejects negative or fractional records", () => {
    expect(() => calculatePoints(-1, 0)).toThrow();
    expect(() => calculatePoints(1.5, 0)).toThrow();
  });
});

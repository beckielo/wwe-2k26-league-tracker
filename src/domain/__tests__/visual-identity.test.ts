import { describe, expect, it } from "vitest";
import { LEAGUE_NAMES } from "../types";
import { LEAGUE_VISUALS, placementZone } from "../visual-identity";

describe("Phase 10.5 visual identity", () => {
  it("defines a distinct visual token for all four leagues", () => {
    expect(Object.keys(LEAGUE_VISUALS)).toEqual(LEAGUE_NAMES);
    expect(new Set(Object.values(LEAGUE_VISUALS).map((visual) => visual.key)).size).toBe(4);
  });

  it("classifies each live-table rank without changing competition logic", () => {
    expect(placementZone(1)).toBe("rank-1");
    expect(placementZone(2)).toBe("rank-2");
    expect(placementZone(3)).toBe("rank-3");
    expect(placementZone(4)).toBe("rank-4");
    expect([5, 6, 7, 8].map(placementZone)).toEqual(["mid-table", "mid-table", "mid-table", "mid-table"]);
    expect(placementZone(9)).toBe("rank-9");
    expect(placementZone(10)).toBe("rank-10");
    expect(placementZone(11)).toBe("rank-11");
    expect(placementZone(12)).toBe("rank-12");
  });

  it("rejects ranks outside a twelve-wrestler league", () => {
    expect(() => placementZone(0)).toThrow(RangeError);
    expect(() => placementZone(13)).toThrow(RangeError);
  });
});

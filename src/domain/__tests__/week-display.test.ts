import { describe, expect, it } from "vitest";
import { getWeekDisplay } from "../week-display";

describe("split-relative week display", () => {
  it("displays Opening Split Year Week 1 as Opening Split Week 1", () => {
    expect(getWeekDisplay(2, 1)).toMatchObject({
      primary: "Opening Split Week 1",
      compact: "Opening Split · Week 1",
      secondary: "League Year 2 · Year Week 1",
    });
  });

  it("displays Closing Split Year Week 25 primarily as Closing Split Week 1", () => {
    const display = getWeekDisplay(2, 25);
    expect(display.primary).toBe("Closing Split Week 1");
    expect(display.primary).not.toContain("25");
    expect(display.secondary).toBe("League Year 2 · Year Week 25");
  });
});

import { describe, it, expect } from "vitest";
import { calculateExtraActions } from "../speed";

describe("calculateExtraActions", () => {
  it("returns 0 extras when speeds are equal", () => {
    expect(calculateExtraActions(100, 100)).toEqual({ extraA: 0, extraB: 0 });
  });

  it("returns 0 extras when ratio < 2", () => {
    expect(calculateExtraActions(100, 60)).toEqual({ extraA: 0, extraB: 0 });
    expect(calculateExtraActions(150, 80)).toEqual({ extraA: 0, extraB: 0 });
  });

  it("returns 1 extra when ratio = 2 exactly", () => {
    expect(calculateExtraActions(100, 50)).toEqual({ extraA: 1, extraB: 0 });
  });

  it("returns 1 extra when ratio between 2 and 4", () => {
    expect(calculateExtraActions(100, 40)).toEqual({ extraA: 1, extraB: 0 });
    expect(calculateExtraActions(100, 30)).toEqual({ extraA: 1, extraB: 0 });
  });

  it("returns 2 extras when ratio = 4 exactly", () => {
    expect(calculateExtraActions(100, 25)).toEqual({ extraA: 2, extraB: 0 });
  });

  it("returns 2 extras when ratio between 4 and 8", () => {
    expect(calculateExtraActions(100, 20)).toEqual({ extraA: 2, extraB: 0 });
  });

  it("returns 3 extras when ratio = 8 exactly", () => {
    const result = calculateExtraActions(800, 100);
    expect(result).toEqual({ extraA: 3, extraB: 0 });
  });

  it("caps at 3 extras when ratio > 8", () => {
    expect(calculateExtraActions(1000, 5)).toEqual({ extraA: 3, extraB: 0 });
    expect(calculateExtraActions(9999, 1)).toEqual({ extraA: 3, extraB: 0 });
  });

  it("assigns extras to B when speedB > speedA", () => {
    expect(calculateExtraActions(50, 100)).toEqual({ extraA: 0, extraB: 1 });
    expect(calculateExtraActions(25, 100)).toEqual({ extraA: 0, extraB: 2 });
  });

  it("returns 0 extras when speedA = 0", () => {
    expect(calculateExtraActions(0, 100)).toEqual({ extraA: 0, extraB: 0 });
  });

  it("returns 0 extras when speedB = 0", () => {
    expect(calculateExtraActions(100, 0)).toEqual({ extraA: 0, extraB: 0 });
  });

  it("returns 0 extras when both speeds are 0", () => {
    expect(calculateExtraActions(0, 0)).toEqual({ extraA: 0, extraB: 0 });
  });
});

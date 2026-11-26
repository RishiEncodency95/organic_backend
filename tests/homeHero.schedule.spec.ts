import { describe, expect, it } from "vitest";
import {
  isSlideActive,
  isSlideActiveAt,
  parseScheduleDateTime,
  validateSlideSchedule,
} from "../src/modules/website/home/homeHero/homeHero.schedule";

// 2026-11-05 10:00 IST === 2026-11-05 04:30 UTC, whatever timezone the test machine runs in.
const IST_10AM = Date.UTC(2026, 10, 5, 4, 30, 0, 0);

describe("hero banner schedule (IST)", () => {
  it("reads date + time as IST, independent of the server timezone", () => {
    expect(parseScheduleDateTime("2026-11-05", "10:00")).toBe(IST_10AM);
  });

  it("accepts both YYYY-MM-DD and DD-MM-YYYY", () => {
    expect(parseScheduleDateTime("05-11-2026", "10:00")).toBe(IST_10AM);
  });

  it("start defaults to 00:00 IST and end defaults to 23:59:59.999 IST", () => {
    expect(parseScheduleDateTime("2026-11-05", "", false)).toBe(Date.UTC(2026, 10, 4, 18, 30, 0, 0));
    expect(parseScheduleDateTime("2026-11-05", "", true)).toBe(Date.UTC(2026, 10, 5, 18, 29, 59, 999));
  });

  it("returns null for empty or invalid input", () => {
    expect(parseScheduleDateTime("", "10:00")).toBeNull();
    expect(parseScheduleDateTime(undefined, undefined)).toBeNull();
    expect(parseScheduleDateTime("2026/11/05", "10:00")).toBeNull();
    expect(parseScheduleDateTime("abcd-ef-gh", "10:00")).toBeNull();
  });

  it("slide without schedule is always active", () => {
    expect(isSlideActive({ isScheduled: false, startDate: "2099-01-01" })).toBe(true);
  });

  it("is inactive before start and active from the start instant", () => {
    const slide = { isScheduled: true, startDate: "2026-11-05", startTime: "10:00" };
    expect(isSlideActiveAt(slide, IST_10AM - 1)).toBe(false);
    expect(isSlideActiveAt(slide, IST_10AM)).toBe(true);
  });

  it("is active through the end day and inactive right after", () => {
    const slide = { isScheduled: true, endDate: "2026-11-05" };
    const endOfDay = Date.UTC(2026, 10, 5, 18, 29, 59, 999);
    expect(isSlideActiveAt(slide, endOfDay)).toBe(true);
    expect(isSlideActiveAt(slide, endOfDay + 1)).toBe(false);
  });

  it("is safe to pass straight to Array.filter (index must not be read as the time)", () => {
    const liveNow = { isScheduled: true, startDate: "2000-01-01", endDate: "2999-12-31" };
    const notYet = { isScheduled: true, startDate: "2999-01-01" };
    expect([liveNow, notYet, { isScheduled: false }].filter(isSlideActive)).toEqual([liveNow, { isScheduled: false }]);
  });

  it("scheduled slide with no dates stays active", () => {
    expect(isSlideActive({ isScheduled: true })).toBe(true);
  });

  it("flags an end that is before the start", () => {
    expect(
      validateSlideSchedule({
        isScheduled: true,
        startDate: "2026-11-10",
        endDate: "2026-11-05",
      })
    ).not.toBeNull();
    expect(
      validateSlideSchedule({
        isScheduled: true,
        startDate: "2026-11-05",
        endDate: "2026-11-10",
      })
    ).toBeNull();
    expect(validateSlideSchedule({ isScheduled: false, startDate: "2026-11-10", endDate: "2026-11-05" })).toBeNull();
  });
});

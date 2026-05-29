import { describe, expect, it } from "vitest";
import {
  DEFAULT_CRON_TIMES,
  computeNextRunAt,
  reportDateFromRunAt,
} from "./time";

describe("schedule time helpers", () => {
  it("computes the next run in the selected browser timezone", () => {
    const from = new Date("2026-05-29T15:20:00.000Z");
    const next = computeNextRunAt("23:21", from, "Asia/Shanghai");

    expect(next.toISOString()).toBe("2026-05-29T15:21:00.000Z");
  });

  it("cycles through the three default Beijing report times", () => {
    expect(
      computeNextRunAt(
        DEFAULT_CRON_TIMES,
        new Date("2026-05-29T00:59:00.000Z"),
        "Asia/Shanghai",
      ).toISOString(),
    ).toBe("2026-05-29T01:00:00.000Z");
    expect(
      computeNextRunAt(
        DEFAULT_CRON_TIMES,
        new Date("2026-05-29T01:00:00.000Z"),
        "Asia/Shanghai",
      ).toISOString(),
    ).toBe("2026-05-29T06:00:00.000Z");
    expect(
      computeNextRunAt(
        DEFAULT_CRON_TIMES,
        new Date("2026-05-29T14:00:00.000Z"),
        "Asia/Shanghai",
      ).toISOString(),
    ).toBe("2026-05-30T01:00:00.000Z");
  });

  it("keeps midnight times and report dates in the schedule timezone", () => {
    const from = new Date("2026-05-29T15:20:00.000Z");
    const next = computeNextRunAt("00:30", from, "Asia/Shanghai");

    expect(next.toISOString()).toBe("2026-05-29T16:30:00.000Z");
    expect(reportDateFromRunAt(next, "Asia/Shanghai")).toBe("2026-05-30");
  });
});

import { describe, expect, it } from "vitest";
import { greetingAt } from "./greeting";

describe("Teacher Home greeting", () => {
  it("uses the school's local time at the morning, afternoon and evening boundaries", () => {
    const kampala = "Africa/Kampala";
    expect(greetingAt(new Date("2026-09-29T08:59:00Z"), kampala)).toBe("Good morning");
    expect(greetingAt(new Date("2026-09-29T09:00:00Z"), kampala)).toBe("Good afternoon");
    expect(greetingAt(new Date("2026-09-29T13:59:00Z"), kampala)).toBe("Good afternoon");
    expect(greetingAt(new Date("2026-09-29T14:00:00Z"), kampala)).toBe("Good evening");
  });
});

import { describe, expect, it } from "vitest";
import { continuityStateFor, requiresReason } from "@/classroom-continuity/domain/projection";

describe("classroom continuity projection", () => {
  it("keeps future lessons scheduled when no event exists", () => expect(continuityStateFor(null, false)).toBe("SCHEDULED"));
  it("derives unconfirmed only after the lesson has ended", () => expect(continuityStateFor(null, true)).toBe("UNCONFIRMED"));
  it("projects operational carry-forward without claiming curriculum coverage", () => {
    expect(continuityStateFor("PARTIALLY_DELIVERED", true)).toBe("PARTIAL_CARRY_FORWARD");
    expect(continuityStateFor("NOT_DELIVERED", true)).toBe("NOT_DELIVERED_CARRY_FORWARD");
    expect(continuityStateFor("CHANGED", true)).toBe("CHANGED_REVIEW");
  });
  it("requires extra context only for outcomes that need it", () => {
    expect(requiresReason("DELIVERED")).toBe(false);
    expect(requiresReason("PARTIALLY_DELIVERED")).toBe(false);
    expect(requiresReason("NOT_DELIVERED")).toBe(true);
    expect(requiresReason("CHANGED")).toBe(true);
  });
});

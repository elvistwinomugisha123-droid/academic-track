import { describe, expect, it } from "vitest";
import { classifyStreamDrift } from "./stream-drift";

describe("stream drift", () => {
  it("treats the same governed position as aligned", () => {
    expect(classifyStreamDrift({ canonicalId: "topic-a" }, { canonicalId: "topic-a" }, ["topic-a", "topic-b"])).toBe("ALIGNED");
  });

  it("uses governed ordering for adjacent positions", () => {
    expect(classifyStreamDrift({ canonicalId: "topic-a" }, { canonicalId: "topic-b" }, ["topic-a", "topic-b"])).toBe("ONE_POSITION_APART");
  });

  it("uses the full governed sequence for positions two apart", () => {
    expect(classifyStreamDrift({ canonicalId: "topic-a" }, { canonicalId: "topic-c" }, ["topic-a", "topic-b", "topic-c"])).toBe("TWO_OR_MORE_POSITIONS_APART");
  });

  it("does not compare unrelated subject profiles", () => {
    expect(classifyStreamDrift({ canonicalId: "topic-a", profileId: "biology-2026" }, { canonicalId: "topic-b", profileId: "biology-2019" }, ["topic-a", "topic-b"])).toBe("UNKNOWN");
  });

  it("does not infer alignment without usable position data", () => {
    expect(classifyStreamDrift({ canonicalId: "topic-a" }, { canonicalId: "topic-b" }, null)).toBe("UNKNOWN");
  });
});

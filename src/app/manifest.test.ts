import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("ATE web app manifest", () => {
  it("is installable and launches through the authenticated workspace route", () => {
    const value = manifest();
    expect(value).toMatchObject({ name: "Academic Track Engine", short_name: "ATE", start_url: "/workspace", scope: "/", display: "standalone", theme_color: "#0b1f3a" });
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/ate.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }),
      expect.objectContaining({ src: "/icons/ate-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }),
    ]));
  });
});

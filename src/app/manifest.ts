import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/workspace", name: "Academic Track Engine", short_name: "ATE",
    description: "Teacher-first academic continuity and curriculum implementation.",
    start_url: "/workspace", scope: "/", display: "standalone", orientation: "any",
    background_color: "#f7f8fa", theme_color: "#0b1f3a",
    icons: [
      { src: "/icons/ate.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/ate-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Teacher Home", short_name: "Home", url: "/workspace", icons: [{ src: "/icons/ate.svg", sizes: "any", type: "image/svg+xml" }] }],
  };
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() { return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }]; },
  outputFileTracingIncludes: {
    "/api/teacher/lessons/*/artifacts/*/pdf": ["node_modules/pdfkit/js/standard-fonts/**/*"],
    "/api/teacher/assessments/*/pdf": ["node_modules/pdfkit/js/standard-fonts/**/*"],
  },
};
export default nextConfig;

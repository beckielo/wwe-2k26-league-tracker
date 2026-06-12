import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./source-docs/**/*.xlsx"],
  },
};

export default nextConfig;

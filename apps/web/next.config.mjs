import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const apiGatewayUrl = process.env.API_GATEWAY_URL?.trim();
if (!apiGatewayUrl) {
  throw new Error("API_GATEWAY_URL is required for Next.js API rewrites.");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@videoai/contracts"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiGatewayUrl}/api/v1/:path*`
      }
    ];
  }
};

export default nextConfig;

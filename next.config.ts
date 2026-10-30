import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // set NEXT_DIST_DIR to build somewhere other than .next (used for testing beside a running app)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;

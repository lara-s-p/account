import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (base local de desarrollo) usa WebAssembly y no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;

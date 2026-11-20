import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (banco embutido de desenvolvimento) precisa rodar como pacote Node puro
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

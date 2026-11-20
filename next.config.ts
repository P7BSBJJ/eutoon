import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (banco embutido de desenvolvimento) precisa rodar como pacote Node puro
  serverExternalPackages: ["@electric-sql/pglite"],
  // as migrações SQL são lidas em tempo de execução: inclui a pasta no pacote publicado (Vercel)
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
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

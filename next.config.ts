import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Painel de moderação de denúncias (public/moderacao/index.html) — fica
  // fora do app (React) de propósito, é HTML puro que só fala com
  // /api/reports. Esse rewrite só deixa acessar por /moderacao em vez de
  // precisar digitar /moderacao/index.html.
  async rewrites() {
    return [{ source: "/moderacao", destination: "/moderacao/index.html" }];
  },
};

export default nextConfig;

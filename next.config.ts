import type { NextConfig } from "next";

// ── Validación de variables críticas de entorno ─────────────────────────────
const criticalEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

for (const envVar of criticalEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`[Config Warning] La variable de entorno crítica '${envVar}' no está definida.`);
  }
}

const nextConfig: NextConfig = {
  turbopack: {},
  async rewrites() {
    return [
      {
        source: '/iclock/cdata',
        destination: '/api/zkteco/push?source_path=cdata',
      },
      {
        source: '/iclock/getrequest',
        destination: '/api/zkteco/push?cmd=getrequest&source_path=getrequest',
      },
      {
        source: '/iclock/devicecmd',
        destination: '/api/zkteco/push?source_path=devicecmd',
      },
    ];
  },
};

export default nextConfig;

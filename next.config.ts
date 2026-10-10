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

const zktecoApiKey = (process.env.ZKTECO_API_KEY || '').trim();

// Si está definida la clave ZKTeco, requerir autenticación por header en los rewrites de /iclock/*
const zktecoAuthCondition = zktecoApiKey
  ? [
      {
        type: 'header' as const,
        key: 'x-api-key',
        value: zktecoApiKey,
      },
    ]
  : undefined;

const nextConfig: NextConfig = {
  turbopack: {},
  async rewrites() {
    return [
      {
        source: '/iclock/cdata',
        destination: '/api/zkteco/push?source_path=cdata',
        ...(zktecoAuthCondition ? { has: zktecoAuthCondition } : {}),
      },
      {
        source: '/iclock/getrequest',
        destination: '/api/zkteco/push?cmd=getrequest&source_path=getrequest',
        ...(zktecoAuthCondition ? { has: zktecoAuthCondition } : {}),
      },
      {
        source: '/iclock/devicecmd',
        destination: '/api/zkteco/push?source_path=devicecmd',
        ...(zktecoAuthCondition ? { has: zktecoAuthCondition } : {}),
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/iclock/cdata',
        destination: '/api/zkteco/push',
      },
      {
        source: '/iclock/getrequest',
        destination: '/api/zkteco/push',
      },
    ];
  },
};

export default nextConfig;

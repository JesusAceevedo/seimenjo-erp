import type { NextConfig } from "next";

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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/bin-scanner", destination: "/bin-sniper", permanent: true },
    ];
  },
};

export default nextConfig;

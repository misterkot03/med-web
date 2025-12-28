import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // другие твои настройки...

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

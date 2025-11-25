import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    // Disable Vercel image optimization for Bungie images to avoid 402 errors
    // Bungie's CDN already serves optimized images
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.bungie.net',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;

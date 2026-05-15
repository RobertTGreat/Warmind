import type { NextConfig } from "next";
import path from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: path.join(__dirname),
  },
  
  // Experimental features for performance
  experimental: {
    // Inline critical CSS to reduce render-blocking requests
    optimizeCss: true,
    // Optimize imports from large packages (tree-shaking)
    optimizePackageImports: [
      'lucide-react',
      'date-fns', 
      'framer-motion',
      'sonner',
      'zustand',
      'swr',
      '@supabase/supabase-js',
    ],
  },
  
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
      {
        protocol: 'https',
        hostname: 'images.contentstack.io',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 31536000,
  },
  
  // Cache headers for static assets
  async headers() {
    return [
      {
        // Immutable assets (JS/CSS with content hash) - cache for 1 year
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Static files in public folder (images, fonts, icons)
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Manifest and other JSON config files
        source: '/:path*.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Service worker should not be cached
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

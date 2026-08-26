import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript-compiled CJS; Next must transpile them so
  // they participate in the app's module graph and tree-shaking.
  transpilePackages: ['@vedaai/shared', '@vedaai/database'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
    ],
  },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;

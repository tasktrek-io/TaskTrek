/** @type {import('next').NextConfig} */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.env.NODE_ENV === 'production' ? join(__dirname, '../../') : undefined,
  experimental: {
    outputFileTracingRoot: process.env.NODE_ENV === 'production' ? join(__dirname, '../../') : undefined
  },
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript checking during production builds
    ignoreBuildErrors: false,
  }
}

export default nextConfig

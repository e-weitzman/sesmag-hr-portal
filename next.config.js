/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't try to fetch/optimize Google Fonts at build time
  // They load normally at browser runtime via CSS @import
  optimizeFonts: false,
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },
}

module.exports = nextConfig

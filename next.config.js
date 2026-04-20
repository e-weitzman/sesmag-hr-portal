/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for @neondatabase/serverless WebSocket support on Vercel Edge
  serverExternalPackages: ['@neondatabase/serverless'],
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/**/*': ['./data/scans.json'],
    '/**/*': ['./data/scans.json'],
  },
};

export default nextConfig;

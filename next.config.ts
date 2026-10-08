import type { NextConfig } from 'next';



const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Old marketing URLs consolidate into the catalogue landings (permanent, so search engines move their
  // signals to the new pages instead of indexing near-duplicates).
  async redirects() {
    return [
      { source: '/social', destination: '/services', permanent: true },
      { source: '/social/x', destination: '/services', permanent: true },
      { source: '/social/:channel(instagram|telegram|tiktok|youtube)', destination: '/services/:channel', permanent: true },
      { source: '/services/social/instagram-services', destination: '/services/instagram', permanent: true },
      { source: '/services/social', destination: '/services', permanent: true },
    ];
  },
};

export default nextConfig;

const nextConfig = {
  output: "standalone",
  turbopack: {},
  transpilePackages: [
    "@agent-chat/react",
    "@agent-chat/server-core",
    "@agent-chat/server-next",
  ],
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

module.exports = nextConfig;

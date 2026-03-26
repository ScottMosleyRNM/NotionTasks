import path from "path";

const nextConfig = {
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(".");
    return config;
  },
};

export default nextConfig;

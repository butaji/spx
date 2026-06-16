import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { readFileSync, existsSync } from "fs";

const host = process.env.TAURI_DEV_HOST;

function getHttpsConfig() {
  const useHttps = process.env.VITE_HTTPS === "1";
  if (!useHttps) return undefined;

  const certPath = process.env.VITE_HTTPS_CERT || ".cert/cert.pem";
  const keyPath = process.env.VITE_HTTPS_KEY || ".cert/key.pem";

  if (!existsSync(certPath) || !existsSync(keyPath)) {
    console.warn("[Vite] HTTPS enabled but cert/key not found, falling back to HTTP");
    return undefined;
  }

  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  };
}

export default defineConfig(async () => ({
  plugins: [preact()],
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  clearScreen: false,
  server: {
    port: parseInt(process.env.VITE_DEV_PORT || "1420"),
    strictPort: true,
    allowedHosts: host ? [host] : ['localhost', '127.0.0.1', '192.168.1.32'],
    host: host || process.env.VITE_HOST || false,
    https: getHttpsConfig(),
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

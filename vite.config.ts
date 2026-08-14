import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Ensure WeakRef exists before Vite SSR / RSC deps load.
  if (typeof globalThis.WeakRef === "undefined") {
    // @ts-expect-error local polyfill for incomplete runtimes
    globalThis.WeakRef = class WeakRef {
      #v: unknown;
      constructor(v: unknown) {
        this.#v = v;
      }
      deref() {
        return this.#v;
      }
    };
  }

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        configPath: "./wrangler.toml",
      }),
    ],
  };
});

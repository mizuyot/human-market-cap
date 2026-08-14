/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { withSecurityHeaders } from "../app/security-headers";

// Some local SSR / workerd paths miss WeakRef; React RSC needs it.
if (typeof WeakRef === "undefined") {
  // eslint-disable-next-line no-global-assign -- local runtime polyfill
  globalThis.WeakRef = class WeakRef<T extends WeakKey> {
    #value: T | undefined;
    constructor(value: T) {
      this.#value = value;
    }
    deref(): T | undefined {
      return this.#value;
    }
  } as typeof WeakRef;
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      if (!env.IMAGES) {
        const assetPath = url.searchParams.get("url");
        if (assetPath) return env.ASSETS.fetch(new Request(new URL(assetPath, request.url)));
        return new Response("Image optimization unavailable", { status: 503 });
      }
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES!.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response);
  },
};

export default worker;

declare type D1Database = any;

declare interface Fetcher {
  fetch(input: Request): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: Record<string, any>;
}

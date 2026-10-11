import { createMetaWebhookHandler } from "./webhook-core.mjs";

// Meta calls this public endpoint without a Supabase JWT.
// Both operations authenticate independently:
// GET via the verify token, POST via Meta's HMAC-SHA256 signature.
Deno.serve(createMetaWebhookHandler((name: string) => Deno.env.get(name) ?? ""));

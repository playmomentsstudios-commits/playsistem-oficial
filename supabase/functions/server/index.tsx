import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { sign, verify } from "npm:hono/jwt";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "play-moments-secret-change-in-production";

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(c: any, data: any, status = 200) {
  return c.json({ success: true, data }, status);
}
function err(c: any, message: string, status = 400) {
  return c.json({ success: false, message }, status);
}

async function authMiddleware(c: any, next: any) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return err(c, "Unauthorized", 401);
  try {
    const token = auth.slice(7);
    if (token.startsWith("demo_")) {
      // Demo tokens — skip JWT verification in dev
      c.set("userId", token.split("_")[1] + "_" + token.split("_")[2]);
      return next();
    }
    const payload = await verify(token, JWT_SECRET);
    c.set("userId", payload.sub);
    c.set("userRole", payload.role);
    return next();
  } catch {
    return err(c, "Invalid token", 401);
  }
}

async function adminMiddleware(c: any, next: any) {
  const role = c.get("userRole");
  if (role !== "admin" && role !== "staff") return err(c, "Forbidden", 403);
  return next();
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/make-server-89b8ead1/health", (c) => c.json({ status: "ok" }));

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post("/auth/register", async (c) => {
  const body = await c.req.json();
  const { name, lastName, email, password, phone } = body;
  if (!email || !password || !name) return err(c, "Campos obrigatórios faltando");

  const existingUsers = (await kv.get("users")) || [];
  if (existingUsers.find((u: any) => u.email === email)) {
    return err(c, "E-mail já cadastrado");
  }

  const user = {
    id: `user-${Date.now()}`,
    email,
    name,
    lastName,
    phone,
    role: "customer",
    status: "active",
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kv.set("users", [...existingUsers, user]);

  const { passwordHash: _, ...safeUser } = user;
  const token = await sign({ sub: user.id, role: user.role }, JWT_SECRET);
  return ok(c, { token, user: safeUser }, 201);
});

app.post("/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return err(c, "E-mail e senha são obrigatórios");

  const users = (await kv.get("users")) || [];
  const user = users.find((u: any) => u.email === email);
  if (!user) return err(c, "E-mail ou senha incorretos", 401);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return err(c, "E-mail ou senha incorretos", 401);

  const { passwordHash: _, ...safeUser } = user;
  const token = await sign({ sub: user.id, role: user.role }, JWT_SECRET);

  // Update last access
  await kv.set("users", users.map((u: any) =>
    u.id === user.id ? { ...u, lastAccessAt: new Date().toISOString() } : u
  ));

  return ok(c, { token, user: safeUser });
});

app.get("/auth/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const users = (await kv.get("users")) || [];
  const user = users.find((u: any) => u.id === userId);
  if (!user) return err(c, "User not found", 404);
  const { passwordHash: _, ...safeUser } = user;
  return ok(c, safeUser);
});

// ── Products ──────────────────────────────────────────────────────────────────

app.get("/products", async (c) => {
  const products = (await kv.get("products")) || [];
  const featured = c.req.query("featured");
  const filtered = featured ? products.filter((p: any) => p.featured && p.active) : products.filter((p: any) => p.active);
  return ok(c, { data: filtered, total: filtered.length, page: 1, limit: 50, hasMore: false });
});

app.post("/products", authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const products = (await kv.get("products")) || [];
  const product = { id: `prod-${Date.now()}`, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await kv.set("products", [...products, product]);
  return ok(c, product, 201);
});

app.put("/products/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const products = (await kv.get("products")) || [];
  const updated = products.map((p: any) => p.id === id ? { ...p, ...body, updatedAt: new Date().toISOString() } : p);
  await kv.set("products", updated);
  return ok(c, updated.find((p: any) => p.id === id));
});

// ── Services ──────────────────────────────────────────────────────────────────

app.get("/services", async (c) => {
  const services = (await kv.get("services")) || [];
  const featured = c.req.query("featured");
  const filtered = featured ? services.filter((s: any) => s.featured && s.active) : services.filter((s: any) => s.active);
  return ok(c, { data: filtered, total: filtered.length, page: 1, limit: 50, hasMore: false });
});

app.post("/services", authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const services = (await kv.get("services")) || [];
  const service = { id: `svc-${Date.now()}`, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await kv.set("services", [...services, service]);
  return ok(c, service, 201);
});

// ── Orders ────────────────────────────────────────────────────────────────────

app.get("/orders", authMiddleware, async (c) => {
  const orders = (await kv.get("orders")) || [];
  const userId = c.get("userId");
  const role = c.get("userRole");
  const userOrders = role === "admin" || role === "staff" ? orders : orders.filter((o: any) => o.customerId === userId);
  return ok(c, { data: userOrders, total: userOrders.length, page: 1, limit: 50, hasMore: false });
});

app.post("/orders", authMiddleware, async (c) => {
  const body = await c.req.json();
  const orders = (await kv.get("orders")) || [];
  const count = orders.length + 1;
  const order = {
    id: `order-${Date.now()}`,
    orderNumber: `PM-${String(count).padStart(6, "0")}`,
    customerId: c.get("userId"),
    ...body,
    status: "pending",
    paymentStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set("orders", [...orders, order]);
  return ok(c, order, 201);
});

app.patch("/orders/:id/status", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const { status } = await c.req.json();
  const orders = (await kv.get("orders")) || [];
  const updated = orders.map((o: any) => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o);
  await kv.set("orders", updated);
  return ok(c, updated.find((o: any) => o.id === id));
});

// Support chat uses Supabase tables with RLS (see src/api/conversations.ts).
// Legacy KV chat endpoints retired to avoid a second, incompatible inbox.

// ── Posts ─────────────────────────────────────────────────────────────────────

app.get("/posts", async (c) => {
  const posts = (await kv.get("posts")) || [];
  const active = posts.filter((p: any) => p.active !== false);
  return ok(c, { data: active, total: active.length, page: 1, limit: 20, hasMore: false });
});

app.post("/posts", authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const posts = (await kv.get("posts")) || [];
  const post = {
    id: `post-${Date.now()}`,
    authorId: c.get("userId"),
    ...body,
    reactions: {},
    commentsCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set("posts", [post, ...posts]);
  return ok(c, post, 201);
});

app.post("/posts/:id/reactions", authMiddleware, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");
  const { emoji } = await c.req.json();

  const posts = (await kv.get("posts")) || [];
  const post = posts.find((p: any) => p.id === postId);
  if (!post) return err(c, "Post not found", 404);

  const userReactions = (await kv.get(`reactions:${userId}`)) || {};
  const current = userReactions[postId];

  const reactions = { ...post.reactions };
  if (current) reactions[current] = Math.max(0, (reactions[current] || 1) - 1);
  if (current !== emoji) {
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    userReactions[postId] = emoji;
  } else {
    delete userReactions[postId];
  }

  await kv.set("posts", posts.map((p: any) => p.id === postId ? { ...p, reactions } : p));
  await kv.set(`reactions:${userId}`, userReactions);

  return ok(c, { reactions });
});

// ── Settings ──────────────────────────────────────────────────────────────────

app.get("/settings", async (c) => {
  const settings = await kv.get("siteSettings") || {
    companyName: "Play Moments",
    description: "Studio criativo de vídeo, design e tecnologia.",
    primaryColor: "#E30613",
    heroHeadline: "Criamos momentos que ficam.",
    heroCta: "Explorar serviços",
    socialLinks: {},
    contact: {},
    updatedAt: new Date().toISOString(),
  };
  return ok(c, settings);
});

app.put("/settings", authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const current = await kv.get("siteSettings") || {};
  const updated = { ...current, ...body, updatedAt: new Date().toISOString() };
  await kv.set("siteSettings", updated);
  return ok(c, updated);
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get("/notifications", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const all = (await kv.get(`notifications:${userId}`)) || [];
  return ok(c, all);
});

// ── Password helpers (simple bcrypt-like using Web Crypto) ───────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [saltHex, _] = stored.split(":");
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
    return stored === `${saltHex}:${hashHex}`;
  } catch {
    return false;
  }
}

Deno.serve(app.fetch);

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const webhook=fs.readFileSync("supabase/functions/asaas-webhook/index.ts","utf8");
const cancel=fs.readFileSync("supabase/functions/asaas-admin-cancel/index.ts","utf8");
const checkout=fs.readFileSync("supabase/migrations/20260925070000_secure_cart_checkout.sql","utf8");
const stock=fs.readFileSync("supabase/migrations/20260927030000_order_stock_release.sql","utf8");

test("overdue event stays inside current database status contract",()=>{
 assert.match(webhook,/PAYMENT_OVERDUE/);
 assert.match(webhook,/overdue\?"pending"/);
 assert.doesNotMatch(webhook,/overdue\?"overdue"/);
});

test("admin cancellation refuses cross-environment provider operations",()=>{
 assert.match(cancel,/currentEnvironment=asaasEnvironment\(\)/);
 assert.match(cancel,/payment\.environment!==currentEnvironment/);
});

test("cart pricing and stock are authoritative in database",()=>{
 assert.match(checkout,/security definer/i);
 assert.match(checkout,/coalesce\(p\.promotional_price,p\.sale_price\)/);
 assert.match(checkout,/for update/i);
 assert.match(checkout,/p\.stock < qty/);
 assert.match(checkout,/stock = stock - qty/);
});

test("stock release is idempotent",()=>{
 assert.match(stock,/stock_released_at is not null/);
 assert.match(stock,/stock = stock \+ item\.quantity/);
 assert.match(stock,/set stock_released_at = now\(\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const path = "services/whatsapp-bridge/";
const read = name => readFileSync(path+name, "utf8");

test("isolated persistent runtime, with no Meta API cutover or public port",()=>{
  const docker=read("Dockerfile"),compose=read("compose.yaml");
  assert.match(docker,/FROM node:22/);
  assert.match(docker,/USER node/);
  assert.match(docker,/CMD \["node", "index\.mjs"\]/);
  assert.match(compose,/restart: unless-stopped/);
  assert.match(compose,/session:\/app\/\.local\/session/);
  assert.match(compose,/env_file:\s*\n\s*- \.env/);
  assert.match(compose,/read_only: true/);
  assert.match(compose,/no-new-privileges:true/);
  assert.doesNotMatch(compose,/^\s+ports:/m);
  assert.doesNotMatch(compose,/META_WA_ACCESS_TOKEN|META_WA_APP_SECRET|meta-whatsapp-webhook/);
});

test("private local authentication, credentials and build artifacts are excluded",()=>{
  const ignore=read(".dockerignore");
  assert.match(ignore,/^\.env$/m);
  assert.match(ignore,/^\.local$/m);
  assert.match(ignore,/^node_modules$/m);
  const docker=read("Dockerfile");
  assert.doesNotMatch(docker,/COPY \./);
  assert.doesNotMatch(docker,/SUPABASE_SERVICE_ROLE_KEY=|PROBE_ACCESS_TOKEN=/);
});

test("existing queue, QR and receipt sender unchanged",()=>{
  const bridge=read("index.mjs");
  for(const rpc of ["wa_bridge_claim","wa_bridge_finish","wa_bridge_worker_report","wa_bridge_register_destination"])
    assert.ok(bridge.includes(rpc),rpc);
  assert.match(bridge,/useMultiFileAuthState/);
  assert.match(bridge,/QRCode\.toDataURL/);
  assert.match(bridge,/wa_bridge_auto_enabled/);
});

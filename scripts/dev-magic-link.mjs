#!/usr/bin/env node
// Dev-only helper: generate a sign-in OTP code/link via the Supabase Admin API
// without sending an email. Useful when you've hit Supabase's built-in email
// rate limit while testing the sign-in flow repeatedly.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Settings -> API -> service_role).
// NEVER prefix this with VITE_, never commit it, never use it in client code —
// it has full admin access and bypasses Row Level Security.
//
// Usage: node scripts/dev-magic-link.mjs you@email.com

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/dev-magic-link.mjs you@email.com");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("No email was sent — the rate limit doesn't apply to this.\n");
console.log("OTP code (paste into the app's 6-digit code field):", data.properties.email_otp);
console.log("Action link (open directly instead, if you prefer):", data.properties.action_link);

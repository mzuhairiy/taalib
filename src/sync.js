// Optional cross-device sync via Supabase.
// If VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY aren't set, this module exposes
// `syncAvailable = false` and everything else is a no-op; the app stays local-only.
import { createClient } from "@supabase/supabase-js";

const URL_ENV = import.meta.env.VITE_SUPABASE_URL;
const KEY_ENV = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const syncAvailable = Boolean(URL_ENV && KEY_ENV);
export const supabase = syncAvailable
  ? createClient(URL_ENV, KEY_ENV, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

const TABLE = "taalib_state";
const listeners = new Set();

export function onAuthChange(cb) {
  if (!syncAvailable) return () => {};
  listeners.add(cb);
  const sub = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user || null);
  });
  // fire once with current state
  supabase.auth.getUser().then(({ data }) => cb(data?.user || null));
  return () => {
    listeners.delete(cb);
    sub.data?.subscription?.unsubscribe?.();
  };
}

export async function getUser() {
  if (!syncAvailable) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function signInWithEmail(email, redirectTo) {
  if (!syncAvailable) throw new Error("sync not configured");
  const target = redirectTo || window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: target }
  });
  if (error) throw error;
}

export async function signOut() {
  if (!syncAvailable) return;
  await supabase.auth.signOut();
}

/** Fetch remote state blob + updated_at for the signed-in user. Returns null if no row. */
export async function pullRemote() {
  if (!syncAvailable) return null;
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { data: data.data, updatedAt: data.updated_at } : null;
}

/** Upsert state. Returns server updated_at timestamp on success. */
export async function pushRemote(stateObj) {
  if (!syncAvailable) return null;
  const user = await getUser();
  if (!user) return null;
  const payload = {
    user_id: user.id,
    data: stateObj,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select("updated_at")
    .single();
  if (error) throw error;
  return data?.updated_at || null;
}

// Bento brief : connexion Google et lecture Gmail (lecture seule) des boîtes reliées à l'app.
// Routes :
//   POST /bento-google/start     { key, label, hint }  -> { url } (adresse de connexion Google)
//   GET  /bento-google/callback  (retour de Google)     -> page « Compte relié »
//   POST /bento-google/sync      { key } ou en-tête x-bento-cron -> relit les non lus de chaque compte
// Les jetons Google restent dans la table bento_accounts (fermée à l'app). Aucun mail n'est modifié.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const APP_URL = "https://sholypro.github.io/bento-brief/";
const REDIRECT = `${SB_URL}/functions/v1/bento-google/callback`;
const SCOPES = "openid email https://www.googleapis.com/auth/gmail.readonly";
const QUERY = "in:inbox is:unread newer_than:2d -category:promotions -category:social -category:forums";

const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function keyOk(key: unknown) {
  if (typeof key !== "string" || !/^bento_[a-f0-9]{24,}$/i.test(key)) return false;
  const { data } = await db.from("bento_keys").select("id").eq("key_hash", await sha256Hex(key)).limit(1);
  return !!(data && data.length);
}
function randomHex(n = 24) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function page(title: string, text: string, ok = true) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 -apple-system,system-ui,sans-serif;background:linear-gradient(160deg,#cfe6f2,#e9f3c9 55%,#7fae5b);color:#14201A}
.c{max-width:420px;margin:24px;padding:28px;border-radius:30px;background:rgba(252,250,238,.92);box-shadow:0 20px 60px rgba(20,32,26,.2)}
h1{font:400 36px/1.05 Georgia,serif;margin:0 0 10px}p{margin:0 0 18px;color:#3a4a40}
a{display:inline-block;padding:14px 22px;border-radius:26px;background:#1E3A2B;color:#D7F75B;font-weight:700;text-decoration:none}
.b{display:inline-block;margin-bottom:14px;padding:5px 12px;border-radius:99px;font-weight:700;font-size:13px;background:${ok ? "#1E3A2B;color:#D7F75B" : "#FFD9CC;color:#8A2E12"}}</style></head>
<body><div class="c"><span class="b">${ok ? "Bento brief" : "Oups"}</span><h1>${title}</h1><p>${text}</p><a href="${APP_URL}">Revenir à Bento</a></div></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

async function tokenRequest(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

async function gmail(path: string, token: string) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`gmail ${r.status}`);
  return r.json();
}

// Relit les non lus d'un compte et remplace son instantané dans bento_inbox
async function syncAccount(acc: { email: string; refresh_token: string | null }) {
  if (!acc.refresh_token) return { email: acc.email, status: "reconnect" };
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: acc.refresh_token });
  if (!t.ok) {
    const reconnect = t.j && (t.j.error === "invalid_grant" || t.j.error === "unauthorized_client");
    await db.from("bento_accounts").update({ status: reconnect ? "reconnect" : "error", last_error: String(t.j?.error_description || t.j?.error || t.status) }).eq("email", acc.email);
    return { email: acc.email, status: reconnect ? "reconnect" : "error" };
  }
  const token = t.j.access_token as string;
  try {
    const list = await gmail(`messages?maxResults=40&q=${encodeURIComponent(QUERY)}`, token);
    const ids: string[] = (list.messages || []).map((m: { id: string }) => m.id);
    const rows = await Promise.all(ids.map(async (id) => {
      const m = await gmail(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, token);
      const h = Object.fromEntries((m.payload?.headers || []).map((x: { name: string; value: string }) => [x.name.toLowerCase(), x.value]));
      return {
        account_email: acc.email,
        message_id: m.id,
        thread_id: m.threadId,
        sender: String(h.from || "").slice(0, 300),
        subject: String(h.subject || "(sans objet)").slice(0, 300),
        snippet: decodeEntities(String(m.snippet || "")).slice(0, 400),
        received_at: new Date(Number(m.internalDate || Date.now())).toISOString(),
        link: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(acc.email)}#all/${m.threadId}`,
      };
    }));
    await db.from("bento_inbox").delete().eq("account_email", acc.email);
    if (rows.length) await db.from("bento_inbox").insert(rows);
    await db.from("bento_accounts").update({ status: "ok", last_error: null, last_sync_at: new Date().toISOString(), unread_count: list.resultSizeEstimate ?? rows.length }).eq("email", acc.email);
    return { email: acc.email, status: "ok", unread: rows.length };
  } catch (e) {
    await db.from("bento_accounts").update({ status: "error", last_error: String(e).slice(0, 200) }).eq("email", acc.email);
    return { email: acc.email, status: "error" };
  }
}

async function syncAll() {
  const { data } = await db.from("bento_accounts").select("email, refresh_token");
  const out = [];
  for (const acc of data || []) out.push(await syncAccount(acc));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.split("/").filter(Boolean).pop();

  try {
    if (route === "start" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!(await keyOk(body.key))) return json({ error: "clé" }, 403);
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "google_not_configured" }, 503);
      const state = randomHex();
      await db.from("bento_oauth_states").delete().lt("created_at", new Date(Date.now() - 3600e3).toISOString());
      await db.from("bento_oauth_states").insert({ state, label: String(body.label || "").slice(0, 20) || null, hint: String(body.hint || "").slice(0, 200) || null });
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.search = new URLSearchParams({
        client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPES,
        access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
        ...(body.hint ? { login_hint: String(body.hint) } : {}),
      }).toString();
      return json({ url: auth.toString() });
    }

    if (route === "callback" && req.method === "GET") {
      const state = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      if (url.searchParams.get("error")) return page("Connexion annulée", "Aucun compte n’a été relié. Tu peux réessayer depuis la pastille Gmail de Bento.", false);
      const { data: st } = await db.from("bento_oauth_states").select("*").eq("state", state).maybeSingle();
      if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60e3) return page("Lien expiré", "Relance la connexion depuis la pastille Gmail de Bento.", false);
      await db.from("bento_oauth_states").delete().eq("state", state);
      const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT });
      if (!t.ok || !t.j.refresh_token) return page("Connexion refusée", "Google n’a pas donné l’accès. Si c’est une boîte d’entreprise, l’administrateur a peut-être bloqué les applications externes.", false);
      const prof = await gmail("profile", t.j.access_token);
      const email = String(prof.emailAddress || "").toLowerCase();
      if (!email) return page("Connexion incomplète", "Impossible de lire l’adresse du compte.", false);
      await db.from("bento_accounts").upsert({ email, label: st.label || email.split("@")[0], refresh_token: t.j.refresh_token, status: "ok", last_error: null, connected_at: new Date().toISOString() });
      const res = await syncAccount({ email, refresh_token: t.j.refresh_token });
      return page("Compte relié", `<b>${esc(email)}</b> est relié à Bento en lecture seule. ${res.status === "ok" ? `${(res as { unread?: number }).unread ?? 0} mail(s) non lu(s) trouvé(s).` : ""} Claude le lira au prochain tri.`);
    }

    if (route === "sync" && req.method === "POST") {
      const cron = req.headers.get("x-bento-cron");
      let allowed = false;
      if (cron) {
        const { data } = await db.from("bento_settings").select("value").eq("key", "cron_secret").maybeSingle();
        allowed = !!data && data.value === cron;
      } else {
        const body = await req.json().catch(() => ({}));
        allowed = await keyOk(body.key);
      }
      if (!allowed) return json({ error: "clé" }, 403);
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "google_not_configured" }, 503);
      return json({ ok: true, accounts: await syncAll() });
    }

    if (route === "status" && req.method === "GET") {
      return json({ ok: true, configured: !!(CLIENT_ID && CLIENT_SECRET), redirect: REDIRECT });
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});

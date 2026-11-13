// Studio KLIMB (studio.goklimb.com, app Lovable).
// Deux façons de brancher la source, au choix :
//  A. STUDIO_JSON_URL : n'importe quelle URL qui renvoie un tableau JSON de projets
//  B. STUDIO_SUPABASE_URL + STUDIO_SUPABASE_KEY + STUDIO_TABLE : lecture directe
//     de la table Supabase derrière l'app Lovable (clé "anon" ou une clé lecture seule)
// Les lignes brutes sont ensuite normalisées par Claude (ou par normalizeRows en secours).

export function studioConfigured(env) {
  return Boolean(env.STUDIO_JSON_URL || (env.STUDIO_SUPABASE_URL && env.STUDIO_SUPABASE_KEY));
}

export async function fetchStudio(env) {
  let rows = [];
  if (env.STUDIO_JSON_URL) {
    const res = await fetch(env.STUDIO_JSON_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Studio JSON : HTTP ${res.status}`);
    const json = await res.json();
    rows = Array.isArray(json) ? json : json.projects || json.data || [];
  } else {
    const base = env.STUDIO_SUPABASE_URL.replace(/\/$/, '');
    const table = env.STUDIO_TABLE || 'projects';
    const res = await fetch(`${base}/rest/v1/${encodeURIComponent(table)}?select=*&limit=60`, {
      headers: { apikey: env.STUDIO_SUPABASE_KEY, Authorization: `Bearer ${env.STUDIO_SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error(`Studio Supabase : HTTP ${res.status} ${await res.text()}`);
    rows = await res.json();
  }
  // On garde un JSON compact pour le prompt
  return rows.slice(0, 60).map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === '' || (typeof v === 'object' && !Array.isArray(v))) continue;
      out[k] = typeof v === 'string' ? v.slice(0, 160) : v;
    }
    return out;
  });
}

const pick = (row, keys) => {
  for (const k of Object.keys(row)) {
    if (keys.some((key) => k.toLowerCase().includes(key))) return row[k];
  }
  return undefined;
};

// Secours sans IA : devine les colonnes les plus probables
export function normalizeRows(rows) {
  const now = Date.now();
  return rows
    .map((r) => {
      const dueRaw = pick(r, ['deadline', 'due', 'end', 'delivery', 'livraison', 'date']);
      const due = dueRaw ? new Date(dueRaw) : null;
      const progressRaw = pick(r, ['progress', 'avancement', 'percent']);
      const status = String(pick(r, ['status', 'statut', 'state']) || '').toLowerCase();
      const done = /done|livr|termin|complete|closed/.test(status);
      const pct = done ? 100 : Number(progressRaw) > 1 ? Number(progressRaw) : Number(progressRaw) * 100 || null;
      const days = due && !isNaN(due) ? (due - now) / 86400000 : null;
      return {
        client: String(pick(r, ['client', 'customer', 'brand', 'company']) || pick(r, ['name', 'title', 'nom']) || 'Projet'),
        what: String(pick(r, ['title', 'name', 'type', 'phase', 'description']) || ''),
        due: due && !isNaN(due) ? due.toISOString().slice(0, 10) : null,
        pct: pct === null ? null : Math.max(0, Math.min(100, Math.round(pct))),
        hot: days !== null && days >= -1 && days <= 7 && !done,
        done
      };
    })
    .filter((p) => !p.done || p.due)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
    .slice(0, 6);
}

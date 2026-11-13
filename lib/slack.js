// Slack : les messages qui te concernent (DM, groupes privés, mentions), avec l'état non lu.
// Token utilisateur (xoxp-...). Scopes à cocher dans l'app Slack (User Token Scopes) :
// search:read, users:read, im:read, im:history, mpim:read, mpim:history, channels:read, groups:read

async function call(method, params, token) {
  const url = `https://slack.com/api/${method}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method} : ${json.error}`);
  return json;
}

function cleanSlackText(text, names) {
  return (text || '')
    .replace(/<@([A-Z0-9]+)(\|[^>]+)?>/g, (_, id) => '@' + (names.get(id) || 'quelqu’un'))
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

// Garde les 5 plus récents, mais un message non lu n'est jamais écarté par un message déjà lu.
export function pickSlack(items, max = 5) {
  const byTime = (a, b) => b.ts - a.ts;
  const unread = items.filter((i) => i.unread).sort(byTime);
  const read = items.filter((i) => !i.unread).sort(byTime);
  return [...unread, ...read].slice(0, max).sort(byTime);
}

export async function fetchSlack({ token, hours = 36 }) {
  const errors = [];
  const auth = await call('auth.test', {}, token);
  const me = auth.user_id;
  const teamUrl = auth.url;
  const since = Date.now() / 1000 - hours * 3600;

  // Noms + liste des robots à ignorer
  const names = new Map();
  const bots = new Set(['USLACKBOT']);
  try {
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const users = await call('users.list', { limit: 500, ...(cursor ? { cursor } : {}) }, token);
      for (const u of users.members || []) {
        names.set(u.id, u.profile?.display_name || u.profile?.real_name || u.name);
        if (u.is_bot || u.is_app_user) bots.add(u.id);
      }
      cursor = users.response_metadata?.next_cursor;
      if (!cursor) break;
    }
  } catch (e) {
    errors.push(`Slack noms : ${e.message}`);
  }
  const isHuman = (m) => m.user && m.user !== me && !bots.has(m.user) && !m.bot_id && !m.subtype;

  // Une entrée par conversation : son dernier message qui te concerne
  const convs = new Map();
  const keep = (key, item) => {
    const prev = convs.get(key);
    if (!prev || item.ts > prev.ts) convs.set(key, { ...item, count: (prev?.count || 0) + 1 });
    else prev.count += 1;
  };

  // 1. Mentions dans les canaux
  try {
    const search = await call('search.messages', { query: `<@${me}>`, sort: 'timestamp', sort_dir: 'desc', count: 40 }, token);
    for (const m of search.messages?.matches || []) {
      if (Number(m.ts) < since || !isHuman(m) || m.channel?.is_im || m.channel?.is_mpim) continue;
      keep(`${m.channel?.id}:${m.thread_ts || m.ts}`, {
        kind: 'mention',
        channelId: m.channel?.id,
        where: `#${m.channel?.name || 'canal'}`,
        who: names.get(m.user) || m.username || 'Quelqu’un',
        text: cleanSlackText(m.text, names),
        ts: Number(m.ts),
        link: m.permalink || teamUrl
      });
    }
  } catch (e) {
    errors.push(`Slack mentions : ${e.message}`);
  }

  // 2. DM et groupes privés
  const awaiting = new Map();
  try {
    const list = await call('conversations.list', { types: 'im,mpim', limit: 200, exclude_archived: true }, token);
    const channels = (list.channels || [])
      .filter((c) => !c.is_user_deleted && !(c.is_im && bots.has(c.user)))
      .slice(0, 60);
    const histories = await Promise.allSettled(
      channels.map((c) => call('conversations.history', { channel: c.id, oldest: String(since), limit: 15 }, token).then((h) => ({ c, h })))
    );
    for (const r of histories) {
      if (r.status !== 'fulfilled') continue;
      const { c, h } = r.value;
      const msgs = h.messages || [];
      const incoming = msgs.filter(isHuman);
      if (!incoming.length) continue;
      const last = incoming[0];
      // Tu as déjà répondu après ce message ?
      const repliedAfter = msgs.some((m) => m.user === me && Number(m.ts) > Number(last.ts));
      awaiting.set(c.id, !repliedAfter);
      const where = c.is_im ? 'DM' : 'Groupe';
      convs.set(c.id, {
        kind: c.is_im ? 'dm' : 'group',
        channelId: c.id,
        where,
        who: names.get(last.user) || 'Quelqu’un',
        text: cleanSlackText(last.text, names),
        ts: Number(last.ts),
        count: incoming.length,
        link: `${teamUrl}archives/${c.id}/p${String(last.ts).replace('.', '')}`
      });
    }
  } catch (e) {
    errors.push(`Slack DM : ${e.message}`);
  }

  // 3. État non lu (dernier message lu par toi dans chaque conversation)
  const items = [...convs.values()];
  const ids = [...new Set(items.map((i) => i.channelId).filter(Boolean))];
  const infos = await Promise.allSettled(ids.map((id) => call('conversations.info', { channel: id }, token)));
  const lastRead = new Map();
  infos.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.channel?.last_read) lastRead.set(ids[i], Number(r.value.channel.last_read));
  });
  for (const it of items) {
    const lr = lastRead.get(it.channelId);
    it.unread = lr !== undefined ? it.ts > lr : false;
    it.awaitingReply = awaiting.get(it.channelId) ?? false;
  }

  items.sort((a, b) => b.ts - a.ts);
  return { items, errors };
}

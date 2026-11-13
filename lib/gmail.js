// Lecture Gmail en IMAP avec un mot de passe d'application.
// Pas de Google Cloud, pas d'OAuth : juste la double authentification activée
// sur le compte et un mot de passe d'application (voir README).
import { ImapFlow } from 'imapflow';

export function parseAccounts(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      return { user: pair.slice(0, i).trim(), pass: pair.slice(i + 1).replace(/\s+/g, '') };
    })
    .filter((a) => a.user && a.pass);
}

function findPart(node, type) {
  if (!node) return null;
  if (node.type === type && node.disposition !== 'attachment') return node.part || '1';
  for (const child of node.childNodes || []) {
    const found = findPart(child, type);
    if (found) return found;
  }
  return null;
}

async function streamToString(stream, max = 4000) {
  let out = '';
  for await (const chunk of stream) {
    out += chunk.toString('utf8');
    if (out.length > max) break;
  }
  return out;
}

function cleanText(text) {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/^>.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

async function readAccount(account, hours, max) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: account.user, pass: account.pass },
    logger: false
  });
  await client.connect();
  const mails = [];
  const lock = await client.getMailboxLock('INBOX');
  try {
    const days = Math.max(1, Math.ceil(hours / 24));
    // Recherche native Gmail : non lus, onglet Principal uniquement
    const uids = await client.search(
      { gmraw: `is:unread newer_than:${days}d -category:promotions -category:social -category:forums -category:updates` },
      { uid: true }
    );
    const recent = (uids || []).slice(-max);
    if (!recent.length) return mails;

    const metas = [];
    for await (const msg of client.fetch(recent, { uid: true, envelope: true, internalDate: true, bodyStructure: true, emailId: true }, { uid: true })) {
      metas.push(msg);
    }
    for (const msg of metas) {
      let snippet = '';
      try {
        const part = findPart(msg.bodyStructure, 'text/plain') || findPart(msg.bodyStructure, 'text/html');
        if (part) {
          const { content } = await client.download(String(msg.uid), part, { uid: true, maxBytes: 6000 });
          snippet = cleanText(await streamToString(content));
        }
      } catch {
        snippet = '';
      }
      const from = msg.envelope?.from?.[0] || {};
      mails.push({
        id: `${account.user}:${msg.uid}`,
        account: account.user,
        fromName: from.name || from.address || 'Inconnu',
        fromAddress: (from.address || '').toLowerCase(),
        subject: msg.envelope?.subject || '(sans objet)',
        date: (msg.internalDate || msg.envelope?.date || new Date()).toISOString(),
        snippet,
        link: msg.emailId
          ? `https://mail.google.com/mail/u/${encodeURIComponent(account.user)}/#all/${BigInt(msg.emailId).toString(16)}`
          : 'https://mail.google.com/'
      });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return mails;
}

export async function fetchGmail({ accounts, hours = 36, max = 40 }) {
  const results = await Promise.allSettled(accounts.map((a) => readAccount(a, hours, max)));
  const mails = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') mails.push(...r.value);
    else errors.push(`Gmail ${accounts[i].user} : ${r.reason?.message || r.reason}`);
  });
  mails.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { mails, errors };
}

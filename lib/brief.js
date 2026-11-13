import { fetchGmail, parseAccounts } from './gmail.js';
import { fetchSlack, pickSlack } from './slack.js';
import { fetchStudio, normalizeRows, studioConfigured } from './studio.js';
import { askClaude } from './claude.js';
import { rulesFromEnv, scoreMail, tagFromScore, fallbackSummary } from './rules.js';
import { demoBrief } from './demo.js';

const TAGS = new Set(['urgent', 'client', 'valider', 'info']);
const STUDIO_URL = 'https://studio.goklimb.com/';

export function isConfigured(env) {
  return Boolean(parseAccounts(env.GMAIL_ACCOUNTS).length || env.SLACK_USER_TOKEN || studioConfigured(env));
}

export async function buildBrief(env) {
  const name = env.DISPLAY_NAME || 'Sholy';
  if (!isConfigured(env)) return demoBrief(name);

  const hours = Number(env.LOOKBACK_HOURS) || 36;
  const accounts = parseAccounts(env.GMAIL_ACCOUNTS);
  const rules = rulesFromEnv(env);
  const errors = [];
  const sources = { gmail: 'off', slack: 'off', studio: 'off', ai: 'off' };

  const [gmailR, slackR, studioR] = await Promise.allSettled([
    accounts.length ? fetchGmail({ accounts, hours }) : Promise.resolve(null),
    env.SLACK_USER_TOKEN ? fetchSlack({ token: env.SLACK_USER_TOKEN, hours }) : Promise.resolve(null),
    studioConfigured(env) ? fetchStudio(env) : Promise.resolve(null)
  ]);

  let mails = [];
  if (gmailR.status === 'fulfilled' && gmailR.value) {
    mails = gmailR.value.mails;
    errors.push(...gmailR.value.errors);
    sources.gmail = gmailR.value.errors.length && !mails.length ? 'error' : 'ok';
  } else if (gmailR.status === 'rejected') {
    sources.gmail = 'error';
    errors.push(`Gmail : ${gmailR.reason?.message}`);
  }

  let slack = [];
  if (slackR.status === 'fulfilled' && slackR.value) {
    slack = slackR.value.items;
    errors.push(...slackR.value.errors);
    sources.slack = 'ok';
  } else if (slackR.status === 'rejected') {
    sources.slack = 'error';
    errors.push(`Slack : ${slackR.reason?.message}`);
  }

  let studioRows = [];
  if (studioR.status === 'fulfilled' && studioR.value) {
    studioRows = studioR.value;
    sources.studio = 'ok';
  } else if (studioR.status === 'rejected') {
    sources.studio = 'error';
    errors.push(`Studio : ${studioR.reason?.message}`);
  }

  // 1. Règles
  for (const m of mails) m.score = scoreMail(m, rules);
  const candidates = mails
    .filter((m) => m.score > -2)
    .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
    .slice(0, 25);
  const slackCandidates = slack.slice(0, 20);
  const fallbackProjects = normalizeRows(studioRows);

  // 2. IA
  let ai;
  if (env.ANTHROPIC_API_KEY) {
    try {
      ai = await askClaude({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.CLAUDE_MODEL || 'claude-haiku-5-5',
        name,
        now: new Date(),
        mails: candidates,
        slack: slackCandidates,
        studioRows
      });
      sources.ai = 'ok';
    } catch (e) {
      sources.ai = 'error';
      errors.push(`IA : ${e.message}`);
    }
  }
  if (!ai) ai = fallbackSummary({ mails: candidates, slack: slackCandidates, projects: fallbackProjects });

  // 3. Fusion : les liens, noms et heures viennent toujours des vraies données
  const mailById = new Map(candidates.map((m) => [m.id, m]));

  const essentials = (ai.essentials || []).slice(0, 3).map((e) => {
    let time = null;
    let link = null;
    if (e.source === 'gmail' && mailById.has(e.ref)) {
      const m = mailById.get(e.ref);
      time = m.date;
      link = m.link;
    } else if (e.source === 'slack' && slackCandidates[Number(e.ref)]) {
      const s = slackCandidates[Number(e.ref)];
      time = new Date(s.ts * 1000).toISOString();
      link = s.link;
    } else if (e.source === 'studio') {
      link = STUDIO_URL;
    }
    return { text: String(e.text || ''), source: e.source || 'gmail', action: e.action || '', time, link };
  });

  const shownMails = (ai.mails || [])
    .map((x) => {
      const m = mailById.get(x.id);
      if (!m) return null;
      const fb = tagFromScore(m, rules);
      return {
        from: m.fromName,
        subject: m.subject,
        time: m.date,
        tag: TAGS.has(x.tag) ? x.tag : fb.tag,
        why: x.why || fb.why,
        link: m.link
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  // Slack : règle fixe, pas l'IA. Les 5 conversations les plus récentes qui te concernent,
  // les non lues passent avant les lues.
  const shownSlack = pickSlack(slack, 5).map((s) => ({
    where: s.where,
    who: s.who,
    text: s.text,
    time: new Date(s.ts * 1000).toISOString(),
    link: s.link,
    unread: Boolean(s.unread),
    awaitingReply: Boolean(s.awaitingReply),
    count: s.count || 1
  }));

  const projects = (Array.isArray(ai.projects) && ai.projects.length ? ai.projects : fallbackProjects).slice(0, 6).map((p) => ({
    client: String(p.client || 'Projet'),
    what: String(p.what || ''),
    due: p.due || null,
    pct: p.pct === null || p.pct === undefined ? null : Math.max(0, Math.min(100, Number(p.pct))),
    hot: Boolean(p.hot),
    done: Boolean(p.done)
  }));

  return {
    demo: false,
    name,
    generatedAt: new Date().toISOString(),
    headline: ai.headline || '',
    essentials,
    counts: {
      mailsImportant: shownMails.length,
      mailsTotal: mails.length,
      slackMentions: slack.filter((s) => s.kind === 'mention').length,
      slackDms: slack.filter((s) => s.kind === 'dm' || s.kind === 'group').length,
      slackUnread: slack.filter((s) => s.unread).length,
      studioHot: projects.filter((p) => p.hot).length
    },
    mails: shownMails,
    otherMails: Math.max(0, mails.length - shownMails.length),
    slack: shownSlack,
    projects,
    studioUrl: STUDIO_URL,
    sources,
    errors
  };
}

// Tri par règles, avant l'IA (et en secours si l'IA n'est pas configurée).

const list = (raw, fallback = []) =>
  raw ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : fallback;

export function rulesFromEnv(env) {
  return {
    senders: list(env.PRIORITY_SENDERS),
    keywords: list(env.PRIORITY_KEYWORDS, ['urgent', 'asap', 'deadline', 'bat', 'validation', 'retour', 'devis', 'facture'])
  };
}

const AUTOMATED = /(no-?reply|newsletter|notification|mailer|bounce|marketing|news@|hello@|info@|support@|team@)/;

export function scoreMail(mail, rules) {
  const who = `${mail.fromName} ${mail.fromAddress}`.toLowerCase();
  const text = `${mail.subject} ${mail.snippet}`.toLowerCase();
  let score = 0;
  if (rules.senders.some((s) => who.includes(s))) score += 3;
  if (rules.keywords.some((k) => text.includes(k))) score += 2;
  if (/\?/.test(mail.snippet)) score += 1;
  if (AUTOMATED.test(mail.fromAddress)) score -= 4;
  const ageH = (Date.now() - new Date(mail.date)) / 3600000;
  if (ageH < 6) score += 1;
  return score;
}

export function tagFromScore(mail, rules) {
  const text = `${mail.subject} ${mail.snippet}`.toLowerCase();
  if (/(urgent|asap|aujourd|ce soir|deadline)/.test(text)) return { tag: 'urgent', why: 'Mot-clé urgent' };
  if (/(bat|valid|devis|facture)/.test(text)) return { tag: 'valider', why: 'À valider' };
  if (rules.senders.some((s) => `${mail.fromName} ${mail.fromAddress}`.toLowerCase().includes(s))) return { tag: 'client', why: 'Expéditeur suivi' };
  return { tag: 'info', why: 'Non lu récent' };
}

// Résultat minimal sans IA
export function fallbackSummary({ mails, slack, projects }) {
  const important = mails.filter((m) => m.score >= 2);
  const essentials = [];
  if (important[0]) {
    essentials.push({
      text: `**${important[0].fromName}** t'a écrit : **${important[0].subject}**`,
      source: 'gmail',
      ref: important[0].id,
      action: 'Lire le mail'
    });
  }
  const hot = projects.find((p) => p.hot);
  if (hot) {
    essentials.push({ text: `**${hot.client}** : deadline **${hot.due}**.`, source: 'studio', ref: hot.client, action: 'Vérifier le projet' });
  }
  if (slack.length) {
    essentials.push({ text: `**${slack.length} message${slack.length > 1 ? 's' : ''} Slack** pour toi, dont **${slack[0].who}**.`, source: 'slack', ref: 0, action: 'Ouvrir Slack' });
  }
  if (!essentials.length) {
    essentials.push({ text: '**Rien d’urgent** pour l’instant. Profite pour avancer au calme.', source: 'gmail', ref: null, action: 'Respirer' });
  }
  return {
    headline: important.length ? `${essentials.length} chose${essentials.length > 1 ? 's' : ''} à regarder. Résumé sans IA (clé Claude absente).` : 'Journée calme pour l’instant.',
    essentials: essentials.slice(0, 3),
    mails: important.slice(0, 5).map((m) => ({ id: m.id })),
    slack: slack.slice(0, 4).map((_, index) => ({ index })),
    projects: null
  };
}

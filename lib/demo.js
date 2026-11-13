// Données d'exemple affichées tant qu'aucune source n'est branchée.

export function demoBrief(name = 'Sholy') {
  const now = new Date();
  const at = (h, m, dayOffset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const inDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return {
    demo: true,
    name,
    generatedAt: now.toISOString(),
    headline: '3 choses comptent aujourd’hui. Le reste peut attendre.',
    essentials: [
      { text: '**Micha attend tes pistes Qantum** avant **17h**, pour le comité de lundi.', source: 'gmail', time: at(11, 42), action: 'Envoyer les pistes', link: '#' },
      { text: '**Illicado a répondu** sur la piste collage : **2 retours** à intégrer.', source: 'gmail', time: at(10, 15), action: 'Intégrer les retours', link: '#' },
      { text: '**Slack calme** : rien ne bloque avant lundi.', source: 'slack', time: at(12, 58), action: 'Ouvrir Slack', link: '#' }
    ],
    counts: { mailsImportant: 4, mailsTotal: 23, slackMentions: 2, slackDms: 3, slackUnread: 2, studioHot: 2 },
    mails: [
      { from: 'Micha · Qantum', subject: 'Pistes DA ASCII pour le comité de lundi', time: at(11, 42), tag: 'urgent', why: 'Deadline aujourd’hui', link: '#' },
      { from: 'Illicado', subject: 'Retours sur la piste collage papier', time: at(10, 15), tag: 'client', why: 'Réponse attendue', link: '#' },
      { from: 'Firstrow', subject: 'BAT merch tee + sweat à valider', time: at(9, 3), tag: 'valider', why: 'Fichier joint', link: '#' }
    ],
    otherMails: 19,
    slack: [
      { where: '#qantum-klimb', who: 'Lénaïc', text: '@Alex tu peux partager le lien Figma des pistes ?', time: at(12, 58), link: '#', unread: true, awaitingReply: true, count: 1 },
      { where: 'DM', who: 'Victoria', text: 'J’ai mis dans le channel Qantum les retours, tu pourras jeter un œil !', time: at(12, 6), link: '#', unread: true, awaitingReply: true, count: 2 },
      { where: 'DM', who: 'Bixente', text: 'Point process design décalé à 16h', time: at(11, 20), link: '#', unread: false, awaitingReply: false, count: 1 },
      { where: 'Groupe', who: 'Angélina', text: 'Sinon à part ça c’est bon ?', time: at(10, 1), link: '#', unread: false, awaitingReply: true, count: 3 },
      { where: '#studio', who: 'Romane', text: '@Alex dispo pour une review LumApps lundi ?', time: at(17, 40, -1), link: '#', unread: false, awaitingReply: false, count: 1 }
    ],
    projects: [
      { client: 'Qantum', what: 'Rebranding', due: inDays(3), pct: 70, hot: true, done: false },
      { client: 'Illicado', what: 'Pistes créatives', due: inDays(7), pct: 45, hot: true, done: false },
      { client: 'Dougs', what: 'Audit de marque', due: inDays(11), pct: 30, hot: false, done: false },
      { client: 'LumApps', what: 'Templates Product', due: inDays(13), pct: 20, hot: false, done: false },
      { client: 'Firstrow', what: 'Merch', due: null, pct: 100, hot: false, done: true }
    ],
    sources: { gmail: 'demo', slack: 'demo', studio: 'demo', ai: 'demo' },
    errors: []
  };
}

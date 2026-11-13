// Appel à l'API Claude : tri + résumé, sortie JSON stricte.

const SYSTEM = `Tu es l'assistant de tri de {NAME}, brand & motion designer en agence (KLIMB) et freelance.
Tu reçois ses mails non lus, ses mentions et DM Slack, et les projets du Studio KLIMB.
Ton job : lui dire en 10 secondes ce qui compte vraiment aujourd'hui.

Règles :
- Tutoie-le. Français naturel, phrases courtes. N'utilise jamais le tiret long (caractère Unicode U+2014), utilise des deux-points ou des virgules.
- Une vraie priorité = un client ou un collègue attend une action de sa part, ou une deadline proche.
- Newsletters, notifications automatiques, pubs : jamais dans l'essentiel.
- Dans "essentials", mets en gras avec **double astérisque** 1 à 3 éléments clés par phrase :
  qui, quoi, et l'échéance (ex : "**Micha attend tes pistes Qantum** avant **17h**, pour le comité de lundi.").
- 1 à 3 essentials, du plus important au moins important. Le premier est LA priorité du jour.
  S'il n'y a rien d'important, dis-le simplement en un seul essential rassurant.
- "action" : 2 à 4 mots, verbe à l'infinitif, ex "Envoyer les pistes", "Valider le BAT", "Répondre à Lénaïc".
- N'invente aucun fait : tout doit venir des données fournies.
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{
  "headline": "phrase courte, ex : 3 choses comptent aujourd'hui. Le reste peut attendre.",
  "essentials": [{"text": "...", "source": "gmail|slack|studio", "ref": "id du mail, index slack ou nom du projet", "action": "..."}],
  "mails": [{"id": "id exact du mail", "tag": "urgent|client|valider|info", "why": "raison en 2 à 4 mots"}],
  "projects": [{"client": "...", "what": "...", "due": "AAAA-MM-JJ ou null", "pct": 0, "hot": true, "done": false}]
}
- "mails" : au maximum 5 mails vraiment importants, du plus au moins urgent.
- Slack : un message non lu ou qui attend sa réponse compte plus qu'un message déjà traité.
- "projects" : normalise les projets du Studio (max 6, deadlines les plus proches d'abord ; hot = deadline dans les 7 jours et pas livré).`;

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Réponse IA sans JSON');
  return JSON.parse(text.slice(start, end + 1));
}

export async function askClaude({ apiKey, model, name, now, mails, slack, studioRows }) {
  const payload = {
    maintenant: now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' }),
    mails: mails.map((m) => ({
      id: m.id,
      de: `${m.fromName} <${m.fromAddress}>`,
      objet: m.subject,
      recu: new Date(m.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit' }),
      extrait: m.snippet,
      score_regles: m.score
    })),
    slack: slack.map((s, index) => ({
      index,
      type: s.kind,
      non_lu: Boolean(s.unread),
      attend_ta_reponse: Boolean(s.awaitingReply),
      ou: s.where,
      qui: s.who,
      texte: s.text,
      quand: new Date(s.ts * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit' })
    })),
    projets_studio: studioRows
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM.replace('{NAME}', name),
        messages: [{ role: 'user', content: `Voici les données à trier :\n${JSON.stringify(payload)}` }]
      })
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text = (json.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

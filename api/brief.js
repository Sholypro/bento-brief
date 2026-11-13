import { timingSafeEqual } from 'node:crypto';
import { buildBrief, isConfigured } from '../lib/brief.js';

function sameKey(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const key = url.searchParams.get('k');
  const fresh = url.searchParams.get('fresh') === '1';
  const env = process.env;

  // Dès qu'une vraie source est branchée, le code d'accès est obligatoire
  if (isConfigured(env)) {
    if (!env.APP_KEY) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'APP_KEY manquant côté serveur' }));
    }
    if (!sameKey(key, env.APP_KEY)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({ error: 'Code d’accès invalide' }));
    }
  }

  try {
    const brief = await buildBrief(env);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Cache CDN : réponse instantanée, recalcul en arrière-plan toutes les 10 min.
    // ?fresh=1 (bouton Actualiser) force un nouveau calcul.
    res.setHeader('Cache-Control', fresh ? 'no-store' : 'public, s-maxage=600, stale-while-revalidate=3600');
    res.end(JSON.stringify(brief));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: e.message || 'Erreur inconnue' }));
  }
}

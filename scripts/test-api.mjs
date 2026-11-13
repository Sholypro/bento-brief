// Teste l'API sans navigateur : npm run test:api
// Affiche le brief JSON (mode démo si aucune variable n'est définie).
import { buildBrief } from '../lib/brief.js';

const brief = await buildBrief(process.env);
console.log(JSON.stringify(brief, null, 2));
if (brief.errors?.length) {
  console.error('\nErreurs :\n- ' + brief.errors.join('\n- '));
  process.exitCode = 1;
}

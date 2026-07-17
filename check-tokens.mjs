import 'dotenv/config.js';
import { readRange } from './lib/ordenes-sheets.ts';
import { OAUTH_TOKENS_TAB, OAUTH_TOKENS_RANGE, OAUTH_TOKENS_COLS, OC_SPREADSHEET_ID } from './lib/ordenes-config.ts';

const rows = await readRange(OC_SPREADSHEET_ID, `${OAUTH_TOKENS_TAB}!${OAUTH_TOKENS_RANGE}`);
console.log('=== Tokens en OAuthTokens ===');
rows.forEach((row, idx) => {
  const email = row[OAUTH_TOKENS_COLS.email] || '';
  const nombre = row[OAUTH_TOKENS_COLS.nombre] || '';
  const fecha = row[OAUTH_TOKENS_COLS.conectadoEn] || '';
  console.log(`${idx + 2}: ${email} (${nombre}) - ${fecha}`);
});

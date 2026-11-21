// Fails the build if any data record lacks provenance or breaks a rule.
// Run: node scripts/check-data.mjs   (also runs automatically before `npm run build`)
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../data/', import.meta.url);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STALE_DAYS = 183;

export function check(name, file, today = new Date()) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(file.items)) return [[`${name}: missing items[]`], []];

  file.items.forEach((item, i) => {
    const where = `${name}[${i}]`;
    const source = item.source ?? file.source;
    const asOf = item.as_of ?? file.as_of;
    if (!source) errors.push(`${where}: no source (item or file level)`);
    if (!ISO.test(asOf ?? ''))
      errors.push(`${where}: as_of must be YYYY-MM-DD`);
    else if ((today - new Date(asOf)) / 864e5 > STALE_DAYS)
      warnings.push(`${where}: as_of ${asOf} is older than 6 months`);
    for (const [k, v] of Object.entries(item))
      if (k.endsWith('_centavos') && !Number.isSafeInteger(v))
        errors.push(`${where}.${k}: must be an integer (centavos)`);
  });

  if (name === 'barangays') {
    const codes = file.items.map(b => b.psgc);
    if (new Set(codes).size !== codes.length)
      errors.push('barangays: duplicate psgc');
    if (codes.some(c => !/^1705110\d{3}$/.test(c)))
      errors.push(
        'barangays: psgc must be a 10-digit San Jose code (1705110xxx)'
      );
    if (codes.length !== 39)
      errors.push(`barangays: expected 39, got ${codes.length}`);
  }
  return [errors, warnings];
}

function selfTest() {
  const ok = { as_of: '2026-01-01', source: 'x', items: [{ a_centavos: 100 }] };
  console.assert(
    check('t', ok, new Date('2026-02-01'))[0].length === 0,
    'valid file'
  );
  const bad = { as_of: '2026-01-01', items: [{ a_centavos: 1.5 }] };
  console.assert(
    check('t', bad, new Date('2026-02-01'))[0].length === 2,
    'no source + float'
  );
  console.assert(
    check('t', ok, new Date('2027-01-01'))[1].length === 1,
    'stale warns'
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  selfTest();
  let failed = false;
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.json'))) {
    const [errors, warnings] = check(
      f.replace('.json', ''),
      JSON.parse(readFileSync(new URL(f, DIR), 'utf8'))
    );
    warnings.forEach(w => console.warn('warn:', w));
    errors.forEach(e => console.error('error:', e));
    failed ||= errors.length > 0;
  }
  if (failed) process.exit(1);
  console.log('data ok');
}

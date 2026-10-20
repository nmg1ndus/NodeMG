/* पासवर्ड से लॉक js/vault.js बनाता है (Node 18+).
 *   NODEMG_PW='आपका-पासवर्ड' node tools/make-vault.js [settings.json] [sample.csv]
 * settings.json: {"dataSource":"appsscript","appsScriptUrl":"...","accessKey":"","csvUrl":""}
 * पासवर्ड कहीं सेव नहीं होता. */
const { webcrypto: c } = require('crypto');
const fs = require('fs'), path = require('path');
const ITER = 310000;
(async () => {
  const pw = process.env.NODEMG_PW;
  if (!pw) { console.error('NODEMG_PW environment variable दीजिए'); process.exit(1); }
  const settings = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : { dataSource: 'sample' };
  const payload = Object.assign({ dataSource: 'sample', appsScriptUrl: '', accessKey: '', csvUrl: '' }, settings);
  if (process.argv[3]) payload.sampleCsv = fs.readFileSync(process.argv[3], 'utf8');
  const enc = new TextEncoder();
  const salt = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
  const km = await c.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await c.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  const b = (x) => Buffer.from(x).toString('base64');
  const out = '/* Encrypted settings (AES-256-GCM, key from password via PBKDF2). Regenerate with tools/make-vault.js */\n' +
    'window.NODEMG_VAULT = ' + JSON.stringify({ v: 1, iter: ITER, salt: b(salt), iv: b(iv), data: b(ct) }) + ';\n';
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'vault.js'), out);
  console.log('js/vault.js बन गई (' + out.length + ' bytes)');
})();

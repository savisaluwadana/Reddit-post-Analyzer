import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const documents = ['README.md', ...readdirSync(path.join(root, 'docs')).filter((name) => name.endsWith('.md')).map((name) => `docs/${name}`)];
const missing = [];
for (const document of documents) {
  const source = readFileSync(path.join(root, document), 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const [, target] of source.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    const file = decodeURIComponent(target.split('#')[0]);
    if (file && !existsSync(path.resolve(root, path.dirname(document), file))) missing.push(`${document}: ${target}`);
  }
}
if (missing.length) throw new Error(`Broken local documentation links:\n${missing.join('\n')}`);
console.log(`Checked relative file links in ${documents.length} documents.`);

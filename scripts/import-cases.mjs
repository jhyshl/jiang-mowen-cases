import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('请传入原始案件世界书所在目录：node scripts/import-cases.mjs <directory>');
// Parse embedded JSON without evaluating any legacy EJS or script instructions.
function objectAt(s, at) {
  const start = s.indexOf('{', at); let depth = 0, quote = false, escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') quote = false; }
    else if (c === '"') quote = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  throw new Error('Legacy case object was not complete');
}
await mkdir('src/cases', { recursive: true });
for (const [file, id, key, needle] of [
  ['教授夫妇案 (2).json','professor','0','"value": {'],
  ['林小女案 (2).json','lin','2',"setvar('stat_data.currentCase',"]
]) {
  const book = JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const content = book.entries[key].content;
  const data = objectAt(content, content.indexOf(needle));
  const canon = Object.values(book.entries).filter(e => !/注意事项/.test(e.comment || '')).map(e => e.content).join('\n\n');
  await writeFile(`src/cases/${id}.source.json`, JSON.stringify({ ...data, canon }, null, 2) + '\n');
  console.log(id, Object.keys(data.evidence).length, 'original evidence records imported');
}

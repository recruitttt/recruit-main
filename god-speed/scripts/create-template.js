#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
const slug = (value) => value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

(async () => {
  const name = await ask('Template name: ');
  const purpose = await ask('Purpose: ');
  const sections = await ask('Key sections (comma-separated): ');
  rl.close();

  const file = path.join(process.cwd(), 'templates', slug(name) + '.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    console.error('Refusing to overwrite existing file: ' + file);
    process.exit(1);
  }

  const title = name.replace(/\b\w/g, (char) => char.toUpperCase());
  const body = [
    '# ' + title,
    '',
    'Purpose: ' + purpose,
    '',
    ...sections.split(',').map((section) => `## ${section.trim()}\n\n- `),
  ].join('\n');

  fs.writeFileSync(file, body + '\n');
  console.log('Created ' + file);
})();

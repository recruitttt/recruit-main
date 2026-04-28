#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
const slug = (value) => value.toLowerCase().replace(/^\//, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

(async () => {
  const name = await ask('Command name: ');
  const purpose = await ask('Purpose: ');
  const reads = await ask('Reads (comma-separated): ');
  const writes = await ask('Writes/proposes (comma-separated): ');
  rl.close();

  const file = path.join(process.cwd(), 'commands', slug(name) + '.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    console.error('Refusing to overwrite existing file: ' + file);
    process.exit(1);
  }

  const content = `# /${name.replace(/^\//, '')}

## Purpose

${purpose}

## When To Use

Use when this command helps the team make a clear execution decision.

## Reads

${reads.split(',').map((item) => '- ' + item.trim()).filter((item) => item !== '-').join('\n')}

## Writes / Proposes

${writes.split(',').map((item) => '- ' + item.trim()).filter((item) => item !== '-').join('\n')}

## Output Format

Concise markdown with decisions, owners, risks, and next actions.

## Prompt

Read the listed context first. Produce actionable output for a 2-4 person hackathon team. Be explicit about demo impact, verification, and fallback plans.
`;

  fs.writeFileSync(file, content);
  console.log('Created ' + file);
})();

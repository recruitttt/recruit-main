#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const root = path.resolve(__dirname, '..');
const target = path.join(process.cwd(), '.hackathon-os');
const pipedAnswers = process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
let answerIndex = 0;
const ask = (q) => {
  if (pipedAnswers) {
    process.stdout.write(q);
    return Promise.resolve((pipedAnswers[answerIndex++] || '').trim());
  }
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
};
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function relative(file) { return file.replace(process.cwd() + path.sep, ''); }
function safeCopy(src, dest, created) {
  ensure(path.dirname(dest));
  if (fs.existsSync(dest)) {
    if (!fs.existsSync(dest + '.bak')) fs.copyFileSync(dest, dest + '.bak');
    created.push(relative(dest) + ' (kept existing; .bak created if needed)');
    return;
  }
  fs.copyFileSync(src, dest);
  created.push(relative(dest));
}
function safeWrite(dest, body, created) {
  ensure(path.dirname(dest));
  if (fs.existsSync(dest)) {
    if (!fs.existsSync(dest + '.bak')) fs.copyFileSync(dest, dest + '.bak');
    created.push(relative(dest) + ' (kept existing; .bak created if needed)');
    return;
  }
  fs.writeFileSync(dest, body);
  created.push(relative(dest));
}
(async () => {
  const project = await ask('Project name: ');
  const team = await ask('Team size: ');
  const sprint = await ask('Sprint length (24h, 36h, or custom): ');
  const linear = await ask('Using Linear? (yes/no): ');
  if (rl) rl.close();
  const created = [];
  ['knowledge', 'templates', 'status', 'issues', 'outputs'].forEach((d) => ensure(path.join(target, d)));
  for (const folder of ['knowledge', 'templates']) {
    for (const file of fs.readdirSync(path.join(root, folder)).filter((f) => f.endsWith('.md'))) {
      safeCopy(path.join(root, folder, file), path.join(target, folder, file), created);
    }
  }
  safeWrite(path.join(target, 'status/latest.md'), '# Sprint Status Update\n\nDate: ' + new Date().toISOString().slice(0, 10) + '\nProject: ' + (project || '_TODO_') + '\nTeam Size: ' + (team || '_TODO_') + '\nSprint Length: ' + (sprint || '_TODO_') + '\nUsing Linear: ' + (linear || '_TODO_') + '\n\n## Summary\n\n_TODO: Current state._\n\n## Done\n\n- \n\n## In Progress\n\n- \n\n## Blocked\n\n- \n\n## Next Best Actions\n\n1. Fill in project source of truth.\n2. Run /brief create.\n3. Run /issues generate.\n', created);
  safeWrite(path.join(target, 'issues/generated-issues.md'), '# Generated Issues\n\nRun /issues generate after the operating brief is filled in.\n', created);
  console.log('\n✅ Hackathon OS installed\n');
  console.log('Created:');
  for (const item of created) console.log('- ' + item);
  console.log('- .hackathon-os/outputs/');
  console.log('\nNext:');
  ['Fill in .hackathon-os/knowledge/project-source-of-truth.md', 'Run /brief create', 'Run /issues generate', 'Import issues into Linear', 'Run /next'].forEach((x, i) => console.log(String(i + 1) + '. ' + x));
})();

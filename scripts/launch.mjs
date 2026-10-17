#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { defaultRoot, environment, agentCommand, validateUrl, doctor } from './runtime.mjs';

export function buildPrompt(url, skill, folder) {
  return `Use aziz-WA by reading ${path.join(skill, 'SKILL.md')} and following its references.\n` +
    `Deeply audit ${validateUrl(url)} using public pages only, for a marketing prospect assessment. ` +
    'Review UI, UX, accessibility, performance, technical SEO and passive publicly visible technical signals. ' +
    'Mark private source, backend quality, exact full dependency versions and unavailable checks as unverified. ' +
    'Use ordinary browsing and read-only checks; do not submit forms, probe authentication or perform intrusive security testing. ' +
    `Write the detailed aziz-WA-audit-report.md and supporting evidence in ${folder}. ` +
    'Include an evidence-based client summary and suggested service deliverables, without invented revenue losses or guaranteed gains. ' +
    'Deliver the Markdown file first, then ask my approval before creating any PowerPoint. ' +
    'The managed runtime is already installed: use AZIZ_WA_PYTHON for Python and AZIZ_WA_TOOLS_DIR for Playwright/axe/Lighthouse/presentation packages; keep PLAYWRIGHT_BROWSERS_PATH. ' +
    'Do not reinstall tools unless diagnostics establish a specific missing or broken requirement.';
}

async function main() {
  const root = defaultRoot();
  const statePath = path.join(root, 'setup.json');
  if (!fs.existsSync(statePath)) throw new Error('Run the GitHub installer first. No setup record was found.');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const p = state.paths;
  if (process.argv[2] === 'doctor') {
    const result = await doctor(p, state.agents);
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'ready' ? 0 : 1; return;
  }
  if (state.status !== 'ready') throw new Error(`Setup is incomplete. Check ${statePath}, then rerun the installer.`);
  const args = process.argv.slice(2);
  let agent, input;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && args[i + 1]) agent = args[++i];
    else if (!input) input = args[i];
    else throw new Error('Usage: aziz-wa [--agent claude|codex] [https://website.com] or aziz-wa doctor');
  }
  let rl;
  try {
    if (!agent) {
      if (state.agents.length === 1) agent = state.agents[0];
      else {
        if (!process.stdin.isTTY) throw new Error('Choose an agent with --agent claude or --agent codex.');
        rl = createInterface({ input: process.stdin, output: process.stdout });
        const choice = (await rl.question('Choose an agent: 1 = Claude Code, 2 = Codex [1]: ')).trim();
        if (!['', '1', '2'].includes(choice)) throw new Error('Choose 1 or 2.');
        agent = choice === '2' ? 'codex' : 'claude';
      }
    }
    if (!state.agents.includes(agent)) throw new Error(`Agent ${agent} is not installed by this setup.`);
    if (!input) {
      if (!process.stdin.isTTY) throw new Error('Provide the website URL.');
      rl ||= createInterface({ input: process.stdin, output: process.stdout });
      input = (await rl.question('Website to audit (https://...): ')).trim();
    }
  } finally { rl?.close(); }
  const url = validateUrl(input);
  const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '-');
  const folder = path.join(root, 'audits', `${host}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(folder, { recursive: true });
  const prompt = buildPrompt(url, p.skill, folder);
  fs.writeFileSync(path.join(folder, 'audit-request.txt'), prompt);
  const command = agentCommand(p, agent);
  console.log(`\nOpening ${agent}. Sign in if requested. Reports: ${folder}\n`);
  const child = spawn(command.command, [...command.args, prompt], { env: environment(p), cwd: folder, stdio: 'inherit', shell: false });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

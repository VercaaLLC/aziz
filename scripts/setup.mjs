#!/usr/bin/env node
// Stage 2 of the GitHub bootstrap. Invoked with the private Node runtime.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultRoot, pathsFor, environment, run, doctor, quoteSh } from './runtime.mjs';

export function parseOptions(args) {
  const result = { home: defaultRoot(), agent: 'both', shortcut: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-shortcut') { result.shortcut = false; continue; }
    if (!['--home', '--node-root', '--agent'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid setup argument: ${args[i]}`);
    result[args[i].slice(2).replace('node-root', 'nodeRoot')] = args[++i];
  }
  if (!['both', 'claude', 'codex'].includes(result.agent)) throw new Error('Agent must be both, claude or codex.');
  result.home = path.resolve(result.home);
  if (result.home === path.parse(result.home).root || result.home === os.homedir()) throw new Error('Choose a dedicated installation folder.');
  if (!result.nodeRoot) throw new Error('Use install.sh or install.ps1 to bootstrap Node first.');
  result.nodeRoot = path.resolve(result.nodeRoot);
  return result;
}

export async function download(url, destination, maxBytes = 12_000_000) {
  let current = new URL(url);
  for (let count = 0; count < 8; count++) {
    if (current.protocol !== 'https:') throw new Error('Installer downloads require HTTPS.');
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(120000) });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = new URL(response.headers.get('location'), current); continue;
    }
    if (!response.ok) throw new Error(`Download failed: ${current.host} HTTP ${response.status}`);
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new Error('Installer download exceeded its size limit.');
      chunks.push(chunk);
    }
    await fsp.writeFile(destination, Buffer.concat(chunks), { flag: 'wx', mode: 0o700 });
    return;
  }
  throw new Error('Installer download exceeded redirect limit.');
}

export function copySkill(source, p) {
  const markerName = '.aziz-wa-managed.json';
  const oldMarker = path.join(p.skill, markerName);
  if (fs.existsSync(p.skill)) {
    let owner;
    try { owner = JSON.parse(fs.readFileSync(oldMarker, 'utf8')); } catch { /* Refuse unknown folders. */ }
    if (owner?.root !== p.root) throw new Error(`Existing skill folder is not managed by this installer: ${p.skill}`);
  }
  const stage = fs.mkdtempSync(path.join(p.root, '.skill-stage-'));
  try {
    for (const name of ['SKILL.md', 'README.md', 'LICENSE', 'install.sh', 'install.ps1', 'agents', 'references', 'scripts']) {
      const item = path.join(source, name);
      if (!fs.existsSync(item)) throw new Error(`Incomplete source: ${name} is missing.`);
      fs.cpSync(item, path.join(stage, name), { recursive: true, filter: itemPath => !['__pycache__', '.DS_Store'].includes(path.basename(itemPath)) });
    }
    fs.writeFileSync(path.join(stage, markerName), JSON.stringify({ root: p.root, installed_at: new Date().toISOString() }));
    if (fs.existsSync(p.skill)) {
      fs.mkdirSync(path.join(p.root, 'backups'), { recursive: true });
      fs.renameSync(p.skill, path.join(p.root, 'backups', `skill-${Date.now()}`));
    }
    fs.renameSync(stage, p.skill);
  } catch (error) { fs.rmSync(stage, { recursive: true, force: true }); throw error; }
}

export function writeLaunchers(p, shortcut, platform = process.platform) {
  fs.mkdirSync(p.bin, { recursive: true });
  const launch = path.join(p.skill, 'scripts', 'launch.mjs');
  const runtime = platform === 'win32'
    ? `@echo off\r\nrem aziz-WA managed launcher\r\nset "AZIZ_WA_HOME=${p.root.replace(/%/g, '%%')}"\r\n"${p.node.replace(/%/g, '%%')}" "${launch.replace(/%/g, '%%')}" %*\r\nif errorlevel 1 pause\r\n`
    : `#!/usr/bin/env bash\n# aziz-WA managed launcher\nexport AZIZ_WA_HOME=${quoteSh(p.root)}\nexec ${quoteSh(p.node)} ${quoteSh(launch)} "$@"\n`;
  const launcherPath = path.join(p.bin, platform === 'win32' ? 'aziz-wa.cmd' : 'aziz-wa');
  fs.writeFileSync(launcherPath, runtime, { mode: 0o700 });
  const created = { launcher: launcherPath, desktop: null };
  if (!shortcut) return created;
  const desktop = process.env.AZIZ_WA_DESKTOP || path.join(os.homedir(), 'Desktop');
  if (!fs.existsSync(desktop)) return created;
  let target, text;
  if (platform === 'win32') { target = path.join(desktop, 'aziz-WA.cmd'); text = runtime; }
  else if (platform === 'darwin') { target = path.join(desktop, 'aziz-WA.command'); text = runtime; }
  else {
    target = path.join(desktop, 'aziz-WA.desktop');
    // Desktop-entry Exec syntax differs from shell quoting.
    const escaped = launcherPath.replace(/([\\"`$])/g, '\\$1').replace(/%/g, '%%');
    text = `[Desktop Entry]\n# aziz-WA managed launcher\nType=Application\nName=aziz-WA\nTerminal=true\nExec="${escaped}"\n`;
  }
  if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes('aziz-WA managed launcher')) {
    console.warn(`Preserved existing desktop file: ${target}`); return created;
  }
  fs.writeFileSync(target, text, { mode: 0o700 }); created.desktop = target;
  return created;
}

export async function setup(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const p = pathsFor(options.home, options.nodeRoot);
  fs.mkdirSync(p.root, { recursive: true });
  const statePath = path.join(p.root, 'setup.json');
  const state = { schema_version: '1.1', started_at: new Date().toISOString(), status: 'installing',
    node_version: process.versions.node, platform: process.platform, arch: process.arch,
    agents: options.agent === 'both' ? ['claude', 'codex'] : [options.agent], paths: p, steps: [] };
  const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  const step = async (name, action) => {
    console.log(`\n[aziz-WA] ${name}`);
    const entry = { name, status: 'running' }; state.steps.push(entry); save();
    try { await action(); entry.status = 'passed'; save(); }
    catch (error) { entry.status = 'failed'; entry.reason = error.message; save(); throw error; }
  };
  const env = environment(p);
  const invoke = (command, argv, extra = {}) => run(command, argv, { env, cwd: p.root, ...extra });
  try {
    await step('Prepare the managed skill folder', () => copySkill(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), p));
    await step('Install Python runtime manager', async () => {
      if (!fs.existsSync(p.uv)) {
        const script = path.join(p.root, `uv-installer-${Date.now()}.${process.platform === 'win32' ? 'ps1' : 'sh'}`);
        try {
          await download(`https://astral.sh/uv/install.${process.platform === 'win32' ? 'ps1' : 'sh'}`, script);
          if (process.platform === 'win32') {
            // PowerShell 7 exports its module paths. Windows PowerShell 5.1
            // must build its own defaults instead of loading incompatible modules.
            const shellEnv = { ...env };
            for (const key of Object.keys(shellEnv)) if (key.toLowerCase() === 'psmodulepath') delete shellEnv[key];
            invoke('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { env: shellEnv });
          }
          else invoke('sh', [script]);
        } finally { fs.rmSync(script, { force: true }); }
      }
      invoke(p.uv, ['--version']);
    });
    await step('Install managed Python and PowerPoint libraries', () => {
      invoke(p.uv, ['python', 'install', '3.12']);
      if (!fs.existsSync(p.python)) invoke(p.uv, ['venv', '--python', '3.12', path.join(p.root, 'python-env')]);
      invoke(p.uv, ['pip', 'install', '--python', p.python, 'python-pptx>=1,<2', 'Pillow>=11,<13']);
    });
    await step('Install browser, accessibility, performance, presentation and agent tools', () => {
      fs.mkdirSync(p.tools, { recursive: true });
      const manifestPath = path.join(p.tools, 'package.json');
      const manifest = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { name: 'aziz-wa-local-tools', private: true };
      // Current npm requires explicit approval for dependency setup scripts.
      // Claude's official postinstall connects its platform-specific native binary.
      if (state.agents.includes('claude')) manifest.allowScripts = { ...manifest.allowScripts, '@anthropic-ai/claude-code': true };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      const packages = ['playwright@latest', '@axe-core/playwright@latest', 'lighthouse@latest', 'pptxgenjs@latest', '@marp-team/marp-cli@latest'];
      if (state.agents.includes('claude')) packages.push('@anthropic-ai/claude-code@latest');
      if (state.agents.includes('codex')) packages.push('@openai/codex@latest');
      invoke(p.node, [p.npm, 'install', '--prefix', p.tools, '--save-exact', '--include=optional', '--no-audit', '--no-fund', ...packages]);
      state.node_packages = JSON.parse(fs.readFileSync(path.join(p.tools, 'package.json'), 'utf8')).dependencies;
    });
    await step('Install Chromium and browser system dependencies', () => {
      const argv = [path.join(p.tools, 'node_modules/playwright/cli.js'), 'install'];
      if (process.platform === 'linux') {
        console.log('Linux may request your administrator password to install Chromium system libraries.');
        argv.push('--with-deps');
      }
      invoke(p.node, [...argv, 'chromium']);
      const probe = invoke(p.node, ['-e', 'process.stdout.write(require(process.argv[1]).chromium.executablePath())', path.join(p.tools, 'node_modules/playwright')], { stdio: 'pipe' });
      p.chromium = probe.stdout.toString().trim();
      env.CHROME_PATH = p.chromium;
    });
    await step('Install the skill into the selected agents', () => {
      const argv = [path.join(p.skill, 'scripts/install.py'), '--agent', options.agent, '--update-owned', '--managed-root', p.root];
      if (process.platform === 'win32') argv.push('--copy');
      invoke(p.python, argv);
    });
    await step('Create launchers', () => { state.launchers = writeLaunchers(p, options.shortcut); });
    await step('Verify installed runtimes, browser and tools', async () => {
      state.doctor = await doctor(p, state.agents);
      save();
      for (const result of state.doctor.results) console.log(`${result.status}: ${result.name}${result.reason ? ` — ${result.reason}` : ''}`);
      if (state.doctor.status !== 'ready') throw new Error('Installation checks are incomplete. See setup.json and the failed check above.');
    });
    state.status = 'ready'; state.completed_at = new Date().toISOString(); save();
    console.log('\naziz-WA is installed. No Node.js, Python, agent or audit-tool installation remains.');
    console.log(`Start: ${state.launchers.desktop || state.launchers.launcher}`);
    console.log('Sign in to Claude Code or Codex when it opens. Model accounts/usage are separate from this free installer.');
    console.log(`Installation record: ${statePath}`);
    return state;
  } catch (error) {
    state.status = 'incomplete'; state.error = error.message; save();
    throw new Error(`${error.message}\nSetup is not complete. Rerun the same installer after resolving the error. Record: ${statePath}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  setup().catch(error => { console.error(error.message); process.exitCode = 1; });
}

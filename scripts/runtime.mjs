// Shared environment, doctor and launcher helpers. No network on import.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

export function defaultRoot(platform = process.platform, env = process.env, userDir = os.homedir()) {
  return path.resolve(env.AZIZ_WA_HOME || (platform === 'win32'
    ? path.join(env.LOCALAPPDATA || path.join(userDir, 'AppData', 'Local'), 'aziz-wa')
    : path.join(userDir, '.local', 'share', 'aziz-wa')));
}
export function pathsFor(root, nodeRoot, platform = process.platform) {
  const win = platform === 'win32';
  return { root, nodeRoot, node: path.join(nodeRoot, win ? 'node.exe' : 'bin/node'),
    npm: path.join(nodeRoot, win ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js'),
    tools: path.join(root, 'tools'), skill: path.join(root, 'skill'),
    uv: path.join(root, 'runtime', 'uv', win ? 'uv.exe' : 'uv'),
    python: path.join(root, 'python-env', win ? 'Scripts/python.exe' : 'bin/python'),
    browsers: path.join(root, 'browsers'), bin: path.join(root, 'bin') };
}
export function environment(p, original = process.env) {
  return { ...original, AZIZ_WA_HOME: p.root, AZIZ_WA_TOOLS_DIR: p.tools, AZIZ_WA_PYTHON: p.python,
    PLAYWRIGHT_BROWSERS_PATH: p.browsers, ...(p.chromium ? { CHROME_PATH: p.chromium } : {}),
    UV_UNMANAGED_INSTALL: path.dirname(p.uv), UV_NO_MODIFY_PATH: '1', UV_NO_CONFIG: '1',
    UV_PYTHON_INSTALL_DIR: path.join(p.root, 'runtime', 'python'), UV_PYTHON_BIN_DIR: path.join(p.root, 'runtime', 'python-bin'),
    UV_PYTHON_INSTALL_REGISTRY: 'false', UV_CACHE_DIR: path.join(p.root, 'cache', 'uv'),
    PATH: [p.bin, path.dirname(p.node), path.dirname(p.python), path.join(p.tools, 'node_modules', '.bin'), original.PATH || ''].join(path.delimiter) };
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(command)} failed: ${result.error?.message || `exit ${result.status}`}`);
  return result;
}
export function agentCommand(p, agent) {
  const packageName = agent === 'claude' ? '@anthropic-ai/claude-code' : '@openai/codex';
  const directory = path.join(p.tools, 'node_modules', packageName);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const binary = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[agent];
  if (!binary) throw new Error(`${agent} has no executable in its package manifest.`);
  const executable = path.join(directory, binary);
  return /\.[cm]?js$/i.test(executable) ? { command: p.node, args: [executable] } : { command: executable, args: [] };
}
export function quoteSh(value) { return `'${String(value).replace(/'/g, `'"'"'`)}'`; }
export function validateUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a public HTTP(S) URL without embedded credentials.');
  return url.href;
}
export async function doctor(p, agents, options = {}) {
  const results = [];
  const env = environment(p);
  const check = async (name, action) => {
    try { await action(); results.push({ name, status: 'passed' }); }
    catch (error) { results.push({ name, status: 'failed', reason: error.message.split('\n')[0] }); }
  };
  const quiet = options.quiet ? 'pipe' : 'inherit';
  await check('Node.js and npm', () => { run(p.node, ['--version'], { env, stdio: quiet }); run(p.node, [p.npm, '--version'], { env, stdio: quiet }); });
  await check('Python and PowerPoint libraries', () => run(p.python, ['-c', 'import sys, pptx, PIL; assert sys.version_info >= (3,11); print(sys.version.split()[0])'], { env, stdio: quiet }));
  const require = createRequire(path.join(p.tools, '__resolver__.cjs'));
  await check('Lighthouse and presentation generation/rendering tools', () => { require.resolve('lighthouse'); require('pptxgenjs'); require.resolve('@marp-team/marp-cli'); });
  for (const agent of agents) await check(`${agent} agent executable`, () => {
    const cmd = agentCommand(p, agent); run(cmd.command, [...cmd.args, '--version'], { env, stdio: quiet, timeout: 60000 });
  });
  await check('Chromium launch and axe accessibility engine', async () => {
    // Playwright reads its browser location from this process, not a child env.
    const old = process.env.PLAYWRIGHT_BROWSERS_PATH;
    process.env.PLAYWRIGHT_BROWSERS_PATH = p.browsers;
    let browser;
    try {
      const { chromium } = require('playwright');
      const mod = require('@axe-core/playwright');
      const AxeBuilder = mod.default || mod.AxeBuilder || mod;
      browser = await chromium.launch({ headless: true });
      // axe opens an auxiliary page; Playwright's browser.newPage convenience
      // context only permits its single owned page.
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('data:text/html,<html lang="en"><title>aziz-WA setup check</title><main><h1>Ready</h1></main></html>');
      const result = await new AxeBuilder({ page }).analyze();
      if (!result.testEngine?.version) throw new Error('axe did not return a valid result.');
    } finally {
      if (browser) await browser.close();
      if (old === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH; else process.env.PLAYWRIGHT_BROWSERS_PATH = old;
    }
  });
  return { checked_at: new Date().toISOString(), status: results.every(r => r.status === 'passed') ? 'ready' : 'incomplete',
    results, account_sign_in: 'User signs in to the chosen agent; no credentials are installed or collected.',
    presentation_rendering: 'Marp and Chromium provide image-based PPTX export and slide image rendering. Editable PptxGenJS/python-pptx decks require separate visual verification when native rendering is unavailable.' };
}

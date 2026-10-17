#!/usr/bin/env node
// Optional Playwright/axe evidence capture. Never downloads or installs tools.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: browser-audit.mjs --url URL --out DIR [--tools-dir DIR] [--channel chrome] [--require-axe]');
    process.exit(0);
  }
  if (args[i] === '--require-axe') { opts.requireAxe = true; continue; }
  if (!['--url', '--out', '--tools-dir', '--channel'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
    console.error(`Invalid argument: ${args[i]}`); process.exit(2);
  }
  opts[args[i].slice(2)] = args[++i];
}
if (!opts.url || !opts.out) { console.error('--url and --out are required'); process.exit(2); }
let url;
try {
  url = new URL(opts.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
} catch { console.error('Use an HTTP(S) URL without embedded credentials.'); process.exit(2); }

const out = path.resolve(opts.out);
const report = { schema_version: '1.0', checked_at: new Date().toISOString(),
  target: url.href, tools: {}, pages: [], limitations: [
    'Explicit URL only; no crawl, task walkthrough, authentication, or screen-reader testing.',
    'Viewport emulation is not a real mobile browser test.',
    'Overflow candidates need human review; no visual quality score is computed.',
    'No field Core Web Vitals or whole-site accessibility conformance is established.',
  ] };
let browser;
let exitCode = 0;
const safe = value => String(value).replace(/(https?:\/\/)[^/\s@]+@/g, '$1<redacted>@')
  .replace(/([?&](?:token|key|password|secret|auth|code)=)[^&#\s]+/gi, '$1<redacted>');
const requireTool = createRequire(path.join(path.resolve(opts['tools-dir'] || process.cwd()), '__audit_resolver__.cjs'));
async function toolVersion(name) {
  let directory = path.dirname(requireTool.resolve(name));
  for (let depth = 0; depth < 6; depth++) {
    try {
      const info = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
      if (info.name === name) return info.version;
    } catch { /* Package exports need not expose package.json. */ }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return 'unknown';
}
try {
  // New folder only: never replace previous evidence.
  await fs.mkdir(out, { recursive: false });
} catch (error) {
  console.error(`Cannot create a fresh output directory: ${error.message}`); process.exit(2);
}
try {
  const { chromium } = requireTool('playwright');
  report.tools.playwright = await toolVersion('playwright');
  let AxeBuilder;
  try {
    const mod = requireTool('@axe-core/playwright');
    AxeBuilder = mod.default || mod.AxeBuilder || mod;
    report.tools.axePlaywright = await toolVersion('@axe-core/playwright');
  } catch (error) {
    report.limitations.push(`axe unavailable: ${safe(error.message)}`);
    if (opts.requireAxe) throw new Error('Requested axe is not installed in --tools-dir.');
  }
  browser = await chromium.launch({ headless: true, ...(opts.channel ? { channel: opts.channel } : {}) });
  report.tools.channel = opts.channel || 'bundled-chromium';
  report.tools.browser = browser.version();
  for (const [name, width, height] of [['mobile', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 1000]]) {
    const entry = { name, viewport: { width, height }, console_errors: [], page_errors: [],
      failed_requests: [], http_errors: [], limitations: [] };
    report.pages.push(entry);
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const capped = (key, value) => { if (entry[key].length < 100) entry[key].push(value); };
    page.on('console', msg => { if (msg.type() === 'error') capped('console_errors', safe(msg.text())); });
    page.on('pageerror', error => capped('page_errors', safe(error.message)));
    page.on('requestfailed', request => capped('failed_requests', { url: safe(request.url()), error: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) capped('http_errors', { url: safe(response.url()), status: response.status() }); });
    try {
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      entry.status = response?.status() ?? null;
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => entry.limitations.push('Network did not become idle in 5 seconds.'));
      entry.final_url = safe(page.url());
      entry.title = await page.title();
      entry.dom = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const candidates = Array.from(document.querySelectorAll('body *')).map(el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || s.display === 'none' || s.visibility === 'hidden') return null;
          if (r.right <= width + 1 && r.left >= -1) return null;
          return { tag: el.tagName.toLowerCase(), id: el.id, class: String(el.className).slice(0,160),
            left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
        }).filter(Boolean).slice(0, 40);
        return { language: document.documentElement.lang, viewport_width: width,
          scroll_width: document.documentElement.scrollWidth, overflow_candidates: candidates,
          headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 60).map(el => ({ level: el.tagName, text: el.textContent.trim().slice(0, 200) })) };
      });
      for (const [suffix, fullPage] of [['viewport', false], ['full', true]]) {
        const filename = `${name}-${suffix}.png`;
        await page.screenshot({ path: path.join(out, filename), fullPage, animations: 'disabled', timeout: 20000 });
        (entry.screenshots ||= []).push(filename);
      }
      if (AxeBuilder) {
        try {
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
          const filename = `${name}-axe.json`;
          await fs.writeFile(path.join(out, filename), JSON.stringify(axe, null, 2), { flag: 'wx' });
          entry.axe = { artifact: filename, violations: axe.violations.length,
            incomplete: axe.incomplete.length, passes: axe.passes.length, version: axe.testEngine.version };
        } catch (error) { entry.axe = { error: safe(error.message) }; exitCode = 1; }
      } else entry.axe = { status: 'not-tested' };
    } catch (error) { entry.error = safe(error.message); exitCode = 1; }
    finally { await context.close(); }
  }
} catch (error) {
  report.error = safe(error.message);
  report.limitations.push('Browser capture incomplete; missing tools or launch errors are not a website pass.');
  exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  report.target = safe(report.target);
  await fs.writeFile(path.join(out, 'browser-evidence.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(JSON.stringify({ output: path.join(out, 'browser-evidence.json'), viewports: report.pages.length,
  status: exitCode ? 'incomplete' : 'captured-agent-review-required', error: report.error?.split('\n')[0] }));
process.exitCode = exitCode;

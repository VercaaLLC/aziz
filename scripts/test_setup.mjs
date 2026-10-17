import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseOptions, download, copySkill, writeLaunchers } from './setup.mjs';
import { defaultRoot, pathsFor, environment, agentCommand, validateUrl, quoteSh, doctor } from './runtime.mjs';
import { buildPrompt } from './launch.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function temporary() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aziz-setup-test-')); }
function packageFile(root, name, manifest) {
  const directory = path.join(root, 'tools/node_modules', name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest));
  return directory;
}

test('default roots use platform-specific user locations without changing environment', () => {
  assert.equal(defaultRoot('linux', {}, '/users/a'), path.resolve('/users/a/.local/share/aziz-wa'));
  assert.equal(defaultRoot('win32', { LOCALAPPDATA: '/local' }, '/users/a'), path.resolve('/local/aziz-wa'));
  assert.equal(defaultRoot('linux', { AZIZ_WA_HOME: '/custom' }), path.resolve('/custom'));
});
test('setup rejects unsafe roots, invalid agents and incomplete arguments', () => {
  assert.throws(() => parseOptions(['--home', path.parse(process.cwd()).root, '--node-root', '/node']), /dedicated/);
  assert.throws(() => parseOptions(['--agent', 'unknown']), /Agent/);
  assert.throws(() => parseOptions(['--node-root']), /Invalid/);
  assert.throws(() => parseOptions([]), /bootstrap/);
});
test('doctor reports incomplete rather than ready when installed tools are absent', async () => {
  const root = temporary();
  try {
    const result = await doctor(pathsFor(root, path.join(root, 'node')), ['codex'], { quiet: true });
    assert.equal(result.status, 'incomplete');
    assert.ok(result.results.every(check => check.status === 'failed'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('runtime environment uses private tools and preserves existing PATH', () => {
  const p = pathsFor(path.resolve('/private-install'), path.resolve('/private-node'));
  const original = { PATH: '/existing', UNRELATED: 'preserved' };
  const result = environment(p, original);
  assert.equal(result.AZIZ_WA_PYTHON, p.python);
  assert.equal(result.PLAYWRIGHT_BROWSERS_PATH, p.browsers);
  assert.ok(result.PATH.endsWith('/existing'));
  assert.equal(result.UNRELATED, 'preserved');
  assert.equal(original.PATH, '/existing');
});
test('agent executables are resolved from installed package metadata', () => {
  const root = temporary();
  try {
    packageFile(root, '@openai/codex', { bin: { codex: 'bin/codex.js' } });
    packageFile(root, '@anthropic-ai/claude-code', { bin: { claude: 'bin/claude.exe' } });
    const p = pathsFor(root, path.join(root, 'node'));
    assert.equal(agentCommand(p, 'codex').command, p.node);
    assert.ok(agentCommand(p, 'codex').args[0].endsWith('codex.js'));
    assert.ok(agentCommand(p, 'claude').command.endsWith('claude.exe'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('managed skill updates preserve the previous release and its edits', () => {
  const root = temporary(); const p = pathsFor(root, path.join(root, 'node'));
  try {
    copySkill(source, p);
    fs.writeFileSync(path.join(p.skill, 'user-note.txt'), 'preserve me');
    copySkill(source, p);
    const backup = fs.readdirSync(path.join(root, 'backups'))[0];
    assert.equal(fs.readFileSync(path.join(root, 'backups', backup, 'user-note.txt'), 'utf8'), 'preserve me');
    assert.ok(fs.existsSync(path.join(p.skill, 'scripts/setup.mjs')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('unknown installation folders are never replaced', () => {
  const root = temporary(); const p = pathsFor(root, path.join(root, 'node'));
  try {
    fs.mkdirSync(p.skill); fs.writeFileSync(path.join(p.skill, 'keep'), 'original');
    assert.throws(() => copySkill(source, p), /not managed/);
    assert.equal(fs.readFileSync(path.join(p.skill, 'keep'), 'utf8'), 'original');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('audit URL validation rejects embedded credentials and non-web protocols', () => {
  assert.equal(validateUrl('https://example.com'), 'https://example.com/');
  for (const url of ['file:///tmp/local', 'https://user:secret@example.com', 'javascript:alert(1)']) assert.throws(() => validateUrl(url));
});
test('launch prompt retains the exact target as data including shell punctuation', () => {
  const skill = path.resolve('skill folder');
  const folder = path.resolve('reports folder');
  const prompt = buildPrompt('https://example.com/?q=%24%28x%29&mode=a', skill, folder);
  assert.ok(prompt.includes('https://example.com/?q=%24%28x%29&mode=a'));
  assert.ok(prompt.includes(path.join(skill, 'SKILL.md')));
  assert.ok(prompt.includes(folder));
});
test('HTTPS downloader rejects plaintext and redirect downgrades', async () => {
  const root = temporary(); const original = globalThis.fetch;
  try {
    await assert.rejects(download('http://example.com', path.join(root, 'a')), /HTTPS/);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'http://example.com/file' } });
    await assert.rejects(download('https://example.com', path.join(root, 'b')), /HTTPS/);
    assert.equal(fs.readdirSync(root).length, 0);
  } finally { globalThis.fetch = original; fs.rmSync(root, { recursive: true, force: true }); }
});
test('HTTPS downloader caps response size and never replaces existing evidence', async () => {
  const root = temporary(); const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('12345678');
    await assert.rejects(download('https://example.com', path.join(root, 'large'), 4), /size limit/);
    const file = path.join(root, 'existing'); fs.writeFileSync(file, 'keep');
    await assert.rejects(download('https://example.com', file), /EEXIST/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
  } finally { globalThis.fetch = original; fs.rmSync(root, { recursive: true, force: true }); }
});
test('custom-root launcher actually propagates its runtime location', { skip: process.platform === 'win32' }, () => {
  const root = temporary(); const p = pathsFor(root, path.join(root, 'node'));
  try {
    fs.mkdirSync(path.dirname(p.node), { recursive: true });
    fs.writeFileSync(p.node, `#!/bin/sh\nexec ${quoteSh(process.execPath)} "$@"\n`, { mode: 0o700 });
    fs.mkdirSync(path.join(p.skill, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(p.skill, 'scripts/launch.mjs'), 'console.log(JSON.stringify({root:process.env.AZIZ_WA_HOME,args:process.argv.slice(2)}));');
    const launcher = writeLaunchers(p, false).launcher;
    const command = spawnSync('bash', [launcher, 'https://example.com/?x=a&y=b'], { encoding: 'utf8', env: { ...process.env, AZIZ_WA_HOME: '/wrong' } });
    assert.equal(command.status, 0, command.stderr);
    assert.deepEqual(JSON.parse(command.stdout), { root, args: ['https://example.com/?x=a&y=b'] });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('desktop shortcuts preserve pre-existing user files', () => {
  const root = temporary(); const desktop = path.join(root, 'desktop'); fs.mkdirSync(desktop);
  const original = process.env.AZIZ_WA_DESKTOP;
  try {
    process.env.AZIZ_WA_DESKTOP = desktop;
    const p = pathsFor(root, path.join(root, 'node'));
    fs.writeFileSync(path.join(desktop, 'aziz-WA.command'), 'user-owned');
    const result = writeLaunchers(p, true, 'darwin');
    assert.equal(result.desktop, null);
    assert.equal(fs.readFileSync(path.join(desktop, 'aziz-WA.command'), 'utf8'), 'user-owned');
  } finally {
    if (original === undefined) delete process.env.AZIZ_WA_DESKTOP; else process.env.AZIZ_WA_DESKTOP = original;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('shell bootstrap plan does not create installation folders', { skip: process.platform === 'win32' }, () => {
  const root = temporary(); const destination = path.join(root, 'new installation');
  try {
    const result = spawnSync('bash', [path.join(source, 'install.sh'), '--home', destination, '--plan'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(destination), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('bootstrap verifies a downloaded runtime before executing stage two', { skip: process.platform === 'win32' }, () => {
  const root = temporary();
  try {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
    const name = `node-v24.0.0-${platform}-${arch}.tar.gz`;
    const fixture = path.join(root, 'fixture'); fs.mkdirSync(path.join(fixture, 'node/bin'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'node/bin/node'), `#!/bin/sh\nexec ${quoteSh(process.execPath)} "$@"\n`, { mode: 0o700 });
    const archive = path.join(root, name);
    const tar = spawnSync('tar', ['-czf', archive, '-C', fixture, 'node']); assert.equal(tar.status, 0);
    const sum = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    const sums = path.join(root, 'sums'); fs.writeFileSync(sums, `${sum}  ${name}\n`);
    const mockbin = path.join(root, 'mockbin'); fs.mkdirSync(mockbin);
    fs.writeFileSync(path.join(mockbin, 'curl'), `#!/bin/sh\nurl=''\nout=''\nwhile [ "$#" -gt 0 ]; do case "$1" in -o) out=$2; shift 2;; https:*) url=$1; shift;; *) shift;; esac; done\ncase "$url" in */SHASUMS256.txt) cp "$AZIZ_TEST_SUMS" "$out";; *) cp "$AZIZ_TEST_ARCHIVE" "$out";; esac\n`, { mode: 0o700 });
    const stage = path.join(root, 'source'); fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(stage, 'SKILL.md'), 'fixture');
    const marker = path.join(root, 'stage-ran');
    fs.writeFileSync(path.join(stage, 'scripts/setup.mjs'), 'import fs from "node:fs"; fs.writeFileSync(process.env.AZIZ_TEST_MARKER,"ran");');
    const env = { ...process.env, PATH: mockbin + path.delimiter + process.env.PATH, AZIZ_TEST_SUMS: sums, AZIZ_TEST_ARCHIVE: archive, AZIZ_TEST_MARKER: marker };
    const installRoot = path.join(root, 'private install');
    const argv = [path.join(source, 'install.sh'), '--home', installRoot, '--source', stage, '--no-shortcut'];
    const good = spawnSync('bash', argv, { env, encoding: 'utf8' });
    assert.equal(good.status, 0, good.stderr); assert.equal(fs.readFileSync(marker, 'utf8'), 'ran');
    fs.unlinkSync(marker); fs.writeFileSync(sums, `${'0'.repeat(64)}  ${name}\n`);
    const bad = spawnSync('bash', [path.join(source, 'install.sh'), '--home', path.join(root, 'bad install'), '--source', stage], { env, encoding: 'utf8' });
    assert.notEqual(bad.status, 0); assert.match(bad.stderr, /checksum mismatch/); assert.equal(fs.existsSync(marker), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

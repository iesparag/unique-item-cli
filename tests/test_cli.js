import { expect } from 'chai';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Compute CLI entry point
const CLI_PATH = path.resolve('cli', 'index.js');
const STORAGE_ENV = 'STORAGE_PATH';

// Helper to exec CLI with args, in test mode, in temp storage file
function runCli(args = [], { env = {}, input = null } = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, ...env };
    const proc = execFile(
      process.execPath, // Node
      [CLI_PATH, ...args],
      { env: childEnv },
      (err, stdout, stderr) => {
        resolve({
          code: err && err.code ? err.code : 0,
          stdout,
          stderr
        });
      }
    );
    if (input) proc.stdin.end(input);
  });
}

// Use a temp file for test isolation
describe('CLI', function () {
  const testFile = path.join(
    os.tmpdir(),
    '.uniqueitemcli.test.' + process.pid + '_' + Math.random().toString(16).slice(2) + '.json'
  );

  beforeEach(async function () {
    try { await fs.unlink(testFile); } catch { }
  });
  afterEach(async function () {
    try { await fs.unlink(testFile); } catch { }
  });

  it('should exit with error if --name is missing', async function () {
    const { code, stderr } = await runCli([
      'generate',
      // no --name
      '--tags', 'tag1,tag2'
    ], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.not.equal(0);
    expect(stderr + '').to.match(/--name/);
  });

  it('should exit with error if tags are invalid', async function () {
    const { code, stderr } = await runCli([
      'generate', '--name', 'ItemWithBadTag', '--tags', 'ok,inv@lid' ], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.not.equal(0);
    expect(stderr + '').to.match(/tags must be alphanumeric/);
  });

  it('should generate a unique item with minimal input', async function () {
    const { code, stdout, stderr } = await runCli([
      'generate', '--name', 'MyItem' ], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.equal(0);
    expect(stdout).to.include('Unique item created successfully!');
    expect(stdout).to.match(/id: /);
    expect(stdout).to.match(/name: MyItem/);
    expect(stdout).to.match(/created_at: /);
    expect(stdout).to.match(/content: /);
    // Tags show as []
    expect(stdout).to.match(/tags: \[\]/);
    // File should exist and contain one item
    const file = await fs.readFile(testFile, 'utf8');
    const arr = JSON.parse(file);
    expect(arr).to.have.length(1);
    expect(arr[0].name).to.equal('MyItem');
  });

  it('should generate a unique item with tags', async function () {
    const { code, stdout } = await runCli([
      'generate', '--name', 'WithTags', '--tags', 'alpha,BETA_1' ], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.equal(0);
    expect(stdout).to.include('Unique item created successfully!');
    expect(stdout).to.include('name: WithTags');
    expect(stdout).to.match(/tags: \[alpha, BETA_1\]/);
    // File should contain correct tags
    const file = await fs.readFile(testFile, 'utf8');
    const arr = JSON.parse(file);
    expect(arr[0].tags).to.deep.equal(['alpha', 'BETA_1']);
  });

  it('should show help and usage info for generate', async function () {
    const { code, stdout } = await runCli(['generate', '--help'], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.equal(0);
    expect(stdout).to.match(/Usage: generate \[options\]/);
    expect(stdout).to.include('--name');
    expect(stdout).to.include('--tags');
  });

  it('should error on empty name', async function () {
    const { code, stderr } = await runCli(['generate', '--name', '', '--tags', 't'], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.not.equal(0);
    expect(stderr).to.match(/--name is required/);
  });

  it('should handle whitespace and blank tags', async function () {
    // Should ignore blank tags, accept spaced tags
    const { code, stdout } = await runCli([
      'generate', '--name', 'Spaces', '--tags', 'foo, ,bar , baz'
    ], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.equal(0);
    expect(stdout).to.include('tags: [foo, bar, baz]');
    const file = await fs.readFile(testFile, 'utf8');
    const arr = JSON.parse(file);
    expect(arr[0].tags).to.deep.equal(['foo', 'bar', 'baz']);
  });

  // --- INTEGRATION TESTS FOR LIST COMMAND ---

  it('should show friendly message if no items to list', async function () {
    const { code, stdout, stderr } = await runCli(['list'], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.equal(0);
    expect(stdout.trim()).to.match(/no unique items stored/i);
  });

  it('should display multiple items in tabular format', async function () {
    // Add several items
    await runCli(['generate', '--name', 'First', '--tags', 'alpha'], { env: { [STORAGE_ENV]: testFile } });
    await runCli(['generate', '--name', 'Second Item', '--tags', 'beta,gamma'], { env: { [STORAGE_ENV]: testFile } });
    // Call list
    const { code, stdout } = await runCli(['list'], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.equal(0);
    // Table headers
    expect(stdout).to.match(/id\s+name\s+tags\s+created_at/);
    // At least two rows
    const lines = stdout.trim().split(/\r?\n/);
    const headerIdx = lines.findIndex(l => /id\s+name\s+tags\s+created_at/.test(l));
    expect(headerIdx).to.be.at.least(0);
    // Should contain both First and Second Item
    const foundFirst = lines.some(l => /First/.test(l));
    const foundSecond = lines.some(l => /Second Item/.test(l));
    expect(foundFirst).to.be.true;
    expect(foundSecond).to.be.true;
    // Should see tags printed nicely
    const tagsLine = lines.find(l => /alpha/.test(l) || /beta, gamma/.test(l));
    expect(tagsLine).to.match(/alpha|beta, gamma/);
    // created_at is trimmed (first 19 chars)
    const createdSnippet = lines.some(l => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(l));
    expect(createdSnippet).to.be.true;
  });

  it('should not throw or crash on corrupted storage for list', async function () {
    // Corrupt the storage file
    await fs.writeFile(testFile, '{ bad json', 'utf8');
    const { code, stdout, stderr } = await runCli(['list'], { env: { [STORAGE_ENV]: testFile } });
    expect(code).to.not.equal(0);
    expect(stderr).to.match(/Error reading storage/i);
    expect(stderr).to.match(/Corrupted JSON/);
  });
});

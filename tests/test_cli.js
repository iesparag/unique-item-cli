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

  // --- INTEGRATION TESTS FOR SEARCH COMMAND ---

  describe('search command', function () {
    function prepItems() {
      // Add three different items
      return runCli([ 'generate', '--name', 'FindMe', '--tags', 'alpha,match1' ], { env: { [STORAGE_ENV]: testFile } })
        .then(() => runCli([ 'generate', '--name', 'otherthing', '--tags', 'beta' ], { env: { [STORAGE_ENV]: testFile } }))
        .then(() => runCli([ 'generate', '--name', 'PartialTag', '--tags', 'gammadelta', 'PARTthing' ], { env: { [STORAGE_ENV]: testFile } }))
        .then(() => runCli([ 'generate', '--name', 'hascontent', '--tags', 'zzz' ], { env: { [STORAGE_ENV]: testFile } }))
        .then(() => fs.readFile(testFile, 'utf8'));
    }

    beforeEach(async function () {
      try { await fs.unlink(testFile); } catch {}
      await prepItems();
      // Patch the last item's content so we can search by content
      const arr = JSON.parse(await fs.readFile(testFile, 'utf8'));
      arr[arr.length - 1].content = 'This contains needle and uniquecontent.';
      await fs.writeFile(testFile, JSON.stringify(arr, null, 2), 'utf8');
    });

    it('should find by name (case-insensitive, partial)', async function () {
      const { code, stdout } = await runCli(['search', 'find'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      // Must contain at least one result with 'FindMe' name
      expect(stdout.toLowerCase()).to.contain('findme');
      // Table headers
      expect(stdout).to.match(/id\s+name\s+content snippet/);
      // Count match statement
      expect(stdout).to.match(/found [1-9]\d* matching item/);
    });

    it('should find by tag (case-insensitive, partial)', async function () {
      const { code, stdout } = await runCli(['search', 'MATCH'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout.toLowerCase()).to.include('findme');
      expect(stdout).to.match(/found [1-9]\d* matching item/);
    });

    it('should find by content (partial, case-insensitive)', async function () {
      const { code, stdout } = await runCli(['search', 'needle'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout.toLowerCase()).to.include('hascontent');
      expect(stdout.toLowerCase()).to.include('needle');
      expect(stdout).to.match(/found [1-9]\d* matching item/);
    });

    it('should find by partial tag', async function () {
      const { code, stdout } = await runCli(['search', 'delta'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout.toLowerCase()).to.include('partialtag');
      expect(stdout).to.match(/found [1-9]\d* matching item/);
    });

    it('should be case-insensitive for all matches', async function () {
      const { code, stdout } = await runCli(['search', 'UNIQUECONTENT'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout.toLowerCase()).to.include('hascontent');
      expect(stdout).to.match(/found [1-9]\d* matching item/);
    });

    it('should return a friendly message if no matches', async function () {
      const { code, stdout } = await runCli(['search', 'noSuchKeyword'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout.toLowerCase()).to.include('no items matched');
      expect(stdout).to.match(/id\s+name\s+content snippet/).to.not.ok;
    });

    it('should report empty if storage is missing', async function () {
      try { await fs.unlink(testFile); } catch {}
      const { code, stdout } = await runCli(['search', 'anything'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout.toLowerCase()).to.contain('no items stored yet');
    });

    it('should exit with error on blank/empty keyword', async function () {
      const { code, stderr } = await runCli(['search', ''], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.not.equal(0);
      expect(stderr).to.match(/<keyword> is required/);
    });

    it('should include content snippets no longer than 40 chars', async function () {
      const { code, stdout } = await runCli(['search', 'find'], { env: { [STORAGE_ENV]: testFile } });
      // Content column lines are at most 50 chars wide
      const lines = stdout.trim().split(/\r?\n/);
      // Ignore headers, scan the content snippet column for ...
      const snippets = lines.filter(l => /[a-z]/i.test(l)).map(l => l.split(/\s{2,}/).slice(-1)[0]);
      snippets.forEach(snip => expect(snip.length).to.be.at.most(43));
    });

    it('should display singular/plural correctly', async function () {
      // unique keyword to ensure one match
      const { stdout } = await runCli(['search', 'partialtag'], { env: { [STORAGE_ENV]: testFile } });
      expect(stdout.toLowerCase()).to.include('found 1 matching item');
      // Use 'a' which should match more than one
      const { stdout: s2 } = await runCli(['search', 'a'], { env: { [STORAGE_ENV]: testFile } });
      expect(s2.toLowerCase()).to.include('found ');
      expect(s2.toLowerCase()).to.match(/found (?:[2-9]|[1-9][0-9]+) matching items/);
    });
  });

  // --- INTEGRATION TESTS FOR DELETE COMMAND ---

  describe('delete command', function () {
    let idToDelete;
    beforeEach(async function () {
      // Use a fresh file and insert one item; fetch its id
      await fs.unlink(testFile).catch(() => {});
      const { stdout } = await runCli(['generate', '--name', 'DelTarget', '--tags', 'dltag'], { env: { [STORAGE_ENV]: testFile } });
      const m = stdout.match(/id: ([a-f0-9\-]{36})/i);
      expect(m).to.be.ok;
      idToDelete = m[1];
    });

    it('should delete an existing item by id', async function () {
      const { code, stdout, stderr } = await runCli(['delete', '--id', idToDelete], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.equal(0);
      expect(stdout).to.include('Deleted item:');
      expect(stdout).to.include(`id: ${idToDelete}`);
      // File should now contain zero items
      const arr = JSON.parse(await fs.readFile(testFile, 'utf8'));
      expect(arr).to.be.an('array').with.length(0);
    });

    it('should error and exit(1) if item does not exist', async function () {
      const bogusId = '00112233-aaaa-4bcd-e012-ffffffffffff';
      const { code, stdout, stderr } = await runCli(['delete', '--id', bogusId], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.not.equal(0);
      expect(stderr).to.include(`No item found with id '${bogusId}'.`);
    });

    it('should fail if id is missing or blank', async function () {
      const { code, stderr } = await runCli(['delete'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.not.equal(0);
      expect(stderr).to.match(/--id/);
    });

    it('should fail if id is not a valid UUID', async function () {
      const { code, stderr } = await runCli(['delete', '--id', 'not-a-uuid'], { env: { [STORAGE_ENV]: testFile } });
      expect(code).to.not.equal(0);
      expect(stderr).to.match(/must be a valid UUID/);
    });
  });
});

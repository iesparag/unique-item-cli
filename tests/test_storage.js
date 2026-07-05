import { expect } from 'chai';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  addItem,
  getAllItems,
  findItems,
  deleteItemById,
  saveItems,
  loadItems,
  getStoragePath
} from '../storage/storage.js';
import { UniqueItem } from '../models/uniqueItem.js';

chai.use(chaiAsPromised);

// Use a temp file per test to avoid collateral in user files
const TEST_FILE = path.join(os.tmpdir(), '.uniqueitemstest.' + process.pid + '_' + Math.random().toString(16).slice(2) + '.json');

function setTestEnv() {
  process.env.STORAGE_PATH = TEST_FILE;
  // clear the cached path so next getStoragePath picks up the env
  if (typeof globalThis.__CLEAR_STORAGE_PATH__ === 'function') globalThis.__CLEAR_STORAGE_PATH__();
}

describe('Storage Module', function () {
  beforeEach(async function () {
    setTestEnv();
    // Remove file if exists
    try { await fs.unlink(TEST_FILE); } catch { }
  });
  afterEach(async function () {
    try { await fs.unlink(TEST_FILE); } catch { }
  });

  it('should add and retrieve items', async function () {
    const item = new UniqueItem({ name: 'A', content: 'X', tags: ['tag1'] });
    await addItem(item);
    const all = await getAllItems();
    expect(all).to.have.lengthOf(1);
    expect(all[0]).to.include({ name: 'A', content: 'X' });
    expect(all[0].tags).to.deep.equal(['tag1']);
  });

  it('should list all items', async function () {
    const item1 = new UniqueItem({ name: 'A', content: '1', tags: ['t1'] });
    const item2 = new UniqueItem({ name: 'B', content: '2', tags: ['t2'] });
    await addItem(item1);
    await addItem(item2);
    const all = await getAllItems();
    expect(all).to.have.length(2);
    expect(all.map(i => i.name)).to.have.members(['A', 'B']);
  });

  it('should find items by predicate', async function () {
    await addItem(new UniqueItem({ name: 'Alpha', content: 'foo', tags: ['x', 'test'] }));
    await addItem(new UniqueItem({ name: 'Beta', content: 'bar', tags: ['y'] }));
    const found = await findItems(item => item.name === 'Alpha');
    expect(found).to.have.length(1);
    expect(found[0].content).to.equal('foo');
    // Find by tag
    const byTag = await findItems(item => item.tags.includes('test'));
    expect(byTag).to.have.length(1);
    expect(byTag[0].name).to.equal('Alpha');
  });

  it('should delete item by id and return the deleted item', async function () {
    const item = new UniqueItem({ name: 'DelMe', content: 'bye', tags: ['gone'] });
    await addItem(item);
    const deleted = await deleteItemById(item.id);
    expect(deleted).to.be.an.instanceOf(UniqueItem);
    expect(deleted.name).to.equal('DelMe');
    // Ensure it's gone
    const all = await getAllItems();
    expect(all.length).to.equal(0);
  });

  it('should return null when deleting non-existent id', async function () {
    const res = await deleteItemById('00000000-0000-4000-8000-000000000000');
    expect(res).to.be.null;
  });

  it('should initialize with empty list if file missing', async function () {
    try { await fs.unlink(TEST_FILE); } catch {}
    const all = await getAllItems();
    expect(all).to.be.an('array').with.length(0);
  });

  it('should throw error if file is corrupted JSON', async function () {
    await fs.writeFile(TEST_FILE, '{ bad json', 'utf8');
    await expect(loadItems()).to.be.rejectedWith(/Corrupted JSON/);
  });

  it('should throw error if file is not an array', async function () {
    await fs.writeFile(TEST_FILE, '{"foo":123}', 'utf8');
    await expect(loadItems()).to.be.rejectedWith(/top-level array/);
  });

  it('should export the storage path correctly', function () {
    setTestEnv();
    expect(getStoragePath()).to.equal(TEST_FILE);
  });

  it('should not add duplicate id', async function () {
    const item = new UniqueItem({ name: 'Dupe', content: 'aaa', tags: ['z'] });
    await addItem(item);
    await expect(addItem(item)).to.be.rejectedWith(/already exists/);
  });

  it('should throw for non-UniqueItem in addItem', async function () {
    const obj = { name: 'Fake', content: 'no', tags: ['f'] };
    await expect(addItem(obj)).to.be.rejectedWith(/UniqueItem/);
  });

  it('should saveItems and reload', async function () {
    const item = new UniqueItem({ name: 'Persist', content: 'save', tags: ['sav'] });
    await saveItems([item]);
    const loaded = await loadItems();
    expect(loaded).to.have.length(1);
    expect(loaded[0].name).to.equal('Persist');
  });
});

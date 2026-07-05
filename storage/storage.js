// JSON file-based storage layer for UniqueItems
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { UniqueItem } from '../models/uniqueItem.js';

let STORAGE_PATH;

function initStoragePath() {
  // Always evaluate using current process.env
  const DEFAULT_STORAGE_PATH = path.join(os.homedir(), '.uniqueitems.json');
  const ENV_STORAGE_PATH = process.env.STORAGE_PATH;
  return ENV_STORAGE_PATH && ENV_STORAGE_PATH.trim()
    ? path.resolve(ENV_STORAGE_PATH)
    : DEFAULT_STORAGE_PATH;
}

function getStoragePath() {
  if (!STORAGE_PATH) STORAGE_PATH = initStoragePath();
  return STORAGE_PATH;
}

/**
 * Atomically write contents to file
 * @param {string} fp
 * @param {string} data
 */
async function atomicWriteFile(fp, data) {
  const dir = path.dirname(fp);
  const tmpFilename = path.join(
    dir,
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).replace('.', '')}.json`
  );
  await fs.writeFile(tmpFilename, data, { encoding: 'utf-8', mode: 0o600 });
  await fs.rename(tmpFilename, fp);
}

/**
 * Load items from the storage file
 * @returns {Promise<UniqueItem[]>}
 */
export async function loadItems() {
  STORAGE_PATH = getStoragePath();
  let json;
  try {
    json = await fs.readFile(STORAGE_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      // No file yet: treat as empty collection
      return [];
    }
    throw new Error(`storage: Failed to read storage file: ${err.message}`);
  }
  let arr;
  try {
    arr = JSON.parse(json);
    if (!Array.isArray(arr)) throw new Error('File must contain a top-level array');
  } catch (err) {
    throw new Error(`storage: Corrupted JSON in storage file: ${err.message}`);
  }
  // Validate and instantiate items
  try {
    return arr.map(obj => UniqueItem.fromJSON(obj));
  } catch (err) {
    throw new Error(`storage: Invalid UniqueItem data: ${err.message}`);
  }
}

/**
 * Save array of UniqueItems to file atomically
 * @param {UniqueItem[]} items
 */
export async function saveItems(items) {
  STORAGE_PATH = getStoragePath();
  if (!Array.isArray(items)) {
    throw new Error('saveItems: items must be an array');
  }
  const arr = items.map(item => item.toJSON());
  try {
    await atomicWriteFile(STORAGE_PATH, JSON.stringify(arr, null, 2));
  } catch (err) {
    throw new Error(`storage: Failed to write storage file: ${err.message}`);
  }
}

/**
 * Add a UniqueItem to storage
 * @param {UniqueItem} item
 * @returns {Promise<void>}
 */
export async function addItem(item) {
  if (!(item instanceof UniqueItem)) {
    throw new Error('addItem: argument must be UniqueItem');
  }
  STORAGE_PATH = getStoragePath();
  // Optimistic lock: retry up to 2 times if concurrent write detected
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Load latest
    let current;
    try {
      current = await loadItems();
    } catch (e) {
      if (attempt === 3) throw e;
      // retry
      continue;
    }
    // Ensure no item with same id
    if (current.some(existing => existing.id === item.id)) {
      throw new Error(`addItem: Item with id '${item.id}' already exists`);
    }
    current.push(item);
    try {
      await saveItems(current);
      return;
    } catch (e) {
      if (/EBUSY|EAGAIN|EINVAL/i.test(e.message) && attempt < 3) {
        continue; // Retry
      }
      throw e;
    }
  }
}

/**
 * Get all items from storage
 * @returns {Promise<UniqueItem[]>}
 */
export async function getAllItems() {
  STORAGE_PATH = getStoragePath();
  return loadItems();
}

/**
 * Find items matching a predicate
 * @param {(item: UniqueItem) => boolean} predicate
 * @returns {Promise<UniqueItem[]>}
 */
export async function findItems(predicate) {
  STORAGE_PATH = getStoragePath();
  const items = await loadItems();
  return items.filter(predicate);
}

/**
 * Delete item by id
 * @param {string} id
 * @returns {Promise<UniqueItem|null>} The deleted item or null if not found
 */
export async function deleteItemById(id) {
  STORAGE_PATH = getStoragePath();
  for (let attempt = 1; attempt <= 3; attempt++) {
    let items;
    try {
      items = await loadItems();
    } catch (e) {
      if (attempt === 3) throw e;
      continue; // Retry read
    }
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;
    const [removed] = items.splice(idx, 1);
    try {
      await saveItems(items);
      return removed;
    } catch (e) {
      if (/EBUSY|EAGAIN|EINVAL/i.test(e.message) && attempt < 3) {
        continue;
      }
      throw e;
    }
  }
}

/**
 * Expose the storage file path (for CLI/diagnostic use)
 */
export { getStoragePath };

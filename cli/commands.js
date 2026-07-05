// Defines CLI commands to be registered with commander
import { generateUniqueContent } from '../generator/uniqueGen.js';
import { UniqueItem } from '../models/uniqueItem.js';
import {
  addItem,
  getAllItems,
  deleteItemById
} from '../storage/storage.js';
import { validate as uuidValidate } from 'uuid';

function parseTags(tagsString) {
  if (!tagsString) return [];
  // Split on comma and filter out blanks, trim all
  return tagsString.split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

function isNonEmptyString(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

function isValidTag(tag) {
  // Match logic from UniqueItem
  return typeof tag === 'string' && /^[a-zA-Z0-9_-]+$/.test(tag);
}

function validateTags(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every(isValidTag);
}

/**
 * Format and print a table of items to the console
 * @param {UniqueItem[]} items
 */
function printListTable(items) {
  // Table columns: id, name, tags, created_at snippet
  // Calculate column widths
  const headers = ['id', 'name', 'tags', 'created_at'];
  const rows = items.map(item => [
    item.id,
    item.name,
    item.tags.join(', '),
    item.created_at.substring(0, 19) // Just date+time part (ISO)
  ]);
  // Determine col widths (include header lengths)
  const allRows = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...allRows.map(row => String(row[i]).length))
  );
  // Make a row string by padding each cell
  const mkRow = row => row.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');
  // Output
  console.log(mkRow(headers));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  rows.forEach(row => console.log(mkRow(row)));
}

/**
 * Format search results
 * @param {UniqueItem[]} items
 */
function printSearchResults(items) {
  // Print id, name, and a content snippet (first 40 chars, breaking on whitespace)
  if (!Array.isArray(items) || items.length === 0) {
    console.log('No items matched your search.');
    return;
  }
  const headers = ['id', 'name', 'content snippet'];
  const rows = items.map(item => {
    const snippet = (item.content.length <= 40)
      ? item.content
      : item.content.substring(0, 37).replace(/\s+/g, ' ') + '...';
    return [item.id, item.name, snippet];
  });
  // Compute column widths
  const allRows = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...allRows.map(row => String(row[i]).length))
  );
  const mkRow = row => row.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');
  // Output
  console.log(mkRow(headers));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  rows.forEach(row => console.log(mkRow(row)));
  if (items.length === 1) {
    console.log('\nFound 1 matching item.');
  } else {
    console.log(`\nFound ${items.length} matching items.`);
  }
}

/**
 * Setup CLI commands
 * @param {import('commander').Command} program
 */
export function setupCommands(program) {
  // 'generate' command
  program
    .command('generate')
    .description('Generate a unique item with name and optional tags')
    .requiredOption('--name <name>', 'Name for the unique item')
    .option('--tags <tags>', 'Comma-separated list of tags (alphanumeric, _ or -)')
    .action(async opts => {
      // Input validation
      const name = opts.name;
      const tags = parseTags(opts.tags);

      // Validate name
      if (!isNonEmptyString(name)) {
        console.error('Error: --name is required and must be non-empty.');
        process.exit(1);
      }
      // Validate tags
      if (!validateTags(tags)) {
        console.error('Error: All tags must be alphanumeric strings (letters, numbers, _ or -)');
        process.exit(1);
      }

      // Generate content
      let content;
      try {
        content = generateUniqueContent();
      } catch (e) {
        console.error('Error generating unique content:', e.message || e);
        process.exit(1);
      }
      // Create item
      let item;
      try {
        item = new UniqueItem({ name, content, tags });
      } catch (e) {
        console.error('Error creating UniqueItem:', e.message || e);
        process.exit(1);
      }
      // Persist item
      try {
        await addItem(item);
      } catch (e) {
        console.error('Error saving item:', e.message || e);
        process.exit(1);
      }
      // Output
      const summaryLines = [
        `Unique item created successfully!`,
        `  id: ${item.id}`,
        `  name: ${item.name}`,
        `  tags: [${item.tags.join(', ')}]`,
        `  created_at: ${item.created_at}`,
        `  content: ${item.content}`
      ];
      console.log(summaryLines.join('\n'));
    });

  // 'list' command - show all stored unique items
  program
    .command('list')
    .description('List all stored unique items in a table')
    .action(async () => {
      let items;
      try {
        items = await getAllItems();
      } catch (err) {
        console.error('Error reading storage:', err.message || err);
        process.exit(1);
      }
      if (!Array.isArray(items) || items.length === 0) {
        console.log('No unique items stored yet! Use `generate` to add an item.');
        return;
      }
      printListTable(items);
    });

  // 'search' command - find items by keyword
  program
    .command('search <keyword>')
    .description('Search items by keyword in name, content, or tags (case-insensitive, partial match)')
    .action(async (keyword) => {
      if (!isNonEmptyString(keyword)) {
        console.error('Error: <keyword> is required and must be a non-empty string.');
        process.exit(1);
      }
      // Get all items
      let items;
      try {
        items = await getAllItems();
      } catch (err) {
        console.error('Error reading storage:', err.message || err);
        process.exit(1);
      }
      if (!Array.isArray(items) || items.length === 0) {
        console.log('No items stored yet! Use `generate` to add some before searching.');
        return;
      }
      // Search logic: case-insensitive, partial match on name, content, or tags
      const kw = keyword.toLowerCase();
      const matches = items.filter(item => {
        // name
        if (item.name && typeof item.name === 'string' && item.name.toLowerCase().includes(kw)) {
          return true;
        }
        // content
        if (item.content && typeof item.content === 'string' && item.content.toLowerCase().includes(kw)) {
          return true;
        }
        // tags (partial and case-insensitive)
        if (Array.isArray(item.tags)) {
          return item.tags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(kw));
        }
        return false;
      });
      printSearchResults(matches);
    });

  // 'delete' command - delete an item by id
  program
    .command('delete')
    .description('Delete a unique item by id')
    .requiredOption('--id <id>', 'Id of the unique item to delete (must be a UUID)')
    .action(async (opts) => {
      const id = opts.id;
      // Validate id as UUID
      if (!isNonEmptyString(id) || !uuidValidate(id)) {
        console.error('Error: --id is required and must be a valid UUID.');
        process.exit(1);
      }
      let deleted;
      try {
        deleted = await deleteItemById(id);
      } catch (err) {
        console.error('Error removing item:', err.message || err);
        process.exit(1);
      }
      if (!deleted) {
        console.error(`No item found with id '${id}'.`);
        process.exit(1);
      }
      console.log(`Deleted item:\n  id: ${deleted.id}\n  name: ${deleted.name}\n  tags: [${deleted.tags.join(', ')}]\n  created_at: ${deleted.created_at}`);
    });
}

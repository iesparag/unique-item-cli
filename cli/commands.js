// Defines CLI commands to be registered with commander
import { generateUniqueContent } from '../generator/uniqueGen.js';
import { UniqueItem } from '../models/uniqueItem.js';
import { addItem, getAllItems } from '../storage/storage.js';

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
}

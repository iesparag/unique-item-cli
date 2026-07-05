// Defines CLI commands to be registered with commander
import { generateUniqueContent } from '../generator/uniqueGen.js';
import { UniqueItem } from '../models/uniqueItem.js';
import { addItem } from '../storage/storage.js';

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
}
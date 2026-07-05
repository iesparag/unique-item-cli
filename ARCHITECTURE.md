# Architecture

The CLI tool uses a modular Node.js ES module architecture.

- CLI Layer: Uses 'commander' for command parsing with commands: generate, search, list, delete.
- Data Layer: File-based JSON persistence stored in user home directory (default ~/.uniqueitems.json), with full CRUD access and safe concurrent updates.
- UniqueItem Model: Representation of each item with id (UUID v4), name (string), content (string), tags (array of strings), created_at (ISO timestamp).
- Generator Module: Produces unique content by combining timestamp and random base64 strings.
- Search: Case-insensitive search over name, content, and tags, with partial matching.
- Validation: Command inputs validated for tags (alphanumeric), non-empty names.

Folder structure:

unique-item-cli/
  cli/
    index.js            # Entry CLI script
    commands.js         # Commander commands definitions
  models/
    uniqueItem.js       # UniqueItem class definition
  storage/
    storage.js          # JSON file storage implementation
  generator/
    uniqueGen.js        # Unique content generation logic
  tests/
    test_storage.js     # Tests for storage module
    test_generator.js   # Tests for uniqueGen module
    test_cli.js         # Tests for CLI commands
  package.json
  README.md
  .gitignore
  .env.example

Data flow:
- User invokes CLI command
- CLI parses and validates arguments
- Commands call generator or storage
- Storage reads/writes JSON file
- CLI outputs results or errors

Decisions:
- Node.js CLI for cross platform ease
- JSON file for simple persistence, no external DB dependency
- UUID for unique ids
- Commander for robust CLI experience
- Tests with Mocha+Chai for common Node CLI compatibility
- Modular structure for clarity and testability

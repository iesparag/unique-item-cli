# unique-item-cli

A command-line interface tool for users to generate uniquely identified items with metadata, efficiently search, list, and delete those items, persisting data locally.

## Features
- Generate unique items with metadata (name, content, tags, timestamp)
- List stored items
- Search items by keyword/tag/name
- Delete items by id or tags

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. (Optional) Copy `.env.example` to `.env` and set environment variables for custom storage path or verbosity.

## Usage

Run the CLI:
```sh
node cli/index.js <command> [options]
```

Or, if installed globally:
```sh
unique-item-cli <command> [options]
```

See detailed usage and commands after implementation.

---

## Testing
Run all tests:
```sh
npm test
```

---

## Deployment

This is a backend-only CLI tool (no web/backend API, no frontend/UI).

---

## Project structure

```
unique-item-cli/
  cli/
    index.js         # Entry CLI script
    commands.js      # Commander commands definitions
  models/
    uniqueItem.js    # UniqueItem class definition
  storage/
    storage.js       # JSON file storage implementation
  generator/
    uniqueGen.js     # Unique content generation logic
  tests/
    test_storage.js  # Storage tests
    test_generator.js# Generator tests
    test_cli.js      # CLI command tests
  package.json
  README.md
  .gitignore
  .env.example
```

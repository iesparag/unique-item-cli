# unique-item-cli

A command-line interface tool for users to generate uniquely identified items with metadata, efficiently search, list, and delete those items, persisting data locally.

## Features
- Generate unique items with metadata (name, content, tags, timestamp)
- List stored items
- Search items by keyword/tag/name
- Delete items by id or tags
- Robust input validation and graceful error handling

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

### Commands & Examples

#### Generate a unique item
```sh
unique-item-cli generate --name "MyItem" --tags alpha,beta
```
- **Name** (`--name`) is required and must be non-empty.
- **Tags** (`--tags`) is optional. Tags must be **alphanumeric** with optional `_` or `-` (e.g., `tag1`, `alpha_beta`, `tag-2`).
- Example error for invalid input:
  ```
  $ unique-item-cli generate --name "" --tags "bad,tag!"
  Error: --name is required and must be non-empty.
  $ unique-item-cli generate --name Test --tags "ok,inv@lid"
  Error: All tags must be alphanumeric strings (letters, numbers, _ or -)
  ```

#### List all items
```sh
unique-item-cli list
```
- Outputs a table of all stored items. If none stored, shows: `No unique items stored yet! Use \\`generate\\` to add an item.`

#### Search for items
```sh
unique-item-cli search <keyword>
```
- Searches all fields (`name`, `content`, or `tags`) for partial, **case-insensitive** matches.
- If no keyword provided or blank, you will see:
  ```
  Error: <keyword> is required and must be a non-empty string.
  ```
- If no items matched:
  ```
  No items matched your search.
  ```
- If no items are stored:
  ```
  No items stored yet! Use `generate` to add some before searching.
  ```

#### Delete an item by id
```sh
unique-item-cli delete --id <item-uuid>
```
- ID must be a valid UUID format. Invalid or missing ids cause errors:
  ```
  Error: --id is required and must be a valid UUID.
  ```
- If the id does not exist:
  ```
  No item found with id '<id>'.
  ```

### Help
All commands support `--help` for details:
```sh
unique-item-cli generate --help
```

## Error Handling & Validation
- **Names**: Must not be empty.
- **Tags**: Only alphanumeric, underscore (`_`), or dash (`-`).
- **ID** (for delete): Must be a valid UUID.
- **Corrupted Storage**: Friendly errors if the storage file is unreadable, corrupted, or missing.

## Testing
Run all tests:
```sh
npm test
```
This covers:
- UniqueItem model and validation errors
- Generator output uniqueness
- Storage CRUD & error handling
- CLI commands (valid/invalid inputs, integration, edge cases)

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

## Deployment

This is a backend-only CLI tool (no web/backend API, no frontend/UI).

### One-click Deploy (for reference)

- Not for Hosted UI, but for visibility:

#### Repo: https://github.com/iesparag/unique-item-cli

- [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)
  - Select this repo, set root to project root if asked, and optionally set env vars in `.env.example`. Not meant for hosting as a web service — run locally.

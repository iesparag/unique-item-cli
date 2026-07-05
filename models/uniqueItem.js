// UniqueItem data model implementation

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

function isNonEmptyString(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

function isValidTag(tag) {
  // Alphanumeric only, allow underscores and dashes for CLI ergonomics
  return typeof tag === 'string' && /^[a-zA-Z0-9_-]+$/.test(tag);
}

export class UniqueItem {
  /**
   * Construct a new UniqueItem
   * @param {string} id - UUID v4 (auto-assigned if falsy)
   * @param {string} name - Required, non-empty string
   * @param {string} content - Arbitrary string
   * @param {string[]} tags - Array of alphanumeric strings
   * @param {string} created_at - ISO8601 timestamp (auto-assigned if falsy)
   */
  constructor({ id, name, content, tags, created_at }) {
    // Id assignment and validation
    this.id = id || uuidv4();
    if (!uuidValidate(this.id)) {
      throw new Error('UniqueItem: id is not a valid UUID');
    }
    // Name
    if (!isNonEmptyString(name)) {
      throw new Error('UniqueItem: name must be a non-empty string');
    }
    this.name = name.trim();
    // Content
    if (typeof content !== 'string') {
      throw new Error('UniqueItem: content must be a string');
    }
    this.content = content;
    // Tags
    if (!Array.isArray(tags)) {
      throw new Error('UniqueItem: tags must be an array');
    }
    if (!tags.every(isValidTag)) {
      throw new Error('UniqueItem: tags must be alphanumeric strings (letters, numbers, _ or -)');
    }
    this.tags = tags;
    // Created_at timestamp
    this.created_at = created_at || new Date().toISOString();
    // Validate timestamp
    if (isNaN(Date.parse(this.created_at))) {
      throw new Error('UniqueItem: created_at must be ISO8601 date string');
    }
  }

  /**
   * Return JSON-serializable plain object (for storage)
   */
  toJSON() {
    // Avoid including methods on serialization
    return {
      id: this.id,
      name: this.name,
      content: this.content,
      tags: Array.from(this.tags),
      created_at: this.created_at
    };
  }

  /**
   * Rehydrate UniqueItem from plain object (e.g. storage)
   */
  static fromJSON(obj) {
    return new UniqueItem(obj);
  }
}

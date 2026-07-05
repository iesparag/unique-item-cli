import { expect } from 'chai';
import { generateUniqueContent } from '../generator/uniqueGen.js';

describe('Generator Module', function () {
  it('should generate unique content', function () {
    // Generate 1000 outputs, expect all unique
    const outputs = new Set();
    for (let i = 0; i < 1000; ++i) {
      outputs.add(generateUniqueContent());
    }
    expect(outputs.size).to.equal(1000);
  });

  it('should return a string in the correct format', function () {
    const value = generateUniqueContent();
    expect(value).to.be.a('string');
    // Check it matches the format: base64str=ISOstring
    const match = value.match(/^([A-Za-z0-9+/]{11,12})=([0-9T:\.\-Z]+)$/);
    expect(match, 'should match pattern <base64>=<ISO>').to.be.ok;
    const [full, b64seg, timestamp] = match;
    // base64 substring should be plausible length (11 or 12 chars)
    expect(b64seg).to.match(/^[A-Za-z0-9+/]{11,12}$/);
    // Timestamp must parse as valid date
    expect(new Date(timestamp).toISOString()).to.equal(timestamp);
  });

  it('outputs should not repeat even with quick invocation', function () {
    const values = Array.from({ length: 20 }, generateUniqueContent);
    for (let i = 0; i < values.length; ++i) {
      for (let j = i + 1; j < values.length; ++j) {
        expect(values[i]).to.not.equal(values[j]);
      }
    }
  });

  it('outputs are still valid under heavy calls', function () {
    // 10000 outputs, not for uniqueness but for format
    for (let i = 0; i < 10000; ++i) {
      const val = generateUniqueContent();
      const match = val.match(/^([A-Za-z0-9+/]{11,12})=([0-9T:\.\-Z]+)$/);
      expect(match).to.be.ok;
      expect(new Date(match[2]).toISOString()).to.equal(match[2]);
    }
  });
});

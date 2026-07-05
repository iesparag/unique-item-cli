import { expect } from 'chai';
import { UniqueItem } from '../models/uniqueItem.js';
import { v4 as uuidv4 } from 'uuid';

describe('UniqueItem Model', function () {
  it('should create an instance with required fields', function () {
    const now = new Date().toISOString();
    const item = new UniqueItem({
      id: uuidv4(),
      name: 'TestItem',
      content: 'Hello world',
      tags: ['alpha', 'BETA_1'],
      created_at: now
    });
    expect(item).to.have.property('id');
    expect(item).to.have.property('name', 'TestItem');
    expect(item).to.have.property('content', 'Hello world');
    expect(item.tags).to.deep.equal(['alpha', 'BETA_1']);
    expect(item.created_at).to.equal(now);
  });

  it('should auto-generate id and created_at if absent', function () {
    const item = new UniqueItem({
      name: 'NoId',
      content: 'C',
      tags: ['foo'],
      // no id, no created_at
    });
    expect(item.id).to.be.a('string');
    expect(item.created_at).to.match(/^\d{4}-\d{2}-\d{2}/);
  });

  it('should throw if name is empty or not a string', function () {
    expect(() => new UniqueItem({ name: '', content: 'X', tags: ['x'] })).to.throw();
    expect(() => new UniqueItem({ name: 123, content: 'X', tags: ['x'] })).to.throw();
  });

  it('should throw for non-alphanumeric tags', function () {
    expect(() => new UniqueItem({ name: 'ok', content: 'X', tags: ['good', 'not*ok'] })).to.throw();
    expect(() => new UniqueItem({ name: 'ok', content: 'X', tags: ['test!', ''] })).to.throw();
    expect(() => new UniqueItem({ name: 'ok', content: 'X', tags: [null] })).to.throw();
  });

  it('should throw on invalid id or created_at', function () {
    expect(() => new UniqueItem({ id: 'bogus', name: 'N', content: 'C', tags: ['a'] })).to.throw();
    expect(() => new UniqueItem({ name: 'N', content: 'C', tags: ['a'], created_at: 'notadate' })).to.throw();
  });

  it('should serialize to/from JSON correctly', function () {
    const orig = new UniqueItem({ name: 'Ser', content: 'CCC', tags: ['t1', 't2'] });
    const json = JSON.stringify(orig);
    const plain = JSON.parse(json);
    const rehydrated = UniqueItem.fromJSON(plain);
    expect(rehydrated).to.be.instanceOf(UniqueItem);
    expect(rehydrated.id).to.equal(orig.id);
    expect(rehydrated.name).to.equal('Ser');
    expect(Array.isArray(rehydrated.tags)).to.be.true;
  });

  it('should throw if tags is not an array', function () {
    expect(() => new UniqueItem({ name: 'q', content: 'x', tags: undefined })).to.throw();
    expect(() => new UniqueItem({ name: 'q', content: 'x', tags: 'hello' })).to.throw();
  });
  
  it('should throw if content is not a string', function () {
    expect(() => new UniqueItem({ name: 'abc', content: 123, tags: ['t'] })).to.throw();
  });
});

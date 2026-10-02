import { describe, expect, it } from 'vitest';
import { UnionFind } from './union-find.js';

describe('UnionFind', () => {
  it('groups connected entities together', () => {
    const uf = new UnionFind<string>();
    uf.union('alice', 'ally');
    uf.union('ally', 'al');
    uf.makeSet('bob');

    expect(uf.connected('alice', 'al')).toBe(true);
    expect(uf.connected('alice', 'bob')).toBe(false);

    const groups = [...uf.groups().values()];
    expect(groups).toContainEqual(expect.arrayContaining(['alice', 'ally', 'al']));
  });
});

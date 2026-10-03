import { describe, expect, it } from 'vitest';
import { buildOrTsQuery, lexicalTerms } from './lexical-query.js';

describe('lexical query building', () => {
  it('drops stop words and punctuation', () => {
    expect(lexicalTerms("What is Melanie's favourite book?")).toEqual(['melanie', 'favourite', 'book']);
  });

  it('never emits tsquery operators from user input', () => {
    expect(buildOrTsQuery("x' & !yy | (zz:*)")).toBe('yy | zz');
  });

  it('returns null when nothing searchable remains', () => {
    expect(buildOrTsQuery('what is the')).toBeNull();
  });

  it('deduplicates repeated terms', () => {
    expect(buildOrTsQuery('berlin berlin Berlin')).toBe('berlin');
  });
});

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'of', 'in', 'on', 'at',
  'to', 'for', 'with', 'and', 'or', 'but', 'it', 'its', 'this', 'that', 'what', 'who', 'whom', 'when', 'where',
  'which', 'how', 'why', 'has', 'have', 'had', 'my', 'your', 'his', 'her', 'their', 'our', 'about', 'from', 'as',
  'by', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'them', 'us', 'not', 'no', 'so', 'if', 'than', 'then',
]);

const MAX_TERMS = 24;

export function lexicalTerms(text: string): string[] {
  const terms = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
  return [...new Set(terms)].slice(0, MAX_TERMS);
}

export function buildOrTsQuery(text: string): string | null {
  const terms = lexicalTerms(text);
  return terms.length === 0 ? null : terms.join(' | ');
}

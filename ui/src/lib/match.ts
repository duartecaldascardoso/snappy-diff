/**
 * Plain substring matching, used by every search: ".tsx" matches only text
 * containing ".tsx". Each space-separated term must appear; case is ignored.
 */
export function matches(text: string, query: string) {
  const haystack = text.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}

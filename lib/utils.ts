// Cyrillic → Latin map. Keep IDENTICAL to app_transliterate() in SQL migration,
// otherwise slugs generated client-side and server-side will diverge.
const TRANSLIT_MAP: Record<string, string> = {
  // Russian
  'а': 'a',  'б': 'b',  'в': 'v',  'г': 'g',  'д': 'd',  'е': 'e',
  'ё': 'yo', 'ж': 'zh', 'з': 'z',  'и': 'i',  'й': 'y',  'к': 'k',
  'л': 'l',  'м': 'm',  'н': 'n',  'о': 'o',  'п': 'p',  'р': 'r',
  'с': 's',  'т': 't',  'у': 'u',  'ф': 'f',  'х': 'h',  'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',  'ы': 'y',  'ь': '',
  'э': 'e',  'ю': 'yu', 'я': 'ya',
  // Kazakh-specific
  'ә': 'a',  'ғ': 'gh', 'қ': 'k',  'ң': 'ng', 'ө': 'o',  'ұ': 'u',
  'ү': 'u',  'һ': 'h',  'і': 'i',
}

export function transliterate(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    out += TRANSLIT_MAP[ch] ?? ch
  }
  return out
}

// Builds slug like "sabyr-zhumakhanuly-2026-574"
export function generateSlug(fullName: string, year: number, resultId: string): string {
  const base = transliterate(fullName)
    .replace(/[^a-z0-9\s-]/g, ' ')   // drop punctuation/non-latin leftovers
    .replace(/[\s-]+/g, '-')          // collapse whitespace + dashes
    .replace(/^-+|-+$/g, '')          // trim edge dashes
  const tail = resultId.replace(/-/g, '').slice(-3)
  return `${base}-${year}-${tail}`
}

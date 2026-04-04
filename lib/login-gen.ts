// Cyrillic → Latin translit map (Russian + Kazakh)
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Kazakh extra
  ә: 'ae', ғ: 'gh', қ: 'q', ң: 'ng', ө: 'oe', ұ: 'u',
  ү: 'ue', һ: 'h', і: 'i',
}

function toTranslit(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map(ch => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Generate student login: firstName + first 3 chars of lastName + 3 random digits.
 * Example: Алибек Жаксыбеков → alibekzha847
 */
export function generateLogin(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const firstName = toTranslit(parts[0] ?? '')
  const lastNamePart = toTranslit(parts[1] ?? '').slice(0, 3)
  const digits = String(Math.floor(Math.random() * 900) + 100) // 100–999
  return firstName + lastNamePart + digits
}

/**
 * Generate unique login, retrying with new random digits if collision found.
 */
export function generateUniqueLogin(
  fullName: string,
  existingLogins: Set<string>
): string {
  let login = generateLogin(fullName)
  let attempts = 0
  while (existingLogins.has(login) && attempts < 50) {
    login = generateLogin(fullName)
    attempts++
  }
  return login
}

const PASSWORD_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a random 6-character alphanumeric password.
 * Excludes visually ambiguous chars (0, O, l, 1, I).
 */
export function generatePassword(length: number = 6): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]
  }
  return result
}

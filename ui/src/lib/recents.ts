/**
 * Files last opened from the Go to menu, newest first, per diff (`key`), so the
 * menu opens on where you have just been. Kept in this browser.
 */
const STORAGE = 'recents'
const KEPT = 50
const SHOWN = 4

type Recent = { key: string; file: string }

function read(): Recent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const recentFiles = (key: string) =>
  read()
    .filter((r) => r.key === key)
    .slice(0, SHOWN)
    .map((r) => r.file)

export function rememberFile(key: string, file: string) {
  try {
    const rest = read().filter((r) => !(r.key === key && r.file === file))
    localStorage.setItem(STORAGE, JSON.stringify([{ key, file }, ...rest].slice(0, KEPT)))
  } catch {
    // Without storage the menu has no recents, and works as before.
  }
}

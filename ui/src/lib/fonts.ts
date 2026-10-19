/** Fonts shipped with the app, as display name → CSS family (see fonts.css). */
const BUNDLED: Record<string, string> = {
  'JetBrains Mono': 'JetBrains Mono Variable',
  'Fira Code': 'Fira Code Variable',
  'Geist Mono': 'Geist Mono Variable',
  'Cascadia Code': 'Cascadia Code Variable',
  'Source Code Pro': 'Source Code Pro Variable',
  'Victor Mono': 'Victor Mono Variable',
  'Martian Mono': 'Martian Mono Variable',
  'Red Hat Mono': 'Red Hat Mono Variable',
  'IBM Plex Mono': 'IBM Plex Mono',
  'Commit Mono': 'Commit Mono',
}

export const BUNDLED_FONTS = Object.keys(BUNDLED)

/** Popular code fonts we can't ship but will use if they're installed. */
const SYSTEM = [
  'Berkeley Mono',
  'Consolas',
  'Dank Mono',
  'Hack',
  'Input Mono',
  'Iosevka',
  'Menlo',
  'Monaco',
  'MonoLisa',
  'Operator Mono',
  'SF Mono',
  'Ubuntu Mono',
]

/** The CSS `font-family` for a font picked by name. */
export const fontFamily = (name: string) => `"${BUNDLED[name] ?? name}", monospace`

/**
 * The system fonts installed on this machine. A font is installed if text set
 * in it measures differently from at least one generic fallback.
 */
export function installedFonts(): string[] {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return []
  const width = (family: string) => {
    ctx.font = `72px ${family}`
    return ctx.measureText('mmmmmmmmmmlli10O').width
  }
  const fallbacks = ['monospace', 'serif'].map((f) => [f, width(f)] as const)
  return SYSTEM.filter((font) => fallbacks.some(([f, w]) => width(`"${font}", ${f}`) !== w))
}

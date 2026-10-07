const CANDIDATES = [
  'Berkeley Mono',
  'Cascadia Code',
  'Commit Mono',
  'Consolas',
  'Fira Code',
  'Geist Mono',
  'Hack',
  'IBM Plex Mono',
  'Iosevka',
  'JetBrains Mono',
  'Menlo',
  'Monaco',
  'MonoLisa',
  'SF Mono',
  'Source Code Pro',
  'Ubuntu Mono',
]

/**
 * The candidate code fonts installed on this machine. A font is installed if
 * text set in it measures differently from at least one generic fallback.
 */
export function installedFonts(): string[] {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return []
  const width = (family: string) => {
    ctx.font = `72px ${family}`
    return ctx.measureText('mmmmmmmmmmlli10O').width
  }
  const fallbacks = ['monospace', 'serif'].map((f) => [f, width(f)] as const)
  return CANDIDATES.filter((font) => fallbacks.some(([f, w]) => width(`"${font}", ${f}`) !== w))
}

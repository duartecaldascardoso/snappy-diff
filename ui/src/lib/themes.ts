import { type BundledTheme, bundledThemes } from 'shiki/themes'

/** A syntax theme family: the variant used in light and in dark mode. */
export type Theme = { name: string; light: string; dark: string }

const pair = (name: string, light: string, dark = light): Theme => ({ name, light, dark })

export const THEMES: Theme[] = [
  pair('Pierre', 'pierre-light', 'pierre-dark'),
  pair('GitHub', 'github-light', 'github-dark'),
  pair('Catppuccin', 'catppuccin-latte', 'catppuccin-mocha'),
  pair('Rosé Pine', 'rose-pine-dawn', 'rose-pine'),
  pair('Vitesse', 'vitesse-light', 'vitesse-dark'),
  pair('One', 'one-light', 'one-dark-pro'),
  pair('Solarized', 'solarized-light', 'solarized-dark'),
  pair('Gruvbox', 'gruvbox-light-medium', 'gruvbox-dark-medium'),
  pair('Everforest', 'everforest-light', 'everforest-dark'),
  pair('Kanagawa', 'kanagawa-lotus', 'kanagawa-wave'),
  pair('Ayu', 'ayu-light', 'ayu-dark'),
  pair('Night Owl', 'night-owl-light', 'night-owl'),
  pair('Material', 'material-theme-lighter', 'material-theme-darker'),
  pair('Min', 'min-light', 'min-dark'),
  // Dark only.
  pair('Dracula', 'dracula'),
  pair('Nord', 'nord'),
  pair('Tokyo Night', 'tokyo-night'),
  pair('Monokai', 'monokai'),
  pair('Poimandres', 'poimandres'),
  pair('Vesper', 'vesper'),
  pair('Houston', 'houston'),
  pair('Synthwave 84', 'synthwave-84'),
]

export const themeNamed = (name: string) => THEMES.find((t) => t.name === name) ?? THEMES[0]

/** CSS variables that dress the app in a syntax theme, and whether it is dark. */
export type Chrome = { vars: Record<string, string>; dark: boolean }

const mix = (fg: string, percent: number, bg: string) => `color-mix(in oklab, ${fg} ${percent}%, ${bg})`

type ThemeJson = { type?: string; fg?: string; colors?: Record<string, string> }

// Pierre ships with the diff library rather than with Shiki.
const PIERRE: Record<string, () => Promise<{ default: ThemeJson }>> = {
  'pierre-light': () => import('@pierre/theme/pierre-light'),
  'pierre-dark': () => import('@pierre/theme/pierre-dark'),
}

/**
 * The app colors for a syntax theme, derived from its editor colors, so the
 * chrome, popovers and comment cards always sit on the same ground as the code.
 */
export async function chromeFor(variant: string): Promise<Chrome> {
  const load = PIERRE[variant] ?? bundledThemes[variant as BundledTheme]
  const theme: ThemeJson = (await load()).default
  const colors = theme.colors ?? {}
  const dark = theme.type === 'dark'
  const bg = colors['editor.background'] ?? (dark ? '#1e1e1e' : '#ffffff')
  const fg = colors['editor.foreground'] ?? theme.fg ?? (dark ? '#d4d4d4' : '#333333')
  const accent = mix(fg, 10, bg)
  return {
    dark,
    vars: {
      '--background': bg,
      '--foreground': fg,
      '--muted': mix(fg, 6, bg),
      '--muted-foreground': mix(fg, 60, bg),
      '--accent': accent,
      '--accent-foreground': fg,
      '--primary': fg,
      '--primary-foreground': bg,
      '--secondary': accent,
      '--secondary-foreground': fg,
      '--popover': colors['editorWidget.background'] ?? mix(fg, 4, bg),
      '--popover-foreground': fg,
      '--card': bg,
      '--card-foreground': fg,
      '--border': mix(fg, 14, bg),
      '--input': mix(fg, 18, bg),
      '--ring': mix(fg, 40, bg),
    },
  }
}

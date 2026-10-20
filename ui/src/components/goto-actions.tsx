import {
  ChartNoAxesColumn,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  Columns2,
  FileUp,
  Maximize2,
  Moon,
  PanelLeft,
  Pilcrow,
  RotateCw,
  Rows2,
  Settings2,
  Sparkles,
  StepBack,
  StepForward,
  Sun,
  WrapText,
} from 'lucide-react'
import { EditorLogo } from '@/components/editor-logo'
import { GithubIcon } from '@/components/github-icon'
import type { Action } from '@/components/goto'
import type { Prefs } from '@/hooks/use-prefs'
import { EDITORS } from '@/lib/editor'
import { MOD } from '@/lib/shortcut'

type Context = {
  prefs: Prefs
  dark: boolean
  sidebarOpen: boolean
  allCollapsed: boolean
  hasComments: boolean
  /** Set in a repository; whitespace and reload need one. */
  ignoreWhitespace?: boolean
  canShowFullFiles: boolean
  do: {
    toggleSidebar: () => void
    toggleAll: () => void
    next: () => void
    previous: () => void
    toggleViewed: () => void
    copyForAI: () => void
    toggleDiffStyle: () => void
    toggleDark: () => void
    toggleWhitespace: () => void
    toggleFullFiles: () => void
    toggleWrap: () => void
    reload: () => void
    openFile: () => void
    reviewNext: () => void
    openOverview: () => void
    /** Absent without a repository. */
    openInEditor?: () => void
    /** Absent unless reviewing a pull request with comments to post. */
    sendToGitHub?: () => void
    openSettings: () => void
  }
}

/** Everything the Go to menu can do, labelled for the current state. */
export function gotoActions(c: Context): Action[] {
  const git = c.ignoreWhitespace != null
  const actions: (Action | false)[] = [
    { id: 'review-next', label: 'Review next file', icon: <StepForward />, keys: ['N'], words: 'suggested order', run: c.do.reviewNext },
    { id: 'overview', label: 'Overview', icon: <ChartNoAxesColumn />, words: 'stats areas effort summary', run: c.do.openOverview },
    { id: 'next', label: 'Next file', icon: <StepForward />, keys: ['J'], run: c.do.next },
    { id: 'previous', label: 'Previous file', icon: <StepBack />, keys: ['K'], run: c.do.previous },
    { id: 'viewed', label: 'Mark file as viewed', icon: <CircleCheck />, keys: ['V'], run: c.do.toggleViewed },
    !!c.do.openInEditor && {
      id: 'editor',
      label: `Open file in ${EDITORS[c.prefs.editor]}`,
      icon: <EditorLogo editor={c.prefs.editor} />,
      keys: ['O'],
      words: 'vscode cursor zed',
      run: c.do.openInEditor,
    },
    !!c.do.sendToGitHub && {
      id: 'github',
      label: 'Send comments to GitHub',
      icon: <GithubIcon />,
      words: 'pull request review post',
      run: c.do.sendToGitHub,
    },
    c.hasComments && { id: 'ai', label: 'Copy comments for AI', icon: <Sparkles />, words: 'review prompt clipboard', run: c.do.copyForAI },
    {
      id: 'collapse',
      label: c.allCollapsed ? 'Expand all files' : 'Collapse all files',
      icon: c.allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />,
      run: c.do.toggleAll,
    },
    {
      id: 'sidebar',
      label: c.sidebarOpen ? 'Hide sidebar' : 'Show sidebar',
      icon: <PanelLeft />,
      keys: [MOD, 'B'],
      run: c.do.toggleSidebar,
    },
    {
      id: 'layout',
      label: c.prefs.diffStyle === 'split' ? 'Switch to unified' : 'Switch to split',
      icon: c.prefs.diffStyle === 'split' ? <Rows2 /> : <Columns2 />,
      words: 'layout side by side',
      run: c.do.toggleDiffStyle,
    },
    { id: 'mode', label: c.dark ? 'Switch to light mode' : 'Switch to dark mode', icon: c.dark ? <Sun /> : <Moon />, words: 'theme', run: c.do.toggleDark },
    git && {
      id: 'whitespace',
      label: c.ignoreWhitespace ? 'Show whitespace changes' : 'Ignore whitespace changes',
      icon: <Pilcrow />,
      run: c.do.toggleWhitespace,
    },
    c.canShowFullFiles && {
      id: 'full',
      label: c.prefs.fullFiles ? 'Fold unchanged lines' : 'Show full files',
      icon: <Maximize2 />,
      words: 'expand context',
      run: c.do.toggleFullFiles,
    },
    { id: 'wrap', label: c.prefs.wrap ? 'Stop wrapping lines' : 'Wrap lines', icon: <WrapText />, run: c.do.toggleWrap },
    git && { id: 'reload', label: 'Reload diff', icon: <RotateCw />, words: 'refresh', run: c.do.reload },
    { id: 'open', label: 'Open a diff file…', icon: <FileUp />, words: 'patch upload', run: c.do.openFile },
    { id: 'settings', label: 'Settings and shortcuts', icon: <Settings2 />, keys: ['?'], words: 'theme font icons', run: c.do.openSettings },
  ]
  return actions.filter((a): a is Action => !!a)
}

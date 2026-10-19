/** Whether this machine says ⌘ or Ctrl for a shortcut. */
const MAC = /Mac|iPhone|iPad/.test(navigator.platform)

/** The modifier key as this machine writes it. */
export const MOD = MAC ? '⌘' : 'Ctrl'

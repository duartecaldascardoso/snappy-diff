import { type MouseEvent, type ReactNode, useState } from 'react'

/** A tooltip that follows the pointer inside a `relative` chart container. */
export function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null)
  const show = (e: MouseEvent, content: ReactNode) => {
    const box = (e.currentTarget as Element).closest('[data-chart]')!.getBoundingClientRect()
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content })
  }
  const node = tip && (
    <div
      className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  )
  return { show, hide: () => setTip(null), node }
}


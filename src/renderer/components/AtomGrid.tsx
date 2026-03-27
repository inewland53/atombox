import React, { useState, useEffect, useRef, useCallback } from 'react'
import AtomCard from './AtomCard'
import type { Atom, InstalledMap } from '../types/atom'

const PAGE_SIZE = 24

interface Props { atoms: Atom[]; installed: InstalledMap; selected: Atom | null; heading: string; onSelect: (a: Atom) => void; showSourceBadge?: boolean; resetKey: string }

export default function AtomGrid({ atoms, installed, selected, heading, onSelect, showSourceBadge, resetKey }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset scroll only on structural changes (filter/search), not batch appends
  useEffect(() => {
    setVisible(PAGE_SIZE)
    containerRef.current?.scrollTo(0, 0)
  }, [resetKey])

  const loadMore = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) {
      setVisible(prev => Math.min(prev + PAGE_SIZE, atoms.length))
    }
  }, [atoms.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(loadMore, { root: containerRef.current, rootMargin: '200px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  if (atoms.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">No atoms found</div>
  }

  const shown = atoms.slice(0, visible)

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">{heading}</h2>
        <span className="text-sm text-gray-400">{atoms.length.toLocaleString()} atoms</span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {shown.map(atom => (
          <AtomCard key={atom.id} atom={atom} installed={installed}
            isSelected={selected?.id === atom.id} onClick={() => onSelect(atom)} showSourceBadge={showSourceBadge} />
        ))}
      </div>
      {visible < atoms.length && <div ref={sentinelRef} className="h-1" />}
    </div>
  )
}

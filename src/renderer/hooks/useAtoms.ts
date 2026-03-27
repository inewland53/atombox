import { useState, useEffect, useMemo } from 'react'
import type { Atom } from '../types/atom'

// NOTE: mount only once in the app tree.
// Double-mounting triggers two startupSync() invocations, producing duplicate atoms.
// Currently used only in App.tsx.
export function useAtoms() {
  const [atomsBySource, setAtomsBySource] = useState<Map<string, Atom[]>>(new Map())

  useEffect(() => {
    // No clearing on syncing — incremental sync only sends NEW atoms,
    // so existing cached atoms stay in the Map without duplicates.
    const offBatch = window.api.onRepoBatch(({ sourceId, atoms }) => {
      setAtomsBySource(prev => {
        const next = new Map(prev)
        const existing = next.get(sourceId) ?? []
        next.set(sourceId, [...existing, ...atoms])
        return next
      })
    })

    window.api.startupSync()

    return () => { offBatch() }
  }, [])

  const atoms = useMemo(
    () => Array.from(atomsBySource.values()).flat(),
    [atomsBySource]
  )

  function refresh() {
    setAtomsBySource(new Map())
    window.api.startupSync()
  }

  return { data: atoms, atomsBySource, refresh }
}

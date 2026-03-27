import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { Atom, InstallProgress } from '../types/atom'

export function useInstallAtom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (atom: Atom) => window.api.installAtom(atom),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installed'] }),
  })
}

export function useUninstallAtom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (atomId: string) => window.api.uninstallAtom(atomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installed'] }),
  })
}

export function useInstallProgress(cb: (p: InstallProgress) => void) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    return window.api.onInstallProgress((p) => cbRef.current(p))
  }, [])
}

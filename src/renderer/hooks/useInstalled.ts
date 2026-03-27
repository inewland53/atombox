import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { InstalledMap } from '../types/atom'

export function useInstalled() {
  return useQuery<InstalledMap>({
    queryKey: ['installed'],
    queryFn: () => window.api.getInstalled(),
  })
}

export function useInvalidateInstalled() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['installed'] })
}

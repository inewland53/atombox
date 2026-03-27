import { useState, useEffect } from 'react'
import type { RepoSource, RepoStatus, RepoStatusEvent } from '../types/atom'

export function useRepoStatus() {
  const [statuses, setStatuses] = useState<Map<string, RepoStatus>>(new Map())

  useEffect(() => {
    const off = window.api.onRepoStatus((event: RepoStatusEvent) => {
      setStatuses(prev => {
        const next = new Map(prev)
        next.set(event.sourceId, {
          sourceId: event.sourceId,
          state: event.state,
          atomCount: event.atomCount ?? next.get(event.sourceId)?.atomCount ?? null,
          progress: event.progress ?? null,
          error: event.error ?? null,
        })
        return next
      })
    })
    return off
  }, [])

  const fetchRepo = (sourceId: string) => window.api.fetchRepoCount(sourceId)
  const syncRepo = (sourceId: string) => window.api.syncRepo(sourceId)
  const syncAll = async (repos: RepoSource[]) => {
    const fetchedRepos = repos.filter(r =>
      statuses.get(r.id)?.state === 'fetched'
    )
    await Promise.allSettled(fetchedRepos.map(r => syncRepo(r.id)))
  }

  return { statuses, fetchRepo, syncRepo, syncAll }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { RepoSource } from '../types/atom'

const BUILTIN_REACTOR: RepoSource = {
  id: 'builtin-reactor',
  name: 'Reactor',
  type: 'gitlab',
  url: 'https://gitlab.com/WeSuckLess/Reactor',
  categoryLabel: 'Reactor',
  refreshInterval: 0,
  addedAt: '2024-01-01T00:00:00.000Z',
  lastFetched: null,
}

export function useRepos() {
  const queryClient = useQueryClient()

  const { data: customRepos = [] } = useQuery({
    queryKey: ['repos'],
    queryFn: () => window.api.listRepos(),
  })

  // All repos = builtin + custom
  const repos: RepoSource[] = [BUILTIN_REACTOR, ...customRepos]

  const addRepo = useMutation({
    mutationFn: (repo: Omit<RepoSource, 'id' | 'addedAt' | 'lastFetched'>) =>
      window.api.addRepo(repo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repos'] }),
  })

  const removeRepo = useMutation({
    mutationFn: (id: string) => window.api.removeRepo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repos'] }),
  })

  const updateRepo = useMutation({
    mutationFn: (payload: { id: string } & Partial<Pick<RepoSource, 'type' | 'url' | 'name' | 'categoryLabel' | 'refreshInterval'>>) =>
      window.api.updateRepo(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repos'] }),
  })

  const exportRepos = async () => window.api.exportRepos()

  const importRepos = useMutation({
    mutationFn: (json: string) => window.api.importRepos(json),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repos'] }),
  })

  return { repos, addRepo, removeRepo, updateRepo, exportRepos, importRepos }
}

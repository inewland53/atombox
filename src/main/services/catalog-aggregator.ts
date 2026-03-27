import type { Atom, RepoSource, RepoType } from '../../renderer/types/atom'
import type { RepoProvider } from '../providers/types'
import { GitLabProvider } from '../providers/gitlab-provider'
import { GitHubProvider } from '../providers/github-provider'
import { LocalProvider } from '../providers/local-provider'
import { HttpProvider } from '../providers/http-provider'

type SendFn = (channel: string, data: unknown) => void

const REACTOR_REFRESH_HOURS = 24

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

export class CatalogAggregator {
  constructor(
    private getCustomRepos: () => RepoSource[],
    private loadCache: (sourceId: string) => { atoms: Atom[]; time: number; complete: boolean } | null,
    private saveCache: (sourceId: string, atoms: Atom[], time: number, complete: boolean) => void
  ) {}

  private findSource(sourceId: string): RepoSource {
    const sources: RepoSource[] = [BUILTIN_REACTOR, ...this.getCustomRepos()]
    const source = sources.find(s => s.id === sourceId)
    if (!source) throw new Error(`Source not found: ${sourceId}`)
    return source
  }

  async fetchCount(sourceId: string, send: SendFn): Promise<number> {
    const source = this.findSource(sourceId)
    send('repo:status', { sourceId, state: 'fetching' })
    try {
      const provider = this.getProvider(source.type)
      const count = await provider.countAtoms(source)
      send('repo:status', { sourceId, state: 'fetched', atomCount: count })
      return count
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send('repo:status', { sourceId, state: 'error', error: message })
      throw err
    }
  }

  async syncSource(sourceId: string, send: SendFn): Promise<void> {
    const source = this.findSource(sourceId)
    send('repo:status', { sourceId, state: 'syncing', progress: { loaded: 0, total: 0 } })
    const provider = this.getProvider(source.type)

    // Load existing cache for incremental resume
    const cached = this.loadCache(sourceId)
    const cachedAtoms = cached?.atoms ?? []
    const knownAtomDirs = new Set(cachedAtoms.map(a => a.atomDir))
    const atoms: Atom[] = [...cachedAtoms]

    try {
      await provider.fetchCatalog(
        source,
        (batch) => {
          atoms.push(...batch)
          send('repo:batch', { sourceId, atoms: batch })
          this.saveCache(sourceId, atoms, Date.now(), false)
        },
        (loaded, total) => {
          send('repo:status', { sourceId, state: 'syncing', progress: { loaded, total } })
        },
        (counted) => {
          send('repo:status', { sourceId, state: 'syncing', progress: { loaded: cachedAtoms.length, total: counted } })
        },
        knownAtomDirs
      )
      this.saveCache(sourceId, atoms, Date.now(), true)
      send('repo:status', { sourceId, state: 'synced', atomCount: atoms.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send('repo:status', { sourceId, state: 'error', error: message })
    }
  }

  async startup(send: SendFn): Promise<void> {
    const sources: RepoSource[] = [BUILTIN_REACTOR, ...this.getCustomRepos()]

    for (const source of sources) {
      const cached = this.loadCache(source.id)

      if (cached) {
        send('repo:batch', { sourceId: source.id, atoms: cached.atoms })
        send('repo:status', { sourceId: source.id, state: 'synced', atomCount: cached.atoms.length })

        const ageHours = (Date.now() - cached.time) / (1000 * 60 * 60)
        const shouldResync = !cached.complete
          || (source.id === 'builtin-reactor' && ageHours >= REACTOR_REFRESH_HOURS)
          || (source.id !== 'builtin-reactor' && source.refreshInterval > 0 && source.lastFetched
              && ageHours >= source.refreshInterval)

        if (shouldResync) {
          this.syncSource(source.id, send).catch(() => {})
        }
      } else if (source.id === 'builtin-reactor') {
        await this.syncSource(source.id, send)
      } else {
        send('repo:status', { sourceId: source.id, state: 'idle' })
      }
    }
  }

  private getProvider(type: RepoType): RepoProvider {
    switch (type) {
      case 'gitlab':
        return new GitLabProvider()
      case 'github':
        return new GitHubProvider()
      case 'local':
        return new LocalProvider()
      case 'http':
        return new HttpProvider()
    }
  }
}

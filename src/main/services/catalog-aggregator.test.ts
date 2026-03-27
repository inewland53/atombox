import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CatalogAggregator } from './catalog-aggregator'
import { GitLabProvider } from '../providers/gitlab-provider'

// Mock all providers so syncSource completes immediately without network
vi.mock('../providers/gitlab-provider', () => ({
  GitLabProvider: vi.fn().mockImplementation(function () {
    this.fetchCatalog = vi.fn().mockResolvedValue([])
    this.countAtoms = vi.fn().mockResolvedValue(0)
    this.fetchFile = vi.fn()
  }),
}))
vi.mock('../providers/github-provider', () => ({
  GitHubProvider: vi.fn().mockImplementation(function () {
    this.fetchCatalog = vi.fn().mockResolvedValue([])
    this.countAtoms = vi.fn().mockResolvedValue(0)
    this.fetchFile = vi.fn()
  }),
}))
vi.mock('../providers/local-provider', () => ({
  LocalProvider: vi.fn().mockImplementation(function () {
    this.fetchCatalog = vi.fn().mockResolvedValue([])
    this.countAtoms = vi.fn().mockResolvedValue(0)
    this.fetchFile = vi.fn()
  }),
}))
vi.mock('../providers/http-provider', () => ({
  HttpProvider: vi.fn().mockImplementation(function () {
    this.fetchCatalog = vi.fn().mockResolvedValue([])
    this.countAtoms = vi.fn().mockResolvedValue(0)
    this.fetchFile = vi.fn()
  }),
}))

const HOUR_MS = 1000 * 60 * 60

function makeAggregator(cacheAgeMs: number | null) {
  const cachedData = cacheAgeMs !== null
    ? { atoms: [{ id: 'test-atom' } as any], time: Date.now() - cacheAgeMs }
    : null
  const send = vi.fn()
  const aggregator = new CatalogAggregator(
    () => [],
    () => cachedData,
    vi.fn()
  )
  return { aggregator, send }
}

describe('CatalogAggregator.startup() - Reactor staleness check', () => {
  it('does NOT background sync when cache is fresh (< 24h old)', async () => {
    const { aggregator, send } = makeAggregator(HOUR_MS * 2) // 2 hours old
    await aggregator.startup(send)

    const syncingCalls = send.mock.calls.filter(
      ([, data]: any) => data?.state === 'syncing'
    )
    expect(syncingCalls).toHaveLength(0)
  })

  it('background syncs when cache is stale (>= 24h old)', async () => {
    const { aggregator, send } = makeAggregator(HOUR_MS * 25) // 25 hours old
    await aggregator.startup(send)

    // Flush microtask queue to let fire-and-forget promise settle
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const syncingCalls = send.mock.calls.filter(
      ([, data]: any) => data?.state === 'syncing'
    )
    expect(syncingCalls.length).toBeGreaterThan(0)
  })

  it('blocks and syncs on first launch (no cache)', async () => {
    const { aggregator, send } = makeAggregator(null) // no cache
    await aggregator.startup(send)

    const syncingCalls = send.mock.calls.filter(
      ([, data]: any) => data?.state === 'syncing'
    )
    expect(syncingCalls.length).toBeGreaterThan(0)
  })
})

describe('CatalogAggregator.syncSource() - onEnumProgress wiring', () => {
  it('emits syncing status with growing total during enumeration', async () => {
    // Make fetchCatalog call onEnumProgress twice then resolve
    const mockFetchCatalog = vi.fn().mockImplementation(
      async (_source: any, _onBatch: any, _onProgress: any, onEnumProgress: any) => {
        onEnumProgress?.(100)
        onEnumProgress?.(200)
        return []
      }
    )
    ;(GitLabProvider as any).mockImplementation(function (this: any) {
      this.fetchCatalog = mockFetchCatalog
      this.countAtoms = vi.fn().mockResolvedValue(0)
      this.fetchFile = vi.fn()
    })

    const send = vi.fn()
    const aggregator = new CatalogAggregator(
      () => [],
      () => null,
      vi.fn()
    )

    await aggregator.syncSource('builtin-reactor', send)

    const enumEvents = send.mock.calls
      .filter(([, data]: any) => data?.state === 'syncing' && data?.progress?.loaded === 0 && data?.progress?.total > 0)
      .map(([, data]: any) => data.progress.total)

    expect(enumEvents).toContain(100)
    expect(enumEvents).toContain(200)
  })
})

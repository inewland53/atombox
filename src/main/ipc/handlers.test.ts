import { describe, it, expect, vi } from 'vitest'
import { registerHandlers } from './handlers'
import type { RepoSource } from '../../renderer/types/atom'

function createTestHarness(initialRepos: RepoSource[] = []) {
  const handlers = new Map<string, Function>()
  const storeData: Record<string, unknown> = { customRepos: initialRepos }

  const ipcMain = {
    handle: (channel: string, handler: Function) => {
      handlers.set(channel, handler)
    },
  } as any

  const store = {
    get: (key: string, fallback?: unknown) => storeData[key] ?? fallback,
    set: (key: string, value: unknown) => { storeData[key] = value },
  } as any

  const aggregator = {} as any
  const fs = {} as any
  const getFusionPath = () => null
  const send = vi.fn()

  registerHandlers(ipcMain, store, aggregator, fs, getFusionPath, send)

  return { handlers, storeData, send }
}

function makeRepo(overrides: Partial<RepoSource> = {}): RepoSource {
  return {
    id: 'test-id',
    name: 'Test Repo',
    type: 'gitlab',
    url: 'https://gitlab.com/test/repo',
    categoryLabel: 'Test',
    refreshInterval: 0,
    addedAt: '2025-01-01T00:00:00.000Z',
    lastFetched: null,
    ...overrides,
  }
}

describe('repos:update', () => {
  it('updates specified fields and returns the updated repo', async () => {
    const repo = makeRepo()
    const { handlers, storeData } = createTestHarness([repo])

    const handler = handlers.get('repos:update')!
    const result = await handler({}, { id: 'test-id', name: 'New Name', url: 'https://new-url.com' })

    expect(result.name).toBe('New Name')
    expect(result.url).toBe('https://new-url.com')
    expect(result.type).toBe('gitlab') // unchanged
    expect(result.id).toBe('test-id') // unchanged
    expect((storeData.customRepos as RepoSource[])[0].name).toBe('New Name')
  })

  it('throws if repo id is not found', async () => {
    const { handlers } = createTestHarness([])

    const handler = handlers.get('repos:update')!
    await expect(handler({}, { id: 'nonexistent', name: 'X' })).rejects.toThrow('Repo not found:')
  })

  it('preserves fields not included in the update', async () => {
    const repo = makeRepo({ categoryLabel: 'Work', refreshInterval: 6 })
    const { handlers } = createTestHarness([repo])

    const handler = handlers.get('repos:update')!
    const result = await handler({}, { id: 'test-id', name: 'Updated' })

    expect(result.categoryLabel).toBe('Work')
    expect(result.refreshInterval).toBe(6)
    expect(result.addedAt).toBe('2025-01-01T00:00:00.000Z')
    expect(result.lastFetched).toBeNull()
  })
})

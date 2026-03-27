import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitLabService } from './gitlab'
import type { Atom } from '../../renderer/types/atom'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const ATOM_CONTENT = `
Atom {
  Name = "TestAtom",
  Category = "Fuses",
  Author = "TestAuthor",
  Version = 1.0,
  Description = "A test atom.",
  Deploy = {
    "Fuses/TestAtom.fuse",
  },
}
`

function makeTreeResponse(items: object[], nextPage: string | null) {
  return {
    ok: true,
    headers: { get: (name: string) => name === 'x-next-page' ? (nextPage ?? '') : null },
    json: async () => items,
    text: async () => '',
  }
}

function makeTextResponse(content: string) {
  return { ok: true, text: async () => content }
}

describe('GitLabService', () => {
  let service: GitLabService

  beforeEach(() => {
    service = new GitLabService()
    vi.resetAllMocks()
  })

  it('fetches and parses atoms from a single page', async () => {
    const treeItems = [
      { type: 'blob', name: 'TestAtom.atom', path: 'Atoms/Fuses/TestAtom/TestAtom.atom' },
    ]
    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(treeItems, null))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))

    const atoms = await service.fetchCatalog()
    expect(atoms).toHaveLength(1)
    expect(atoms[0].name).toBe('TestAtom')
    expect(atoms[0].id).toBe('TestAtom')
    expect(atoms[0].category).toBe('Fuses')
    expect(atoms[0].version).toBe('1.0')
  })

  it('paginates across multiple pages', async () => {
    const page1 = [{ type: 'blob', name: 'Atom1.atom', path: 'Atoms/Fuses/Atom1/Atom1.atom' }]
    const page2 = [{ type: 'blob', name: 'Atom2.atom', path: 'Atoms/Tools/Atom2/Atom2.atom' }]

    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(page1, '2'))
      .mockResolvedValueOnce(makeTreeResponse(page2, null))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))

    const atoms = await service.fetchCatalog()
    expect(atoms).toHaveLength(2)
  })

  it('retries on 429 and eventually succeeds', async () => {
    const treeItems = [{ type: 'blob', name: 'TestAtom.atom', path: 'Atoms/Fuses/TestAtom/TestAtom.atom' }]
    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(treeItems, null))
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => '' })
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => '' })
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))

    const atoms = await service.fetchCatalog()
    expect(atoms).toHaveLength(1)
  })

  it('uses cache on second call within TTL', async () => {
    const treeItems = [{ type: 'blob', name: 'TestAtom.atom', path: 'Atoms/Fuses/TestAtom/TestAtom.atom' }]
    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(treeItems, null))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))

    await service.fetchCatalog()
    await service.fetchCatalog() // should hit cache

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('calls onBatch with each batch of atoms', async () => {
    const treeItems = [
      { type: 'blob', name: 'Atom1.atom', path: 'Atoms/Fuses/Atom1/Atom1.atom' },
      { type: 'blob', name: 'Atom2.atom', path: 'Atoms/Tools/Atom2/Atom2.atom' },
    ]
    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(treeItems, null))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))

    const batches: Atom[][] = []
    await service.fetchCatalog(false, (batch) => batches.push(batch))

    // Both atoms fit in one batch (CONCURRENCY=5), so onBatch called once
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(2)
  })

  it('calls onProgress with (0, total) then (loaded, total) after each batch', async () => {
    const treeItems = [
      { type: 'blob', name: 'Atom1.atom', path: 'Atoms/Fuses/Atom1/Atom1.atom' },
    ]
    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(treeItems, null))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))

    const progress: Array<[number, number]> = []
    await service.fetchCatalog(false, undefined, (loaded, total) => progress.push([loaded, total]))

    expect(progress[0]).toEqual([0, 1])   // initial: paths known, nothing parsed yet
    expect(progress[1]).toEqual([1, 1])   // after batch 1
  })

  it('calls onBatch with cached atoms on cache hit', async () => {
    // Prime the cache
    const treeItems = [
      { type: 'blob', name: 'Atom1.atom', path: 'Atoms/Fuses/Atom1/Atom1.atom' },
    ]
    mockFetch
      .mockResolvedValueOnce(makeTreeResponse(treeItems, null))
      .mockResolvedValueOnce(makeTextResponse(ATOM_CONTENT))
    await service.fetchCatalog()

    // Second call — cache is warm, no network calls
    const batches: Atom[][] = []
    await service.fetchCatalog(false, (batch) => batches.push(batch))

    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(1)
    // fetch should not have been called again beyond the initial two calls
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

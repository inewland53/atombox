import { describe, it, expect, vi, afterEach } from 'vitest'
import { GitLabProvider } from './gitlab-provider'

// Helper to make a fake GitLab tree page response
function makeTreeResponse(atomNames: string[], nextPage: string | null) {
  const items = atomNames.map(name => ({
    type: 'blob',
    name: `${name}.atom`,
    path: `Atoms/Tools/${name}/${name}.atom`,
  }))
  return {
    ok: true,
    json: () => Promise.resolve(items),
    headers: {
      get: (header: string) => header === 'x-next-page' ? nextPage : null,
    },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    text: () => Promise.resolve(''),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitLabProvider.fetchCatalog - onEnumProgress', () => {
  it('calls onEnumProgress after each page with running total', async () => {
    // Page 1: 3 atoms, page 2: 2 atoms, total 5
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeTreeResponse(['Alpha', 'Beta', 'Gamma'], '2'))
      .mockResolvedValueOnce(makeTreeResponse(['Delta', 'Epsilon'], null))
      // Subsequent calls for manifest files can fail silently (parseManifest catches errors)
      .mockRejectedValue(new Error('no manifest'))

    vi.stubGlobal('fetch', fetchMock)

    const provider = new GitLabProvider()
    const onEnumProgress = vi.fn()

    await provider.fetchCatalog(
      { id: 'test', name: 'Test', type: 'gitlab', url: 'owner/repo', categoryLabel: '', refreshInterval: 0, addedAt: '', lastFetched: null },
      undefined,
      undefined,
      onEnumProgress
    )

    // onEnumProgress should have been called at least twice: after page 1 and after page 2
    expect(onEnumProgress).toHaveBeenCalledTimes(2)
    // After page 1: 3 atoms found
    expect(onEnumProgress).toHaveBeenNthCalledWith(1, 3)
    // After page 2: 5 atoms found total
    expect(onEnumProgress).toHaveBeenNthCalledWith(2, 5)
  })

  it('does not throw when onEnumProgress is not provided', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeTreeResponse(['Alpha'], null))
      .mockRejectedValue(new Error('no manifest'))

    vi.stubGlobal('fetch', fetchMock)

    const provider = new GitLabProvider()
    // Should not throw even without the callback
    await expect(
      provider.fetchCatalog(
        { id: 'test', name: 'Test', type: 'gitlab', url: 'owner/repo', categoryLabel: '', refreshInterval: 0, addedAt: '', lastFetched: null }
      )
    ).resolves.not.toThrow()
  })
})

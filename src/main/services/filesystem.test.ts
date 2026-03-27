import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs/promises', () => {
  const mocks = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  }
  return { default: mocks, ...mocks }
})

import * as fsp from 'fs/promises'
import { FileSystemService } from './filesystem'
import type { Atom, InstalledMap } from '../../renderer/types/atom'

const FUSION_PATH = '/test/Fusion'

const MOCK_ATOM: Atom = {
  id: 'TestAtom',
  name: 'Test Atom',
  category: 'Fuses',
  author: 'Author',
  version: '1.0',
  description: 'A test',
  thumbnailUrl: '',
  gitlabUrl: '',
  hasFilesForPlatform: true,
  deployFiles: ['Fuses/TestAtom.fuse', 'Docs/TestAtom.md'],
}

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFileResponse(content: string) {
  return {
    ok: true,
    arrayBuffer: async () => Buffer.from(content).buffer,
  }
}

describe('FileSystemService', () => {
  let service: FileSystemService
  let installed: InstalledMap
  let progressEvents: object[]

  beforeEach(() => {
    installed = {}
    progressEvents = []
    service = new FileSystemService(
      () => FUSION_PATH,
      (p) => progressEvents.push(p)
    )
    vi.resetAllMocks()
    mockFetch.mockResolvedValue(makeFileResponse('content'))
    vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
    vi.mocked(fsp.writeFile).mockResolvedValue(undefined)
    vi.mocked(fsp.unlink).mockResolvedValue(undefined)
  })

  it('installs files to Reactor/Deploy/ and records relative paths', async () => {
    await service.install(MOCK_ATOM, installed)
    expect(fsp.writeFile).toHaveBeenCalledTimes(2)
    expect(installed['TestAtom']).toBeDefined()
    expect(installed['TestAtom'].files).toEqual(['Fuses/TestAtom.fuse', 'Docs/TestAtom.md'])
    expect(installed['TestAtom'].version).toBe('1.0')
  })

  it('emits progress events during install', async () => {
    await service.install(MOCK_ATOM, installed)
    expect(progressEvents).toHaveLength(2)
    expect(progressEvents[0]).toMatchObject({ atomId: 'TestAtom', total: 2 })
  })

  it('uninstalls files and removes record from installed map', async () => {
    installed['TestAtom'] = {
      version: '1.0',
      installedAt: new Date().toISOString(),
      files: ['Fuses/TestAtom.fuse'],
    }

    await service.uninstall('TestAtom', installed)

    expect(fsp.unlink).toHaveBeenCalledWith(`${FUSION_PATH}/Reactor/Deploy/Fuses/TestAtom.fuse`)
    expect(installed['TestAtom']).toBeUndefined()
  })

  it('continues uninstall even if a file deletion fails', async () => {
    installed['TestAtom'] = {
      version: '1.0',
      installedAt: new Date().toISOString(),
      files: ['Fuses/A.fuse', 'Fuses/B.fuse'],
    }

    vi.mocked(fsp.unlink)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined)

    await expect(service.uninstall('TestAtom', installed)).resolves.not.toThrow()
    expect(installed['TestAtom']).toBeUndefined()
  })

  it('rolls back written files on install failure', async () => {
    const networkError = new Error('Network error')
    mockFetch
      .mockResolvedValueOnce(makeFileResponse('ok'))
      .mockRejectedValue(networkError)

    vi.useFakeTimers()
    let installError: Error | undefined
    const installPromise = service.install(MOCK_ATOM, installed).catch((e) => {
      installError = e
    })
    try {
      await vi.runAllTimersAsync()
      await installPromise
    } finally {
      vi.useRealTimers()
    }

    expect(installError).toBeDefined()
    expect(fsp.unlink).toHaveBeenCalled()
    expect(installed['TestAtom']).toBeUndefined()
  })
})

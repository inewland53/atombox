import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  accessSync: vi.fn(),
  constants: { W_OK: 2 },
}))

import * as fs from 'fs'
import { detectFusionPath, MAC_FUSION_PATH, WIN_FUSION_PATH } from './drdetector'
import path from 'path'

describe('detectFusionPath', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns resolved path when exists and writable on Mac', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.accessSync).mockReturnValue(undefined)
    const result = detectFusionPath('darwin')
    expect(result).toBe(path.resolve(MAC_FUSION_PATH))
  })

  it('returns resolved path when exists and writable on Windows', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.accessSync).mockReturnValue(undefined)
    const result = detectFusionPath('win32')
    expect(result).toBe(path.resolve(WIN_FUSION_PATH))
  })

  it('returns null when path does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = detectFusionPath('darwin')
    expect(result).toBeNull()
  })

  it('returns null when path exists but is not writable', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.accessSync).mockImplementation(() => { throw new Error('EACCES') })
    const result = detectFusionPath('darwin')
    expect(result).toBeNull()
  })
})

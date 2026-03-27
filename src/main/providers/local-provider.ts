import fs from 'node:fs/promises'
import path from 'node:path'
import { parseAtomManifest, type Platform } from '../services/atomParser'
import type { Atom, RepoSource } from '../../renderer/types/atom'
import type { RepoProvider } from './types'

const BATCH_SIZE = 10

export class LocalProvider implements RepoProvider {
  async fetchCatalog(
    source: RepoSource,
    onBatch?: (atoms: Atom[]) => void,
    onProgress?: (loaded: number, total: number) => void,
    _onEnumProgress?: (counted: number) => void,
    _knownAtomDirs?: Set<string>
  ): Promise<Atom[]> {
    const platform: Platform = process.platform === 'darwin' ? 'Mac' : 'Windows'
    const rootDir = source.url

    const atomFiles = await findAtomFiles(rootDir)
    onProgress?.(0, atomFiles.length)

    const results: Atom[] = []
    let loaded = 0
    let batchBuffer: Atom[] = []

    for (const filePath of atomFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const parsed = parseAtomManifest(content, platform)

        const relativePath = path.relative(rootDir, filePath)
        const parts = relativePath.split(path.sep)
        const atomName = parts[parts.length - 2] ?? path.basename(filePath, '.atom')
        const category = parts[parts.length - 3] ?? 'Uncategorized'
        const atomDir = parts.slice(0, -1).join('/')

        const atom: Atom = {
          id: atomName,
          name: parsed.name || atomName,
          category: parsed.category || category,
          author: parsed.author,
          version: parsed.version,
          description: parsed.description,
          deployFiles: parsed.deployFiles,
          thumbnailUrl: `file://${path.join(rootDir, atomDir, 'img', `${atomName}.png`)}`,
          gitlabUrl: `file://${filePath}`,
          atomDir,
          hasFilesForPlatform: parsed.hasFilesForPlatform,
          sourceId: source.id,
          sourceName: source.name,
        }

        results.push(atom)
        batchBuffer.push(atom)

        if (batchBuffer.length >= BATCH_SIZE) {
          onBatch?.(batchBuffer)
          batchBuffer = []
        }
      } catch {
        // Skip files that fail to parse
      }

      loaded++
      onProgress?.(loaded, atomFiles.length)
    }

    if (batchBuffer.length > 0) {
      onBatch?.(batchBuffer)
    }

    return results
  }

  async fetchFile(source: RepoSource, relativePath: string): Promise<Buffer> {
    return fs.readFile(path.join(source.url, relativePath))
  }

  async countAtoms(source: RepoSource): Promise<number> {
    const atomFiles = await findAtomFiles(source.url)
    return atomFiles.length
  }
}

async function findAtomFiles(dir: string): Promise<string[]> {
  const results: string[] = []

  async function walk(currentDir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.atom')) {
        results.push(fullPath)
      }
    }
  }

  await walk(dir)
  return results
}

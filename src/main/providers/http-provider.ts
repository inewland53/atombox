import { parseAtomManifest, type Platform } from '../services/atomParser'
import type { Atom, RepoSource } from '../../renderer/types/atom'
import type { RepoProvider } from './types'

const CONCURRENCY = 25
const MAX_RETRIES = 3
const FETCH_TIMEOUT_MS = 15_000

interface HttpIndex {
  atoms: string[]
}

export class HttpProvider implements RepoProvider {
  async fetchCatalog(
    source: RepoSource,
    onBatch?: (atoms: Atom[]) => void,
    onProgress?: (loaded: number, total: number) => void,
    _onEnumProgress?: (counted: number) => void,
    knownAtomDirs?: Set<string>
  ): Promise<Atom[]> {
    const baseUrl = source.url.replace(/\/$/, '')
    const platform: Platform = process.platform === 'darwin' ? 'Mac' : 'Windows'

    const indexRes = await fetchWithRetry(`${baseUrl}/index.json`)
    const index: HttpIndex = await indexRes.json()
    const allPaths = index.atoms

    const toFetch = knownAtomDirs
      ? allPaths.filter(p => !knownAtomDirs.has(p.split('/').slice(0, -1).join('/')))
      : allPaths
    let loaded = allPaths.length - toFetch.length
    onProgress?.(loaded, allPaths.length)

    const results: Atom[] = []

    for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
      const batch = toFetch.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(
        batch.map(p => parseManifest(p, platform, baseUrl, source))
      )
      const batchResults: Atom[] = []
      for (const s of settled) {
        if (s.status === 'fulfilled' && s.value) {
          results.push(s.value)
          batchResults.push(s.value)
        }
      }
      loaded += batch.length
      if (batchResults.length > 0) onBatch?.(batchResults)
      onProgress?.(loaded, allPaths.length)
    }

    return results
  }

  async fetchFile(source: RepoSource, relativePath: string): Promise<Buffer> {
    const baseUrl = source.url.replace(/\/$/, '')
    const res = await fetchWithRetry(`${baseUrl}/${relativePath}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async countAtoms(source: RepoSource): Promise<number> {
    const baseUrl = source.url.replace(/\/$/, '')
    const res = await fetchWithRetry(`${baseUrl}/index.json`)
    const index: HttpIndex = await res.json()
    return index.atoms.length
  }
}

async function parseManifest(
  atomPath: string,
  platform: Platform,
  baseUrl: string,
  source: RepoSource
): Promise<Atom | null> {
  try {
    const res = await fetchWithRetry(`${baseUrl}/${atomPath}`)
    const content = await res.text()

    const parts = atomPath.split('/')
    const atomName = parts[parts.length - 2] ?? parts[parts.length - 1].replace('.atom', '')
    const category = parts[parts.length - 3] ?? 'Uncategorized'
    const atomDir = parts.slice(0, -1).join('/')

    const parsed = parseAtomManifest(content, platform)

    return {
      id: atomName,
      name: parsed.name || atomName,
      category: parsed.category || category,
      author: parsed.author,
      version: parsed.version,
      description: parsed.description,
      deployFiles: parsed.deployFiles,
      thumbnailUrl: `${baseUrl}/${atomDir}/img/${atomName}.png`,
      gitlabUrl: `${baseUrl}/${atomDir}`,
      atomDir,
      hasFilesForPlatform: parsed.hasFilesForPlatform,
      sourceId: source.id,
      sourceName: source.name,
    }
  } catch {
    return null
  }
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (res.ok) return res
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 500)
        continue
      }
      throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e as Error
      if (attempt < MAX_RETRIES) await sleep(Math.pow(2, attempt) * 500)
    }
  }
  throw lastErr ?? new Error(`Failed to fetch ${url}`)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

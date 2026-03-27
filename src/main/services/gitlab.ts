import { parseAtomManifest, type Platform } from './atomParser'
import type { Atom } from '../../renderer/types/atom'

const GITLAB_API = 'https://gitlab.com/api/v4/projects/WeSuckLess%2FReactor'
const RAW_BASE = 'https://gitlab.com/WeSuckLess/Reactor/-/raw/master'
const CACHE_TTL_MS = Infinity
const CONCURRENCY = 25
const MAX_RETRIES = 3

interface TreeItem {
  type: string
  name: string
  path: string
}

export class GitLabService {
  private cache: Atom[] | null = null
  private cacheTime = 0

  constructor(
    private loadPersistedCache?: () => { atoms: Atom[]; time: number } | null,
    private persistCache?: (atoms: Atom[], time: number) => void
  ) {
    const persisted = loadPersistedCache?.()
    if (persisted) {
      this.cache = persisted.atoms
      this.cacheTime = persisted.time
    }
  }

  async fetchCatalog(
    force = false,
    onBatch?: (atoms: Atom[]) => void,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Atom[]> {
    if (!force && this.cache && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      onBatch?.(this.cache)
      return this.cache
    }

    const manifestPaths = await this.fetchAllManifestPaths()
    const platform: Platform = process.platform === 'darwin' ? 'Mac' : 'Windows'
    onProgress?.(0, manifestPaths.length)

    const atoms = await this.fetchManifestsInBatches(manifestPaths, platform, onBatch, onProgress)

    this.cache = atoms
    this.cacheTime = Date.now()
    this.persistCache?.(this.cache, this.cacheTime)
    return this.cache
  }

  private async fetchAllManifestPaths(): Promise<string[]> {
    const paths: string[] = []
    let page = 1

    while (true) {
      const url = `${GITLAB_API}/repository/tree?path=Atoms&recursive=true&per_page=100&page=${page}`
      const res = await fetchWithRetry(url)
      const items: TreeItem[] = await res.json()

      for (const item of items) {
        if (item.type === 'blob' && item.name.endsWith('.atom')) {
          paths.push(item.path)
        }
      }

      const nextPage = res.headers.get('x-next-page')
      if (!nextPage) break
      page++
    }

    return paths
  }

  private async fetchManifestsInBatches(
    paths: string[],
    platform: Platform,
    onBatch?: (atoms: Atom[]) => void,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Atom[]> {
    const results: Atom[] = []
    let loaded = 0
    for (let i = 0; i < paths.length; i += CONCURRENCY) {
      const batch = paths.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(batch.map(p => this.parseManifest(p, platform)))
      const batchResults: Atom[] = []
      for (const s of settled) {
        if (s.status === 'fulfilled' && s.value) {
          results.push(s.value)
          batchResults.push(s.value)
        }
      }
      loaded += batch.length
      if (batchResults.length > 0) onBatch?.(batchResults)
      onProgress?.(loaded, paths.length)
    }
    return results
  }

  private async parseManifest(manifestPath: string, platform: Platform): Promise<Atom | null> {
    try {
      const res = await fetchWithRetry(`${RAW_BASE}/${manifestPath}`)
      const content = await res.text()

      const parts = manifestPath.split('/')
      const atomName = parts[parts.length - 2]
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
        thumbnailUrl: `${RAW_BASE}/${atomDir}/img/${atomName}.png`,
        gitlabUrl: `https://gitlab.com/WeSuckLess/Reactor/-/tree/master/${atomDir}`,
        atomDir,
        hasFilesForPlatform: parsed.hasFilesForPlatform,
      }
    } catch {
      return null
    }
  }
}

const FETCH_TIMEOUT_MS = 15_000

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

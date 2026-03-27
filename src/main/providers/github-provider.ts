import { parseAtomManifest, type Platform } from '../services/atomParser'
import type { Atom, RepoSource } from '../../renderer/types/atom'
import type { RepoProvider } from './types'

const CONCURRENCY = 25
const MAX_RETRIES = 3
const FETCH_TIMEOUT_MS = 15_000

interface GitHubEntry {
  type: 'file' | 'dir'
  name: string
  path: string
  download_url: string | null
}

function parseOwnerRepoClean(url: string): string {
  if (!url.includes('://')) {
    return url
  }
  const withoutOrigin = url.replace(/^https?:\/\/github\.com\//, '')
  const parts = withoutOrigin.split('/')
  return `${parts[0]}/${parts[1]}`
}

export class GitHubProvider implements RepoProvider {
  async fetchCatalog(
    source: RepoSource,
    onBatch?: (atoms: Atom[]) => void,
    onProgress?: (loaded: number, total: number) => void,
    _onEnumProgress?: (counted: number) => void,
    knownAtomDirs?: Set<string>
  ): Promise<Atom[]> {
    const ownerRepo = parseOwnerRepoClean(source.url)
    const platform: Platform = process.platform === 'darwin' ? 'Mac' : 'Windows'

    const allFiles = await fetchAllAtomFiles(ownerRepo)
    const toFetch = knownAtomDirs
      ? allFiles.filter(e => !knownAtomDirs.has(e.path.split('/').slice(0, -1).join('/')))
      : allFiles
    let loaded = allFiles.length - toFetch.length
    onProgress?.(loaded, allFiles.length)

    const results: Atom[] = []

    for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
      const batch = toFetch.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(
        batch.map(entry => parseManifest(entry, platform, ownerRepo, source))
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
      onProgress?.(loaded, allFiles.length)
    }

    return results
  }

  async fetchFile(source: RepoSource, relativePath: string): Promise<Buffer> {
    const ownerRepo = parseOwnerRepoClean(source.url)
    const url = `https://raw.githubusercontent.com/${ownerRepo}/main/${relativePath}`
    const res = await fetchWithRetry(url)
    return Buffer.from(await res.arrayBuffer())
  }

  async countAtoms(source: RepoSource): Promise<number> {
    const ownerRepo = parseOwnerRepoClean(source.url)
    const atomFiles = await fetchAllAtomFiles(ownerRepo)
    return atomFiles.length
  }
}

async function fetchAllAtomFiles(ownerRepo: string): Promise<GitHubEntry[]> {
  const atomFiles: GitHubEntry[] = []
  const queue: string[] = [`https://api.github.com/repos/${ownerRepo}/contents/Atoms`]

  while (queue.length > 0) {
    const url = queue.shift()!
    const res = await fetchWithRetry(url, {
      'Accept': 'application/vnd.github+json',
    })
    const entries: GitHubEntry[] = await res.json()

    for (const entry of entries) {
      if (entry.type === 'dir') {
        queue.push(`https://api.github.com/repos/${ownerRepo}/contents/${entry.path}`)
      } else if (entry.type === 'file' && entry.name.endsWith('.atom')) {
        atomFiles.push(entry)
      }
    }
  }

  return atomFiles
}

async function parseManifest(
  entry: GitHubEntry,
  platform: Platform,
  ownerRepo: string,
  source: RepoSource
): Promise<Atom | null> {
  try {
    if (!entry.download_url) return null

    const res = await fetchWithRetry(entry.download_url)
    const content = await res.text()

    const parts = entry.path.split('/')
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
      thumbnailUrl: `https://raw.githubusercontent.com/${ownerRepo}/main/${atomDir}/img/${atomName}.png`,
      gitlabUrl: `https://github.com/${ownerRepo}/tree/main/${atomDir}`,
      atomDir,
      hasFilesForPlatform: parsed.hasFilesForPlatform,
      sourceId: source.id,
      sourceName: source.name,
    }
  } catch {
    return null
  }
}

async function fetchWithRetry(url: string, headers?: Record<string, string>): Promise<Response> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers,
      })
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

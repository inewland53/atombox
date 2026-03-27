import fsp from 'fs/promises'
import path from 'path'
import type { Atom, InstalledMap, InstallProgress } from '../../renderer/types/atom'

const RAW_BASE = 'https://gitlab.com/WeSuckLess/Reactor/-/raw/master'
const CONCURRENCY = 5
const MAX_RETRIES = 5

export class FileSystemService {
  constructor(
    private getFusionPath: () => string | null,
    private sendProgress: (progress: InstallProgress) => void
  ) {}

  private deployRoot(): string {
    const fp = this.getFusionPath()
    if (!fp) throw new Error('DaVinci Resolve Fusion path not configured')
    return path.join(fp, 'Reactor', 'Deploy')
  }

  async install(atom: Atom, installed: InstalledMap): Promise<void> {
    if (!atom.hasFilesForPlatform || atom.deployFiles.length === 0) {
      throw new Error(`Atom "${atom.name}" has no files for this platform`)
    }

    const deployRoot = this.deployRoot()
    const writtenFiles: string[] = []
    const { deployFiles } = atom

    try {
      for (let i = 0; i < deployFiles.length; i += CONCURRENCY) {
        const batch = deployFiles.slice(i, i + CONCURRENCY)
        await Promise.all(batch.map(async (relPath, batchIdx) => {
          const absPath = path.join(deployRoot, relPath)
          await fsp.mkdir(path.dirname(absPath), { recursive: true })

          const url = `${RAW_BASE}/${atom.atomDir}/${relPath}`
          const buffer = await fetchFileWithRetry(url)
          await fsp.writeFile(absPath, Buffer.from(buffer))

          writtenFiles.push(relPath)
          this.sendProgress({
            atomId: atom.id,
            file: relPath,
            index: i + batchIdx,
            total: deployFiles.length,
          })
        }))
      }
    } catch (err) {
      await this.rollback(deployRoot, writtenFiles)
      throw err
    }

    installed[atom.id] = {
      version: atom.version,
      installedAt: new Date().toISOString(),
      files: deployFiles,
    }
  }

  async detectInstalled(atoms: Atom[], installed: InstalledMap): Promise<void> {
    const fp = this.getFusionPath()
    if (!fp) return

    await Promise.all(atoms.map(async (atom) => {
      if (installed[atom.id] || atom.deployFiles.length === 0) return
      const results = await Promise.all(
        atom.deployFiles.map(f =>
          fsp.access(path.join(fp, 'Reactor', 'Deploy', f)).then(() => true, () => false)
        )
      )
      if (results.every(Boolean)) {
        installed[atom.id] = {
          version: atom.version,
          installedAt: new Date().toISOString(),
          files: atom.deployFiles,
        }
      }
    }))
  }

  async uninstall(atomId: string, installed: InstalledMap): Promise<void> {
    const record = installed[atomId]
    if (!record) return

    const deployRoot = this.deployRoot()
    for (const relPath of record.files) {
      try {
        await fsp.unlink(path.join(deployRoot, relPath))
      } catch {
        // best-effort
      }
    }

    delete installed[atomId]
  }

  private async rollback(deployRoot: string, writtenFiles: string[]): Promise<void> {
    for (const relPath of writtenFiles) {
      try {
        await fsp.unlink(path.join(deployRoot, relPath))
      } catch {
        // log in production
      }
    }
  }
}

async function fetchFileWithRetry(url: string): Promise<ArrayBuffer> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.arrayBuffer()
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 2000)
        continue
      }
      throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e as Error
      if (attempt < MAX_RETRIES) await sleep(Math.pow(2, attempt) * 2000)
    }
  }
  throw lastErr ?? new Error(`Failed to fetch ${url}`)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

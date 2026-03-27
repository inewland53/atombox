import type { IpcMain } from 'electron'
import type Store from 'electron-store'
import type { CatalogAggregator } from '../services/catalog-aggregator'
import type { FileSystemService } from '../services/filesystem'
import type { Atom, RepoSource } from '../../renderer/types/atom'
import { randomUUID } from 'crypto'

type StoreSchema = {
  fusionPath: string | null
  installed: Record<string, { version: string; installedAt: string; files: string[] }>
  customRepos: RepoSource[]
}

export function registerHandlers(
  ipcMain: IpcMain,
  store: Store<StoreSchema>,
  aggregator: CatalogAggregator,
  fs: FileSystemService,
  getFusionPath: () => string | null,
  send: (channel: string, data: unknown) => void
) {
  ipcMain.handle('repos:list', () => store.get('customRepos', []))

  ipcMain.handle('repos:add', (_event, repo: Omit<RepoSource, 'id' | 'addedAt' | 'lastFetched'>) => {
    const newRepo: RepoSource = {
      ...repo,
      id: randomUUID(),
      addedAt: new Date().toISOString(),
      lastFetched: null,
    }
    const current = store.get('customRepos', [])
    store.set('customRepos', [...current, newRepo])
    return newRepo
  })

  ipcMain.handle('repos:remove', (_event, id: string) => {
    const current = store.get('customRepos', [])
    store.set('customRepos', current.filter((r) => r.id !== id))
  })

  ipcMain.handle('repos:update', async (_event, payload: { id: string } & Partial<Pick<RepoSource, 'type' | 'url' | 'name' | 'categoryLabel' | 'refreshInterval'>>) => {
    const { id, ...fields } = payload
    const current = store.get('customRepos', [])
    const idx = current.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Repo not found: ${id}`)
    const updated = { ...current[idx], ...fields }
    const next = [...current]
    next[idx] = updated
    store.set('customRepos', next)
    return updated
  })

  ipcMain.handle('repos:export', () => {
    const repos = store.get('customRepos', [])
    return JSON.stringify(
      {
        'atombox-repos': '1.0',
        repos: repos.map((r) => ({
          name: r.name,
          type: r.type,
          url: r.url,
          categoryLabel: r.categoryLabel,
          refreshInterval: r.refreshInterval,
        })),
      },
      null,
      2
    )
  })

  ipcMain.handle('repos:import', (_event, json: string) => {
    const parsed = JSON.parse(json)
    if (!parsed['atombox-repos'] || !Array.isArray(parsed.repos)) {
      throw new Error('Invalid atombox-repos export format')
    }
    const current = store.get('customRepos', [])
    const existingUrls = new Set(current.map((r) => r.url))
    const imported: RepoSource[] = []
    for (const r of parsed.repos) {
      if (existingUrls.has(r.url)) continue
      const newRepo: RepoSource = {
        id: randomUUID(),
        name: r.name,
        type: r.type,
        url: r.url,
        categoryLabel: r.categoryLabel,
        refreshInterval: r.refreshInterval,
        addedAt: new Date().toISOString(),
        lastFetched: null,
      }
      imported.push(newRepo)
      existingUrls.add(r.url)
    }
    store.set('customRepos', [...current, ...imported])
    return imported
  })

  ipcMain.handle('repos:fetchCount', async (_event, sourceId: string) => {
    return aggregator.fetchCount(sourceId, send)
  })

  ipcMain.handle('repos:sync', async (_event, sourceId: string) => {
    await aggregator.syncSource(sourceId, send)
  })

  ipcMain.handle('catalog:startup', async () => {
    try {
      await aggregator.startup(send)
    } catch (e) {
      send('repo:status', { sourceId: 'builtin-reactor', state: 'error', error: (e as Error).message })
    }
  })

  ipcMain.handle('installed:get', () => store.get('installed'))

  ipcMain.handle('installed:detect', async (_event, atoms: Atom[]) => {
    const installed = store.get('installed')
    await fs.detectInstalled(atoms, installed)
    store.set('installed', installed)
  })

  ipcMain.handle('atom:install', async (_event, atom: Atom) => {
    const installed = store.get('installed')
    await fs.install(atom, installed)
    store.set('installed', installed)
  })

  ipcMain.handle('atom:uninstall', async (_event, atomId: string) => {
    const installed = store.get('installed')
    await fs.uninstall(atomId, installed)
    store.set('installed', installed)
  })

  ipcMain.handle('settings:getFusionPath', () => getFusionPath())
  ipcMain.handle('settings:setFusionPath', (_event, p: string) => store.set('fusionPath', p))
}

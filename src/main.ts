import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import Store from 'electron-store'
import { CatalogAggregator } from './main/services/catalog-aggregator'
import { FileSystemService } from './main/services/filesystem'
import { detectFusionPath } from './main/services/drdetector'
import { registerHandlers } from './main/ipc/handlers'
import type { RepoSource } from './renderer/types/atom'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

const store = new Store({
  defaults: {
    fusionPath: null as string | null,
    installed: {} as Record<string, any>,
    customRepos: [] as RepoSource[],
  },
})

const aggregator = new CatalogAggregator(
  () => store.get('customRepos', []) as RepoSource[],
  (sourceId) => {
    const cache = store.get(`cache_${sourceId}`) as { atoms: any[]; time: number; complete?: boolean } | null
    return cache ? { ...cache, complete: cache.complete ?? true } : null
  },
  (sourceId, atoms, time, complete) => {
    store.set(`cache_${sourceId}`, { atoms, time, complete })
  }
)
let mainWindow: BrowserWindow | null = null

function getFusionPath(): string | null {
  return (store.get('fusionPath') as string | null) ?? detectFusionPath()
}

const fsService = new FileSystemService(getFusionPath, (progress) => {
  try { mainWindow?.webContents.send('install:progress', progress) } catch {}
})

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  registerHandlers(ipcMain, store as any, aggregator, fsService, getFusionPath,
    (channel, data) => {
      try { mainWindow?.webContents.send(channel, data) } catch {}
    }
  )

})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    app.whenReady().then(() => {
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      })
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
      } else {
        mainWindow.loadFile(
          path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
        )
      }
    })
  }
})

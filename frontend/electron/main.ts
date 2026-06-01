import { app, BrowserWindow, shell, Menu } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import net from 'net'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BACKEND_PORT = 5757
const isDev = !app.isPackaged

let backendProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------

function waitForPort(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const tryConnect = () => {
      const sock = net.createConnection(port, '127.0.0.1')
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() >= deadline) reject(new Error(`Backend not ready after ${timeout}ms`))
        else setTimeout(tryConnect, 300)
      })
    }
    tryConnect()
  })
}

function spawnBackend(): void {
  // In dev: project root is one level above frontend/
  // In prod: bundled nocap-server binary lives in Resources/backend/
  if (isDev) {
    const projectRoot = path.join(app.getAppPath(), '..')
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3')
    const pythonExe = existsSync(venvPython) ? venvPython : 'python3'
    backendProcess = spawn(
      pythonExe,
      ['-m', 'nocap.web.desktop', '--port', String(BACKEND_PORT)],
      { cwd: projectRoot, env: { ...process.env, PYTHONUNBUFFERED: '1' } }
    )
  } else {
    // nocap-server is a PyInstaller onedir bundle: Resources/backend/nocap-server/nocap-server
    const serverBin = path.join(process.resourcesPath, 'backend', 'nocap-server', 'nocap-server')
    backendProcess = spawn(serverBin, ['--port', String(BACKEND_PORT)], {
      env: {
        ...process.env,
        // Tell the Python backend where bundled assets (Whisper model) live
        NOCAP_RESOURCES: process.resourcesPath,
      },
    })
  }

  backendProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[backend] ${d}`))
  backendProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[backend] ${d}`))
  backendProcess.on('exit', code => console.log(`[backend] exited ${code}`))
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 22 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      sandbox: false,
    },
    show: false,
  })

  // Open external links in the default browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      // Dev: Vite dev server handles HMR, /api proxied to Flask
      await waitForPort(BACKEND_PORT)
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
      // Production: Flask serves the built React app + API
      await waitForPort(BACKEND_PORT)
      await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`)
    }
  } catch (err) {
    console.error('[main] Backend failed to start:', err)
    app.quit()
  }
}

// ---------------------------------------------------------------------------
// macOS menu (minimal native menu so keyboard shortcuts work)
// ---------------------------------------------------------------------------

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  buildMenu()
  spawnBackend()
  await createWindow()

  // macOS: re-create window when clicking dock icon with no windows open
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  backendProcess?.kill()
  backendProcess = null
})

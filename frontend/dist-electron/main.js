import { app, BrowserWindow, Menu, shell } from "electron";
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const BACKEND_PORT = 5757;
const isDev = !app.isPackaged;
let backendProcess = null;
let mainWindow = null;
function waitForPort(port, timeout = 3e4) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const tryConnect = () => {
      const sock = net.createConnection(port, "127.0.0.1");
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() >= deadline) reject(new Error(`Backend not ready after ${timeout}ms`));
        else setTimeout(tryConnect, 300);
      });
    };
    tryConnect();
  });
}
function spawnBackend() {
  var _a, _b;
  if (isDev) {
    const projectRoot = path.join(app.getAppPath(), "..");
    const venvPython = path.join(projectRoot, ".venv", "bin", "python3");
    const pythonExe = existsSync(venvPython) ? venvPython : "python3";
    backendProcess = spawn(
      pythonExe,
      ["-m", "nocap.web.desktop", "--port", String(BACKEND_PORT)],
      { cwd: projectRoot, env: { ...process.env, PYTHONUNBUFFERED: "1" } }
    );
  } else {
    const serverBin = path.join(process.resourcesPath, "backend", "nocap-server", "nocap-server");
    backendProcess = spawn(serverBin, ["--port", String(BACKEND_PORT)], {
      env: {
        ...process.env,
        // Tell the Python backend where bundled assets (Whisper model) live
        NOCAP_RESOURCES: process.resourcesPath
      }
    });
  }
  (_a = backendProcess.stdout) == null ? void 0 : _a.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  (_b = backendProcess.stderr) == null ? void 0 : _b.on("data", (d) => process.stderr.write(`[backend] ${d}`));
  backendProcess.on("exit", (code) => console.log(`[backend] exited ${code}`));
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 22 },
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      sandbox: false
    },
    show: false
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow == null ? void 0 : mainWindow.show());
  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      await waitForPort(BACKEND_PORT);
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      await waitForPort(BACKEND_PORT);
      await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    }
  } catch (err) {
    console.error("[main] Backend failed to start:", err);
    app.quit();
  }
}
function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...isDev ? [{ role: "toggleDevTools" }] : []
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
app.whenReady().then(async () => {
  buildMenu();
  spawnBackend();
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
    else mainWindow == null ? void 0 : mainWindow.show();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  backendProcess == null ? void 0 : backendProcess.kill();
  backendProcess = null;
});

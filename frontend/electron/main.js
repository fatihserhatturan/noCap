var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { app, BrowserWindow, shell, Menu } from 'electron';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var BACKEND_PORT = 5757;
var isDev = !app.isPackaged;
var backendProcess = null;
var mainWindow = null;
// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------
function waitForPort(port, timeout) {
    if (timeout === void 0) { timeout = 30000; }
    return new Promise(function (resolve, reject) {
        var deadline = Date.now() + timeout;
        var tryConnect = function () {
            var sock = net.createConnection(port, '127.0.0.1');
            sock.once('connect', function () { sock.destroy(); resolve(); });
            sock.once('error', function () {
                sock.destroy();
                if (Date.now() >= deadline)
                    reject(new Error("Backend not ready after ".concat(timeout, "ms")));
                else
                    setTimeout(tryConnect, 300);
            });
        };
        tryConnect();
    });
}
function spawnBackend() {
    var _a, _b;
    // In dev: project root is one level above frontend/
    // In prod: bundled nocap-server binary lives in Resources/backend/
    if (isDev) {
        var projectRoot = path.join(app.getAppPath(), '..');
        var venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
        var pythonExe = existsSync(venvPython) ? venvPython : 'python3';
        backendProcess = spawn(pythonExe, ['-m', 'nocap.web.desktop', '--port', String(BACKEND_PORT)], { cwd: projectRoot, env: __assign(__assign({}, process.env), { PYTHONUNBUFFERED: '1' }) });
    }
    else {
        // nocap-server is a PyInstaller onedir bundle: Resources/backend/nocap-server/nocap-server
        var serverBin = path.join(process.resourcesPath, 'backend', 'nocap-server', 'nocap-server');
        backendProcess = spawn(serverBin, ['--port', String(BACKEND_PORT)], {
            env: __assign(__assign({}, process.env), { 
                // Tell the Python backend where bundled assets (Whisper model) live
                NOCAP_RESOURCES: process.resourcesPath }),
        });
    }
    (_a = backendProcess.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (d) { return process.stdout.write("[backend] ".concat(d)); });
    (_b = backendProcess.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (d) { return process.stderr.write("[backend] ".concat(d)); });
    backendProcess.on('exit', function (code) { return console.log("[backend] exited ".concat(code)); });
}
// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
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
                    });
                    // Open external links in the default browser, not in Electron
                    mainWindow.webContents.setWindowOpenHandler(function (_a) {
                        var url = _a.url;
                        shell.openExternal(url);
                        return { action: 'deny' };
                    });
                    mainWindow.once('ready-to-show', function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show(); });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    if (!process.env.VITE_DEV_SERVER_URL) return [3 /*break*/, 4];
                    // Dev: Vite dev server handles HMR, /api proxied to Flask
                    return [4 /*yield*/, waitForPort(BACKEND_PORT)];
                case 2:
                    // Dev: Vite dev server handles HMR, /api proxied to Flask
                    _a.sent();
                    return [4 /*yield*/, mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 4: 
                // Production: Flask serves the built React app + API
                return [4 /*yield*/, waitForPort(BACKEND_PORT)];
                case 5:
                    // Production: Flask serves the built React app + API
                    _a.sent();
                    return [4 /*yield*/, mainWindow.loadURL("http://localhost:".concat(BACKEND_PORT))];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_1 = _a.sent();
                    console.error('[main] Backend failed to start:', err_1);
                    app.quit();
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// macOS menu (minimal native menu so keyboard shortcuts work)
// ---------------------------------------------------------------------------
function buildMenu() {
    var template = [
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
            submenu: __spreadArray([
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ], (isDev ? [{ role: 'toggleDevTools' }] : []), true),
        },
        {
            label: 'Window',
            submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buildMenu();
                spawnBackend();
                return [4 /*yield*/, createWindow()
                    // macOS: re-create window when clicking dock icon with no windows open
                ];
            case 1:
                _a.sent();
                // macOS: re-create window when clicking dock icon with no windows open
                app.on('activate', function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(BrowserWindow.getAllWindows().length === 0)) return [3 /*break*/, 2];
                                return [4 /*yield*/, createWindow()];
                            case 1:
                                _a.sent();
                                return [3 /*break*/, 3];
                            case 2:
                                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
                                _a.label = 3;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
        }
    });
}); });
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('before-quit', function () {
    backendProcess === null || backendProcess === void 0 ? void 0 : backendProcess.kill();
    backendProcess = null;
});

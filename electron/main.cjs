const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  Notification,
  desktopCapturer,
  ipcMain,
  nativeImage,
  session,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const APP_ID = 'com.aeirmist.social';
const PREFERRED_PORT = 45820;
const UPSTREAM_API_ORIGIN = process.env.AEIRMIST_API_ORIGIN || 'https://aeirmist.com';

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const ICON_PATH_PNG = path.resolve(__dirname, '..', 'build', 'icon.png');
const PUBLIC_ICON_PNG = path.resolve(__dirname, '..', 'public', 'icon-512.png');
const OFFLINE_HTML = path.resolve(__dirname, 'offline.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

let mainWindow = null;
let tray = null;
let localServer = null;
let localBaseUrl = null;
let isQuitting = false;
let pendingDeepLink = null;

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

// Register aeirmist:// deep-link protocol
try {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('aeirmist', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('aeirmist');
  }
} catch {
  // Ignore if running in restricted context
}

// Single-instance enforcement
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function getAppIcon() {
  const iconCandidate = fs.existsSync(ICON_PATH_PNG) ? ICON_PATH_PNG : PUBLIC_ICON_PNG;
  if (fs.existsSync(iconCandidate)) {
    return nativeImage.createFromPath(iconCandidate);
  }
  return undefined;
}

function extractDeepLink(argv) {
  if (!Array.isArray(argv)) return null;
  return argv.find((arg) => typeof arg === 'string' && arg.startsWith('aeirmist://')) || null;
}

function handleDeepLink(url) {
  if (!url) return;
  pendingDeepLink = url;
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const parsed = new URL(url);
      const targetRoute = `/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/+/g, '/');
      if (localBaseUrl && targetRoute !== '/') {
        mainWindow.loadURL(`${localBaseUrl}${targetRoute}`);
      }
    } catch {
      // Fallback: notify renderer via preload channel
    }
    mainWindow.webContents.send('aeirmist:deep-link', url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    pendingDeepLink = null;
  }
}

function forwardUpstream(req, res, targetUrl, redirectCount = 0) {
  const transport = targetUrl.protocol === 'https:' ? https : http;
  const headers = { ...req.headers };
  headers.host = targetUrl.host;
  headers.origin = `${targetUrl.protocol}//${targetUrl.host}`;
  headers.referer = `${targetUrl.protocol}//${targetUrl.host}/`;
  delete headers['content-length'];
  if (req.headers['content-length'] && redirectCount === 0) {
    headers['content-length'] = req.headers['content-length'];
  }

  const upstreamReq = transport.request(
    targetUrl,
    {
      method: redirectCount > 0 ? 'GET' : req.method,
      headers,
      timeout: 30000,
    },
    (upstreamRes) => {
      const status = upstreamRes.statusCode || 502;
      if ([301, 302, 303, 307, 308].includes(status) && upstreamRes.headers.location && redirectCount < 3) {
        upstreamRes.resume();
        try {
          const nextUrl = new URL(upstreamRes.headers.location, targetUrl);
          forwardUpstream(req, res, nextUrl, redirectCount + 1);
          return;
        } catch {
          // fall through to forwarding original response
        }
      }

      const responseHeaders = { ...upstreamRes.headers };
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['x-frame-options'];
      responseHeaders['access-control-allow-origin'] = '*';
      responseHeaders['cross-origin-resource-policy'] = 'cross-origin';
      res.writeHead(status, responseHeaders);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('Upstream API timeout'));
  });

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Network unavailable or upstream unreachable',
          offline: true,
          details: err.message,
        })
      );
    } else {
      res.end();
    }
  });

  if (redirectCount === 0) {
    req.pipe(upstreamReq);
  } else {
    upstreamReq.end();
  }
}

function proxyRequestToUpstream(req, res) {
  let targetUrl;
  try {
    targetUrl = new URL(req.url || '/', UPSTREAM_API_ORIGIN);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid proxy URL' }));
    return;
  }

  forwardUpstream(req, res, targetUrl, 0);
}

function serveDistRequest(req, res) {
  const urlPath = (req.url || '/').split('?')[0];

  // Forward /api/* and /media/* (images, videos, audio, uploads) through the local bridge
  if (
    urlPath.startsWith('/api/') ||
    urlPath === '/api' ||
    urlPath.startsWith('/media/') ||
    urlPath === '/media' ||
    urlPath.startsWith('/uploads/') ||
    urlPath === '/uploads' ||
    urlPath.startsWith('/storage/') ||
    urlPath === '/storage'
  ) {
    proxyRequestToUpstream(req, res);
    return;
  }

  let cleanPath = '/';
  try {
    cleanPath = decodeURIComponent(urlPath);
  } catch {
    cleanPath = urlPath;
  }

  const relativePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, relativePath);

  // Guard against directory traversal
  const withinDist = candidate === DIST_DIR || candidate.startsWith(DIST_DIR + path.sep);
  if (withinDist && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(candidate).pipe(res);
    return;
  }

  // Missing static asset extension should return 404 rather than HTML
  const ext = path.extname(relativePath).toLowerCase();
  if (ext && ext !== '.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  // SPA fallback to dist/index.html
  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(indexHtml).pipe(res);
    return;
  }

  // Offline / missing bundle fallback
  if (fs.existsSync(OFFLINE_HTML)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(OFFLINE_HTML).pipe(res);
    return;
  }

  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Aeirmist bundle missing.');
}

function startLocalAppServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(serveDistRequest);
    let retriedRandomPort = false;

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && !retriedRandomPort) {
        retriedRandomPort = true;
        server.listen(0, 'localhost');
      } else {
        reject(err);
      }
    });

    server.listen(PREFERRED_PORT, 'localhost', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : PREFERRED_PORT;
      localServer = server;
      resolve(`http://localhost:${port}`);
    });
  });
}

function isAllowedInternalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (
      u.hostname === 'aeirmist.com' ||
      u.hostname.endsWith('.aeirmist.com') ||
      u.hostname.endsWith('.pages.dev') ||
      u.hostname === 'accounts.google.com' ||
      u.hostname.endsWith('.firebaseapp.com') ||
      u.hostname.endsWith('.web.app')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function configurePermissions() {
  const allowedPermissions = new Set([
    'media',
    'mediaKeySystem',
    'notifications',
    'fullscreen',
    'clipboard-read',
    'clipboard-sanitized-write',
    'display-capture',
  ]);

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const origin = details?.requestingUrl || '';
    if (allowedPermissions.has(permission) && (!origin || isAllowedInternalUrl(origin))) {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (allowedPermissions.has(permission) && (!requestingOrigin || isAllowedInternalUrl(requestingOrigin))) {
      return true;
    }
    return false;
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      callback(sources.length > 0 ? { video: sources[0], audio: 'loopback' } : {});
    } catch {
      callback({});
    }
  });
}

function createTray() {
  if (tray) return;
  const icon = getAppIcon();
  if (!icon) return;
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Aeirmist');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Aeirmist',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    {
      label: 'Reload App',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Aeirmist',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

async function createMainWindow() {
  if (!localBaseUrl) {
    localBaseUrl = process.env.AEIRMIST_DEV_URL || (await startLocalAppServer());
  }

  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Aeirmist',
    backgroundColor: '#030712',
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  // Clean dark desktop menu
  const appMenu = Menu.buildFromTemplate([
    {
      label: 'Aeirmist',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
  Menu.setApplicationMenu(appMenu);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (pendingDeepLink) {
      handleDeepLink(pendingDeepLink);
    }
  });

  // Handle popups (allow OAuth/internal, open external links in default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInternalUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          backgroundColor: '#030712',
          autoHideMenuBar: true,
          icon,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, _validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 && fs.existsSync(OFFLINE_HTML)) {
      mainWindow.loadFile(OFFLINE_HTML);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(localBaseUrl);
}

app.on('second-instance', (_event, argv) => {
  const link = extractDeepLink(argv);
  if (link) {
    handleDeepLink(link);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

ipcMain.on('aeirmist:notify', (_event, payload) => {
  if (Notification.isSupported() && payload?.title) {
    new Notification({
      title: String(payload.title),
      body: String(payload.body || ''),
      icon: getAppIcon(),
    }).show();
  }
});

ipcMain.handle('aeirmist:open-external', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('aeirmist:get-version', () => app.getVersion());

app.whenReady().then(async () => {
  try {
    const repairFlag = path.join(app.getPath('userData'), 'cache-repair-v2.flag');
    if (!fs.existsSync(repairFlag)) {
      await session.defaultSession.clearStorageData({
        storages: ['serviceworkers', 'cachestorage'],
      });
      fs.writeFileSync(repairFlag, new Date().toISOString(), 'utf8');
    }
  } catch {
    // Non-fatal if cache cleanup cannot run
  }
  configurePermissions();
  createTray();
  pendingDeepLink = extractDeepLink(process.argv);
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (localServer) {
    try {
      localServer.close();
    } catch {
      // ignore
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});

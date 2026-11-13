const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aeirmistDesktop', {
  isElectron: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  notify: (title, body) => ipcRenderer.send('aeirmist:notify', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('aeirmist:open-external', url),
  getAppVersion: () => ipcRenderer.invoke('aeirmist:get-version'),
  onDeepLink: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('aeirmist:deep-link', handler);
    return () => ipcRenderer.removeListener('aeirmist:deep-link', handler);
  },
});

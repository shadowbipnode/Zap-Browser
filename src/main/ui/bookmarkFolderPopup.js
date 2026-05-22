'use strict'

const { BrowserWindow } = require('electron')

let folderPopup = null

function hideBookmarkFolderPopup() {
  if (folderPopup && !folderPopup.isDestroyed()) folderPopup.hide()
}

function showBookmarkFolderPopup({ mainWindow, items = [], x = 0, y = 0 }) {
  if (!mainWindow) return { ok: false }

  const html = `
<!doctype html>
<html>
<body style="margin:0;background:#151720;color:white;font-family:sans-serif;padding:6px;overflow:hidden;">
${items.length === 0 ? '<div style="padding:10px;color:#aaa;font-size:12px;">Empty folder</div>' : items.map(i => `
<button data-url="${String(i.url || '')}" style="display:block;width:260px;text-align:left;background:transparent;color:white;border:0;padding:8px;border-radius:8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
${Number(i.is_folder) === 1 ? '📁' : '🌐'} ${String(i.title || i.url || '')}
</button>`).join('')}
<script>
const { ipcRenderer } = require('electron')
document.querySelectorAll('button[data-url]').forEach(b => {
  b.addEventListener('click', () => {
    ipcRenderer.send('bookmark-folder-popup-picked', b.getAttribute('data-url'))
  })
})
</script>
</body>
</html>`

  if (!folderPopup || folderPopup.isDestroyed()) {
    folderPopup = new BrowserWindow({
      width: 280,
      height: Math.min(400, Math.max(60, items.length * 38 + 20)),
      x: Math.round(x),
      y: Math.round(y),
      parent: mainWindow,
      frame: false,
      show: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    })

    folderPopup.on('blur', hideBookmarkFolderPopup)
    folderPopup.on('closed', () => { folderPopup = null })
  }

  folderPopup.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: 280,
    height: Math.min(400, Math.max(60, items.length * 38 + 20)),
  })

  folderPopup.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  folderPopup.show()

  return { ok: true }
}

module.exports = {
  showBookmarkFolderPopup,
  hideBookmarkFolderPopup,
}

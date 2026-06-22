'use strict'

const { Menu, clipboard } = require('electron')

function showBookmarkContextMenu({
  mainWindow,
  bookmark,
}) {
  if (!mainWindow) return Promise.resolve(null)

  if (!bookmark) {
    return new Promise((resolve) => {
      const menu = Menu.buildFromTemplate([
        {
          label: 'New Bookmark',
          click: () => resolve('new-bookmark'),
        },
        {
          label: 'New Folder',
          click: () => resolve('new-folder'),
        },
        { type: 'separator' },
        {
          label: 'Import Bookmarks',
          click: () => resolve('import-bookmarks'),
        },
        {
          label: 'Export Bookmarks',
          click: () => resolve('export-bookmarks'),
        },
        { type: 'separator' },
        {
          label: 'Refresh',
          click: () => resolve('refresh'),
        },
      ])

      menu.popup({
        window: mainWindow,
        callback: () => resolve(null),
      })
    })
  }

  const isFolder = Number(bookmark?.is_folder) === 1

  const template = []

  if (!isFolder) {
    template.push({
      label: 'Open in New Tab',
      click: () => {
        mainWindow.webContents.send('bookmark-open-new-tab', bookmark)
      },
    })

    template.push({
      label: 'Copy URL',
      click: () => {
        clipboard.writeText(bookmark?.url || '')
      },
    })

    template.push({ type: 'separator' })
  }

  template.push({
    label: 'Rename',
    click: () => {
      mainWindow.webContents.send('bookmark-rename', bookmark)
    },
  })

  template.push({
    label: 'Delete',
    click: () => {
      mainWindow.webContents.send('bookmark-delete', bookmark)
    },
  })

  const menu = Menu.buildFromTemplate(template)
  menu.popup({ window: mainWindow })

  return Promise.resolve(null)
}

module.exports = {
  showBookmarkContextMenu,
}

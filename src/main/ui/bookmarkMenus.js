'use strict'

const { Menu, clipboard } = require('electron')

function showBookmarkContextMenu({
  mainWindow,
  bookmark,
}) {
  if (!mainWindow) return

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
}

module.exports = {
  showBookmarkContextMenu,
}

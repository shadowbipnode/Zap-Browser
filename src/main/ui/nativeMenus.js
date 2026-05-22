'use strict'

const { Menu, shell } = require('electron')

function setupWebViewContextMenu({ view, mainWindow, getActiveTabId }) {
  if (!view?.webContents) return

  view.webContents.on('context-menu', (event, params) => {
    const wc = view.webContents

    const template = []

    if (params.selectionText && params.selectionText.trim()) {
      template.push(
        {
          label: 'Copy',
          click: () => {
            require('electron').clipboard.writeText(params.selectionText)
          },
        },
        { type: 'separator' }
      )
    }

    if (params.linkURL) {
      template.push(
        {
          label: 'Open Link in New Tab',
          click: () => {
            mainWindow?.webContents.send('open-new-tab', { url: params.linkURL })
          },
        },
        {
          label: 'Copy Link',
          click: () => {
            require('electron').clipboard.writeText(params.linkURL)
          },
        },
        { type: 'separator' }
      )
    }

    if (params.srcURL) {
      template.push(
        {
          label: 'Open Image in New Tab',
          click: () => {
            mainWindow?.webContents.send('open-new-tab', { url: params.srcURL })
          },
        },
        {
          label: 'Copy Image URL',
          click: () => {
            require('electron').clipboard.writeText(params.srcURL)
          },
        },
        { type: 'separator' }
      )
    }

    template.push(
      {
        label: 'Back',
        enabled: wc.canGoBack(),
        click: () => wc.goBack(),
      },
      {
        label: 'Forward',
        enabled: wc.canGoForward(),
        click: () => wc.goForward(),
      },
      {
        label: 'Reload',
        click: () => wc.reload(),
      },
      { type: 'separator' },
      {
        label: 'Copy Page URL',
        click: () => {
          require('electron').clipboard.writeText(wc.getURL())
        },
      },
      {
        label: 'Open Page Externally',
        click: () => {
          shell.openExternal(wc.getURL())
        },
      },
      { type: 'separator' },
      {
        label: 'Inspect Element',
        click: () => {
          wc.inspectElement(params.x, params.y)
        },
      }
    )

    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window: mainWindow })
  })
}

module.exports = {
  setupWebViewContextMenu,
}

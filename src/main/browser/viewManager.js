'use strict'

const SHELL_H = 142

function showView(mainWindow, activeView) {
  if (!mainWindow || !activeView) return

  if (!mainWindow.getBrowserViews().includes(activeView)) {
    mainWindow.addBrowserView(activeView)
  }

  const { width, height } = mainWindow.getBounds()

  activeView.setBounds({
    x: 0,
    y: SHELL_H,
    width,
    height: height - SHELL_H,
  })

  activeView.setAutoResize({
    width: true,
    height: true,
  })
}

function hideView(mainWindow, activeView) {
  if (!mainWindow || !activeView) return

  try {
    mainWindow.removeBrowserView(activeView)
  } catch (_) {}
}

function resizeView(mainWindow, activeView, args = {}) {
  if (!mainWindow || !activeView) return

  const { width, height } = mainWindow.getBounds()

  const suggestionsOffset = args?.suggestionsOpen ? 320 : 0

  activeView.setBounds({
    x: 0,
    y: SHELL_H + suggestionsOffset,
    width: width - (args?.panelOpen ? 320 : 0),
    height: height - SHELL_H - suggestionsOffset,
  })
}

module.exports = {
  SHELL_H,
  showView,
  hideView,
  resizeView,
}

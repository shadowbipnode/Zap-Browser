'use strict'

const SHELL_H = 174

function showView(mainWindow, activeView, args = {}) {
  if (!mainWindow || !activeView) return

  if (!mainWindow.getBrowserViews().includes(activeView)) {
    mainWindow.addBrowserView(activeView)
  }

  resizeView(mainWindow, activeView, args)

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
  const suggestionsOffset = 0
  const requestedPanelWidth = Number(args?.panelWidth)
  const panelWidth = Number.isFinite(requestedPanelWidth)
    ? Math.max(0, Math.min(width, Math.round(requestedPanelWidth)))
    : (args?.panelOpen ? 320 : 0)

  activeView.setBounds({
    x: 0,
    y: SHELL_H + suggestionsOffset,
    width: Math.max(0, width - panelWidth),
    height: Math.max(0, height - SHELL_H - suggestionsOffset),
  })
}

module.exports = {
  SHELL_H,
  showView,
  hideView,
  resizeView,
}

const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const keychain = require('./keychain')

const PORTABLE_MARKER = '.portable'
const PORTABLE_CONFIG = 'portable.json'

function getAppBasePath() {
  if (app.isPackaged) return path.dirname(process.execPath)
  return path.resolve(__dirname, '../..')
}

function getPortableDir() {
  return path.join(getAppBasePath(), 'zap-data')
}

function isPortableMode() {
  return fs.existsSync(path.join(getAppBasePath(), PORTABLE_MARKER))
}

function applyPortableUserDataPath() {
  if (!isPortableMode()) return false

  const dir = getPortableDir()
  fs.mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)

  return true
}

function getConfigPath() {
  return path.join(getPortableDir(), PORTABLE_CONFIG)
}

function hasPortableConfig() {
  return fs.existsSync(getConfigPath())
}

function readConfig() {
  if (!hasPortableConfig()) return null
  return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'))
}

function setupPassphrase(passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters')
  }

  fs.mkdirSync(getPortableDir(), { recursive: true })

  const salt = keychain.createSalt()
  const key = keychain.deriveKeyFromPassphrase(passphrase, salt)
  const verifier = keychain.createVerifier(key)

  fs.writeFileSync(getConfigPath(), JSON.stringify({
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations: 310000,
    salt,
    verifier,
    created_at: Date.now(),
  }, null, 2))

  keychain.setRuntimeKey(key)

  return { ok: true }
}

function unlock(passphrase) {
  const cfg = readConfig()
  if (!cfg) throw new Error('Portable config not found')

  const key = keychain.deriveKeyFromPassphrase(passphrase, cfg.salt)

  if (!keychain.verifyKey(key, cfg.verifier)) {
    key.fill(0)
    throw new Error('Invalid passphrase')
  }

  keychain.setRuntimeKey(key)

  return { ok: true }
}

module.exports = {
  isPortableMode,
  applyPortableUserDataPath,
  hasPortableConfig,
  setupPassphrase,
  unlock,
}

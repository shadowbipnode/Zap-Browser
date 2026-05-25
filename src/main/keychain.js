const crypto = require('crypto')
const keytar = require('keytar')

const SERVICE = 'zap-browser'
const ACCOUNT = 'encryption-key'

let runtimeKey = null

function setRuntimeKey(key) {
  runtimeKey = key
}

function clearRuntimeKey() {
  if (runtimeKey) runtimeKey.fill(0)
  runtimeKey = null
}

function deriveKeyFromPassphrase(passphrase, saltHex) {
  const salt = Buffer.from(saltHex, 'hex')
  return crypto.pbkdf2Sync(passphrase, salt, 310000, 32, 'sha256')
}

function createSalt() {
  return crypto.randomBytes(16).toString('hex')
}

function createVerifier(key) {
  return encrypt('zap-portable-verifier', key)
}

function verifyKey(key, verifier) {
  try {
    return decrypt(verifier, key) === 'zap-portable-verifier'
  } catch (_) {
    return false
  }
}

async function getOrCreateKey() {
  if (runtimeKey) return runtimeKey

  let key = await keytar.getPassword(SERVICE, ACCOUNT)

  if (!key) {
    key = crypto.randomBytes(32).toString('hex')
    await keytar.setPassword(SERVICE, ACCOUNT, key)
  }

  return Buffer.from(key, 'hex')
}

function encrypt(text, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(data, key) {
  const [ivHex, tagHex, encHex] = data.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

module.exports = {
  getOrCreateKey,
  encrypt,
  decrypt,
  setRuntimeKey,
  clearRuntimeKey,
  deriveKeyFromPassphrase,
  createSalt,
  createVerifier,
  verifyKey,
}

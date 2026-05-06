'use strict'

const keytar = require('keytar')

const SERVICE = 'zap-browser'
const ACCOUNT = 'encryption-key'

const crypto = require('crypto')

async function getOrCreateKey() {
  let key = await keytar.getPassword(SERVICE, ACCOUNT)
  if (!key) {
    key = crypto.randomBytes(32).toString('hex')
    await keytar.setPassword(SERVICE, ACCOUNT, key)
  }
  return Buffer.from(key, 'hex')
}

function encrypt(text, key) {
  const iv         = crypto.randomBytes(12)
  const cipher     = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag    = cipher.getAuthTag()
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(data, key) {
  const [ivHex, tagHex, encHex] = data.split(':')
  const iv        = Buffer.from(ivHex, 'hex')
  const authTag   = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher  = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

module.exports = { getOrCreateKey, encrypt, decrypt }

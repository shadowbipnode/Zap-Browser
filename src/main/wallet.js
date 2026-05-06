'use strict'

const keychain = require('./keychain')
const bip39   = require('bip39')
const crypto  = require('crypto')

function generateMnemonic() {
  return bip39.generateMnemonic(256).split(' ')
}

function validateMnemonic(words) {
  const phrase = Array.isArray(words) ? words.join(' ') : words
  return bip39.validateMnemonic(phrase)
}

async function setupWallet(DB, { words, password, mode }) {
  const phrase = Array.isArray(words) ? words.join(' ') : words

  if (mode === 'bitcoin' && phrase.trim()) {
    if (!bip39.validateMnemonic(phrase)) throw new Error('Invalid mnemonic')
    const seed         = bip39.mnemonicToSeedSync(phrase, password || '')
    const seedHex      = seed.toString('hex')
    const key          = await keychain.getOrCreateKey()
    const encSeed      = keychain.encrypt(seedHex, key)
    const salt         = crypto.randomBytes(16).toString('hex')
    DB._db()
      .prepare('INSERT OR REPLACE INTO wallet(id,encrypted_seed,salt,mode,created_at) VALUES(1,?,?,?,?)')
      .run(encSeed, salt, mode, Math.floor(Date.now() / 1000))
    DB.setSetting('initialized', '1')
    DB.setSetting('mode', mode)
    return { success: true, seedHex }
  }

  DB.setSetting('initialized', '1')
  DB.setSetting('mode', mode)
  return { success: true, seedHex: null }
}

module.exports = { generateMnemonic, validateMnemonic, setupWallet }

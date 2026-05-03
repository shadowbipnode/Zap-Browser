// src/main/wallet.js
'use strict'

const bip39 = require('bip39')

function generateMnemonic() {
  return bip39.generateMnemonic(256).split(" ") // 24 words
}

function validateMnemonic(words) {
  const phrase = Array.isArray(words) ? words.join(' ') : words
  return bip39.validateMnemonic(phrase)
}

function setupWallet(DB, { words, password, mode }) {
  const phrase = Array.isArray(words) ? words.join(' ') : words
  let seedHex = null

  if (mode === 'bitcoin' && phrase.trim()) {
    if (!bip39.validateMnemonic(phrase)) throw new Error('Mnemonic non valido')
    const seed = bip39.mnemonicToSeedSync(phrase, password || '')
    seedHex = seed.toString('hex')
    const enc = seed.slice(0, 32).toString('hex') // placeholder encryption
    const salt = require('crypto').randomBytes(16).toString('hex')
    const db = DB._db()
    db.prepare('INSERT OR REPLACE INTO wallet(id,encrypted_seed,salt,mode,created_at) VALUES(1,?,?,?,?)')
      .run(enc, salt, mode, Math.floor(Date.now() / 1000))
  }

  DB.setSetting('initialized', '1')
  DB.setSetting('mode', mode)
  return { success: true, seedHex }
}

module.exports = { generateMnemonic, validateMnemonic, setupWallet }

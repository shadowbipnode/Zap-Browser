'use strict'

let _cashu = null
async function getCashu() {
  if (!_cashu) _cashu = await import('@cashu/cashu-ts')
  return _cashu
}

async function listMints(DB) {
  return DB._db().prepare('SELECT * FROM cashu_mints ORDER BY created_at DESC').all()
}

async function addMint(DB, { url }) {
  url = url.trim().replace(/\/$/, '')
  const { CashuMint } = await getCashu()
  const mint = new CashuMint(url)
  await mint.getKeys()
  DB._db().prepare('INSERT OR IGNORE INTO cashu_mints(url,name,active,created_at) VALUES(?,?,1,?)')
    .run(url, url.replace('https://',''), Math.floor(Date.now()/1000))
  return { ok: true }
}

async function removeMint(DB, { url }) {
  DB._db().prepare('DELETE FROM cashu_mints WHERE url=?').run(url)
  return { ok: true }
}

async function getBalance(DB) {
  const proofs = DB._db().prepare('SELECT * FROM cashu_proofs WHERE spent=0').all()
  return { balance: proofs.reduce((s,p) => s + p.amount, 0) }
}

async function receive(DB, { token }) {
  const { CashuMint, CashuWallet, getDecodedToken } = await getCashu()
  const decoded = getDecodedToken(token)
  const mintUrl = decoded.token[0].mint
  const mint    = new CashuMint(mintUrl)
  const keys    = await mint.getKeys()
  const wallet  = new CashuWallet(mint, { keys })
  const proofs  = decoded.token[0].proofs
  const newProofs = await wallet.receiveTokenEntry({ mint: mintUrl, proofs }, {})
  const db = DB._db()
  for (const p of newProofs) {
    db.prepare('INSERT OR IGNORE INTO cashu_proofs(secret,amount,C,mint_url,spent,created_at) VALUES(?,?,?,?,0,?)')
      .run(p.secret, p.amount, p.C, mintUrl, Math.floor(Date.now()/1000))
  }
  return { ok: true, amount: newProofs.reduce((s,p)=>s+p.amount,0) }
}

async function send(DB, { amount, mintUrl }) {
  const { CashuMint, CashuWallet, getEncodedToken } = await getCashu()
  const allProofs = DB._db().prepare('SELECT * FROM cashu_proofs WHERE spent=0 AND mint_url=?').all(mintUrl)
  if (!allProofs.length) throw new Error('Nessun proof disponibile')
  const mint   = new CashuMint(mintUrl)
  const keys   = await mint.getKeys()
  const wallet = new CashuWallet(mint, { keys })
  const { keep, send: sendProofs } = await wallet.send(amount, allProofs)
  const db = DB._db()
  for (const p of allProofs) db.prepare('UPDATE cashu_proofs SET spent=1 WHERE secret=?').run(p.secret)
  for (const p of keep) {
    db.prepare('INSERT OR IGNORE INTO cashu_proofs(secret,amount,C,mint_url,spent,created_at) VALUES(?,?,?,?,0,?)')
      .run(p.secret, p.amount, p.C, mintUrl, Math.floor(Date.now()/1000))
  }
  const encoded = getEncodedToken({ token: [{ mint: mintUrl, proofs: sendProofs }] })
  return { ok: true, token: encoded }
}

async function mintTokens(DB, { amount, mintUrl }) {
  const { CashuMint, CashuWallet } = await getCashu()
  const mint   = new CashuMint(mintUrl)
  const keys   = await mint.getKeys()
  const wallet = new CashuWallet(mint, { keys })
  const { request: pr, quote } = await wallet.createMintQuote(amount)
  return { invoice: pr, quote }
}

async function checkMintQuote(DB, { quote, amount, mintUrl }) {
  const { CashuMint, CashuWallet } = await getCashu()
  const mint   = new CashuMint(mintUrl)
  const keys   = await mint.getKeys()
  const wallet = new CashuWallet(mint, { keys })
  const proofs = await wallet.mintProofs(amount, quote)
  const db = DB._db()
  for (const p of proofs) {
    db.prepare('INSERT OR IGNORE INTO cashu_proofs(secret,amount,C,mint_url,spent,created_at) VALUES(?,?,?,?,0,?)')
      .run(p.secret, p.amount, p.C, mintUrl, Math.floor(Date.now()/1000))
  }
  return { ok: true, amount: proofs.reduce((s,p)=>s+p.amount,0) }
}

module.exports = { listMints, addMint, removeMint, getBalance, receive, send, mintTokens, checkMintQuote }

'use strict'

const axios = require('axios')

function isLightningAddress(value) {
  if (!value || typeof value !== 'string') return false

  const v = value.trim()

  // Basic Lightning Address format: user@domain.tld
  // Avoid treating normal emails inside search queries as payments.
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
}

function lightningAddressToUrl(address) {
  const [name, domain] = address.trim().split('@')

  if (!name || !domain) {
    throw new Error('Invalid Lightning Address')
  }

  return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`
}

async function fetchPayParams(address) {
  if (!isLightningAddress(address)) {
    throw new Error('Invalid Lightning Address')
  }

  const url = lightningAddressToUrl(address)

  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      accept: 'application/json',
      'user-agent': 'Zap-Browser-LNURL',
    },
  })

  const data = res.data || {}

  if (data.status === 'ERROR') {
    throw new Error(data.reason || 'LNURL service returned an error')
  }

  if (data.tag && data.tag !== 'payRequest') {
    throw new Error(`Unsupported LNURL tag: ${data.tag}`)
  }

  if (!data.callback) {
    throw new Error('LNURL response missing callback')
  }

  if (!Number.isFinite(Number(data.minSendable)) || !Number.isFinite(Number(data.maxSendable))) {
    throw new Error('LNURL response missing min/max amount')
  }

  return {
    address,
    callback: data.callback,
    minSendable: Number(data.minSendable),
    maxSendable: Number(data.maxSendable),
    metadata: data.metadata || '',
    commentAllowed: Number(data.commentAllowed || 0),
  }
}

async function requestInvoice({ callback, amountMsat, comment }) {
  if (!callback || typeof callback !== 'string') {
    throw new Error('Invalid LNURL callback')
  }

  const url = new URL(callback)
  url.searchParams.set('amount', String(amountMsat))

  if (comment) {
    url.searchParams.set('comment', comment)
  }

  const res = await axios.get(url.toString(), {
    timeout: 12000,
    headers: {
      accept: 'application/json',
      'user-agent': 'Zap-Browser-LNURL',
    },
  })

  const data = res.data || {}

  if (data.status === 'ERROR') {
    throw new Error(data.reason || 'LNURL callback returned an error')
  }

  if (!data.pr) {
    throw new Error('LNURL callback did not return an invoice')
  }

  return {
    invoice: data.pr,
    routes: data.routes || [],
    successAction: data.successAction || null,
  }
}

module.exports = {
  isLightningAddress,
  lightningAddressToUrl,
  fetchPayParams,
  requestInvoice,
}

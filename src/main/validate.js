function isString(v, max = 5000) {
  return typeof v === 'string' &&
    v.length > 0 &&
    v.length <= max
}

function isOptionalString(v, max = 5000) {
  return v == null || (
    typeof v === 'string' &&
    v.length <= max
  )
}

function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg || 'Invalid payload')
  }
}

function validateInvoice(invoice) {
  assert(isString(invoice, 10000), 'Invalid invoice')
}

function validateNsec(nsec) {
  assert(
    isString(nsec, 500) &&
    nsec.startsWith('nsec'),
    'Invalid nsec'
  )
}

function validateOrigin(origin) {
  assert(
    isString(origin, 2000),
    'Invalid origin'
  )
}

function validateNostrEvent(event) {
  assert(event && typeof event === 'object', 'Invalid event')

  assert(isString(event.kind?.toString(), 20), 'Invalid kind')

  if (event.content != null) {
    assert(isString(event.content, 50000), 'Content too large')
  }

  assert(Array.isArray(event.tags || []), 'Invalid tags')
}

module.exports = {
  assert,
  isString,
  isOptionalString,
  validateInvoice,
  validateNsec,
  validateOrigin,
  validateNostrEvent,
}

'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  CMP_SELECTORS,
  CANDIDATE_SELECTORS,
  getOverlayProtectionScript,
  shouldEnableOverlayProtection,
} = require('../src/main/overlayProtection')
const { getCosmeticScript } = require('../src/main/cosmetic')

test('overlay protection is profile-setting gated', () => {
  assert.equal(shouldEnableOverlayProtection({ adblock: 1, overlay_block: 1 }), true)
  assert.equal(shouldEnableOverlayProtection({ adblock: 0, overlay_block: 1 }), false)
  assert.equal(shouldEnableOverlayProtection({ adblock: 1, overlay_block: 0 }), false)
  assert.equal(shouldEnableOverlayProtection({ adblock: 0, overlay_block: 0 }), false)
})

test('overlay protection script is bounded and preserves paywalls', () => {
  const script = getOverlayProtectionScript()

  assert.doesNotThrow(() => new Function(script))
  assert.match(script, /paywallPattern/)
  assert.match(script, /isPaywall\(el\)/)
  assert.match(script, /protectedPaywallSelector/)
  assert.doesNotMatch(script, /setInterval\s*\(/)
  assert.doesNotMatch(script, /\.click\s*\(/)
  assert.doesNotMatch(script, /querySelectorAll\(['"](?:body )?\*['"]\)/)
  assert.doesNotMatch(script, /attributes:\s*true/)
})

test('CMP selectors target vendor containers rather than paid content', () => {
  const selectors = CMP_SELECTORS.join(' ')

  assert.match(selectors, /onetrust/)
  assert.match(selectors, /didomi/)
  assert.match(selectors, /iubenda/)
  assert.doesNotMatch(selectors, /paywall|premium|article|subscription|subscribe/i)
  assert.doesNotMatch(CANDIDATE_SELECTORS, /\[id\*="cookie"|\[class\*="cookie"/i)
})

test('cosmetic cleanup avoids navigation automation and full-page mutation scans', () => {
  const script = getCosmeticScript()

  assert.doesNotThrow(() => new Function(script))
  assert.doesNotMatch(script, /\.click\s*\(/)
  assert.doesNotMatch(script, /setInterval\s*\(/)
  assert.doesNotMatch(script, /querySelectorAll\(['"]body \*['"]\)/)
  assert.doesNotMatch(script, /attributes:\s*true/)
  assert.doesNotMatch(script, /document\.(?:body|documentElement)\.style\.overflow\s*=/)
})

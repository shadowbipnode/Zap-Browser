'use strict'

const CMP_SELECTORS = [
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '.qc-cmp2-container',
  '.qc-cmp2-main',
  '.qc-cmp-ui-container',
  '#didomi-host',
  '.didomi-popup-container',
  '.didomi-consent-popup',
  '.iubenda-cs-container',
  '.iubenda-cs-overlay',
  '.iubenda-cs-banner',
  '#CybotCookiebotDialog',
  '#CybotCookiebotDialogBodyUnderlay',
  '.truste_overlay',
  '.truste_box_overlay',
  '[data-testid="consent-modal"]',
  '[data-testid="cookie-banner"]',
]

const CANDIDATE_SELECTORS = [
  ...CMP_SELECTORS,
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[class*="anti-adblock" i]',
  '[class*="adblock-modal" i]',
  '[id*="anti-adblock" i]',
  '[id*="adblock-modal" i]',
].join(',')

function getOverlayProtectionScript() {
  return `
    (() => {
      if (window.__zapOverlayProtection) return;

      const state = window.__zapOverlayProtection = {
        hiddenCount: 0,
        pending: new Set(),
        timer: 0
      };
      const knownCmpSelector = ${JSON.stringify(CMP_SELECTORS.join(','))};
      const candidateSelector = ${JSON.stringify(CANDIDATE_SELECTORS)};
      const protectedPaywallSelector = '[class*="paywall" i], [id*="paywall" i], [class*="premium" i], [data-paywall], [data-testid*="paywall" i], .tp-backdrop, .tp-modal, [class*="piano" i]';
      const paywallPattern = /(?:paywall|premium|subscriber|subscription|subscribe|already subscribed|sign in to continue|purchase access|paid content|abbonati|abbonamento|sei già abbonato|contenuto riservato|articolo riservato|acquista|pagamento|accedi per continuare|login per continuare)/i;
      const consentPattern = /(?:cookie|consent|privacy|personal data|tracking|partners|legitimate interest|manage preferences|accept all|reject all|consenso|dati personali|tracciamento|partner|interesse legittimo|gestisci preferenze|accetta tutto|rifiuta tutto)/i;
      const antiAdblockPattern = /(?:ad[ -]?block(?:er)?|disable (?:your )?ad[ -]?block|turn off (?:your )?ad[ -]?block|whitelist (?:us|this site)|disabilita (?:il |l['’])?ad[ -]?block|rimuovi (?:il |l['’])?ad[ -]?block)/i;

      function textFor(el) {
        return [
          el.id || '',
          typeof el.className === 'string' ? el.className : '',
          el.getAttribute?.('aria-label') || '',
          String(el.innerText || el.textContent || '').slice(0, 1800)
        ].join(' ');
      }

      function isPaywall(el) {
        if (!el) return false;
        if (paywallPattern.test(textFor(el))) return true;
        return !!el.closest?.('[class*="paywall" i], [id*="paywall" i], [class*="premium" i], [data-paywall], [data-testid*="paywall" i]');
      }

      function isVisible(el) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      }

      function hasOverlayGeometry(el) {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const positioned = style.position === 'fixed' || style.position === 'absolute' || style.position === 'sticky';
        const large = rect.width >= innerWidth * 0.32 && rect.height >= Math.min(140, innerHeight * 0.18);
        const edgeBanner = rect.width >= innerWidth * 0.55 && (
          rect.top <= 12 || rect.bottom >= innerHeight - 12
        );
        return positioned && (large || edgeBanner);
      }

      function isCmpOrAntiAdblock(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE || isPaywall(el)) return false;
        if (el.matches(knownCmpSelector)) return true;
        if (!hasOverlayGeometry(el)) return false;
        const text = textFor(el);
        return consentPattern.test(text) || antiAdblockPattern.test(text);
      }

      function hideOverlay(el) {
        if (!isVisible(el) || !isCmpOrAntiAdblock(el)) return false;
        el.setAttribute('data-zap-hidden-overlay', 'true');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        state.hiddenCount += 1;
        return true;
      }

      function hasVisibleBlockingLayer() {
        const paywalls = document.querySelectorAll(protectedPaywallSelector);
        for (let index = 0; index < Math.min(paywalls.length, 50); index += 1) {
          if (isVisible(paywalls[index])) return true;
        }

        const nodes = document.querySelectorAll(candidateSelector);
        for (let index = 0; index < Math.min(nodes.length, 100); index += 1) {
          const el = nodes[index];
          if (el.hasAttribute('data-zap-hidden-overlay') || !isVisible(el)) continue;
          if (isPaywall(el) || hasOverlayGeometry(el)) return true;
        }
        return false;
      }

      function restoreScrollIfSafe() {
        if (!state.hiddenCount || !document.body || hasVisibleBlockingLayer()) return;
        if (document.documentElement.scrollHeight <= innerHeight + 32) return;

        for (const el of [document.documentElement, document.body]) {
          const computed = getComputedStyle(el);
          if (computed.overflow === 'hidden' || computed.overflow === 'clip') {
            el.style.setProperty('overflow', 'auto', 'important');
            el.setAttribute('data-zap-scroll-restored', 'true');
          }
        }

        if (getComputedStyle(document.body).pointerEvents === 'none') {
          document.body.style.setProperty('pointer-events', 'auto', 'important');
        }
      }

      function inspect(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
        hideOverlay(root);

        const matches = root.querySelectorAll?.(candidateSelector) || [];
        for (let index = 0; index < Math.min(matches.length, 80); index += 1) {
          hideOverlay(matches[index]);
        }
      }

      function flush() {
        state.timer = 0;
        const roots = Array.from(state.pending).slice(0, 80);
        state.pending.clear();
        roots.forEach(inspect);
        requestAnimationFrame(restoreScrollIfSafe);
      }

      function schedule(root) {
        if (root?.nodeType === Node.ELEMENT_NODE) state.pending.add(root);
        clearTimeout(state.timer);
        state.timer = setTimeout(flush, 80);
      }

      const style = document.createElement('style');
      style.id = '__zap_overlay_protection_style';
      style.textContent = '[data-zap-hidden-overlay="true"]{display:none!important;visibility:hidden!important;pointer-events:none!important}';
      document.documentElement.appendChild(style);

      inspect(document.documentElement);
      document.querySelectorAll('body > div, body > aside, body > section').forEach(inspect);
      requestAnimationFrame(restoreScrollIfSafe);

      const observer = new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) schedule(node);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      state.observer = observer;

      window.addEventListener('load', () => schedule(document.body), { once: true });
      setTimeout(() => schedule(document.body), 400);
      setTimeout(() => schedule(document.body), 1200);
      setTimeout(() => schedule(document.body), 3000);
    })();
  `
}

function shouldEnableOverlayProtection(privacy = {}) {
  return Number(privacy.adblock) === 1 && Number(privacy.overlay_block) === 1
}

module.exports = {
  CMP_SELECTORS,
  CANDIDATE_SELECTORS,
  getOverlayProtectionScript,
  shouldEnableOverlayProtection,
}

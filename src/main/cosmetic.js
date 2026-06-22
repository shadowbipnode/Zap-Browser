'use strict'

function getCosmeticScript() {
  return `
    (() => {
      if (window.__zapCosmeticEngineLoaded) return;
      window.__zapCosmeticEngineLoaded = true;

      function zapInjectCSS() {
        if (document.getElementById('__zap_cosmetic_engine')) return;

        const style = document.createElement('style');
        style.id = '__zap_cosmetic_engine';
        style.textContent = [
          '[id^="div-gpt-ad"], [id*="div-gpt-ad"], [id*="google_ads_iframe"], [id*="google_ads"], [id*="gpt-ad"], [id*="adunit"], [class*="adunit"], .ads-contrib, .ads-container, .ads-manchette, .masthead-top, .ad_column, .pct-banner, .adunit, .adsbygoogle, ins.adsbygoogle, [data-ad-slot], [data-ad-client], [data-google-query-id] { display:none !important; visibility:hidden !important; height:0 !important; min-height:0 !important; max-height:0 !important; overflow:hidden !important; }',
          'iframe[src*="googlesyndication"], iframe[src*="doubleclick"], iframe[src*="googleads"], iframe[src*="adservice"], iframe[src*="/ads/"], iframe[src*="prebid"] { display:none !important; visibility:hidden !important; height:0 !important; max-height:0 !important; overflow:hidden !important; }',
          '[id*="PN-SKIN"], [id*="PN-INTRO"], [id*="PN-TOP"], [id*="PN-BANNER"], [id*="PN-MPU"], [id*="skin-ad"], [class*="skin-ad"], [id*="ad-skin"], [class*="ad-skin"], #banner-overlay-mobile-fixed, .simple_overlay_header { display:none !important; visibility:hidden !important; height:0 !important; max-height:0 !important; overflow:hidden !important; }'
        ].join('\\n');

        document.documentElement.appendChild(style);
      }

      function zapLooksLikePaywall(el) {
        const text = String(el.innerText || '').toLowerCase();
        const html = String(el.outerHTML || '').toLowerCase();
        return /tinypass|piano|tp-backdrop|tp-active|paywall|subscription|subscribe|abbonati|abbonamento|login|accedi/.test(html + ' ' + text);
      }

      function zapHide(el) {
        if (!el || el === document.body || el === document.documentElement) return;
        if (zapLooksLikePaywall(el)) return;

        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('max-height', '0px', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
      }

      function zapMatchesWithin(root, selector) {
        const matches = [];
        if (root?.nodeType === Node.ELEMENT_NODE && root.matches(selector)) matches.push(root);
        if (root?.querySelectorAll) matches.push(...root.querySelectorAll(selector));
        return matches;
      }

      function zapCleanAdNodes(root) {
        zapMatchesWithin(root,
          '[id^="div-gpt-ad"], [id*="div-gpt-ad"], [id*="google_ads_iframe"], .ads-contrib, .ads-container, .ads-manchette, .masthead-top, .ad_column, .pct-banner, .adunit, .adsbygoogle, ins.adsbygoogle, [data-ad-slot], [data-ad-client], [data-google-query-id], #banner-overlay-mobile-fixed, .simple_overlay_header'
        ).forEach(el => {
          const wrap = el.closest('.ads-contrib, .ads-container, .ads-manchette, .masthead-top, .ad_column, .pct-banner, .adunit, [id^="div-gpt-ad"], [id*="div-gpt-ad"], .simple_overlay_header') || el;
          zapHide(wrap);
        });
      }

      function zapCleanIntroOverlays(root) {
        zapMatchesWithin(root,
          '#divPubblicita, [id*="Pubblicita"], [id*="pubblicita"], #banner-overlay-mobile-fixed, #div-gpt-ad-PN-INTRO-01, [id*="PN-INTRO"], .simple_overlay_header'
        ).forEach(el => {
          zapHide(el);
        });

      }

      function zapCleanBackgroundSkins(root) {
        if (root === document && document.body) {
          const bodyBg = getComputedStyle(document.body).backgroundImage || '';
          if (/googlesyndication|doubleclick|googleads|adservice|simgad/i.test(bodyBg)) {
            document.body.style.setProperty('background-image', 'none', 'important');
            document.body.style.setProperty('background', '#fff', 'important');
          }
        }

        zapMatchesWithin(root, '[class*="skin" i], [id*="skin" i], [class*="wallpaper" i], [id*="wallpaper" i], [class*="background" i], [id*="background" i], [class*="masthead" i], [id*="masthead" i]').forEach(el => {
          if (zapLooksLikePaywall(el)) return;

          const st = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const bg = st.backgroundImage || '';

          if (!bg || bg === 'none') return;
          if (r.width < 120 || r.height < 120) return;

          const isSideSkin =
            r.height >= innerHeight * 0.45 &&
            r.width >= 120 &&
            (r.left <= 120 || r.right >= innerWidth - 120);

          const isTopSkin =
            r.width >= innerWidth * 0.45 &&
            r.height >= 90 &&
            r.top <= 280;

          const idClass = String((el.id || '') + ' ' + (el.className || '')).toLowerCase();
          const looksAd =
            /ad|adv|ads|banner|skin|sponsor|promo|campaign|pubblic|gpt|google_ads/i.test(idClass) ||
            /doubleclick|googlesyndication|googleads|adservice|banner|promo|campaign|simgad/i.test(bg);

          if ((isSideSkin || isTopSkin) && looksAd) {
            zapHide(el);
          }
        });
      }

      function zapRunCosmeticCleanup(root = document) {
        zapInjectCSS();
        zapCleanAdNodes(root);
        zapCleanIntroOverlays(root);
        zapCleanBackgroundSkins(root);
      }

      zapRunCosmeticCleanup();
      setTimeout(zapRunCosmeticCleanup, 250);
      setTimeout(zapRunCosmeticCleanup, 1000);
      setTimeout(zapRunCosmeticCleanup, 3000);

      if (!window.__zapCosmeticObserver) {
        window.__zapCosmeticPending = new Set();
        window.__zapCosmeticObserver = new MutationObserver(records => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) window.__zapCosmeticPending.add(node);
            }
          }
          clearTimeout(window.__zapCosmeticTimer);
          window.__zapCosmeticTimer = setTimeout(() => {
            const roots = Array.from(window.__zapCosmeticPending).slice(0, 60);
            window.__zapCosmeticPending.clear();
            roots.forEach(zapRunCosmeticCleanup);
          }, 120);
        });

        window.__zapCosmeticObserver.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }
    })();
  `
}

module.exports = { getCosmeticScript }

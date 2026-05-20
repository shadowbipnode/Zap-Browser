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

      function zapClickSkipIntro() {
        document.querySelectorAll('a, button').forEach(el => {
          const txt = String(el.innerText || el.textContent || '').toLowerCase();
          const href = String(el.getAttribute?.('href') || '').toLowerCase();

          if (
            txt.includes('salta intro') ||
            txt.includes('entra nel sito') ||
            txt.includes('skip intro') ||
            href.includes('noadv') ||
            href.includes('skip')
          ) {
            try { el.click(); } catch (_) {}
          }
        });
      }

      function zapCleanAdNodes() {
        document.querySelectorAll(
          '[id^="div-gpt-ad"], [id*="div-gpt-ad"], [id*="google_ads_iframe"], .ads-contrib, .ads-container, .ads-manchette, .masthead-top, .ad_column, .pct-banner, .adunit, .adsbygoogle, ins.adsbygoogle, [data-ad-slot], [data-ad-client], [data-google-query-id], #banner-overlay-mobile-fixed, .simple_overlay_header'
        ).forEach(el => {
          const wrap = el.closest('.ads-contrib, .ads-container, .ads-manchette, .masthead-top, .ad_column, .pct-banner, .adunit, [id^="div-gpt-ad"], [id*="div-gpt-ad"], .simple_overlay_header') || el;
          zapHide(wrap);
        });
      }

      function zapCleanIntroOverlays() {
        document.querySelectorAll(
          '#divPubblicita, [id*="Pubblicita"], [id*="pubblicita"], #banner-overlay-mobile-fixed, #div-gpt-ad-PN-INTRO-01, [id*="PN-INTRO"], [id*="INTRO"], .simple_overlay_header'
        ).forEach(el => {
          zapHide(el);
        });

        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }

      function zapCleanBackgroundSkins() {
        const bodyBg = getComputedStyle(document.body).backgroundImage || '';
        if (/googlesyndication|doubleclick|googleads|adservice|simgad/i.test(bodyBg)) {
          document.body.style.setProperty('background-image', 'none', 'important');
          document.body.style.setProperty('background', '#fff', 'important');
        }

        document.querySelectorAll('body *').forEach(el => {
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

      function zapRunCosmeticCleanup() {
        zapInjectCSS();
        zapClickSkipIntro();
        zapCleanAdNodes();
        zapCleanIntroOverlays();
        zapCleanBackgroundSkins();
      }

      zapRunCosmeticCleanup();
      setTimeout(zapRunCosmeticCleanup, 100);
      setTimeout(zapRunCosmeticCleanup, 250);
      setTimeout(zapRunCosmeticCleanup, 750);
      setTimeout(zapRunCosmeticCleanup, 1500);
      setTimeout(zapRunCosmeticCleanup, 3000);

      if (!window.__zapCosmeticObserver) {
        window.__zapCosmeticObserver = new MutationObserver(() => {
          clearTimeout(window.__zapCosmeticTimer);
          window.__zapCosmeticTimer = setTimeout(zapRunCosmeticCleanup, 120);
        });

        window.__zapCosmeticObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'id']
        });
      }
    })();
  `
}

module.exports = { getCosmeticScript }

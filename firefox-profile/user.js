// firefox-profile/user.js
// Zap Browser — Privacy Hardening
// Derivato da Tor Browser + Arkenfox user.js
// https://github.com/arkenfox/user.js

// ── Fingerprinting ────────────────────────────────────────────────────────────
user_pref("privacy.resistFingerprinting",                           true);
user_pref("privacy.resistFingerprinting.block_mozAddonManager",    true);
user_pref("privacy.fingerprintingProtection",                       true);
user_pref("webgl.enable-debug-renderer-info",                      false);
user_pref("canvas.poisondata",                                      true);
user_pref("browser.display.use_document_fonts",                     0);

// ── WebRTC ────────────────────────────────────────────────────────────────────
user_pref("media.peerconnection.enabled",                           false);
user_pref("media.peerconnection.ice.default_address_only",         true);
user_pref("media.peerconnection.ice.no_host",                      true);
user_pref("media.peerconnection.ice.proxy_only_if_behind_proxy",   true);

// ── DNS ───────────────────────────────────────────────────────────────────────
user_pref("network.trr.mode",                                       3);   // DoH mandatory
user_pref("network.trr.uri",             "https://cloudflare-dns.com/dns-query");
user_pref("network.trr.bootstrapAddress",                          "1.1.1.1");
user_pref("network.dns.disablePrefetch",                            true);
user_pref("network.prefetch-next",                                  false);

// ── Tracking ──────────────────────────────────────────────────────────────────
user_pref("network.cookie.cookieBehavior",                          5);   // dFPI
user_pref("network.http.referer.XOriginPolicy",                    2);
user_pref("network.http.referer.XOriginTrimmingPolicy",            2);
user_pref("privacy.partition.network_state",                        true);

// ── Telemetry ─────────────────────────────────────────────────────────────────
user_pref("toolkit.telemetry.enabled",                              false);
user_pref("toolkit.telemetry.unified",                              false);
user_pref("toolkit.telemetry.server",                               "");
user_pref("datareporting.healthreport.uploadEnabled",               false);
user_pref("datareporting.policy.dataSubmissionEnabled",             false);
user_pref("browser.ping-centre.telemetry",                         false);
user_pref("app.shield.optoutstudies.enabled",                      false);
user_pref("browser.discovery.enabled",                              false);

// ── Safe Browsing (disabilita chiamate Google) ────────────────────────────────
user_pref("browser.safebrowsing.malware.enabled",                  false);
user_pref("browser.safebrowsing.phishing.enabled",                 false);
user_pref("browser.safebrowsing.provider.google4.gethashURL",      "");
user_pref("browser.safebrowsing.provider.google4.updateURL",       "");

// ── Ricerca ───────────────────────────────────────────────────────────────────
user_pref("browser.search.suggest.enabled",                         false);
user_pref("browser.urlbar.suggest.searches",                        false);
user_pref("browser.urlbar.speculativeConnect.enabled",              false);

// ── HTTPS ─────────────────────────────────────────────────────────────────────
user_pref("dom.security.https_only_mode",                           true);
user_pref("dom.security.https_only_mode_ever_enabled",              true);

// ── Storage / Cache ───────────────────────────────────────────────────────────
user_pref("browser.cache.disk.enable",                              false);
user_pref("browser.sessionstore.max_tabs_undo",                     0);
user_pref("places.history.enabled",                                 false);

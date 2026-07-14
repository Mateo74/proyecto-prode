/**
 * open-external.js
 *
 * Instagram/Facebook open links inside their own in-app WebView. That WebView
 * cannot follow Android App Links (so it never hands off to the native app),
 * and it offers a degraded experience (no Google login, no push, etc.).
 *
 * This helper detects those in-app browsers and shows a small banner that lets
 * the user re-open the current page:
 *   - Android: via an `intent://` URL that opens the native app if installed,
 *     and otherwise falls back to the device's default browser (usually Chrome).
 *   - iOS: with an instruction to use the in-app browser's "⋯" menu, since there
 *     is no reliable way to escape Instagram's WebView programmatically on iOS.
 *
 * Self-contained: injects its own styles and markup, no dependencies.
 */
(function () {
  var ANDROID_PACKAGE = "com.oncemetros.mobile";
  var ua = navigator.userAgent || "";

  // Instagram UA contains "Instagram". Facebook in-app browser contains
  // "FBAN"/"FBAV"/"FB_IAB". Only act inside these embedded browsers.
  var isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB/i.test(ua);
  if (!isInAppBrowser) return;

  // Never show it inside our own native WebView wrapper.
  if (window.__ONCE_METROS_NATIVE_WEBVIEW__) return;

  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua);

  var lang = (function () {
    try {
      var stored = localStorage.getItem("once_metros_lang");
      if (stored) return stored.slice(0, 2);
    } catch (e) { /* ignore */ }
    return (document.documentElement.lang || "es").slice(0, 2);
  })();
  var EN = lang === "en";

  var T = EN
    ? {
        msg: "For the best experience, open this in the app or your browser.",
        open: "Open",
        iosHint: 'Tap the "⋯" menu at the top right and choose "Open in external browser".',
        dismiss: "Dismiss",
      }
    : {
        msg: "Para una mejor experiencia, abrí esto en la app o en tu navegador.",
        open: "Abrir",
        iosHint: 'Tocá el menú "⋯" arriba a la derecha y elegí "Abrir en el navegador externo".',
        dismiss: "Cerrar",
      };

  function currentUrl() {
    return window.location.href;
  }

  // Builds an Android `intent://` URL that targets our app package and falls
  // back to the default browser (Chrome) if the app isn't installed or can't
  // handle the URL.
  function androidIntentUrl(httpsUrl) {
    var a = document.createElement("a");
    a.href = httpsUrl;
    var hostPath = a.host + a.pathname + a.search;
    var fallback = encodeURIComponent(httpsUrl);
    return (
      "intent://" + hostPath +
      "#Intent;scheme=https;package=" + ANDROID_PACKAGE +
      ";S.browser_fallback_url=" + fallback + ";end"
    );
  }

  function injectStyles() {
    if (document.getElementById("open-external-styles")) return;
    var css =
      ".oe-banner{position:fixed;left:0;right:0;top:0;z-index:2147483647;" +
      "background:#0a0a0f;color:#fff;border-bottom:1px solid rgba(255,255,255,0.12);" +
      "font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,0.35)}" +
      ".oe-inner{max-width:640px;margin:0 auto;display:flex;align-items:center;" +
      "gap:.75rem;padding:.7rem .9rem}" +
      ".oe-text{flex:1;min-width:0;font-size:.82rem;line-height:1.25}" +
      ".oe-btn{flex-shrink:0;background:#00c853;color:#03210f;border:0;border-radius:8px;" +
      "font:inherit;font-size:.82rem;font-weight:800;padding:.5rem .85rem;cursor:pointer}" +
      ".oe-close{flex-shrink:0;background:transparent;border:0;color:rgba(255,255,255,0.65);" +
      "font-size:1.15rem;line-height:1;cursor:pointer;padding:.25rem}" +
      ".oe-hint{display:block;margin-top:.35rem;font-size:.76rem;color:rgba(255,255,255,0.7)}";
    var style = document.createElement("style");
    style.id = "open-external-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildBanner() {
    var banner = document.createElement("div");
    banner.className = "oe-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Once Metros");

    var inner = document.createElement("div");
    inner.className = "oe-inner";

    var text = document.createElement("div");
    text.className = "oe-text";
    text.textContent = T.msg;

    var btn = document.createElement("button");
    btn.className = "oe-btn";
    btn.type = "button";
    btn.textContent = T.open;

    var close = document.createElement("button");
    close.className = "oe-close";
    close.type = "button";
    close.setAttribute("aria-label", T.dismiss);
    close.textContent = "\u00d7";

    inner.appendChild(text);
    inner.appendChild(btn);
    inner.appendChild(close);
    banner.appendChild(inner);

    close.addEventListener("click", function () {
      banner.remove();
    });

    btn.addEventListener("click", function () {
      if (isAndroid) {
        window.location.href = androidIntentUrl(currentUrl());
      } else if (isIOS) {
        // No reliable programmatic escape from Instagram's WebView on iOS —
        // show the manual instruction instead.
        if (!text.querySelector(".oe-hint")) {
          var hint = document.createElement("span");
          hint.className = "oe-hint";
          hint.textContent = T.iosHint;
          text.appendChild(hint);
        }
      } else {
        window.open(currentUrl(), "_blank");
      }
    });

    return banner;
  }

  // Attempts to jump to the native app automatically (Android only), once per
  // session. If the app isn't installed or the WebView blocks the handoff, the
  // browser stays on the page and the banner remains as a manual fallback.
  function tryAutoOpen() {
    if (!isAndroid) return;
    var KEY = "oe_auto_attempted";
    try {
      // If we already tried this session, don't loop (the fallback URL reloads
      // this same page when the app can't handle the intent).
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch (e) {
      // No sessionStorage (private mode) — skip auto-attempt to avoid a loop.
      return;
    }
    window.location.href = androidIntentUrl(currentUrl());
  }

  function mount() {
    tryAutoOpen();
    injectStyles();
    var banner = buildBanner();
    document.body.appendChild(banner);
    // Nudge page content down so the fixed banner doesn't cover the header.
    document.body.style.paddingTop =
      (banner.offsetHeight || 56) + "px";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();

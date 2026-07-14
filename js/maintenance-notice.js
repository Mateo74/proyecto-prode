/**
 * maintenance-notice.js
 *
 * TEMPORARY outage notice. Shows an apologetic "technical difficulties" popup
 * that works even when the backend/database is down (pure static frontend, no
 * dependencies, no API calls).
 *
 * Language: uses the stored preference if present, else the device language,
 * and shows the other language underneath so everyone understands.
 *
 * TO REMOVE once the service is restored: delete the two <script> includes
 * (index.html and pages/auth.html) — you can also delete this file.
 */
(function () {
  function detectLang() {
    try {
      var stored = localStorage.getItem("once_metros_lang");
      if (stored) return stored.slice(0, 2) === "en" ? "en" : "es";
    } catch (e) { /* ignore */ }
    var nav = (navigator.language || navigator.userLanguage || "es").toLowerCase();
    return nav.indexOf("en") === 0 ? "en" : "es";
  }

  var COPY = {
    es: {
      title: "Estamos con problemas técnicos",
      body: "Estamos trabajando para restablecer el servicio lo antes posible. Pedimos disculpas por las molestias.",
      close: "Entendido",
    },
    en: {
      title: "We're experiencing technical difficulties",
      body: "We're working to restore the service as soon as possible. We apologize for the inconvenience.",
      close: "Got it",
    },
  };

  function injectStyles() {
    if (document.getElementById("maintenance-notice-styles")) return;
    var css =
      ".mn-backdrop{position:fixed;inset:0;z-index:2147483647;background:rgba(4,5,10,0.72);" +
      "backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:1.25rem}" +
      ".mn-card{max-width:420px;width:100%;background:#12131a;color:#fff;border:1px solid rgba(255,255,255,0.12);" +
      "border-radius:16px;padding:1.6rem 1.4rem;box-shadow:0 24px 60px rgba(0,0,0,0.5);text-align:center;" +
      "font-family:inherit}" +
      ".mn-icon{font-size:2.2rem;line-height:1;margin-bottom:.6rem}" +
      ".mn-title{font-size:1.12rem;font-weight:800;margin:0 0 .5rem}" +
      ".mn-body{font-size:.9rem;line-height:1.4;color:rgba(255,255,255,0.85);margin:0}" +
      ".mn-alt{margin-top:.85rem;padding-top:.85rem;border-top:1px solid rgba(255,255,255,0.1)}" +
      ".mn-alt .mn-title{font-size:.98rem;color:rgba(255,255,255,0.9)}" +
      ".mn-alt .mn-body{font-size:.82rem;color:rgba(255,255,255,0.65)}" +
      ".mn-btn{margin-top:1.15rem;background:#00c853;color:#03210f;border:0;border-radius:10px;" +
      "font:inherit;font-size:.9rem;font-weight:800;padding:.65rem 1.4rem;cursor:pointer}";
    var style = document.createElement("style");
    style.id = "maintenance-notice-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function block(copy, isAlt) {
    var wrap = document.createElement("div");
    if (isAlt) wrap.className = "mn-alt";
    var title = document.createElement(isAlt ? "p" : "h2");
    title.className = "mn-title";
    title.textContent = copy.title;
    var body = document.createElement("p");
    body.className = "mn-body";
    body.textContent = copy.body;
    wrap.appendChild(title);
    wrap.appendChild(body);
    return wrap;
  }

  function mount() {
    if (document.getElementById("maintenance-notice")) return;
    injectStyles();

    var primaryLang = detectLang();
    var secondaryLang = primaryLang === "es" ? "en" : "es";

    var backdrop = document.createElement("div");
    backdrop.className = "mn-backdrop";
    backdrop.id = "maintenance-notice";
    backdrop.setAttribute("role", "alertdialog");
    backdrop.setAttribute("aria-modal", "true");

    var card = document.createElement("div");
    card.className = "mn-card";

    var icon = document.createElement("div");
    icon.className = "mn-icon";
    icon.textContent = "\uD83D\uDD27"; // 🔧
    card.appendChild(icon);

    card.appendChild(block(COPY[primaryLang], false));
    card.appendChild(block(COPY[secondaryLang], true));

    var btn = document.createElement("button");
    btn.className = "mn-btn";
    btn.type = "button";
    btn.textContent = COPY[primaryLang].close;
    btn.addEventListener("click", function () { backdrop.remove(); });
    card.appendChild(btn);

    backdrop.appendChild(card);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) backdrop.remove();
    });

    document.body.appendChild(backdrop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();

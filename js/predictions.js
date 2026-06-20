/**
 * predictions.js
 * Renderizado de tarjetas de partido según estado:
 *   - proximo:    spinners de marcador + botón guardar
 *   - en-vivo:    marcador actual con minuto (solo lectura)
 *   - finalizado: resultado final + feedback de predicción
 */

const Predictions = (() => {

  // matchId -> { equipo1: number, equipo2: number, saved: boolean }
  const state = new Map();

  // ─── SVG paths del escudo ─────────────────────────────────────────
  const SHIELD   = 'M3,2 H33 L33,26 Q33,37 18,39 Q3,37 3,26 Z';
  const SHIELD_R = 'M18,2 H33 L33,26 Q33,37 18,39 Z'; // mitad derecha (para stripe)

  /**
   * Genera un escudo SVG para el equipo dado.
   * Usa TEAM_COLORS si está disponible; si no, genera un color
   * determinista a partir del nombre.
   */
  function teamCrest(teamName, crestUrl) {
    if (crestUrl) {
      return `<img class="team__badge team__badge-img" src="${crestUrl}" alt="" loading="lazy">`;
    }

    const data = (typeof TEAM_COLORS !== 'undefined') && TEAM_COLORS[teamName];

    if (!data) {
      // Color determinista + iniciales cuando no hay escudo configurado.
      const hue  = nameToHue(teamName);
      const abbr = abbrev(teamName);
      return svgShield(`hsl(${hue},52%,28%)`, null, abbr);
    }

    return svgShield(data.bg, data.stripe || null, data.abbr);
  }

  /**
   * Construye el HTML del escudo SVG.
   */
  function svgShield(bg, stripe, abbr) {
    // Luminancia del fondo (solo válida para hex)
    let fg = '#fff';
    let fgStroke = 'rgba(0,0,0,0.35)';
    if (bg.startsWith('#') && bg.length === 7) {
      const r = parseInt(bg.slice(1,3), 16);
      const g = parseInt(bg.slice(3,5), 16);
      const b = parseInt(bg.slice(5,7), 16);
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
      if (lum > 0.58) { fg = '#1a1a1a'; fgStroke = 'rgba(255,255,255,0.35)'; }
    }
    // Con stripe siempre blanco (mezcla de colores)
    if (stripe) { fg = '#fff'; fgStroke = 'rgba(0,0,0,0.4)'; }

    const stripeEl = stripe
      ? `<path d="${SHIELD_R}" fill="${stripe}" opacity="0.88"/>`
      : '';

    return (
      `<svg class="team__badge" viewBox="0 0 36 41" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<path d="${SHIELD}" fill="${bg}"/>` +
      stripeEl +
      `<path d="${SHIELD}" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>` +
      `<text x="18" y="20" text-anchor="middle" dominant-baseline="central"` +
      ` fill="${fg}" stroke="${fgStroke}" stroke-width="0.7" paint-order="stroke"` +
      ` font-size="8.5" font-weight="900"` +
      ` font-family="Inter,system-ui,sans-serif" letter-spacing="-0.3">${abbr}</text>` +
      `</svg>`
    );
  }

  /** Hash del nombre → tono HSL (0–359) */
  function nameToHue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 360;
  }

  /** Iniciales del equipo (máx 3 chars) */
  function abbrev(name) {
    return name.split(' ')
      .filter(w => w.length > 1)
      .map(w => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || name.slice(0, 3).toUpperCase();
  }

  // ─── Dispatcher principal ─────────────────────────────────────────
  function equipo1De(match) {
    if (typeof localizeTeamName === 'function') return localizeTeamName(match.equipo1Id, match.equipo1 ?? match.equipoLocal);
    if (typeof I18n !== 'undefined' && I18n.getLang() === 'en' && match.equipo1NombreEn) return match.equipo1NombreEn;
    return match.equipo1 ?? match.equipoLocal;
  }
  function equipo2De(match) {
    if (typeof localizeTeamName === 'function') return localizeTeamName(match.equipo2Id, match.equipo2 ?? match.equipoVisitante);
    if (typeof I18n !== 'undefined' && I18n.getLang() === 'en' && match.equipo2NombreEn) return match.equipo2NombreEn;
    return match.equipo2 ?? match.equipoVisitante;
  }
  function ligaDe(match) {
    if (typeof I18n !== 'undefined' && I18n.getLang() === 'en' && match.ligaEn) return match.ligaEn;
    return match.liga ?? '';
  }
  function score1De(match) { return match.scoreEquipo1 ?? match.scoreLocal; }
  function score2De(match) { return match.scoreEquipo2 ?? match.scoreVisitante; }
  function predScore1De(pred) { return pred.scoreEquipo1 ?? pred.scoreLocal; }
  function predScore2De(pred) { return pred.scoreEquipo2 ?? pred.scoreVisitante; }
  function scoreLabel(value) { return value == null ? '-' : value; }
  function minuteLabel(match) {
    if (match.estado === 'finalizado') return t('match.final');
    if (match.estado === 'en-vivo') {
      const m = match.minutoActual;
      const phase = Number(match.relojFase ?? 0);
      if (!m) return t('match.live');

      // Paused states are explicit in the backend clock FSM.
      if (phase === 2) return t('match.halfTimeShort');
      if (phase === 4) return t('match.end90Short');
      if (phase === 6) return t('match.extraHalfTimeShort');
      if (phase === 8) return t('match.final'); // penalty shootout / ended extra-time window

      // Running states: show stoppage-time by segment without fixed 3/5 minute assumptions.
      if (phase === 1 && m > 45) return `45+${m - 45}'`;
      if (phase === 3 && m > 90) return `90+${m - 90}'`;
      if (phase === 5 && m > 105) return `105+${m - 105}'`;
      if (phase === 7 && m > 120) return `120+${m - 120}'`;

      return `${m}'`;
    }
    if (match.estado === 'suspendido') return t('badge.suspended');
    if (match.estado === 'cancelado') return t('badge.cancelled');
    return '';
  }

  function competitionName(match) {
    if (
      typeof I18n !== 'undefined' &&
      I18n.getLang() === 'en' &&
      (match.competencia?.slug === 'copa-mundial-fifa' || match.liga === 'Copa Mundial FIFA')
    ) {
      return 'FIFA World Cup';
    }
    return ligaDe(match);
  }

  function groupLabel(match) {
    if (typeof groupLetterForMatch !== 'function') return '';
    const letter = groupLetterForMatch(match);
    return letter ? t('groups.title', { letter }) : '';
  }

  function metaBadges(match, statusHtml = '') {
    const group = groupLabel(match);
    return `
        <span class="badge badge-league">${competitionName(match)}</span>
        ${group ? `<span class="badge badge-group">${group}</span>` : ''}
        ${statusHtml}`;
  }

  function createMatchCard(match) {
    if (match.estado === 'en-vivo')    return createLiveCard(match);
    if (match.estado === 'finalizado') return createFinishedCard(match);
    if (match.estado === 'suspendido' || match.estado === 'cancelado') return createStatusCard(match);
    return createUpcomingCard(match);
  }

  // ─── PARTIDO PRÓXIMO ──────────────────────────────────────────────
  function createUpcomingCard(match) {
    const card = document.createElement('div');
    card.classList.add('match-card');
    card.dataset.matchId = match.id;
    const initialEquipo1 = match.userPred?.scoreEquipo1 ?? null;
    const initialEquipo2 = match.userPred?.scoreEquipo2 ?? null;
    const hasSavedPrediction = Boolean(match.userPred);
    const editable = match.prediccionEditable !== false;
    if (hasSavedPrediction) card.classList.add('pred-saved');
    if (!editable) card.classList.add('is-locked');

    const fecha = new Date(match.fecha).toLocaleString(t('locale'), {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });

    card.innerHTML = `
      <div class="match-card__meta">
        ${metaBadges(match, `<span class="badge badge-soon">${t('badge.upcoming')}</span>`)}
        <span class="match-card__time">${fecha}</span>
      </div>

      <div class="match-card__body">
        <div class="team">
          ${teamCrest(equipo1De(match), match.equipo1EscudoUrl)}
          <div class="team__name">${equipo1De(match)}</div>
        </div>

        <div class="score-input">
          <input class="score-box${hasSavedPrediction ? ' has-value' : ''}"
                 type="text" inputmode="numeric" enterkeyhint="next"
                 value="${hasSavedPrediction ? initialEquipo1 : ''}"
                 placeholder="-" data-side="equipo1"
                 ${editable ? '' : 'disabled'}
                 autocomplete="off" spellcheck="false">
          <div class="score-sep">:</div>
          <input class="score-box${hasSavedPrediction ? ' has-value' : ''}"
                 type="text" inputmode="numeric" enterkeyhint="done"
                 value="${hasSavedPrediction ? initialEquipo2 : ''}"
                 placeholder="-" data-side="equipo2"
                 ${editable ? '' : 'disabled'}
                 autocomplete="off" spellcheck="false">
        </div>

        <div class="team">
          ${teamCrest(equipo2De(match), match.equipo2EscudoUrl)}
          <div class="team__name">${equipo2De(match)}</div>
        </div>
      </div>
    `;

    state.set(match.id, { equipo1: initialEquipo1, equipo2: initialEquipo2, saved: hasSavedPrediction });

    if (!editable) return card;

    card.querySelectorAll('.score-box').forEach(input => {
      const side = input.dataset.side;

      input.addEventListener('focus', () => {
        // Select all so the existing value is visible but will be overwritten on type
        input.select();
      });

      input.addEventListener('blur', () => {
        // If the user left without typing, restore the saved value
        const s = state.get(match.id);
        if (s[side] !== null) {
          input.value = s[side];
          input.classList.add('has-value');
        }
      });

      // Block non-digit keys on desktop keyboards; Enter advances to next input
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          advanceFocus(input);
          return;
        }
        if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        if (/^[0-9]$/.test(e.key)) return;
        e.preventDefault();
      });

      // Primary handler — fires reliably on both desktop and mobile virtual keyboards
      input.addEventListener('input', () => {
        const digit = input.value.replace(/\D/g, '').slice(-1);
        input.value = digit;
        const num = digit === '' ? null : parseInt(digit, 10);
        state.get(match.id)[side] = num;
        input.classList.toggle('has-value', num !== null);
        if (num !== null) {
          advanceFocus(input);
          tryAutoSave(card, match.id);
        } else {
          card.classList.remove('pred-saved', 'just-saved');
        }
      });
    });

    return card;
  }

  /** Move focus to the next editable score-box in DOM order. */
  function advanceFocus(current) {
    const all = Array.from(document.querySelectorAll('.score-box:not([disabled])'));
    const idx = all.indexOf(current);
    if (idx >= 0 && idx < all.length - 1) {
      const next = all[idx + 1];
      next.focus();
      next.select();
    }
  }

  /** Save automatically once both scores for a match are filled. */
  async function tryAutoSave(card, matchId) {
    const s = state.get(matchId);
    if (s.equipo1 === null || s.equipo2 === null) return;
    await onSave(card, matchId);
  }

  // ─── PARTIDO EN VIVO ──────────────────────────────────────────────
  function createLiveCard(match) {
    const card = document.createElement('div');
    card.classList.add('match-card', 'is-live');
    card.dataset.matchId = match.id;

    card.innerHTML = `
      <div class="match-card__meta">
        ${metaBadges(match, `<span class="badge badge-live">${t('badge.live')}</span>`)}
      </div>

      <div class="match-card__body">
        <div class="team">
          ${teamCrest(equipo1De(match), match.equipo1EscudoUrl)}
          <div class="team__name">${equipo1De(match)}</div>
        </div>

        <div class="match-score">
          <div class="match-score__nums">
            <span class="match-score__num">${scoreLabel(score1De(match))}</span>
            <span class="match-score__sep">:</span>
            <span class="match-score__num">${scoreLabel(score2De(match))}</span>
          </div>
          <span class="match-score__minute">${minuteLabel(match)}</span>
        </div>

        <div class="team">
          ${teamCrest(equipo2De(match), match.equipo2EscudoUrl)}
          <div class="team__name">${equipo2De(match)}</div>
        </div>
      </div>

      ${predictionSummary(match)}
    `;

    return card;
  }

  // ─── PARTIDO FINALIZADO ───────────────────────────────────────────
  function createFinishedCard(match) {
    const card = document.createElement('div');
    card.classList.add('match-card', 'is-done');
    card.dataset.matchId = match.id;

    const fecha = new Date(match.fecha).toLocaleString(t('locale'), {
      weekday: 'short', day: 'numeric', month: 'short',
    });

    const pred = match.userPred;
    let feedbackHtml = '';

    if (pred) {
      const isExact    = pred.exacto === true ||
        (predScore1De(pred) === score1De(match) && predScore2De(pred) === score2De(match));
      const pending = match.resultadoConfirmado === false || pred.estado === 'pendiente';

      const ptsCls = pending            ? 'pending'
                   : pred.puntos === 0  ? '0'
                   : pred.puntos === 1  ? '1'
                   : pred.puntos === 2  ? '2'
                   : pred.puntos === 3  ? '3'
                   :                     '4plus';
      const ptsLabel = pending           ? t('pred.pending')
                     : pred.puntos === 0 ? `+0 ${t('stat.pts')}`
                     :                    `+${pred.puntos} ${t('stat.pts')}`;

      feedbackHtml = `
        <div class="match-feedback">
          <span class="match-feedback__pred">
            <strong class="match-feedback__pred-score">${predScore1De(pred)}–${predScore2De(pred)}</strong>
            <span class="match-feedback__pred-label">${t('pred.label')}</span>
          </span>
          <span class="pts-badge pts-badge--${ptsCls}">${ptsLabel}</span>
        </div>
      `;

      if (isExact) card.classList.add('is-exact');
      else if (pred.estado === 'acierto') card.classList.add('is-hit');
      else card.classList.add('is-miss');
    }

    card.innerHTML = `
      <div class="match-card__meta">
        ${metaBadges(match, `<span class="badge badge-done">${t('badge.finished')}</span>`)}
        <span class="match-card__time">${fecha}</span>
      </div>

      <div class="match-card__body">
        <div class="team">
          ${teamCrest(equipo1De(match), match.equipo1EscudoUrl)}
          <div class="team__name">${equipo1De(match)}</div>
        </div>

        <div class="match-score">
          <div class="match-score__nums">
            <span class="match-score__num">${scoreLabel(score1De(match))}</span>
            <span class="match-score__sep">–</span>
            <span class="match-score__num">${scoreLabel(score2De(match))}</span>
          </div>
          <span class="match-score__minute">${minuteLabel(match)}</span>
        </div>

        <div class="team">
          ${teamCrest(equipo2De(match), match.equipo2EscudoUrl)}
          <div class="team__name">${equipo2De(match)}</div>
        </div>
      </div>

      ${feedbackHtml}
    `;

    return card;
  }

  function createStatusCard(match) {
    const card = document.createElement('div');
    card.classList.add('match-card', match.estado === 'cancelado' ? 'is-cancelled' : 'is-suspended');
    card.dataset.matchId = match.id;
    const label = match.estado === 'cancelado' ? t('badge.cancelled') : t('badge.suspended');

    card.innerHTML = `
      <div class="match-card__meta">
        ${metaBadges(match, `<span class="badge badge-stopped">${label}</span>`)}
      </div>

      <div class="match-card__body">
        <div class="team">
          ${teamCrest(equipo1De(match), match.equipo1EscudoUrl)}
          <div class="team__name">${equipo1De(match)}</div>
        </div>
        <div class="match-score">
          <span class="match-score__minute">${label}</span>
        </div>
        <div class="team">
          ${teamCrest(equipo2De(match), match.equipo2EscudoUrl)}
          <div class="team__name">${equipo2De(match)}</div>
        </div>
      </div>
      ${predictionSummary(match)}
    `;

    return card;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  function predictionSummary(match) {
    if (!match.userPred) return '';
    const pred = match.userPred;
    return `
      <div class="match-feedback pending">
        <span class="match-feedback__pred">
          <strong class="match-feedback__pred-score">${predScore1De(pred)}–${predScore2De(pred)}</strong>
          <span class="match-feedback__pred-label">${t('pred.label')}</span>
        </span>
      </div>
    `;
  }

  async function onSave(card, matchId) {
    const s = state.get(matchId);

    if (!API.getToken()) {
      window.location.href = `${authPathPrefix()}auth.html`;
      return;
    }

    const prediccion = s.equipo1 > s.equipo2 ? 'equipo1'
                     : s.equipo1 < s.equipo2 ? 'equipo2'
                     : 'empate';

    try {
      await API.savePrediction({ matchId, scoreEquipo1: s.equipo1, scoreEquipo2: s.equipo2, prediccion });
    } catch (err) {
      console.warn('No se pudo guardar la predicción:', err.message);
      card.classList.add('save-error');
      setTimeout(() => card.classList.remove('save-error'), 2500);
      return;
    }

    s.saved = true;
    card.classList.remove('save-error');
    card.classList.add('pred-saved', 'just-saved');
    setTimeout(() => card.classList.remove('just-saved'), 500);
  }

  function authPathPrefix() {
    return window.location.pathname.includes('/pages/') ? '' : 'pages/';
  }

  /**
   * Devuelve los marcadores actuales en memoria para un partido (incluye
   * ediciones del usuario aún sin guardar). Es la fuente de verdad viva de la
   * página: cada tecla actualiza este estado. Devuelve null si la tarjeta del
   * partido no se renderizó (p. ej. partidos finalizados sin input editable).
   */
  function getCurrentScores(matchId) {
    const s = state.get(matchId);
    if (!s) return null;
    return { equipo1: s.equipo1, equipo2: s.equipo2 };
  }

  /**
   * Calcula puntos de una predicción.
   * Resultado correcto: 1 · diferencia correcta: 2 · exacto: max(3, goles totales)
   */
  function calcularPuntos({ scoreEquipo1Pred, scoreEquipo2Pred, scoreEquipo1Real, scoreEquipo2Real }) {
    const predRes = scoreEquipo1Pred > scoreEquipo2Pred ? 'equipo1'
                  : scoreEquipo1Pred < scoreEquipo2Pred ? 'equipo2' : 'empate';
    const realRes = scoreEquipo1Real > scoreEquipo2Real ? 'equipo1'
                  : scoreEquipo1Real < scoreEquipo2Real ? 'equipo2' : 'empate';
    if (predRes !== realRes) return 0;

    const exacto = scoreEquipo1Pred === scoreEquipo1Real && scoreEquipo2Pred === scoreEquipo2Real;
    if (exacto) return Math.max(3, scoreEquipo1Real + scoreEquipo2Real);

    const diffPred = scoreEquipo1Pred - scoreEquipo2Pred;
    const diffReal = scoreEquipo1Real - scoreEquipo2Real;
    return diffPred === diffReal ? 2 : 1;
  }

  return { createMatchCard, calcularPuntos, teamCrest, getCurrentScores };
})();

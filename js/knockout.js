/**
 * knockout.js
 * Llaves eliminatorias de la Copa Mundial 2026 (Dieciseisavos → Final).
 *
 * Modelo (acordado con el usuario):
 *  - Los cruces de Dieciseisavos (R32) se arman con RESULTADOS REALES de los
 *    grupos: 1º/2º de cada grupo + los 8 mejores terceros. Un cruce solo se
 *    puede predecir cuando ambos equipos quedaron determinados de verdad (los
 *    partidos del grupo terminaron y el equipo clasificó).
 *  - Rondas siguientes: los participantes salen del GANADOR PREDICHO de la ronda
 *    anterior; un cruce se desbloquea cuando ambos alimentadores tienen ganador.
 *  - La predicción es por marcador (como en grupos). Si el usuario predice empate
 *    debe elegir quién avanza por penales.
 *  - Como el backend no tiene partidos de eliminatorias, las predicciones se
 *    guardan en localStorage.
 *
 * Estructura oficial (FIFA, partidos 73–104) y conjuntos de grupos permitidos
 * por slot de tercero según el Anexo C del reglamento.
 */
const KO = (() => {
  const STAGES = ['group', 'r32', 'r16', 'qf', 'sf', 'final'];

  // Slot helpers:
  //   { pos: '1', group: 'E' }            → ganador de grupo E
  //   { pos: '2', group: 'A' }            → segundo de grupo A
  //   { pos: '3', groups: [...] }         → mejor tercero (slot = id del partido)
  //   { win: 'm73' }                      → ganador (predicho) del partido m73
  const BRACKET = {
    r32: [
      { id: 'm73', n: 73, a: { pos: '2', group: 'A' }, b: { pos: '2', group: 'B' } },
      { id: 'm74', n: 74, a: { pos: '1', group: 'E' }, b: { pos: '3', groups: ['A', 'B', 'C', 'D', 'F'] } },
      { id: 'm75', n: 75, a: { pos: '1', group: 'F' }, b: { pos: '2', group: 'C' } },
      { id: 'm76', n: 76, a: { pos: '1', group: 'C' }, b: { pos: '2', group: 'F' } },
      { id: 'm77', n: 77, a: { pos: '1', group: 'I' }, b: { pos: '3', groups: ['C', 'D', 'F', 'G', 'H'] } },
      { id: 'm78', n: 78, a: { pos: '2', group: 'E' }, b: { pos: '2', group: 'I' } },
      { id: 'm79', n: 79, a: { pos: '1', group: 'A' }, b: { pos: '3', groups: ['C', 'E', 'F', 'H', 'I'] } },
      { id: 'm80', n: 80, a: { pos: '1', group: 'L' }, b: { pos: '3', groups: ['E', 'H', 'I', 'J', 'K'] } },
      { id: 'm81', n: 81, a: { pos: '1', group: 'D' }, b: { pos: '3', groups: ['B', 'E', 'F', 'I', 'J'] } },
      { id: 'm82', n: 82, a: { pos: '1', group: 'G' }, b: { pos: '3', groups: ['A', 'E', 'H', 'I', 'J'] } },
      { id: 'm83', n: 83, a: { pos: '2', group: 'K' }, b: { pos: '2', group: 'L' } },
      { id: 'm84', n: 84, a: { pos: '1', group: 'H' }, b: { pos: '2', group: 'J' } },
      { id: 'm85', n: 85, a: { pos: '1', group: 'B' }, b: { pos: '3', groups: ['E', 'F', 'G', 'I', 'J'] } },
      { id: 'm86', n: 86, a: { pos: '1', group: 'J' }, b: { pos: '2', group: 'H' } },
      { id: 'm87', n: 87, a: { pos: '1', group: 'K' }, b: { pos: '3', groups: ['D', 'E', 'I', 'J', 'L'] } },
      { id: 'm88', n: 88, a: { pos: '2', group: 'D' }, b: { pos: '2', group: 'G' } },
    ],
    r16: [
      { id: 'm89', n: 89, a: { win: 'm73' }, b: { win: 'm75' } },
      { id: 'm90', n: 90, a: { win: 'm74' }, b: { win: 'm77' } },
      { id: 'm91', n: 91, a: { win: 'm76' }, b: { win: 'm78' } },
      { id: 'm92', n: 92, a: { win: 'm79' }, b: { win: 'm80' } },
      { id: 'm93', n: 93, a: { win: 'm83' }, b: { win: 'm84' } },
      { id: 'm94', n: 94, a: { win: 'm81' }, b: { win: 'm82' } },
      { id: 'm95', n: 95, a: { win: 'm86' }, b: { win: 'm88' } },
      { id: 'm96', n: 96, a: { win: 'm85' }, b: { win: 'm87' } },
    ],
    qf: [
      { id: 'm97', n: 97, a: { win: 'm89' }, b: { win: 'm90' } },
      { id: 'm98', n: 98, a: { win: 'm93' }, b: { win: 'm94' } },
      { id: 'm99', n: 99, a: { win: 'm91' }, b: { win: 'm92' } },
      { id: 'm100', n: 100, a: { win: 'm95' }, b: { win: 'm96' } },
    ],
    sf: [
      { id: 'm101', n: 101, a: { win: 'm97' }, b: { win: 'm98' } },
      { id: 'm102', n: 102, a: { win: 'm99' }, b: { win: 'm100' } },
    ],
    final: [
      { id: 'm104', n: 104, a: { win: 'm101' }, b: { win: 'm102' } },
    ],
  };

  // Slots de tercero (Anexo C): grupos permitidos por cada cruce.
  const THIRD_SLOTS = [
    ['m74', ['A', 'B', 'C', 'D', 'F']],
    ['m77', ['C', 'D', 'F', 'G', 'H']],
    ['m79', ['C', 'E', 'F', 'H', 'I']],
    ['m80', ['E', 'H', 'I', 'J', 'K']],
    ['m81', ['B', 'E', 'F', 'I', 'J']],
    ['m82', ['A', 'E', 'H', 'I', 'J']],
    ['m85', ['E', 'F', 'G', 'I', 'J']],
    ['m87', ['D', 'E', 'I', 'J', 'L']],
  ];

  const matchById = {};
  for (const stage of ['r32', 'r16', 'qf', 'sf', 'final']) {
    for (const m of BRACKET[stage]) matchById[m.id] = m;
  }

  let _competenciaId = null;
  function setCompetencia(id) { _competenciaId = id; }
  function storageKey() { return `once_metros_ko_${_competenciaId || 'wc'}`; }
  function loadPreds() {
    try { return JSON.parse(localStorage.getItem(storageKey())) || {}; }
    catch { return {}; }
  }
  function savePreds(preds) {
    try { localStorage.setItem(storageKey(), JSON.stringify(preds)); } catch { /* ignore */ }
  }

  // ─── Tabla real de grupos (solo partidos finalizados) ─────────────
  function cmpRows(a, b) {
    if ((b.pts ?? 0) !== (a.pts ?? 0)) return (b.pts ?? 0) - (a.pts ?? 0);
    const gdA = (a.gf ?? 0) - (a.gc ?? 0);
    const gdB = (b.gf ?? 0) - (b.gc ?? 0);
    if (gdB !== gdA) return gdB - gdA;
    return (b.gf ?? 0) - (a.gf ?? 0);
  }

  function computeContext(allMatches = [], groupsDef = WORLD_CUP_2026_GROUPS) {
    const teams = typeof WORLD_CUP_2026_TEAMS !== 'undefined' ? WORLD_CUP_2026_TEAMS : {};
    const teamToGroup = {};
    const stats = {};
    const finishedCount = {};
    const crest = {};
    for (const [letter, ids] of Object.entries(groupsDef)) {
      stats[letter] = {};
      finishedCount[letter] = 0;
      for (const id of ids) {
        teamToGroup[id] = letter;
        stats[letter][id] = { id, name: teams[id]?.nombre || id, pj: 0, gf: 0, gc: 0, pts: 0 };
      }
    }

    for (const m of allMatches) {
      const id1 = teamIdFromMatch(m, 1);
      const id2 = teamIdFromMatch(m, 2);
      if (id1 && m.equipo1EscudoUrl && !crest[id1]) crest[id1] = m.equipo1EscudoUrl;
      if (id2 && m.equipo2EscudoUrl && !crest[id2]) crest[id2] = m.equipo2EscudoUrl;
      const letter = teamToGroup[id1];
      if (!letter || letter !== teamToGroup[id2]) continue;
      if (m.estado !== 'finalizado') continue;
      const s1 = Number(m.scoreEquipo1 ?? m.scoreLocal);
      const s2 = Number(m.scoreEquipo2 ?? m.scoreVisitante);
      if (!Number.isFinite(s1) || !Number.isFinite(s2)) continue;
      const r1 = stats[letter][id1];
      const r2 = stats[letter][id2];
      if (!r1 || !r2) continue;
      finishedCount[letter]++;
      r1.pj++; r2.pj++;
      r1.gf += s1; r1.gc += s2;
      r2.gf += s2; r2.gc += s1;
      if (s1 > s2) r1.pts += 3;
      else if (s2 > s1) r2.pts += 3;
      else { r1.pts++; r2.pts++; }
    }

    const standings = {};
    for (const [letter, ids] of Object.entries(groupsDef)) {
      const rows = ids.map(id => ({ ...stats[letter][id], crest: crest[id] || null }));
      rows.sort(cmpRows);
      const decided = finishedCount[letter] >= 6;
      standings[letter] = { rows, first: rows[0], second: rows[1], third: rows[2], decided };
    }

    // Asignación de terceros: requiere TODOS los grupos definidos para rankear
    // los 12 terceros y quedarte con los 8 mejores.
    const allDecided = Object.values(standings).every(g => g.decided);
    let allocation = null;
    if (allDecided) {
      const thirds = Object.entries(standings)
        .map(([letter, g]) => ({ letter, row: g.third }))
        .sort((a, b) => cmpRows(a.row, b.row));
      const qualified = thirds.slice(0, 8).map(t => t.letter);
      allocation = allocateThirds(qualified);
    }

    return { standings, allocation, allDecided };
  }

  /**
   * Asigna cada slot de tercero a un grupo clasificado respetando los conjuntos
   * permitidos del Anexo C (emparejamiento perfecto por backtracking, orden
   * determinista). Devuelve { matchId: 'C', ... } o null si no hay asignación.
   */
  function allocateThirds(qualifiedGroups) {
    const qset = new Set(qualifiedGroups);
    const used = new Set();
    const result = {};
    const solve = (i) => {
      if (i === THIRD_SLOTS.length) return true;
      const [slot, allowed] = THIRD_SLOTS[i];
      for (const g of allowed) {
        if (qset.has(g) && !used.has(g)) {
          used.add(g); result[slot] = g;
          if (solve(i + 1)) return true;
          used.delete(g); delete result[slot];
        }
      }
      return false;
    };
    return solve(0) ? result : null;
  }

  // ─── Resolución de slots a equipos concretos ──────────────────────
  function resolveSlot(slot, matchId, ctx, preds, memo) {
    if (slot.win) return winnerTeam(slot.win, ctx, preds, memo);
    const g = ctx.standings[slot.group];
    if (slot.pos === '1') return g && g.decided ? g.first : null;
    if (slot.pos === '2') return g && g.decided ? g.second : null;
    if (slot.pos === '3') {
      if (!ctx.allocation) return null;
      const group = ctx.allocation[matchId];
      return group ? ctx.standings[group].third : null;
    }
    return null;
  }

  function resolveMatch(matchId, ctx, preds, memo) {
    if (memo[matchId]) return memo[matchId];
    const m = matchById[matchId];
    const out = { a: null, b: null };
    memo[matchId] = out; // evita reentradas (la llave es un DAG)
    out.a = resolveSlot(m.a, matchId, ctx, preds, memo);
    out.b = resolveSlot(m.b, matchId, ctx, preds, memo);
    return out;
  }

  /** Lado ganador ('a'|'b'|null) según la predicción por marcador.
   * Un empate en eliminatorias no determina ganador (la ronda siguiente
   * queda bloqueada hasta que se conozca el resultado real). */
  function winnerSide(pred) {
    if (!pred || pred.s1 == null || pred.s2 == null) return null;
    const s1 = Number(pred.s1);
    const s2 = Number(pred.s2);
    if (s1 > s2) return 'a';
    if (s2 > s1) return 'b';
    return null; // empate → ganador indeterminado
  }

  function winnerTeam(matchId, ctx, preds, memo) {
    const { a, b } = resolveMatch(matchId, ctx, preds, memo);
    if (!a || !b) return null;
    const side = winnerSide(preds[matchId]);
    if (!side) return null;
    return side === 'a' ? a : b;
  }

  // ─── Etiquetas de slot cuando el equipo aún no está definido ──────
  function slotLabel(slot) {
    if (slot.win) {
      const src = matchById[slot.win];
      return `${t('ko.winnerShort')}${src ? src.n : ''}`;
    }
    if (slot.pos === '3') return `${t('ko.thirdShort')} ${slot.groups.join('/')}`;
    return `${slot.pos}${slot.group}`;
  }

  function stageLabel(stage) { return t(`ko.stage.${stage}`); }
  function isGroupStage(stage) { return stage === 'group'; }

  // ─── Render ───────────────────────────────────────────────────────
  function teamSlotHtml(team, slot) {
    if (team) {
      const display = localizeTeamName(team.id, team.name);
      return `
        <div class="ko-team" data-team-id="${team.id}">
          <span class="ko-team__crest">${Predictions.teamCrest(display, team.crest)}</span>
          <span class="ko-team__name">${escapeHtml(display)}</span>
        </div>`;
    }
    return `
        <div class="ko-team ko-team--tbd">
          <span class="ko-team__name">${escapeHtml(slotLabel(slot))}</span>
        </div>`;
  }

  function renderStage(stage, allMatches) {
    const wrap = document.createElement('div');
    wrap.className = 'ko-bracket';
    if (!BRACKET[stage]) return wrap;

    const ctx = computeContext(allMatches);
    const preds = loadPreds();
    const memo = {};

    for (const m of BRACKET[stage]) {
      const { a, b } = resolveMatch(m.id, ctx, preds, memo);
      const unlocked = Boolean(a && b);
      wrap.appendChild(buildKoCard(m, a, b, unlocked, preds));
    }
    return wrap;
  }

  function buildKoCard(m, teamA, teamB, unlocked, preds) {
    const card = document.createElement('div');
    card.className = 'ko-match' + (unlocked ? '' : ' is-locked');
    card.dataset.koId = m.id;

    const pred = preds[m.id] || {};
    const v1 = unlocked && pred.s1 != null ? pred.s1 : '';
    const v2 = unlocked && pred.s2 != null ? pred.s2 : '';

    const scoreHtml = unlocked
      ? `<div class="ko-score">
           <input class="ko-score__box" type="text" inputmode="numeric" maxlength="2" data-side="a" value="${v1}" placeholder="-" autocomplete="off">
           <span class="ko-score__sep">:</span>
           <input class="ko-score__box" type="text" inputmode="numeric" maxlength="2" data-side="b" value="${v2}" placeholder="-" autocomplete="off">
         </div>`
      : `<div class="ko-score ko-score--locked" title="${t('ko.locked')}">🔒</div>`;

    card.innerHTML = `
      <div class="ko-match__meta">${t('ko.matchLabel', { n: m.n })}</div>
      <div class="ko-match__body">
        ${teamSlotHtml(teamA, m.a)}
        ${scoreHtml}
        ${teamSlotHtml(teamB, m.b)}
      </div>`;

    if (unlocked) wireKoCard(card, m, teamA, teamB);
    updateKoCard(card, m, pred);
    return card;
  }

  function wireKoCard(card, m, teamA, teamB) {
    const boxes = card.querySelectorAll('.ko-score__box');
    boxes.forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 2);
        commitKoCard(card, m);
      });
    });
  }

  function commitKoCard(card, m) {
    const a = card.querySelector('.ko-score__box[data-side="a"]').value;
    const b = card.querySelector('.ko-score__box[data-side="b"]').value;
    const preds = loadPreds();
    const pred = preds[m.id] || {};
    pred.s1 = a === '' ? null : parseInt(a, 10);
    pred.s2 = b === '' ? null : parseInt(b, 10);
    preds[m.id] = pred;
    savePreds(preds);
    updateKoCard(card, m, pred);
    document.dispatchEvent(new CustomEvent('knockout:change', { detail: { matchId: m.id } }));
  }

  /** Resalta al ganador según la predicción por marcador. */
  function updateKoCard(card, m, pred) {
    const teams = card.querySelectorAll('.ko-team');
    teams.forEach(el => el.classList.remove('is-winner'));
    const side = winnerSide(pred);
    if (side === 'a' && teams[0]) teams[0].classList.add('is-winner');
    if (side === 'b' && teams[1]) teams[1].classList.add('is-winner');
  }

  return {
    STAGES,
    BRACKET,
    THIRD_SLOTS,
    stageLabel,
    isGroupStage,
    setCompetencia,
    renderStage,
    computeContext,
    allocateThirds,
  };
})();

/**
 * knockout.js
 * Llave eliminatoria de la Copa Mundial 2026 (Dieciseisavos → Final + 3er puesto).
 *
 * Modelo (acordado con el equipo):
 *  - Los cruces REALES (con ambos equipos definidos) los provee el backend como
 *    Partidos con `etapa`. Esos son los únicos PREDECIBLES.
 *  - El resto de la llave se completa en el cliente con cruces BLOQUEADOS: son
 *    solo visuales y NUNCA permiten apostar, aunque podamos resolver uno o ambos
 *    equipos a partir de resultados reales (posiciones de grupo en R32, o el
 *    ganador real de la ronda anterior). Nunca fabricamos un partido predecible.
 *
 * Estructura oficial FIFA (partidos 73–104) y conjuntos de grupos permitidos por
 * slot de tercero según el Anexo C del reglamento.
 */
const KO = (() => {
  // Etapa cruda del proveedor (Partido.etapa) → clave de ronda interna.
  const ETAPA_TO_STAGE = {
    GROUP_STAGE: 'group',
    LAST_32: 'r32',
    LAST_16: 'r16',
    QUARTER_FINALS: 'qf',
    SEMI_FINALS: 'sf',
    THIRD_PLACE: 'third',
    FINAL: 'final',
  };

  // Slot helpers:
  //   { pos: '1', group: 'E' }    → ganador de grupo E
  //   { pos: '2', group: 'A' }    → segundo de grupo A
  //   { pos: '3', groups: [...] } → mejor tercero (el slot define los grupos válidos)
  //   { win: 'm73' }              → ganador REAL del partido m73
  //   { lose: 'm101' }            → perdedor REAL del partido m101 (3er puesto)
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
    third: [
      { id: 'm103', n: 103, a: { lose: 'm101' }, b: { lose: 'm102' } },
    ],
    final: [
      { id: 'm104', n: 104, a: { win: 'm101' }, b: { win: 'm102' } },
    ],
  };

  const STAGES = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];
  const KNOCKOUT_STAGES = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

  const matchById = {};
  for (const stage of KNOCKOUT_STAGES) {
    for (const m of BRACKET[stage]) matchById[m.id] = m;
  }

  let _competenciaId = null;
  function setCompetencia(id) { _competenciaId = id; }

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
        stats[letter][id] = { id, name: teams[id]?.nombre || id, gf: 0, gc: 0, pts: 0 };
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

  /** Empareja cada slot de tercero con un grupo clasificado (Anexo C). */
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

  // ─── Resolución de equipos por resultados REALES ──────────────────
  /** Equipo (fila) de un seed de grupo, o null si el grupo no está decidido. */
  function resolveSeed(side, ctx, slotId) {
    const g = ctx.standings[side.group];
    if (side.pos === '1') return g && g.decided ? g.first : null;
    if (side.pos === '2') return g && g.decided ? g.second : null;
    if (side.pos === '3') {
      if (!ctx.allocation) return null;
      const group = ctx.allocation[slotId];
      return group ? ctx.standings[group].third : null;
    }
    return null;
  }

  function canonicalIds(match) {
    return [teamIdFromMatch(match, 1), teamIdFromMatch(match, 2)];
  }

  /** Construye una fila {id,name,crest} desde un lado de un Partido del backend. */
  function rowFromMatch(match, side) {
    const id = teamIdFromMatch(match, side);
    if (!id) return null;
    const name = side === 1 ? (match.equipo1 ?? match.equipoLocal) : (match.equipo2 ?? match.equipoVisitante);
    const crest = side === 1 ? match.equipo1EscudoUrl : match.equipo2EscudoUrl;
    return { id, name: name || id, crest: crest || null };
  }

  /** Lado ganador real (1|2|null) de un Partido finalizado (sin penales). */
  function winningSide(match) {
    if (!match || match.estado !== 'finalizado') return null;
    const s1 = Number(match.scoreEquipo1 ?? match.scoreLocal);
    const s2 = Number(match.scoreEquipo2 ?? match.scoreVisitante);
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 === s2) return null;
    return s1 > s2 ? 1 : 2;
  }

  function samePair(match, idA, idB) {
    const [m1, m2] = canonicalIds(match);
    return (m1 === idA && m2 === idB) || (m1 === idB && m2 === idA);
  }

  /**
   * Resuelve TODA la llave a partir de los Partidos reales del backend.
   * Devuelve { [slotId]: { slot, a, b, be, winner, loser } } donde a/b son filas
   * resueltas (o null), `be` el Partido real del cruce (predecible) si existe, y
   * winner/loser las filas del resultado real (para alimentar rondas siguientes).
   */
  function resolveAll(allMatches = []) {
    const ctx = computeContext(allMatches);
    const beByStage = {};
    for (const m of allMatches) {
      const stage = ETAPA_TO_STAGE[m.etapa];
      if (stage && stage !== 'group') (beByStage[stage] ||= []).push(m);
    }

    const map = {};
    const used = new Set();

    const resolveSide = (side, slotId) => {
      if (side.win) return map[side.win]?.winner || null;
      if (side.lose) return map[side.lose]?.loser || null;
      return resolveSeed(side, ctx, slotId);
    };

    for (const stage of KNOCKOUT_STAGES) {
      const slots = BRACKET[stage];
      const beList = beByStage[stage] || [];

      for (const slot of slots) {
        const a = resolveSide(slot.a, slot.id);
        const b = resolveSide(slot.b, slot.id);
        let be = null;
        if (a && b) {
          be = beList.find(m => !used.has(m.id) && samePair(m, a.id, b.id)) || null;
          if (be) used.add(be.id);
        }
        map[slot.id] = { slot, a, b, be };
      }

      // Partidos reales de esta ronda que no calzaron por equipos (p. ej. grupos
      // aún no resueltos en nuestra tabla): ubícalos en los slots libres.
      const freeSlots = slots.filter(s => !map[s.id].be);
      const leftover = beList.filter(m => !used.has(m.id));
      for (const m of leftover) {
        const slot = freeSlots.shift();
        if (!slot) break;
        used.add(m.id);
        map[slot.id].be = m;
      }

      // Ganador/perdedor real para alimentar las rondas siguientes.
      for (const slot of slots) {
        const entry = map[slot.id];
        const ws = winningSide(entry.be);
        entry.winner = ws ? rowFromMatch(entry.be, ws) : null;
        entry.loser = ws ? rowFromMatch(entry.be, ws === 1 ? 2 : 1) : null;
      }
    }

    return map;
  }

  // ─── Etiquetas de slot cuando el equipo aún no está definido ──────
  function slotLabel(side) {
    if (side.win) return `${t('ko.winnerShort')}${matchById[side.win]?.n ?? ''}`;
    if (side.lose) return `${t('ko.loserShort')}${matchById[side.lose]?.n ?? ''}`;
    if (side.pos === '3') return `${t('ko.thirdShort')} ${side.groups.join('/')}`;
    return `${side.pos}${side.group}`;
  }

  /** Tarjeta sintética BLOQUEADA (no predecible) para un cruce sin partido real. */
  function lockedDescriptor(entry) {
    return {
      id: `ko-${entry.slot.id}`,
      locked: true,
      koMatchNumber: entry.slot.n,
      equipo1Id: entry.a?.id ?? null,
      equipo1: entry.a?.name ?? null,
      equipo1EscudoUrl: entry.a?.crest ?? null,
      equipo1SlotLabel: entry.a ? null : slotLabel(entry.slot.a),
      equipo2Id: entry.b?.id ?? null,
      equipo2: entry.b?.name ?? null,
      equipo2EscudoUrl: entry.b?.crest ?? null,
      equipo2SlotLabel: entry.b ? null : slotLabel(entry.slot.b),
    };
  }

  /**
   * Descriptores de tarjeta de una ronda, en orden de llave. Cada uno es:
   *   { type: 'be', match }       → cruce real del backend (predecible)
   *   { type: 'locked', locked }  → cruce fabricado y bloqueado (solo visual)
   */
  function buildStageCards(stage, allMatches = []) {
    if (!BRACKET[stage]) return [];
    const map = resolveAll(allMatches);
    return BRACKET[stage].map(slot => {
      const entry = map[slot.id];
      return entry.be
        ? { type: 'be', match: entry.be }
        : { type: 'locked', locked: lockedDescriptor(entry) };
    });
  }

  function stageLabel(stage) { return t(`ko.stage.${stage}`); }
  function isGroupStage(stage) { return stage === 'group'; }

  return {
    STAGES,
    KNOCKOUT_STAGES,
    BRACKET,
    THIRD_SLOTS,
    ETAPA_TO_STAGE,
    setCompetencia,
    computeContext,
    allocateThirds,
    resolveAll,
    buildStageCards,
    stageLabel,
    isGroupStage,
  };
})();

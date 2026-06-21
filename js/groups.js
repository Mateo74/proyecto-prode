/**
 * groups.js
 * Renderizado y cálculo de tablas de grupos predichos.
 *
 * Este archivo usa IDs reales de Equipo para cruzar con el backend, y usa
 * WORLD_CUP_2026_TEAMS solo para renderizar nombres localizados.
 */

/**
 * Renderiza las tablas de grupos ordenadas por puntos predichos.
 *
 * @param {Object.<string, Array.<Array>>} groups
 *   Diccionario { "A": [ [teamId, teamName, games played, goals scored, goals conceded, predicted points, crestUrl?], ...4 filas ], ... }.
 * @returns {string} HTML de un grid adaptativo de group-tables.
 */
function renderGroupsGrid(groups) {
  const letters = Object.keys(groups || {}).sort();
  if (!letters.length) return emptyState(t('groups.empty'));

  const cards = letters
    .map(letter => `<div class="groups-grid__cell">${renderGroupTable(letter, groups[letter])}</div>`)
    .join('');

  return `<div class="groups-grid">${cards}</div>`;
}

/**
 * Renderiza la tabla de un grupo ordenada por puntos predichos (desc).
 * Desempate: diferencia de gol y luego goles a favor.
 *
 * @param {boolean} [opts.showTitle=true] Incluye la fila de título "Grupo X".
 *   Se desactiva cuando el carrusel ya actúa como encabezado del grupo.
 */
function renderGroupTable(letter, teams = [], { showTitle = true } = {}) {
  const sorted = [...teams].sort((a, b) => {
    const byPoints = (b[5] ?? 0) - (a[5] ?? 0);
    if (byPoints !== 0) return byPoints;
    const diffA = (a[3] ?? 0) - (a[4] ?? 0);
    const diffB = (b[3] ?? 0) - (b[4] ?? 0);
    if (diffB !== diffA) return diffB - diffA;
    return (b[3] ?? 0) - (a[3] ?? 0);
  });

  const body = sorted.map(([_teamId, nombre, jugados, golesFavor, golesContra, puntos, crestUrl]) => {
    const completo = Number(jugados ?? 0) >= 3;
    const display = localizeTeamName(_teamId, nombre);
    return `
        <tr class="${completo ? 'is-complete' : ''}">
          <td class="group-table__team">
            <span class="group-table__crest">${Predictions.teamCrest(display, crestUrl)}</span>
            <span class="group-table__name">${escapeHtml(display)}</span>
          </td>
          <td>${Number(jugados ?? 0)}</td>
          <td>${Number(golesFavor ?? 0)}</td>
          <td>${Number(golesContra ?? 0)}</td>
          <td class="group-table__pts">${Number(puntos ?? 0)}</td>
        </tr>`;
  }).join('');

  const titleRow = showTitle
    ? `<tr><th colspan="5" class="group-table__title">${t('groups.title', { letter })}</th></tr>`
    : '';

  return `
      <table class="group-table">
        <thead>
          ${titleRow}
          <tr>
            <th class="group-table__team">${t('groups.team')}</th>
            <th title="${t('groups.playedTitle')}">${t('groups.played')}</th>
            <th title="${t('groups.gfTitle')}">${t('groups.gf')}</th>
            <th title="${t('groups.gcTitle')}">${t('groups.gc')}</th>
            <th title="${t('groups.pointsTitle')}">${t('groups.points')}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
}

/** Normaliza un nombre de equipo para comparaciones (sin acentos, minúsculas). */
function normalizeTeamName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Devuelve el nombre del equipo para mostrar según el idioma activo.
 * El backend y WORLD_CUP_2026_GROUPS usan el nombre canónico en español;
 * cuando el idioma es 'en' se traduce solo para mostrar.
 */
function localizeTeamName(teamId, fallbackName = '') {
  const team = typeof WORLD_CUP_2026_TEAMS !== 'undefined' ? WORLD_CUP_2026_TEAMS[teamId] : null;
  if (typeof I18n === 'undefined' || I18n.getLang() !== 'en') return team?.nombre || fallbackName;
  return team?.nombreEn || fallbackName;
}

function teamToGroupFromDefinition(groupsDef = {}) {
  const out = {};
  for (const [letter, teams] of Object.entries(groupsDef)) {
    for (const teamId of teams) out[teamId] = letter;
  }
  return out;
}

/**
 * Índice normalizado nombre -> teamId canónico, construido una sola vez desde
 * WORLD_CUP_2026_TEAMS. Incluye alias para fuentes de datos cuyos nombres
 * difieren del mapa canónico (p. ej. el seed local: "Catar"/"Qatar",
 * "RD Congo"/"Congo RD", "República Checa"/"Chequia", etc.).
 */
let _nameToCanonicalIdIndex = null;
function nameToCanonicalIdIndex() {
  if (_nameToCanonicalIdIndex) return _nameToCanonicalIdIndex;
  const idx = {};
  const teams = typeof WORLD_CUP_2026_TEAMS !== 'undefined' ? WORLD_CUP_2026_TEAMS : {};
  for (const [teamId, team] of Object.entries(teams)) {
    idx[normalizeTeamName(team.nombre)] = teamId;
    if (team.nombreEn) idx[normalizeTeamName(team.nombreEn)] = teamId;
  }
  const aliases = {
    'arabia saudi': 'Arabia Saudita',
    'bosnia y herzegovina': 'Bosnia-H.',
    'catar': 'Qatar',
    'curazao': 'Curaçao',
    'estados unidos': 'EE. UU.',
    'rd congo': 'Congo RD',
    'republica checa': 'Chequia',
  };
  for (const [variant, canonical] of Object.entries(aliases)) {
    const teamId = idx[normalizeTeamName(canonical)];
    if (teamId) idx[normalizeTeamName(variant)] = teamId;
  }
  return (_nameToCanonicalIdIndex = idx);
}

/** Resuelve el teamId canónico a partir del nombre (ES o EN). Devuelve null si no se reconoce. */
function canonicalTeamIdByName(name, nameEn) {
  const idx = nameToCanonicalIdIndex();
  return idx[normalizeTeamName(name)] || idx[normalizeTeamName(nameEn)] || null;
}

/**
 * Devuelve el teamId canónico de un lado del partido.
 *
 * Producción: los partidos ya traen el id real del Mundial -> se usa tal cual.
 * Local / otras fuentes: el id puede no ser un id conocido del Mundial (el seed
 * genera cuids propios), así que se cae a resolver por nombre normalizado para
 * que tanto el agrupado como la tabla de posiciones funcionen igual.
 */
function teamIdFromMatch(match, side) {
  const id = side === 1 ? match.equipo1Id : match.equipo2Id;
  const teams = typeof WORLD_CUP_2026_TEAMS !== 'undefined' ? WORLD_CUP_2026_TEAMS : {};
  if (id && teams[id]) return id; // id real del Mundial: ruta de producción

  const name = side === 1 ? match.equipo1 : match.equipo2;
  const nameEn = side === 1 ? match.equipo1NombreEn : match.equipo2NombreEn;
  return canonicalTeamIdByName(name, nameEn) || id || null;
}

function groupLetterForMatch(match, groupsDef = WORLD_CUP_2026_GROUPS) {
  if (!match || typeof groupsDef === 'undefined') return null;
  const teamToGroup = teamToGroupFromDefinition(groupsDef);
  const g1 = teamToGroup[teamIdFromMatch(match, 1)];
  const g2 = teamToGroup[teamIdFromMatch(match, 2)];
  return g1 && g1 === g2 ? g1 : null;
}

/**
 * Divide los partidos por grupo oficial.
 *
 * @param {Array}  matches    Partidos del backend.
 * @param {Object} groupsDef  { "A": [teamId,...], ... } composición oficial.
 * @returns {Object.<string, Array>} { "A": [partidos...], ... } una entrada por
 *   cada grupo (vacía si no hay partidos). Los partidos cuyos equipos no forman
 *   un grupo válido se descartan.
 */
function splitMatchesByGroup(matches = [], groupsDef = WORLD_CUP_2026_GROUPS) {
  const out = {};
  for (const letter of Object.keys(groupsDef || {})) out[letter] = [];
  for (const match of matches) {
    const letter = groupLetterForMatch(match, groupsDef);
    if (letter && out[letter]) out[letter].push(match);
  }
  return out;
}

/**
 * Construye las posiciones predichas de cada grupo a partir de los partidos del
 * backend y las predicciones del usuario (Win=3, Draw=1, Lose=0).
 *
 * Solo cuentan los partidos de fase de grupos: ambos equipos deben pertenecer al
 * mismo grupo y existir una predicción del usuario para ese partido.
 *
 * @param {Array}  matches       Partidos del backend (con userPred, equipo1/2, escudos).
 * @param {Object} groupsDef     { "A": [teamId,...4], ... } composición oficial.
 * @param {Object} [crestByName] Mapa teamId -> escudoUrl.
 * @returns {Object} { "A": [ [teamId, nombre, pj, gf, gc, pts, crestUrl], ...4 ], ... }
 */
function buildPredictedGroups(matches = [], groupsDef = {}, crestByName = {}) {
  const teamToGroup = {};
  const stats = {};
  for (const [letter, teamIds] of Object.entries(groupsDef)) {
    stats[letter] = {};
    for (const teamId of teamIds) {
      const teams = typeof WORLD_CUP_2026_TEAMS !== 'undefined' ? WORLD_CUP_2026_TEAMS : {};
      const team = teams[teamId] || { nombre: teamId };
      teamToGroup[teamId] = letter;
      stats[letter][teamId] = { id: teamId, name: team.nombre, pj: 0, gf: 0, gc: 0, pts: 0 };
    }
  }

  const crest = { ...crestByName };
  const rememberCrest = (teamId, url) => {
    if (teamId && url && !crest[teamId]) crest[teamId] = url;
  };

  for (const m of matches) {
    const id1 = teamIdFromMatch(m, 1);
    const id2 = teamIdFromMatch(m, 2);
    rememberCrest(id1, m.equipo1EscudoUrl);
    rememberCrest(id2, m.equipo2EscudoUrl);

    const pred = m.userPred;
    if (!pred || pred.scoreEquipo1 == null || pred.scoreEquipo2 == null) continue;

    const grupo = teamToGroup[id1];
    if (!grupo || grupo !== teamToGroup[id2]) continue;

    const row1 = stats[grupo][id1];
    const row2 = stats[grupo][id2];
    if (!row1 || !row2) continue;

    const s1 = Number(pred.scoreEquipo1);
    const s2 = Number(pred.scoreEquipo2);
    row1.pj++; row2.pj++;
    row1.gf += s1; row1.gc += s2;
    row2.gf += s2; row2.gc += s1;
    if (s1 > s2) row1.pts += 3;
    else if (s2 > s1) row2.pts += 3;
    else { row1.pts++; row2.pts++; }
  }

  const out = {};
  for (const [letter, teamIds] of Object.entries(groupsDef)) {
    out[letter] = teamIds.map(teamId => {
      const s = stats[letter][teamId];
      return [s.id, s.name, s.pj, s.gf, s.gc, s.pts, crest[teamId] || null];
    });
  }
  return out;
}

/**
 * Construye las posiciones REALES de cada grupo combinando los resultados de
 * partidos finalizados y en vivo, junto con los puntos PREDICHOS del usuario.
 *
 * - Stats reales (pj, gf, gc, pts): solo de partidos 'finalizado' y 'en-vivo'
 *   usando el marcador real del partido (los 'proximo' no suman).
 * - predPts: puntos según la predicción del usuario (cualquier estado).
 * - live: true si el equipo está jugando ahora mismo (algún partido 'en-vivo').
 *
 * @returns {Object} { "A": [ { id, name, pj, gf, gc, pts, predPts, live, crest }, ...4 ], ... }
 */
function buildGroupStandings(matches = [], groupsDef = {}, crestByName = {}) {
  const teamToGroup = {};
  const stats = {};
  for (const [letter, teamIds] of Object.entries(groupsDef)) {
    stats[letter] = {};
    for (const teamId of teamIds) {
      const teams = typeof WORLD_CUP_2026_TEAMS !== 'undefined' ? WORLD_CUP_2026_TEAMS : {};
      const team = teams[teamId] || { nombre: teamId };
      teamToGroup[teamId] = letter;
      stats[letter][teamId] = { id: teamId, name: team.nombre, pj: 0, gf: 0, gc: 0, pts: 0, predPts: 0, live: false };
    }
  }

  const crest = { ...crestByName };
  const rememberCrest = (teamId, url) => {
    if (teamId && url && !crest[teamId]) crest[teamId] = url;
  };

  for (const m of matches) {
    const id1 = teamIdFromMatch(m, 1);
    const id2 = teamIdFromMatch(m, 2);
    rememberCrest(id1, m.equipo1EscudoUrl);
    rememberCrest(id2, m.equipo2EscudoUrl);

    const grupo = teamToGroup[id1];
    if (!grupo || grupo !== teamToGroup[id2]) continue;
    const row1 = stats[grupo][id1];
    const row2 = stats[grupo][id2];
    if (!row1 || !row2) continue;

    // Puntos predichos a partir de la predicción del usuario.
    const pred = m.userPred;
    if (pred && pred.scoreEquipo1 != null && pred.scoreEquipo2 != null) {
      const p1 = Number(pred.scoreEquipo1);
      const p2 = Number(pred.scoreEquipo2);
      if (p1 > p2) row1.predPts += 3;
      else if (p2 > p1) row2.predPts += 3;
      else { row1.predPts++; row2.predPts++; }
    }

    // Stats reales: solo partidos finalizados o en vivo, con marcador real.
    const isLive = m.estado === 'en-vivo';
    const isFinished = m.estado === 'finalizado';
    if (isLive) { row1.live = true; row2.live = true; }
    if (isLive || isFinished) {
      const s1 = Number(m.scoreEquipo1 ?? m.scoreLocal);
      const s2 = Number(m.scoreEquipo2 ?? m.scoreVisitante);
      if (Number.isFinite(s1) && Number.isFinite(s2)) {
        row1.pj++; row2.pj++;
        row1.gf += s1; row1.gc += s2;
        row2.gf += s2; row2.gc += s1;
        if (s1 > s2) row1.pts += 3;
        else if (s2 > s1) row2.pts += 3;
        else { row1.pts++; row2.pts++; }
      }
    }
  }

  const out = {};
  for (const [letter, teamIds] of Object.entries(groupsDef)) {
    out[letter] = teamIds.map(teamId => {
      const s = stats[letter][teamId];
      return { id: s.id, name: s.name, pj: s.pj, gf: s.gf, gc: s.gc, pts: s.pts, predPts: s.predPts, live: s.live, crest: crest[teamId] || null };
    });
  }
  return out;
}

/**
 * Renderiza la tabla de posiciones reales de un grupo (vista "Grupos"):
 * ordenada por puntos REALES (desc), desempate por diferencia de gol y goles a
 * favor. Muestra una columna de puntos reales (Pts) y otra de puntos predichos
 * (Pred), y un punto verde junto a los equipos que están jugando ahora.
 * El carrusel actúa de encabezado, por eso no se renderiza fila de título.
 */
function renderGroupStandingsTable(letter, rows = []) {
  const sorted = [...rows].sort((a, b) => {
    if ((b.pts ?? 0) !== (a.pts ?? 0)) return (b.pts ?? 0) - (a.pts ?? 0);
    const gdA = (a.gf ?? 0) - (a.gc ?? 0);
    const gdB = (b.gf ?? 0) - (b.gc ?? 0);
    if (gdB !== gdA) return gdB - gdA;
    return (b.gf ?? 0) - (a.gf ?? 0);
  });

  const body = sorted.map(r => {
    const completo = Number(r.pj ?? 0) >= 3;
    const display = localizeTeamName(r.id, r.name);
    const liveDot = r.live
      ? `<span class="group-table__live" title="${t('groups.playingNow')}" aria-label="${t('groups.playingNow')}"></span>`
      : '';
    return `
        <tr class="${completo ? 'is-complete' : ''}${r.live ? ' is-live' : ''}">
          <td class="group-table__team">
            <span class="group-table__crest">${Predictions.teamCrest(display, r.crest)}</span>
            <span class="group-table__name">${escapeHtml(display)}</span>
            ${liveDot}
          </td>
          <td>${Number(r.pj ?? 0)}</td>
          <td>${Number(r.gf ?? 0)}</td>
          <td>${Number(r.gc ?? 0)}</td>
          <td class="group-table__pts">${Number(r.pts ?? 0)}</td>
          <td class="group-table__pred">${Number(r.predPts ?? 0)}</td>
        </tr>`;
  }).join('');

  return `
      <table class="group-table group-table--live">
        <thead>
          <tr>
            <th class="group-table__team">${t('groups.team')}</th>
            <th title="${t('groups.playedTitle')}">${t('groups.played')}</th>
            <th title="${t('groups.gfTitle')}">${t('groups.gf')}</th>
            <th title="${t('groups.gcTitle')}">${t('groups.gc')}</th>
            <th title="${t('groups.actualPointsTitle')}">${t('groups.points')}</th>
            <th title="${t('groups.predictedTitle')}">${t('groups.predicted')}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
}

async function initGrupos() {
  const root = document.getElementById('grupos-root');
  if (!root) return;
  showSkeleton(root, 4);
  try {
    const competencia = await resolveMundialCompetencia();
    if (!competencia) {
      root.innerHTML = emptyState(t('groups.empty'));
      return;
    }
    await loadGrupos(competencia.id, root);
  } catch (error) {
    root.innerHTML = errorState(error.message);
  }
}

async function resolveMundialCompetencia() {
  const competencias = await API.getCompetencias();
  return (
    competencias.find(c => c.slug === WORLD_CUP_2026_SLUG) ||
    competencias.find(c => normalizeTeamName(c.nombre).includes('mundial')) ||
    null
  );
}

async function loadGrupos(competenciaId, root) {
  const partidos = await API.getMatches({ competenciaId });
  const groups = buildPredictedGroups(partidos, WORLD_CUP_2026_GROUPS);
  root.innerHTML = renderGroupsGrid(groups);
}

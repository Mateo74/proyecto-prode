const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CLOCK_PHASE,
  computeClockState,
} = require("../src/services/externalMatchSync.service");

function minutesAgo(now, minutes) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

test("starts clock at 1' when match first becomes live", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "IN_PLAY" };

  const next = computeClockState(null, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.FIRST_HALF);
  assert.equal(next.minute, 1);
  assert.ok(next.runStart instanceof Date);
});

test("freezes minute and marks HALF_TIME when provider says PAUSED in first half", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "PAUSED" };
  const existing = {
    relojFase: CLOCK_PHASE.FIRST_HALF,
    minutoActual: 47,
    fechaInicioReal: minutesAgo(now, 46),
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.HALF_TIME);
  assert.equal(next.minute, 47);
  assert.equal(next.runStart, null);
});

test("resumes at 46' when live returns after HALF_TIME", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "LIVE" };
  const existing = {
    relojFase: CLOCK_PHASE.HALF_TIME,
    minutoActual: 47,
    fechaInicioReal: null,
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.SECOND_HALF);
  assert.equal(next.minute, 46);
  assert.ok(next.runStart instanceof Date);
});

test("marks END_90_BREAK on PAUSED after second half (90+)", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "PAUSED" };
  const existing = {
    relojFase: CLOCK_PHASE.SECOND_HALF,
    minutoActual: 92,
    fechaInicioReal: minutesAgo(now, 91),
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.END_90_BREAK);
  assert.equal(next.minute, 92);
});

test("resumes at 91' when live returns after END_90_BREAK", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "IN_PLAY" };
  const existing = {
    relojFase: CLOCK_PHASE.END_90_BREAK,
    minutoActual: 92,
    fechaInicioReal: null,
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.EXTRA_FIRST_HALF);
  assert.equal(next.minute, 91);
});

test("marks EXTRA_HALF_TIME on PAUSED after extra first half", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "PAUSED" };
  const existing = {
    relojFase: CLOCK_PHASE.EXTRA_FIRST_HALF,
    minutoActual: 106,
    fechaInicioReal: minutesAgo(now, 105),
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.EXTRA_HALF_TIME);
  assert.equal(next.minute, 106);
});

test("resumes at 106' when live returns after EXTRA_HALF_TIME", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "LIVE" };
  const existing = {
    relojFase: CLOCK_PHASE.EXTRA_HALF_TIME,
    minutoActual: 106,
    fechaInicioReal: null,
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.EXTRA_SECOND_HALF);
  assert.equal(next.minute, 106);
});

test("marks FINISHED phase when provider is PAUSED after extra second half (penalties window)", () => {
  const now = new Date("2026-06-19T20:00:00Z");
  const dto = { statusExternal: "PAUSED" };
  const existing = {
    relojFase: CLOCK_PHASE.EXTRA_SECOND_HALF,
    minutoActual: 121,
    fechaInicioReal: minutesAgo(now, 120),
  };

  const next = computeClockState(existing, dto, now);

  assert.equal(next.phase, CLOCK_PHASE.FINISHED);
  assert.equal(next.minute, 121);
});

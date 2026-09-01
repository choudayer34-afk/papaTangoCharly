// État persistant du 🍅 Pomodoro (js/views/memory.js, demande explicite de Charles-Henri du
// 02/09/2026, "un petit pomodoro"). Volontairement en localStorage, comme
// js/services/draftStore.js : c'est un minuteur d'usage immédiat propre à l'appareil, pas une
// donnée métier à synchroniser entre appareils — aucune nouvelle collection Firestore.
//
// Stocké comme un horodatage de FIN de phase, jamais un compte à rebours décrémenté en
// mémoire — recalculer le temps restant depuis cet horodatage à chaque lecture ne dérive
// jamais, même si l'onglet a été mis en arrière-plan entre deux vérifications (setInterval
// peut être ralenti par le navigateur dans ce cas, l'horodatage lui ne bouge pas).
//
// Un seul propriétaire fait avancer les phases : js/components/pomodoroWidget.js, monté une
// seule fois pour toute la session (comme le bouton ❓ Aide) — c'est ce qui permet au minuteur
// de continuer à tourner pendant que Charles-Henri va travailler ailleurs dans l'app (Kanban,
// Inbox...) plutôt que de s'arrêter dès qu'il change d'écran. La vue #/memory ne fait que LIRE
// cet état pour l'afficher et appeler les actions (start/pause/resume/skip/stop) ; elle ne
// fait jamais elle-même avancer une phase — ça évite qu'une double vérification (widget + vue
// ouverte en même temps) ne déclenche deux fois le même toast/la même notification.

const KEY = "pilotage-pomodoro";
const CYCLES_BEFORE_LONG_BREAK = 4;

export const PRESETS = {
  standard: { label: "Standard (25 min / 5 min)", workMin: 25, breakMin: 5 },
  short: { label: "Courte (15 min / 5 min)", workMin: 15, breakMin: 5 },
};

export const PHASE_LABELS = { work: "🎯 Concentration", break: "☕ Pause", longBreak: "🛋️ Pause longue" };

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRaw(state) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage indisponible — jamais bloquant, voir draftStore.js pour le même principe.
  }
}

function phaseDurationMs(presetKey, phase) {
  const preset = PRESETS[presetKey] || PRESETS.standard;
  if (phase === "work") return preset.workMin * 60000;
  if (phase === "longBreak") return preset.breakMin * 3 * 60000;
  return preset.breakMin * 60000;
}

function nextPhase(state) {
  if (state.phase === "work") {
    const cycleCount = state.cycleCount + 1;
    return { phase: cycleCount % CYCLES_BEFORE_LONG_BREAK === 0 ? "longBreak" : "break", cycleCount };
  }
  return { phase: "work", cycleCount: state.cycleCount };
}

export function start(presetKey) {
  const key = PRESETS[presetKey] ? presetKey : "standard";
  const state = {
    presetKey: key,
    phase: "work",
    cycleCount: 0,
    phaseEndAt: Date.now() + phaseDurationMs(key, "work"),
    isPaused: false,
    pausedRemainingMs: null,
  };
  writeRaw(state);
  return state;
}

export function pause() {
  const state = readRaw();
  if (!state || state.isPaused) return state;
  state.pausedRemainingMs = Math.max(0, state.phaseEndAt - Date.now());
  state.isPaused = true;
  state.phaseEndAt = null;
  writeRaw(state);
  return state;
}

export function resume() {
  const state = readRaw();
  if (!state || !state.isPaused) return state;
  state.phaseEndAt = Date.now() + (state.pausedRemainingMs || 0);
  state.isPaused = false;
  state.pausedRemainingMs = null;
  writeRaw(state);
  return state;
}

/** Passe manuellement à la phase suivante ("⏭️ Passer") — même logique de transition que le
 *  passage automatique en fin de minuteur (nextPhase). */
export function skip() {
  const state = readRaw();
  if (!state) return state;
  const { phase, cycleCount } = nextPhase(state);
  state.phase = phase;
  state.cycleCount = cycleCount;
  state.phaseEndAt = Date.now() + phaseDurationMs(state.presetKey, phase);
  state.isPaused = false;
  state.pausedRemainingMs = null;
  writeRaw(state);
  return state;
}

export function stop() {
  writeRaw(null);
}

export function getState() {
  return readRaw();
}

/**
 * Seul appelant : js/components/pomodoroWidget.js, une fois par seconde. Fait avancer la
 * phase toute seule si le temps est écoulé, et retourne `justTransitionedTo` (nom de la
 * nouvelle phase) une seule fois par transition — jamais répété tant qu'une nouvelle
 * transition n'a pas eu lieu, puisque `phaseEndAt` est aussitôt repoussé dans le futur.
 */
export function tick() {
  const state = readRaw();
  if (!state || state.isPaused || Date.now() < state.phaseEndAt) return { state, justTransitionedTo: null };
  const { phase, cycleCount } = nextPhase(state);
  state.phase = phase;
  state.cycleCount = cycleCount;
  state.phaseEndAt = Date.now() + phaseDurationMs(state.presetKey, phase);
  writeRaw(state);
  return { state, justTransitionedTo: phase };
}

/** Temps restant de la phase en cours, toujours recalculé depuis l'horodatage de fin plutôt
 *  qu'un compteur décrémenté — jamais de dérive après une mise en arrière-plan. */
export function remainingMs(state) {
  if (!state) return 0;
  if (state.isPaused) return state.pausedRemainingMs || 0;
  return Math.max(0, state.phaseEndAt - Date.now());
}

export function formatMs(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

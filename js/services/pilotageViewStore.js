// Préférences d'affichage de Pilotage — bascule "🗂️ Trello" / "📊 Tableau" et configuration de
// la vue Tableau (regroupement, tri, ordre des colonnes). Retour de Charles-Henri, 02/09/2026,
// dans la continuité de "traiter les onglets comme des filtres d'un même flux" : après avoir
// fusionné Équipe/Management, il a demandé de pouvoir aussi basculer Pilotage entre une vue
// façon Trello (l'existant) et une vue façon Monday (tableau groupable/triable/éditable en
// ligne), les deux montrant le même flux de Tâches déjà filtré (casquette, projet, échéance).
//
// État d'interface propre à l'appareil et au moment présent, jamais de la donnée métier —
// mêmes principes défensifs que js/services/draftStore.js et pomodoroStore.js : localStorage,
// jamais bloquant si indisponible (navigation privée, quota dépassé), silencieusement no-op.

const KEY = "pilotage-view";

function defaultState() {
  return {
    mode: "trello", // Tâches : "trello" | "table"
    // Projets : "list" | "category" (retour de Charles-Henri, 07/09/2026 — vue "Par catégorie"
    // en colonnes glissables, voir js/views/projects.js). Clé séparée de `mode` ci-dessus : les
    // deux vies (Tâches Trello/Tableau, Projets Liste/Catégorie) sont indépendantes, jamais la
    // même bascule.
    projectsMode: "list",
    table: {
      groupBy: "status", // "none" | "status" | "project" | "dueDate"
      sortColumn: null, // "type" | "status" | "project" | "dueDate" | null
      sortDir: "asc", // "asc" | "desc"
      // Le Titre reste toujours la première colonne, épinglée — seules ces colonnes-ci sont
      // réordonnables/masquées selon le regroupement actif (voir js/views/kanban.js). "notes"
      // et "description" ajoutées le 02/09/2026 (retour de Charles-Henri).
      columnOrder: ["type", "status", "project", "dueDate", "notes", "description"],
    },
  };
}

export function getViewState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    const table = { ...base.table, ...(parsed.table || {}) };
    // Migration (02/09/2026, ajout des colonnes Notes/Description) : un `columnOrder` déjà
    // enregistré sur cet appareil (depuis avant cette vague) ne les contient pas encore —
    // les ajouter à la fin plutôt que de les cacher silencieusement, sans perdre un ordre déjà
    // personnalisé par ailleurs.
    const missing = base.table.columnOrder.filter((c) => !table.columnOrder.includes(c));
    if (missing.length) table.columnOrder = [...table.columnOrder, ...missing];
    return { ...base, ...parsed, table };
  } catch {
    return defaultState();
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // silencieux — état d'interface, jamais bloquant.
  }
}

export function setMode(mode) {
  const state = getViewState();
  state.mode = mode;
  save(state);
  return state;
}

export function setProjectsMode(mode) {
  const state = getViewState();
  state.projectsMode = mode;
  save(state);
  return state;
}

/** Fusionne `patch` dans la configuration de la vue Tableau (groupBy, sortColumn, sortDir,
 *  columnOrder) — un seul point d'écriture pour ne jamais perdre les autres réglages. */
export function setTableConfig(patch) {
  const state = getViewState();
  state.table = { ...state.table, ...patch };
  save(state);
  return state;
}

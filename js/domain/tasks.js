// Tâches — cahier des charges §20 à §25.
// Statuts centralisés et configurables (§78.8) : le Kanban traduit ces statuts en
// colonnes, le Dashboard les traduit autrement — une seule source de vérité.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { buildSteps } from "./templates.js";
import * as dateUtils from "../services/dateUtils.js";

const COLLECTION = "tasks";

export const STATUSES = ["todo", "in_progress", "waiting", "follow_up", "done"];

export const STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  follow_up: "À suivre",
  done: "Terminé",
};

// Retour de Charles-Henri, 02/09/2026 : afficher le statut sur "🗓️ À échéance dans les 7
// jours" et "🎯 Focus du jour" (Dashboard) — un badge icône + libellé plutôt que le seul
// libellé texte déjà utilisé ailleurs (ex. le Kanban), pour rester repérable au coup d'œil
// dans une liste qui mélange plusieurs tâches.
export const STATUS_ICONS = {
  todo: "⚪",
  in_progress: "🔵",
  waiting: "⏳",
  follow_up: "👀",
  done: "🟢",
};

// Légende ⓘ (audit de simplification du 02/09/2026) : le statut d'une Tâche et celui d'un Suivi
// (js/domain/followups.js) partagent tous les deux une valeur "en attente" avec la même icône
// ⏳ mais un sens différent — ce texte lève l'ambiguïté sur Pilotage, où seul le vocabulaire
// Tâche est visible.
export const STATUS_INFO_HTML =
  "Statut d'une <strong>Tâche</strong> : ⚪ À faire · 🔵 En cours · ⏳ En attente (bloquée par quelqu'un ou quelque chose d'extérieur) · 👀 À suivre (à relancer) · 🟢 Terminé. Différent du statut d'un Suivi (onglet Équipe), qui utilise aussi ⏳ mais avec un sens propre.";

export async function createTask(data) {
  // Canevas Communication (§18, §78.9) : activé volontairement (case à cocher à la création),
  // pas déduit automatiquement du type — "communication" n'est pas l'un des types d'exemple
  // du §21 et forcer la détection serait plus fragile qu'utile pour un cas encore rare.
  const useCommunicationCanevas = data.type === "communication";
  const task = await storage.put(COLLECTION, {
    title: data.title,
    description: data.description || "",
    type: data.type || "action",
    status: data.status || "todo",
    priority: data.priority || "normale",
    dueDate: data.dueDate || null,
    projectId: data.projectId || null,
    parentTaskId: data.parentTaskId || null,
    successCriteria: data.successCriteria || "",
    isBlocked: false,
    sourceInboxItemId: data.sourceInboxItemId || null,
    steps: useCommunicationCanevas ? buildSteps("communication") : [],
    completedAt: null,
    outlookMeetings: [], // référence manuelle (pas de vraie intégration Outlook, voir plus bas)
    // `notesLog`/`checklist` acceptent une valeur initiale (retour de Charles-Henri, 15/09/2026 :
    // un changement de type Suivi→Tâche ne doit pas faire disparaître ce qu'on y avait déjà mis)
    // — voir js/domain/convert.js#convertFollowUpToTask, seul appelant à s'en servir aujourd'hui.
    // Vide par défaut pour tous les autres appelants, aucun changement de comportement pour eux.
    notesLog: data.notesLog || [], // journal de notes horodaté, voir addNote() plus bas
    checklist: data.checklist || [], // sous-étapes courtes libres, voir addChecklistItem() plus bas
    waitingOn: "", // "⏳ En attente de..." — voir setWaitingNote() plus bas
  });
  await storage.logHistory("Task", task.id, "created", { title: task.title });
  return task;
}

/**
 * Active le canevas de communication après création (LOT 1, TODO-007 — UX-010/AUDIT_USAGE_
 * EFFICACITE.md, décision validée par Charles-Henri le 15/09/2026 : la case "Communication" du
 * formulaire de création exposait un réglage avancé sans expliquer sa conséquence ; retirée de
 * `openCreateTaskModal`, ce choix se fait désormais après coup, depuis la fiche détail, comme les
 * autres réglages avancés — voir js/views/kanban.js#openTaskDetail). Volontairement à sens unique
 * (comme l'était la case à cocher qu'elle remplace : aucun chemin ne désactivait un canevas déjà
 * actif) et idempotente : si le canevas est déjà actif, ne réinitialise pas ses `steps` — cela
 * effacerait une progression déjà cochée.
 */
export async function enableCommunicationCanevas(id) {
  let didActivate = false;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    if (current.type === "communication" && (current.steps || []).length) return undefined; // déjà actif, rien à écrire
    didActivate = true;
    return { type: "communication", steps: buildSteps("communication") };
  });
  if (didActivate) {
    await storage.logHistory("Task", id, "updated", { patch: { type: "communication" } });
  }
  return updated;
}

/**
 * Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir
 * js/components/notesBlock.js. Additif uniquement, jamais d'édition ni de suppression d'une
 * note existante. Renvoie le tableau à jour pour que le composant puisse se rafraîchir sans
 * recharger toute la tâche.
 */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  // BUG corrigé (15/09/2026, audit "anomalies silencieuses") : storage.update() sérialise la
  // séquence lecture-modification-écriture par document — voir son commentaire détaillé dans
  // js/services/storage.js. Deux ajouts (note, sous-étape...) sur la MÊME tâche à quelques
  // millisecondes d'intervalle ne peuvent plus s'écraser l'un l'autre.
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    return { notesLog: [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }] };
  });
  await storage.logHistory("Task", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

/**
 * Sous-étapes courtes libres (retour de Charles-Henri, 01/09/2026 — piste TDAH : découper une
 * tâche en petits pas concrets et cochables, distinct du canevas Communication à cases fixes
 * ci-dessous). Volontairement sans historique dédié : une checklist personnelle se coche
 * plusieurs fois par jour, journaliser chaque case ferait du bruit dans le fil d'audit sans
 * rien apporter — même choix que toggleStep().
 */
export async function addChecklistItem(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    return { checklist: [...(current.checklist || []), { id: generateId(), text: trimmed, done: false }] };
  });
  return updated.checklist;
}

export async function toggleChecklistItem(id, itemId, done) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    // `doneAt` (retour de Charles-Henri, vague 21 : "voir quand ça s'est produit à l'affichage")
    // — même principe que toggleStep() dans js/domain/projects.js : horodaté à la coche, effacé
    // si on décoche par erreur plutôt que de garder une date qui ne correspond plus à rien.
    const checklist = (current.checklist || []).map((c) => (c.id === itemId ? { ...c, done, doneAt: done ? Date.now() : null } : c));
    return { checklist };
  });
  return updated.checklist;
}

export async function removeChecklistItem(id, itemId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    return { checklist: (current.checklist || []).filter((c) => c.id !== itemId) };
  });
  return updated.checklist;
}

/**
 * "⏳ En attente de..." (retour de Charles-Henri, 02/09/2026) : une information libre affichée
 * bien en évidence sur la carte Kanban tant qu'une Tâche est "En attente"/"À suivre" — ce
 * qu'on attend, et de qui. S'efface automatiquement dès que la tâche change de statut (voir
 * `updateTask` ci-dessous), pour ne jamais laisser un texte périmé sur une tâche qui a avancé
 * depuis. Volontairement sans historique dédié, même principe que la checklist ci-dessus —
 * une information qu'on ajuste au fil de l'eau, pas un événement à journaliser.
 */
export async function setWaitingNote(id, text) {
  return storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    return { waitingOn: (text || "").trim() };
  });
}

/** Coche/décoche une étape du canevas Communication — même principe que projects.js/meetings.js.
 *  `doneAt` horodate la coche (retour de Charles-Henri : voir à quel moment un point de la
 *  checklist a été traité), affiché par js/components/canevas.js à côté de l'étape cochée. */
export async function toggleStep(id, stepKey, done) {
  return storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    return { steps: (current.steps || []).map((s) => (s.key === stepKey ? { ...s, done, doneAt: done ? Date.now() : null } : s)) };
  });
}

/**
 * Association manuelle à une réunion Outlook (§ retour de Charles-Henri) — pas de vraie
 * intégration Microsoft Graph (authentification, synchro) : juste un titre + une date que
 * Charles-Henri note lui-même sur la tâche, visible dans les deux sens... mais uniquement
 * depuis la tâche, puisque l'app n'a aucun accès à Outlook lui-même. Un vrai aller-retour
 * avec Outlook serait un chantier à part (OAuth, permissions IT) — voir le doc de suivi.
 */
// BUG corrigé (15/09/2026, audit "anomalies silencieuses" : incohérences mineures) : addNote()
// ci-dessus journalise déjà ses événements — ces deux fonctions ne journalisaient rien, alors
// qu'une réunion Outlook rattachée/détachée est une information tout aussi structurante pour la
// tâche que l'ajout d'une note.
export async function addOutlookMeeting(id, { title, date }) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    return { outlookMeetings: [...(current.outlookMeetings || []), { id: generateId(), title, date: date || null }] };
  });
  await storage.logHistory("Task", id, "outlook_meeting_added", { title });
  return updated;
}

export async function removeOutlookMeeting(id, outlookId) {
  let removedTitle = null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    removedTitle = (current.outlookMeetings || []).find((m) => m.id === outlookId)?.title || null;
    return { outlookMeetings: (current.outlookMeetings || []).filter((m) => m.id !== outlookId) };
  });
  await storage.logHistory("Task", id, "outlook_meeting_removed", { title: removedTitle });
  return updated;
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

// `opts` transmis tel quel à storage.js#subscribe — voir son commentaire ({ sort: false } pour
// un appelant qui retrie de toute façon, ex. js/views/kanban.js par échéance).
export function subscribe(callback, opts) {
  return storage.subscribe(COLLECTION, callback, opts);
}

/**
 * Met à jour une tâche. Si `patch.status` est présent, `completedAt` est géré
 * automatiquement (posé quand on passe à "done", effacé sinon) — quel que soit le
 * chemin par lequel le statut change (Kanban, fiche détail, etc.), pas seulement
 * setStatus(). Une seule règle, un seul endroit.
 */
const WAITING_NOTE_STATUSES = ["waiting", "follow_up"];

export async function updateTask(id, patch) {
  let previousStatus = null;
  let statusChanged = false;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Tâche introuvable : " + id);
    previousStatus = current.status;

    const finalPatch = { ...patch };
    if (patch.status && patch.status !== current.status) {
      statusChanged = true;
      finalPatch.completedAt = patch.status === "done" ? Date.now() : null;
      // "⏳ En attente de..." ne vaut que pendant En attente/À suivre — effacé automatiquement
      // dès qu'on en sort, sauf si ce même appel fixe volontairement une nouvelle valeur.
      if (!WAITING_NOTE_STATUSES.includes(patch.status) && !("waitingOn" in patch)) {
        finalPatch.waitingOn = "";
      }
    }
    return finalPatch;
  });
  if (statusChanged) {
    await storage.logHistory("Task", id, "status_changed", { from: previousStatus, to: patch.status });
  } else {
    await storage.logHistory("Task", id, "updated", { patch });
  }
  return updated;
}

export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error("Statut inconnu : " + status);
  return updateTask(id, { status });
}

/**
 * Supprime la tâche. L'historique déjà journalisé n'est pas purgé (le fil global reste un
 * vrai journal d'audit) — il disparaît simplement des vues agrégées (fiche projet) qui ne
 * regardent que les tâches encore existantes.
 */
export async function removeTask(id) {
  await storage.logHistory("Task", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

// BUG corrigé (15/09/2026, audit "anomalies silencieuses" : unification du calcul de dates) —
// voir le commentaire détaillé dans js/services/dateUtils.js. `new Date(task.dueDate)` parsait
// l'échéance comme minuit UTC alors que `startOfToday()` (retiré d'ici) calculait un minuit
// LOCAL : dans un fuseau à décalage négatif, une tâche due aujourd'hui pouvait apparaître en
// retard avant même la fin de la journée.
export function isLate(task) {
  if (!task.dueDate || task.status === "done") return false;
  return dateUtils.daysFromToday(task.dueDate) < 0;
}

// "En pause" (piste TDAH du 01/09/2026, discussion permanence/repérage) : une tâche
// commencée (donc pas "todo") mais pas retouchée depuis un moment, distincte du retard (qui
// dépend d'une échéance — beaucoup de tâches abandonnées n'en ont pas). `updatedAt` est déjà
// posé par storage.put() à CHAQUE mutation (statut, note, sous-étape, édition...), donc aucun
// nouveau champ à ajouter : "dernière touche" existe déjà de fait, il suffisait de la lire.
const STALLED_ACTIVE_STATUSES = ["in_progress", "waiting", "follow_up"];
// Exporté (15/09/2026, audit "anomalies silencieuses") : js/domain/workload.js dupliquait cette
// même valeur pour son propre calcul de stagnation (sur les Suivis) — une seule définition de
// "5 jours sans mouvement" pour tout le monde désormais.
export const STALLED_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 jours

export function isStalled(task) {
  if (!STALLED_ACTIVE_STATUSES.includes(task.status)) return false;
  const lastTouch = task.updatedAt || task.createdAt || 0;
  return Date.now() - lastTouch > STALLED_THRESHOLD_MS;
}

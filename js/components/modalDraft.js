// Brouillons automatiques des fenêtres (modales) — 14/10/2026, retour de Charles-Henri :
// "je saisis un texte dans un champ, j'oublie de cliquer sur enregistrer, ou l'écran se recharge
// tout seul, et je perds tout". Décision : la saisie est sauvegardée automatiquement, à chaque
// frappe, sur l'appareil (localStorage via js/services/draftStore.js — même principe que le
// brouillon de la capture rapide), puis restituée à la réouverture de la même fenêtre avec un
// bandeau bien visible ("Saisie précédente récupérée") qui permet de repartir de zéro.
//
// Ce module ne connaît pas `openModal` : il reçoit l'élément corps de la fenêtre et une clé, et
// retourne un petit contrôleur. js/components/modal.js l'attache à toute fenêtre qui contient un
// champ de texte modifiable, et décide quand le brouillon est conservé ou effacé (voir
// `shouldClearDraft`).
import { saveDraft, getDraft, clearDraft, pruneDrafts } from "../services/draftStore.js";

export const MODAL_DRAFT_PREFIX = "modal:";
export const MODAL_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const MAX_VALUE_LENGTH = 50000;
const SAVE_DEBOUNCE_MS = 250;

// Champs qui ne sont pas de la "saisie de texte" : jamais sauvegardés (un mot de passe n'a rien à
// faire en clair dans localStorage ; un champ de recherche restauré le lendemain surprend ;
// cases/boutons/curseurs ne perdent pas de texte).
const EXCLUDED_INPUT_TYPES = new Set(["password", "file", "hidden", "checkbox", "radio", "range", "color", "button", "submit", "reset", "image", "search"]);

// Annuler est un choix explicite de ne pas garder la saisie (même principe que la capture rapide,
// js/components/capture.js) ; Fermer / Retour / Plus tard ne disent rien de la saisie → conservée.
const DISCARD_LABEL = /^\W*annuler/i;
const KEEP_LABEL = /^\W*(fermer|retour|plus tard|non\b|ignorer|passer|quitter)/i;
const COMMIT_LABEL = /(enregistr|cr[ée]er|ajouter|valider|envoyer|sauv|confirm|appliquer|importer|terminer|publier|mettre à jour|^\W*ok\b)/i;

/**
 * Le clic sur ce bouton doit-il EFFACER le brouillon de la fenêtre ? Oui pour une validation
 * (Enregistrer, Créer...) ou une annulation explicite ; non pour un simple Fermer/Retour — le
 * texte saisi est alors conservé pour la prochaine ouverture. Règle prudente (ne jamais perdre du
 * texte par défaut) : libellé "garder" → non ; libellé annuler/valider, ou variante primary/danger
 * → oui ; tout le reste → non.
 */
export function shouldClearDraft({ label = "", variant = "" } = {}) {
  if (KEEP_LABEL.test(label)) return false;
  if (DISCARD_LABEL.test(label) || COMMIT_LABEL.test(label)) return true;
  return variant === "primary" || variant === "danger";
}

/** Clé de brouillon d'une fenêtre : écran courant (sans paramètres) + titre. */
export function modalDraftKey(title, hash = "") {
  const route = String(hash || "").split("?")[0];
  return `${MODAL_DRAFT_PREFIX}${route}|${title}`;
}

/** Champs de saisie de texte protégés d'un conteneur, dans l'ordre du document. */
export function draftableFields(root) {
  const nodes = root.querySelectorAll("input, textarea");
  const result = [];
  for (const el of nodes) {
    if (el.readOnly || el.disabled || el.hasAttribute("data-no-draft")) continue;
    if (el.tagName === "INPUT" && EXCLUDED_INPUT_TYPES.has((el.getAttribute("type") || "text").toLowerCase())) continue;
    result.push(el);
  }
  return result;
}

function fieldId(el, index) {
  return el.id || el.getAttribute("name") || `#${index}`;
}

function describeAge(savedAt, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

let pruned = false;

/**
 * @param {HTMLElement} bodyEl - corps de la fenêtre.
 * @param {string} key - clé de brouillon (voir modalDraftKey).
 * @returns {{start: Function, flush: Function, discard: Function, destroy: Function}}
 */
export function attachModalDraft(bodyEl, key) {
  if (!pruned) {
    pruned = true;
    pruneDrafts(MODAL_DRAFT_PREFIX, MODAL_DRAFT_MAX_AGE_MS);
  }

  const baseValues = new Map(); // id -> valeur d'origine (avant toute saisie), relevée juste après l'ouverture
  const userEdited = new Set(); // ids modifiés par l'utilisateur dans cette ouverture
  let stored = getDraft(key);
  if (stored && (!stored.fields || Date.now() - (stored.savedAt || 0) > MODAL_DRAFT_MAX_AGE_MS)) {
    clearDraft(key);
    stored = null;
  }
  const copyFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([id, rec]) => [id, { v: String(rec.v ?? ""), b: String(rec.b ?? "") }]));
  const pending = stored ? copyFields(stored.fields) : {}; // id -> {v, b} : brouillon encore à restituer
  const savedFields = stored ? copyFields(stored.fields) : {}; // ce qui est actuellement persisté
  let bannerEl = null;
  let applying = false;
  let saveTimer = null;
  let started = false;
  let destroyed = false;

  function snapshotBases() {
    draftableFields(bodyEl).forEach((el, i) => {
      const id = fieldId(el, i);
      if (!baseValues.has(id)) baseValues.set(id, el.value);
    });
  }

  function setValue(el, value) {
    applying = true;
    try {
      el.value = value;
      // Prévient le code de la fenêtre (aperçu, bouton activé selon le contenu...) comme une
      // vraie saisie — sans que cela compte comme une frappe de l'utilisateur.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } finally {
      applying = false;
    }
  }

  function showBanner() {
    if (bannerEl || destroyed) return;
    bannerEl = document.createElement("div");
    bannerEl.className = "draft-banner";
    bannerEl.setAttribute("role", "status");
    const text = document.createElement("span");
    text.className = "draft-banner-text";
    text.textContent = `📝 Saisie précédente récupérée (${describeAge(stored.savedAt)}) — non enregistrée.`;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-ghost btn-compact draft-banner-reset";
    reset.textContent = "Repartir de zéro";
    reset.addEventListener("click", () => {
      draftableFields(bodyEl).forEach((el, i) => {
        const id = fieldId(el, i);
        if (id in savedFields || id in pending) setValue(el, baseValues.has(id) ? baseValues.get(id) : el.defaultValue);
      });
      for (const id of Object.keys(pending)) delete pending[id];
      for (const id of Object.keys(savedFields)) delete savedFields[id];
      userEdited.clear();
      clearDraft(key);
      bannerEl?.remove();
      bannerEl = null;
    });
    bannerEl.append(text, reset);
    bodyEl.insertBefore(bannerEl, bodyEl.firstChild);
  }

  // Restitue (ou re-restitue) les champs encore en attente. Rejouée une fois peu après
  // l'ouverture : certaines fenêtres remplissent leurs champs après coup (valeur d'une fiche
  // chargée, liste qui s'affiche) — on ne touche jamais à un champ que l'utilisateur a déjà
  // retapé lui-même.
  function applyPass() {
    if (destroyed) return;
    let appliedAny = false;
    draftableFields(bodyEl).forEach((el, i) => {
      const id = fieldId(el, i);
      const rec = pending[id];
      if (!rec || userEdited.has(id)) return;
      if (rec.applied) {
        // Déjà restitué : on le remet seulement si le code de la fenêtre l'a écrasé entre-temps.
        if (el.value !== rec.v) setValue(el, rec.v);
        appliedAny = true;
        return;
      }
      // Garde-fou : deux fiches différentes peuvent porter le même titre d'écran (ex. "Modifier
      // la tâche"). Le texte n'est restitué que si le champ est dans l'état où il était quand
      // le brouillon a été pris (même valeur d'origine) — jamais dans la fiche d'un autre élément.
      if (el.value !== rec.b) return;
      baseValues.set(id, rec.b);
      setValue(el, rec.v);
      rec.applied = true;
      appliedAny = true;
    });
    if (appliedAny && stored) showBanner();
  }

  function persist() {
    saveTimer = null;
    if (destroyed) return;
    const fields = { ...savedFields };
    const elements = draftableFields(bodyEl);
    let changed = false;
    elements.forEach((el, i) => {
      const id = fieldId(el, i);
      if (!userEdited.has(id)) return;
      const base = baseValues.has(id) ? baseValues.get(id) : el.defaultValue;
      if (el.value === base) {
        delete fields[id];
      } else {
        fields[id] = { v: el.value.slice(0, MAX_VALUE_LENGTH), b: base };
      }
      changed = true;
    });
    if (!changed) return;
    for (const id of Object.keys(savedFields)) delete savedFields[id];
    Object.assign(savedFields, fields);
    if (Object.keys(fields).length) saveDraft(key, { fields });
    else clearDraft(key);
  }

  function onInput(e) {
    if (applying || destroyed) return;
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const list = draftableFields(bodyEl);
    const index = list.indexOf(el);
    if (index === -1) return;
    const id = fieldId(el, index);
    userEdited.add(id);
    delete pending[id];
    if (!baseValues.has(id)) baseValues.set(id, el.defaultValue);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS);
  }

  function flush() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      persist();
    }
  }

  function onVisibility() {
    if (document.visibilityState === "hidden") flush();
  }

  bodyEl.addEventListener("input", onInput);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);

  return {
    /** À appeler une fois la fenêtre en place, après le montage initial par son appelant. */
    start() {
      if (started) return;
      started = true;
      // Les appelants remplissent souvent leurs champs juste après openModal() (valeurs d'une
      // fiche existante) : on attend la fin de ce code synchrone avant de relever l'état
      // d'origine et de restituer le brouillon.
      setTimeout(() => {
        if (destroyed) return;
        snapshotBases();
        applyPass();
      }, 0);
      setTimeout(() => {
        if (destroyed) return;
        snapshotBases();
        applyPass();
      }, 500);
    },
    flush,
    /** La saisie a été validée : le brouillon n'a plus lieu d'être. */
    discard() {
      destroyed = true;
      clearTimeout(saveTimer);
      clearDraft(key);
      bodyEl.removeEventListener("input", onInput);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    },
    /** Fermeture sans validation : on garde ce qui est saisi. */
    destroy() {
      flush();
      destroyed = true;
      bodyEl.removeEventListener("input", onInput);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    },
  };
}

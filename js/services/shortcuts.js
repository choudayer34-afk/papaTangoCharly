// Raccourcis clavier — vague 20, retour de Charles-Henri : "je marche aussi beaucoup au
// raccourci clavier, [...] pour aller vite et que ce soit intuitif". Un seul point d'entrée,
// un seul écouteur `keydown` monté une fois pour toute la session (comme le widget Pomodoro ou
// le bouton ❓ Aide, voir js/app.js) plutôt qu'un écouteur par écran.
//
// Deux espaces de combinaisons, jamais mélangés :
//  - un jeu FIXE (BUILTIN_SHORTCUTS ci-dessous), documenté dans le Guide (retour de
//    Charles-Henri : "tous les raccourcis doivent être dans le guide") ;
//  - un jeu PERSONNALISÉ, assigné par Charles-Henri lui-même sur une fiche Personne/Projet
//    (`renderShortcutAssignButton`), toujours de la forme Ctrl+Alt+<lettre ou chiffre> — cet
//    espace ne recoupe jamais le premier (aucun raccourci fixe n'utilise Ctrl+Alt ensemble),
//    donc aucune collision possible entre les deux.
//
// Deux contraintes techniques ont fait dévier certains choix initialement proposés par
// Claude et confirmés par Charles-Henri, documentées ici pour ne jamais les reproposer telles
// quelles :
//  - Ctrl+N (« Capturer ») et Ctrl+1…Ctrl+8 (« changer d'onglet ») sont réservés par TOUS les
//    navigateurs (nouvelle fenêtre / passer à l'onglet N du NAVIGATEUR, pas de la page) et ne
//    peuvent techniquement pas être interceptés par une page web, quel que soit le code écrit
//    ici — remplacés par Alt+N et Alt+1…Alt+8, libres dans tous les navigateurs.
//  - Ctrl+Alt (espace des raccourcis personnalisés) correspond à la touche "AltGr" d'un
//    clavier français AZERTY, qui sert à taper des caractères comme "@", "#", "€"... —
//    `e.getModifierState("AltGraph")` est vérifié partout où un Ctrl+Alt+<touche> est reconnu,
//    pour ne jamais confondre une vraie assignation avec une simple frappe AltGr.

import { openCaptureModal } from "../components/capture.js";
import { openSearchModal } from "../components/search.js";
import { triggerLastUndo, showToast } from "../components/toast.js";
import { fetchBundle, resolveRef } from "../components/linkedItems.js";
import * as preferencesApi from "../domain/preferences.js";

/** Documentation affichée dans le Guide (js/views/guide.js) — une seule source de vérité pour
 *  ne jamais laisser la liste du Guide diverger de ce qui est réellement câblé ci-dessous. */
export const BUILTIN_SHORTCUTS = [
  { combo: "Ctrl+K", description: "Ouvre la recherche globale, curseur posé directement dans le champ." },
  { combo: "Alt+N", description: "Ouvre la modale Capturer, depuis n'importe quel écran." },
  {
    combo: "Alt+1 … Alt+8",
    description:
      "Va directement sur l'onglet à cette position dans la barre du bas (1 = Accueil, 2 = Inbox, 3 = Pilotage, 4 = Projets, 5 = Équipe, 6 = Calendrier, 7 = Ressources, 8 = Prompts). Sans effet tant qu'une fiche est ouverte, pour ne jamais changer d'écran sous elle par erreur.",
  },
  {
    combo: "Ctrl+Entrée",
    description: "Dans une fiche ouverte : déclenche son bouton principal (Enregistrer, Créer...), sans avoir à cliquer dessus.",
  },
  {
    combo: "Ctrl+Z",
    description:
      "Rejoue le bouton « Annuler » du dernier toast affiché (ex. après un glisser-déposer de date sur le Calendrier), tant qu'il est encore visible. Sans effet dans un champ de texte — Ctrl+Z y reste l'annulation native du navigateur.",
  },
  {
    combo: "1 / 2 / 3",
    description: "Dans la fenêtre « Traiter » d'une capture Inbox : choisit directement Action / Suivi / Information sans la souris.",
  },
  {
    combo: "A",
    description: "Dans la même fenêtre « Traiter » : déplie « Autre » (Projet, Réunion, Décision, Ressource, Archiver).",
  },
  {
    combo: "Alt+1 … Alt+8 (dans la recherche)",
    description: "Bascule le filtre de type correspondant (Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision, Information/Idée) sans quitter le clavier.",
  },
  {
    combo: "Ctrl+Alt+<lettre ou chiffre>",
    description:
      "Raccourci personnalisé vers une Personne ou un Projet précis. Chaque fiche Personne/Projet propose un bouton « ⌨️ Assigner un raccourci » : choisis n'importe quelle touche, la combinaison Ctrl+Alt+cette touche rouvre directement cette fiche depuis n'importe quel écran de l'app.",
  },
];

const ROUTE_HASHES = [];
let capturing = false; // vrai pendant qu'une nouvelle assignation Ctrl+Alt+<touche> est en cours d'écoute

function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** `true` si l'événement correspond à une vraie combinaison Ctrl+Alt+<lettre ou chiffre> —
 *  jamais un AltGr (clavier AZERTY) mal interprété. Partagée entre la reconnaissance d'un
 *  raccourci déjà assigné et sa capture initiale (`renderShortcutAssignButton`). */
function isCustomComboEvent(e) {
  if (e.getModifierState && e.getModifierState("AltGraph")) return false;
  const mod = e.ctrlKey || e.metaKey;
  return mod && e.altKey && !e.shiftKey && /^[a-z0-9]$/i.test(e.key);
}

function comboFromEvent(e) {
  return `ctrl+alt+${e.key.toLowerCase()}`;
}

let handler = null;

/** Monté une seule fois pour toute la session (js/app.js#mountApp). `routeHashes` = l'ordre
 *  des onglets de la barre du bas (`Object.keys(ROUTES)`), pour qu'Alt+1…Alt+8 pointe toujours
 *  vers le bon onglet même si la liste évolue plus tard. */
export function initGlobalShortcuts(routeHashes) {
  ROUTE_HASHES.length = 0;
  ROUTE_HASHES.push(...routeHashes);
  if (handler) return;

  handler = async function onKeydown(e) {
    if (capturing) return; // une assignation de raccourci personnalisé est en cours ailleurs

    // Ctrl+Alt+<touche> — raccourci personnalisé vers une Personne/un Projet. Vérifié en
    // premier : c'est la combinaison la plus spécifique, et elle doit fonctionner même le
    // focus posé dans un champ de texte (Ctrl+Alt ne tape jamais de caractère par lui-même,
    // hors AltGr déjà écarté ci-dessus).
    if (isCustomComboEvent(e)) {
      const combo = comboFromEvent(e);
      const prefs = await preferencesApi.getPreferences();
      const target = (prefs.customShortcuts || {})[combo];
      if (target) {
        e.preventDefault();
        const bundle = await fetchBundle();
        const resolved = resolveRef(bundle, target);
        if (resolved) resolved.onOpen();
        else showToast("Cette fiche n'existe plus — le raccourci est à réassigner.");
      }
      return;
    }

    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearchModal();
      return;
    }

    if (e.altKey && !mod && !e.shiftKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      openCaptureModal();
      return;
    }

    if (e.altKey && !mod && !e.shiftKey && /^[1-8]$/.test(e.key)) {
      // Jamais changer d'écran sous une fiche ouverte — cohérent avec le principe "une seule
      // modale à la fois" (js/components/modal.js) : naviguer laisserait la fiche flotter
      // au-dessus d'un écran qui n'est plus le sien.
      if (document.querySelector(".modal-overlay")) return;
      const hash = ROUTE_HASHES[Number(e.key) - 1];
      if (hash) {
        e.preventDefault();
        location.hash = hash;
      }
      return;
    }

    if (mod && !e.altKey && e.key === "Enter") {
      const btn = document.querySelector(".modal-overlay .btn-primary");
      if (btn) {
        e.preventDefault();
        btn.click();
      }
      return;
    }

    if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "z") {
      if (isEditableTarget(e.target)) return; // laisse l'annulation native du champ de texte
      if (triggerLastUndo()) e.preventDefault();
      return;
    }
  };
  document.addEventListener("keydown", handler);
}

export function teardownGlobalShortcuts() {
  if (handler) document.removeEventListener("keydown", handler);
  handler = null;
}

/**
 * Bouton "⌨️ Raccourci" à poser sur une fiche Personne/Projet (retour de Charles-Henri : "je
 * veux pouvoir affecter un raccourci moi-même... pour aller directement sur une personne ou un
 * projet"). `target` = `{ type: "Person"|"Project", id, label }` — `label` sert uniquement à
 * nommer la fiche dans un message de conflit, jamais à la navigation elle-même (toujours
 * résolue à chaud via `resolveRef`, jamais un titre figé).
 */
export async function renderShortcutAssignButton(container, target) {
  const prefs = await preferencesApi.getPreferences();
  paint(prefs.customShortcuts || {});

  function paint(customShortcuts) {
    const existing = preferencesApi.findShortcutForTarget(customShortcuts, target.type, target.id);
    container.innerHTML = "";
    const assignBtn = document.createElement("button");
    assignBtn.type = "button";
    assignBtn.className = "btn btn-ghost btn-sm";
    assignBtn.textContent = existing ? `⌨️ ${comboLabel(existing)} · Modifier` : "⌨️ Assigner un raccourci";
    assignBtn.addEventListener("click", () => startCapture(assignBtn));
    container.appendChild(assignBtn);

    if (existing) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost btn-sm";
      removeBtn.textContent = "Retirer";
      removeBtn.addEventListener("click", async () => {
        await preferencesApi.removeCustomShortcut(existing);
        showToast("Raccourci retiré");
        const fresh = await preferencesApi.getPreferences();
        paint(fresh.customShortcuts || {});
      });
      container.appendChild(removeBtn);
    }
  }

  function startCapture(btn) {
    capturing = true;
    const original = btn.textContent;
    btn.textContent = "Maintiens Ctrl+Alt et appuie sur une touche… (Échap pour annuler)";

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return cleanup(true);
      }
      if (!isCustomComboEvent(e)) return; // ignore tout le reste, y compris un AltGr (AZERTY)
      e.preventDefault();
      // Empêche l'événement d'atteindre ensuite l'écouteur global bubble-phase
      // (initGlobalShortcuts) : sans ça, `cleanup()` remet `capturing` à `false` avant même
      // que cette frappe ait fini sa propagation, et le handler global la retraite aussitôt
      // comme un raccourci déjà assigné — rouvrant la fiche visée À LA PLACE de la fiche en
      // cours d'assignation (bug trouvé aux tests : assigner Ctrl+Alt+J à Bob alors qu'il
      // était déjà pris par Alice refermait la fiche de Bob et rouvrait celle d'Alice).
      e.stopPropagation();
      const combo = comboFromEvent(e);
      cleanup(false);
      save(combo, btn);
    }

    function cleanup(restore) {
      document.removeEventListener("keydown", onKeydown, true);
      capturing = false;
      if (restore) btn.textContent = original;
    }

    document.addEventListener("keydown", onKeydown, true);
  }

  async function save(combo, btn) {
    const fresh = await preferencesApi.getPreferences();
    const holder = (fresh.customShortcuts || {})[combo];
    if (holder && !(holder.type === target.type && holder.id === target.id)) {
      showToast(`${comboLabel(combo)} est déjà utilisé pour « ${holder.label} » — choisis-en un autre.`);
      paint(fresh.customShortcuts || {});
      return;
    }
    await preferencesApi.setCustomShortcut(combo, target);
    showToast(`⌨️ ${comboLabel(combo)} assigné`);
    const updated = await preferencesApi.getPreferences();
    paint(updated.customShortcuts || {});
  }
}

function comboLabel(combo) {
  const key = combo.split("+")[2] || "";
  return "Ctrl+Alt+" + key.toUpperCase();
}

// Logique de post-it PARTAGÉE entre js/components/bureau.js (plan de travail "Tout voir") et
// js/components/pinnedNotesOverlay.js (widgets flottants "toujours visibles") — extraite de
// bureau.js le 23/09/2026 (même jour que la livraison initiale du lot), au moment où le besoin de
// Charles-Henri ("je dois pouvoir [épingler] n'importe où dans l'écran [...] au-dessus des autres
// modales") a fait naître un DEUXIÈME endroit dans l'app qui doit ouvrir le même menu "⋯"
// (couleur/épingle/archive/suppression/transformation) et éditer le même contenu (titre,
// texte/checklist) qu'un post-it du plan de travail. Aucune de ces fonctions ne dépendait de
// l'état interne de mountBureau() (glisser en cours, notes courantes, etc.) — extraction directe,
// sans changement de comportement pour le plan de travail existant.
//
// `openStickyNoteEditor` (édition rapide en modale, ajoutée le 23/09/2026 pour la carte flottante,
// SEUL appelant qu'elle ait jamais eu) a été RETIRÉE le 28/09/2026 : retour direct de
// Charles-Henri sur le complément de redimensionnement livré ce même jour ("je voulais bien
// l'édition rapide donc que tu repasses dessus") confirmant la lecture alternative qui avait été
// explicitement proposée sans être retenue à ce moment-là — rendre le contenu (titre, type,
// checklist/texte) éditable DIRECTEMENT sur la carte flottante, à la manière du plan de travail
// "Tout voir", sans plus jamais passer par une modale dédiée. Voir
// js/components/pinnedNotesOverlay.js#buildFloatingNote, qui reproduit désormais la même
// structure (en-tête avec titre éditable, bascule texte/checklist, corps via renderNoteBody
// ci-dessous) que js/components/bureau.js#buildNoteEl.
import * as stickyNotesApi from "../domain/stickyNotes.js";
import * as inboxApi from "../domain/inbox.js";
import * as peopleApi from "../domain/people.js";
import * as gamificationApi from "../domain/gamification.js";
import { openCreateTaskModal } from "../views/kanban.js";
import { openCreateResourceModal } from "../views/resources.js";
import { openCreateFollowUpModal } from "../views/people.js";
import { openCreateDecisionModal } from "../views/dashboard.js";
import { openKeptItemDetail } from "../views/inbox.js";
import { renderChecklist } from "./checklist.js";
import { openModal, closeModal, confirmDelete } from "./modal.js";
import { showToast } from "./toast.js";

export const COLOR_LABELS = { yellow: "Jaune", blue: "Bleu", green: "Vert", pink: "Rose", purple: "Violet", gray: "Gris", ocean: "Océan", aurore: "Aurore" };

// "Océan"/"Aurore" (LOT G7, TODO_GAMIFICATION.md §6 Table A, 25/09/2026) — ces 2 couleurs de
// stickyNotesApi.COLORS sont des déblocages de gamification (js/domain/gamification.js#DEBLOCAGES,
// catégorie "palette") : jamais proposées dans le sélecteur tant que le déblocage correspondant
// n'est pas acquis (voir openStickyNoteMenu ci-dessous, qui filtre puis complète après coup).
const COULEURS_DEBLOCABLES = { ocean: "palette-ocean", aurore: "palette-aurore" };

// Choix de conversion (post-it entier ET ligne de checklist) — un post-it n'est jamais "archivé
// sans suite" par ce menu : l'action "🗄️ Archiver" existe séparément (voir openStickyNoteMenu).
export const CONVERT_CHOICES = [
  { key: "task", emoji: "✅", label: "Tâche" },
  { key: "followup", emoji: "👀", label: "Suivi" },
  { key: "resource", emoji: "📎", label: "Ressource" },
  { key: "decision", emoji: "🗳️", label: "Décision" },
  { key: "kept", emoji: "🧠", label: "Information" },
];

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

export function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

export function buildConvertChoiceGrid(onChoose) {
  const grid = document.createElement("div");
  grid.className = "choice-grid";
  for (const choice of CONVERT_CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.innerHTML = `<span class="emoji">${choice.emoji}</span> ${choice.label}`;
    btn.addEventListener("click", () => onChoose(choice.key));
    grid.appendChild(btn);
  }
  return grid;
}

/**
 * Contenu éditable d'un post-it (titre géré par l'appelant, ici seulement le corps
 * texte/checklist) — utilisé par le plan de travail complet (js/components/bureau.js#buildNoteEl)
 * ET par la carte flottante (js/components/pinnedNotesOverlay.js#buildFloatingNote), qui affiche
 * et édite désormais son contenu en place, exactement de la même façon.
 * `note.checklist` est mutée localement à chaque callback (même pattern que
 * js/views/kanban.js#openTaskDetail pour `task.checklist`) pour un réaffichage immédiat, sans
 * attendre le prochain aller-retour Firestore (qui finira de toute façon par recréer cet élément
 * avec la donnée serveur, via la resouscription de l'appelant).
 */
export function renderNoteBody(bodyEl, note, { onLineConvertClose } = {}) {
  if (note.type === "checklist") {
    renderChecklist(bodyEl, note.checklist || [], {
      emptyLabel: "Rien de noté pour l'instant.",
      sortDoneToBottom: true,
      onAdd: async (text) => {
        const item = await stickyNotesApi.addChecklistItem(note.id, text);
        note.checklist = item ? [...(note.checklist || []), item] : note.checklist;
        return note.checklist;
      },
      onToggle: async (itemId, done) => {
        note.checklist = await stickyNotesApi.toggleChecklistItem(note.id, itemId, done);
        return note.checklist;
      },
      onRemove: async (itemId) => {
        note.checklist = await stickyNotesApi.removeChecklistItem(note.id, itemId);
        return note.checklist;
      },
      onEdit: async (itemId, text) => {
        note.checklist = (await stickyNotesApi.editChecklistItem(note.id, itemId, text)) || note.checklist;
        return note.checklist;
      },
      onReorder: async (orderedIds) => {
        note.checklist = await stickyNotesApi.reorderChecklist(note.id, orderedIds);
        return note.checklist;
      },
      onLineMenu: (item) => openLineConvertModal(note, item, { onClose: onLineConvertClose }),
    });
  } else {
    bodyEl.innerHTML = `<textarea class="sticky-note-textarea" placeholder="Écris ici...">${escapeHtml(note.content)}</textarea>`;
    const textarea = bodyEl.querySelector(".sticky-note-textarea");
    let contentSaveTimer = null;
    textarea.addEventListener("input", () => {
      clearTimeout(contentSaveTimer);
      contentSaveTimer = setTimeout(() => stickyNotesApi.setContent(note.id, textarea.value), 500);
    });
    textarea.addEventListener("blur", () => {
      clearTimeout(contentSaveTimer);
      stickyNotesApi.setContent(note.id, textarea.value);
    });
  }
}

/** Menu "⋯" d'un post-it — Épingler/Désépingler, couleur, Archiver, Supprimer, "Transformer en"
 *  (post-it ENTIER, voir CONVERT_CHOICES). Commun au plan de travail complet et aux widgets
 *  flottants. `onClose` (optionnel) — l'appelant flottant (pinnedNotesOverlay.js) l'utilise pour
 *  réafficher sa carte, masquée le temps que ce menu reste ouvert (voir le commentaire en tête de
 *  pinnedNotesOverlay.js sur le conflit de superposition avec .modal-overlay). */
// margin-bottom de #note-menu-colors relevée de 16px à 28px plus bas (retour de Charles-Henri,
// 29/09/2026 : "problème d'affichage de légende") : l'infobulle native du navigateur (attribut
// title="Jaune"/"Océan"... posé sur chaque pastille) s'affiche sous la pastille survolée — avec
// seulement 16px d'écart, elle chevauchait le sous-titre "Transformer en" juste en dessous. Ce
// fichier ne définit aucune infobulle personnalisée (uniquement l'attribut natif title) : ce n'est
// pas une infobulle mal positionnée par notre CSS, seulement pas assez d'espace pour celle, native,
// du navigateur.
export function openStickyNoteMenu(note, { onClose } = {}) {
  const body = document.createElement("div");
  // Couleurs affichées immédiatement : toutes les couleurs fixes, plus les couleurs débloquées
  // (LOT G7) uniquement si déjà acquises, plus la couleur courante de la note (même si son
  // déblocage venait à être perdu, on ne cache jamais la couleur active). Les couleurs débloquées
  // pas encore acquises sont ajoutées dynamiquement plus bas, après vérification asynchrone.
  const couleursInitiales = stickyNotesApi.COLORS.filter((c) => !COULEURS_DEBLOCABLES[c] || c === note.color);
  body.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <button type="button" id="note-menu-pin" class="btn btn-secondary btn-sm">${note.pinned ? "📌 Désépingler" : "📌 Épingler"}</button>
      <button type="button" id="note-menu-archive" class="btn btn-secondary btn-sm">🗄️ Archiver</button>
      <button type="button" id="note-menu-delete" class="btn btn-danger btn-sm">🗑️ Supprimer</button>
    </div>
    <div class="section-title" style="margin-top:0;">🎨 Couleur</div>
    <div class="chip-row" id="note-menu-colors" style="margin-bottom:28px;">
      ${couleursInitiales
        .map(
          (c) =>
            `<button type="button" class="chip sticky-color-swatch sticky-note--${c}${c === note.color ? " active" : ""}" data-color="${c}" aria-label="${COLOR_LABELS[c]}" title="${COLOR_LABELS[c]}"></button>`
        )
        .join("")}
    </div>
    <div class="section-title">🔀 Transformer en</div>
    <div class="choice-grid" id="note-menu-convert"></div>
  `;
  body.querySelector("#note-menu-pin").addEventListener("click", async () => {
    await stickyNotesApi.togglePin(note.id, !note.pinned);
    closeModal();
  });
  body.querySelector("#note-menu-archive").addEventListener("click", async () => {
    await stickyNotesApi.setArchived(note.id, true);
    closeModal();
    showToast("Post-it archivé");
  });
  body.querySelector("#note-menu-delete").addEventListener("click", () => {
    closeModal();
    confirmDelete({
      title: "Supprimer ce post-it ?",
      message: `« ${note.title || "Post-it sans titre"} » sera définitivement supprimé.`,
      onConfirm: async () => {
        await stickyNotesApi.removeStickyNote(note.id);
        showToast("Post-it supprimé");
      },
    });
  });
  // Câblage du clic pour une pastille de couleur, factorisé pour être réutilisé à la fois sur les
  // pastilles initiales et sur celles ajoutées dynamiquement ci-dessous (LOT G7).
  function wireColorSwatch(btn) {
    btn.addEventListener("click", async () => {
      await stickyNotesApi.setColor(note.id, btn.dataset.color);
      closeModal();
    });
  }
  body.querySelectorAll("#note-menu-colors .sticky-color-swatch").forEach(wireColorSwatch);
  body.querySelector("#note-menu-convert").appendChild(
    buildConvertChoiceGrid((key) => {
      closeModal();
      convertWholeNote(note, key);
    })
  );
  openModal({ title: note.title || "📝 Post-it", body, actions: [{ label: "Fermer", variant: "ghost" }], onClose });

  // Complète la palette avec les couleurs débloquées (LOT G7) une fois l'état de gamification lu —
  // asynchrone car storage.get() ne peut pas être attendu avant l'ouverture du menu (le menu doit
  // rester réactif immédiatement). Sans effet si la modale a déjà été fermée entre-temps (le
  // conteneur n'existe alors plus dans le DOM détaché).
  gamificationApi.getGamificationState().then((state) => {
    const container = body.querySelector("#note-menu-colors");
    if (!container) return;
    for (const [color, deblocageId] of Object.entries(COULEURS_DEBLOCABLES)) {
      if (color === note.color) continue;
      if (!state.deblocagesAcquis[deblocageId]) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `chip sticky-color-swatch sticky-note--${color}`;
      btn.dataset.color = color;
      btn.setAttribute("aria-label", COLOR_LABELS[color]);
      btn.title = COLOR_LABELS[color];
      wireColorSwatch(btn);
      container.appendChild(btn);
    }
  });
}

/**
 * Conversion du post-it ENTIER — préremplit le formulaire cible avec le titre du post-it et son
 * contenu. Le post-it source est ARCHIVÉ (pas supprimé) une fois la fiche cible créée — jamais
 * perdu, retrouvable dans "🗄️ Post-it archivés" (Règle 3 de l'app : "ne jamais perdre une
 * capture").
 */
async function convertWholeNote(note, key) {
  const title = note.title || "Post-it";
  const text = stickyNotesApi.stickyNoteToText(note);
  const afterCreate = () => stickyNotesApi.setArchived(note.id, true);
  if (key === "task") {
    openCreateTaskModal({ title, description: text, createdToast: "Tâche créée", onCreated: afterCreate });
  } else if (key === "followup") {
    const people = await peopleApi.listAll();
    if (!people.length) {
      showToast("Ajoute d'abord une personne dans l'onglet Équipe pour créer un suivi");
      return;
    }
    openCreateFollowUpModal({ defaultTitle: title, defaultDescription: text, onCreated: afterCreate });
  } else if (key === "resource") {
    openCreateResourceModal({ title, description: text, onCreated: afterCreate });
  } else if (key === "decision") {
    // Écart assumé (pas de champ "description" générique côté Décision) : le contenu du post-it
    // part dans "Contexte", "Ce qui a été décidé" reste vide.
    openCreateDecisionModal({ title, context: text, onCreated: afterCreate });
  } else if (key === "kept") {
    await convertToInformation(title, text, afterCreate);
  }
}

/**
 * Conversion d'une SEULE ligne de checklist — seule cette ligne alimente le formulaire, le reste
 * de la checklist n'est jamais touché tant que la fiche n'est pas créée ; une fois créée, SEULE
 * cette ligne est retirée (jamais tout le post-it).
 */
function openLineConvertModal(note, item, { onClose } = {}) {
  const body = document.createElement("div");
  body.appendChild(
    buildConvertChoiceGrid((key) => {
      closeModal();
      convertLine(note, item, key);
    })
  );
  openModal({ title: "Créer depuis cette ligne", body, actions: [{ label: "Annuler", variant: "ghost" }], onClose });
}

async function convertLine(note, item, key) {
  const text = item.text;
  const afterCreate = () => stickyNotesApi.removeChecklistItem(note.id, item.id);
  if (key === "task") {
    openCreateTaskModal({ title: text, createdToast: "Tâche créée", onCreated: afterCreate });
  } else if (key === "followup") {
    const people = await peopleApi.listAll();
    if (!people.length) {
      showToast("Ajoute d'abord une personne dans l'onglet Équipe pour créer un suivi");
      return;
    }
    openCreateFollowUpModal({ defaultTitle: text, onCreated: afterCreate });
  } else if (key === "resource") {
    openCreateResourceModal({ title: text, onCreated: afterCreate });
  } else if (key === "decision") {
    openCreateDecisionModal({ title: text, onCreated: afterCreate });
  } else if (key === "kept") {
    await convertToInformation(text, "", afterCreate);
  }
}

/**
 * "Information" n'a jamais de formulaire de création dédié nulle part dans l'app (une
 * Information/Idée est structurellement un InboxItem qualifié "kept") — capture directe puis
 * qualification immédiate, la fiche complète s'ouvre ensuite plutôt qu'un simple toast.
 */
async function convertToInformation(title, text, afterCreate) {
  const content = text && text.trim() ? text : title;
  const item = await inboxApi.capture(content, "post-it");
  await inboxApi.qualify(item.id, "kept");
  await afterCreate();
  openKeptItemDetail({ ...item, status: "kept", keptAsType: "kept" });
}

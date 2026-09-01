// Casquettes — piste UX du 31/08/2026 (retour de Charles-Henri : "c'est à l'image de moi,
// j'ai tellement de casquettes que je ne sais plus comment m'y retrouver"). Cinq casquettes
// réelles décrites par Charles-Henri : lui-même, son équipe de dev, ses projets transverses
// (ex. Modernisation avec la marketing), sa relation à son propre manager, le CSE — reprises
// telles quelles du guide utilisateur (js/views/guide.js) pour ne jamais avoir deux
// vocabulaires différents dans l'app.
//
// Volontairement PAS un nouveau champ à saisir sur chaque Tâche/Suivi/Réunion/Décision :
// la casquette se DÉDUIT de ce qui existe déjà (projet lié, type de la personne visée) —
// cohérent avec le principe du cahier des charges "le moins de saisie possible, mais juste
// assez de structure". Si un jour la déduction s'avère insuffisante (ex. un item "Toi" qui
// devrait pouvoir être rattaché à une casquette sans projet), un champ explicite pourra
// s'ajouter — mais ça n'a pas semblé nécessaire pour ce premier chantier.

export const HATS = [
  { id: "toi", icon: "🧑‍💻", label: "Toi" },
  { id: "equipe", icon: "👥", label: "Équipe" },
  { id: "projets", icon: "📦", label: "Projets" },
  { id: "manager", icon: "👔", label: "Manager" },
  { id: "cse", icon: "🏛️", label: "CSE" },
];

export const HAT_BY_ID = Object.fromEntries(HATS.map((h) => [h.id, h]));

/**
 * Casquette d'un Projet lui-même : un projet de catégorie contenant "CSE" (insensible à la
 * casse — la catégorie est un texte libre, voir js/domain/preferences.js) devient la
 * casquette CSE ; toute autre catégorie, ou aucune, reste "Projets" — un projet est par
 * nature transverse, jamais "Toi" tout seul.
 */
export function projectHat(project) {
  if (!project) return "projets";
  const cat = (project.category || "").toLowerCase();
  if (cat.includes("cse")) return "cse";
  return "projets";
}

/**
 * Casquette d'une Tâche : une Tâche n'a jamais d'assignee (§ toujours "ce que MOI je dois
 * faire", voir js/domain/tasks.js) — seul le projet auquel elle est rattachée peut la faire
 * sortir de "Toi".
 */
export function taskHat(task, projectsById) {
  if (!task.projectId) return "toi";
  return projectHat(projectsById.get(task.projectId));
}

/**
 * Casquette d'un Suivi : d'abord le projet s'il y en a un (ex. "j'attends la marketing sur
 * Modernisation"), sinon le type de la personne visée — manager vs collaborateur, la même
 * distinction déjà utilisée par js/views/management.js pour router les sujets à remonter.
 */
export function followUpHat(followUp, projectsById, peopleById) {
  if (followUp.projectId) return projectHat(projectsById.get(followUp.projectId));
  const person = peopleById.get(followUp.personId);
  return person?.type === "manager" ? "manager" : "equipe";
}

/**
 * Casquette d'une Réunion ou d'une Décision : uniquement le projet lié, sinon "Toi" — une
 * décision ou une réunion qu'on garde pour soi sans la rattacher à un projet reste une affaire
 * personnelle plutôt que transverse.
 */
export function itemHat(item, projectsById) {
  if (!item.projectId) return "toi";
  return projectHat(projectsById.get(item.projectId));
}

/**
 * Bandeau de chips "Toutes / Toi / Équipe / Projets / Manager / CSE", réutilisé identique sur
 * l'Accueil et Pilotage (retour de Charles-Henri : le même filtre doit se retrouver partout,
 * pas une logique par écran). `activeId` = "all" ou un id de HATS.
 *
 * `onlyIds` (optionnel, retour de Charles-Henri, 02/09/2026 : "je comprend pas trop le filtre
 * équipe/toi/projets/manager" dans Pilotage) restreint les chips affichées à ce sous-ensemble.
 * Pilotage ne montre jamais que des Tâches, et `taskHat()` ci-dessus ne peut renvoyer que
 * "toi"/"projets"/"cse" (une Tâche n'a pas d'assignee, donc jamais "equipe" ni "manager") —
 * afficher ces deux chips-là dans Pilotage n'aboutissait qu'à un board vide et confus au clic.
 * L'Accueil, qui agrège aussi des Suivis (via `followUpHat()`, qui lui peut renvoyer ces deux
 * valeurs), continue d'afficher les 6 chips en omettant ce paramètre.
 */
export function renderHatChipRow(container, activeId, onSelect, onlyIds = null) {
  const hats = onlyIds ? HATS.filter((h) => onlyIds.includes(h.id)) : HATS;
  container.innerHTML =
    `<button type="button" class="chip${activeId === "all" ? " active" : ""}" data-hat="all">Toutes</button>` +
    hats.map(
      (h) => `<button type="button" class="chip${activeId === h.id ? " active" : ""}" data-hat="${h.id}">${h.icon} ${h.label}</button>`
    ).join("");
  container.querySelectorAll("[data-hat]").forEach((chip) => {
    chip.addEventListener("click", () => onSelect(chip.dataset.hat));
  });
}

// Petite aide "à la demande" (retour de Charles-Henri, 01/09/2026 : "il faudrait presque une
// petite aide pour chaque fonction accessible discrètement") — pour les mécanismes moins
// évidents au premier coup d'œil (canevas piloté par données, revue hebdomadaire...).
//
// Différent du bandeau d'aide au premier usage (js/components/hint.js, qui disparaît pour
// toujours une fois fermé) : ici rien n'est mémorisé, l'aide reste disponible en permanence,
// puisque certaines fonctions restent bonnes à rappeler même après la première fois.
//
// Un simple <details> inline plutôt qu'une vraie modale : ce composant s'utilise aussi À
// L'INTÉRIEUR d'une fiche déjà ouverte (ex. le canevas dans la fiche Tâche/Projet/Réunion) —
// ouvrir une modale par-dessus fermerait cette fiche (une seule modale à la fois, voir
// components/modal.js) et ferait perdre une saisie non enregistrée.
export function renderInfoTip(container, html) {
  const details = document.createElement("details");
  details.className = "info-tip";
  details.innerHTML = `<summary aria-label="Aide">ⓘ</summary><div class="info-tip-body">${html}</div>`;
  container.appendChild(details);
  return details;
}

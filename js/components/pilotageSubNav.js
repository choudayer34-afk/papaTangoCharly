// Sous-navigation de l'écran "Pilotage" (vague 24, retour de Charles-Henri : regrouper Tâches,
// Projets et Calendrier sous un seul onglet "Pilotage" de la barre du bas plutôt que 3 icônes
// séparées — voir claude/vague-24-declins-fiches-navigation.md, "Piste 2" appliquée à
// l'intérieur de "Piste 1" pour ramener la barre de 8 à 5 icônes). Les routes elles-mêmes
// (#/kanban, #/projects, #/calendar) ne changent pas : ce composant n'est qu'une rangée de
// pastilles au-dessus de chacun des 3 écrans pour passer de l'un à l'autre sans repasser par la
// barre du bas — aucun lien profond ni filtre propre à un de ces écrans n'est affecté.
//
// Rail segmenté façon "Réglages iPhone" (audit du 07/09/2026, retour de Charles-Henri : "on
// s'y perd un peu" entre le choix d'écran et les filtres/vues juste en dessous) — réutilise
// `.fiche-tabs`, le même style déjà posé sur les onglets Détails/Sous-étapes/Activité d'une
// fiche (styles/components.css), plutôt qu'une classe dédiée : ce rail n'était jusqu'ici qu'une
// `.chip-row` ordinaire, visuellement indiscernable d'une rangée de filtres. `pilotage-subnav`
// reste sur le conteneur pour tout hook futur, mais ne porte plus aucun style à elle seule.
const ITEMS = [
  { hash: "#/kanban", label: "📋 Tâches" },
  { hash: "#/projects", label: "📦 Projets" },
  { hash: "#/calendar", label: "📅 Calendrier" },
  // "🎯 Priorisation" (vague 33, retour de Charles-Henri, 07/09/2026 : "on pourra commencer
  // après par le premier sujet" — matrice de priorisation. Choix explicite d'un nouvel onglet
  // ICI, dans le rail déjà existant, plutôt qu'une icône de barre du bas supplémentaire (vague
  // 24) ou une route sous ☰ Plus — vue js/views/priorisation.js) : c'est un classement du MÊME
  // flux de Tâches que 📋 Tâches/📦 Projets, pas un écran de référence consulté ponctuellement.
  { hash: "#/priorisation", label: "🎯 Priorisation" },
];

/** `activeHash` : le hash de l'écran actuellement affiché (ex. "#/kanban"), pour surligner le
 *  bon chip — comparaison exacte, pas de préfixe, les 3 hash étant fixes et connus. */
export function renderPilotageSubNav(container, activeHash) {
  container.innerHTML = `
    <div class="fiche-tabs pilotage-subnav" role="tablist">
      ${ITEMS.map(
        (item) => `<a href="${item.hash}" class="chip${item.hash === activeHash ? " active" : ""}" role="tab">${item.label}</a>`
      ).join("")}
    </div>
  `;
}

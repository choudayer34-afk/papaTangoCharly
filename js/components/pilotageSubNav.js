// Sous-navigation de l'écran "Pilotage" (vague 24, retour de Charles-Henri : regrouper Tâches,
// Projets et Calendrier sous un seul onglet "Pilotage" de la barre du bas plutôt que 3 icônes
// séparées — voir claude/vague-24-declins-fiches-navigation.md, "Piste 2" appliquée à
// l'intérieur de "Piste 1" pour ramener la barre de 8 à 5 icônes). Les routes elles-mêmes
// (#/kanban, #/projects, #/calendar) ne changent pas : ce composant n'est qu'une rangée de
// pastilles au-dessus de chacun des 3 écrans pour passer de l'un à l'autre sans repasser par la
// barre du bas — aucun lien profond ni filtre propre à un de ces écrans n'est affecté.

const ITEMS = [
  { hash: "#/kanban", label: "📋 Tâches" },
  { hash: "#/projects", label: "📦 Projets" },
  { hash: "#/calendar", label: "📅 Calendrier" },
];

/** `activeHash` : le hash de l'écran actuellement affiché (ex. "#/kanban"), pour surligner le
 *  bon chip — comparaison exacte, pas de préfixe, les 3 hash étant fixes et connus. */
export function renderPilotageSubNav(container, activeHash) {
  container.innerHTML = `
    <div class="chip-row pilotage-subnav">
      ${ITEMS.map(
        (item) => `<a href="${item.hash}" class="chip${item.hash === activeHash ? " active" : ""}">${item.label}</a>`
      ).join("")}
    </div>
  `;
}

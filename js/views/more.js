// "☰ Plus" — vague 24 (retour de Charles-Henri, base pour la demande : "je trouve que dans les
// fiches c'est un peu fourre-tout... propose-moi 3 autres organisations... base-toi sur les
// standards du web et mobile"). La barre du bas comptait 8 icônes, au-delà de ce que
// recommandent Material Design (3 à 5 destinations) et Apple HIG (bascule vers un onglet
// "Plus" au-delà d'environ 5) — voir claude/vague-24-declins-fiches-navigation.md, section 2 et
// section 7 pour l'organisation exacte choisie avec Charles-Henri.
//
// Regroupe tout ce qui ne rentre plus dans les 5 icônes directes (Accueil/Inbox/Pilotage/
// Équipe/Plus) : Ressources et Prompts (qui avaient chacun leur propre icône avant cette
// vague), plus Guide/Nouveautés/Mémoire & TDAH — décision explicite de Charles-Henri d'en faire
// un vrai écran "tout le reste" plutôt que de les laisser dans ❓ Aide / le bouton de l'Accueil.
// Aucune de ces 5 routes ne change (#/resources, #/prompts, #/guide, #/whatsnew, #/memory) :
// ce module ne fait que les lister, exactement comme js/views/whatsnew.js liste des entrées
// statiques plutôt que d'incarner lui-même une logique métier.

const ITEMS = [
  { hash: "#/resources", emoji: "📎", title: "Ressources", subtitle: "Bibliothèque de liens et documents, sans duplication" },
  { hash: "#/prompts", emoji: "🤖", title: "Prompts", subtitle: "Bibliothèque de prompts IA, copiables en un clic" },
  { hash: "#/guide", emoji: "📖", title: "Guide", subtitle: "Le mode d'emploi complet, casquette par casquette — hors ligne" },
  { hash: "#/whatsnew", emoji: "🆕", title: "Nouveautés", subtitle: "Ce qui a été ajouté à l'app, du plus récent au plus ancien" },
  { hash: "#/memory", emoji: "🧠", title: "Mémoire & TDAH", subtitle: "Pause mémoire : jeu des paires, respiration, séquence, Pomodoro" },
];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function renderMore(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>☰ Plus</h1>
        <div class="subtitle">Tout ce qui ne rentre pas dans les 4 autres onglets</div>
      </div>
    </div>
    <div class="view">
      <div class="card" id="more-list"></div>
    </div>
  `;

  const listEl = container.querySelector("#more-list");
  listEl.innerHTML = ITEMS.map(
    (item, i) => `
    <a class="item-row" href="${item.hash}" style="text-decoration:none;color:inherit;${i === ITEMS.length - 1 ? "border-bottom:none;" : ""}">
      <div style="font-size:1.4rem;line-height:1;">${item.emoji}</div>
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.subtitle)}</div>
      </div>
    </a>
  `
  ).join("");
}

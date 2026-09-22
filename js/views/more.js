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
//
// Repère "Nouveau" sur la ligne Nouveautés (audit TDAH ciblé du 07/09/2026, retour de
// Charles-Henri : "il faut qu'on sache que c'est une nouveauté... guider où aller pour voir la
// note de mise à jour") — la pastille de js/components/whatsNewBadge.js signale déjà, sur
// l'onglet ☰ Plus lui-même, qu'il y a du nouveau ; ce repère, une fois DANS l'écran Plus, dit
// PRÉCISÉMENT quelle ligne regarder plutôt que de laisser deviner parmi les 5.

import * as preferencesApi from "../domain/preferences.js";
import { WHATS_NEW_TOTAL_COUNT } from "./whatsnew.js";

// USE-UX-022 (LOT 9, "Plus" (☰) sans lien thématique lisible") : les 5 lignes étaient une liste
// plate, sans logique visible entre elles (retour de l'audit : on ne devine pas pourquoi Guide
// et Ressources sont à la suite l'un de l'autre). Regroupement par intention retenu tel quel par
// l'audit — "Aide" (Guide+Nouveautés), "Bibliothèques" (Ressources+Prompts), "Pause" (Mémoire) —
// via `group`, affiché avec `.section-title` (même style que les sous-sections d'une fiche
// Projet/Personne, voir js/views/projects.js et js/views/people.js). Aucune route ni aucun
// libellé/sous-titre de ligne ne change : seul l'agencement visuel évolue.
const ITEMS = [
  { hash: "#/guide", emoji: "📖", title: "Guide", subtitle: "Le mode d'emploi complet, casquette par casquette — hors ligne", group: "Aide" },
  { hash: "#/whatsnew", emoji: "🆕", title: "Nouveautés", subtitle: "Ce qui a été ajouté à l'app, du plus récent au plus ancien", group: "Aide" },
  { hash: "#/resources", emoji: "📎", title: "Ressources", subtitle: "Bibliothèque de liens et documents, sans duplication", group: "Bibliothèques" },
  { hash: "#/prompts", emoji: "🤖", title: "Prompts", subtitle: "Bibliothèque de prompts IA, copiables en un clic", group: "Bibliothèques" },
  { hash: "#/memory", emoji: "🧠", title: "Mémoire & TDAH", subtitle: "Pause mémoire : jeu des paires, respiration, séquence, Pomodoro", group: "Pause" },
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
  listEl.innerHTML = ITEMS.map((item, i) => {
    const isFirstOfGroup = i === 0 || ITEMS[i - 1].group !== item.group;
    const isLastRow = i === ITEMS.length - 1;
    const heading = isFirstOfGroup
      ? `<div class="section-title"${i === 0 ? ' style="margin-top:0;"' : ""}>${escapeHtml(item.group)}</div>`
      : "";
    return `
    ${heading}
    <a class="item-row" href="${item.hash}" style="text-decoration:none;color:inherit;${isLastRow ? "border-bottom:none;" : ""}">
      <div style="font-size:1.4rem;line-height:1;">${item.emoji}</div>
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.title)}${item.hash === "#/whatsnew" ? '<span id="more-whatsnew-flag"></span>' : ""}</div>
        <div class="item-meta">${escapeHtml(item.subtitle)}</div>
      </div>
    </a>
  `;
  }).join("");

  preferencesApi.getPreferences().then((prefs) => {
    const unseen = WHATS_NEW_TOTAL_COUNT - (prefs.seenWhatsNewCount || 0);
    const flag = listEl.querySelector("#more-whatsnew-flag");
    if (unseen > 0 && flag) {
      flag.innerHTML = ` <span class="badge" style="background:var(--color-danger);color:var(--color-text-inverse);">Nouveau${unseen > 1 ? " (" + unseen + ")" : ""}</span>`;
    }
  });
}

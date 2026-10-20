// Lien de partage vers une fiche précise (retour de Charles-Henri, vague 23) : « pour chaque
// projet, tâche, suivi, information, décision, idée, réunion, personnes, je dois disposer d'un
// lien que je peux copier et mettre dans une conversation Teams par exemple pour accéder à
// l'élément en cliquant dessus. »
//
// Rien de neuf à construire côté résolution : le format de lien profond (js/services/
// deeplink.js#buildDeepLink) et son résolveur existaient déjà, utilisés jusqu'ici uniquement
// pour le lien inséré dans le .ics d'une réunion (js/components/meetingLauncher.js). Ce
// résolveur (js/components/linkedItems.js#resolveRef, appelé par js/app.js#maybeOpenDeepLink
// après CHAQUE rendu de route, quel que soit l'onglet visé par le lien) sait déjà rouvrir les 8
// types de fiches liables — y compris une Information/Idée (type "Kept", distinguées par
// `keptAsType` dans resolveRef). Ce module ajoute seulement le geste "copier ce lien dans le
// presse-papiers", identique pour les 8 fiches plutôt que dupliqué fiche par fiche.
//
// `routeHash` = l'onglet où la fiche vit normalement (`#/kanban`, `#/people`...) — purement
// cosmétique dans l'URL copiée (un lien plus lisible/prévisible si on le relit), puisque
// `maybeOpenDeepLink` résout la fiche visée quel que soit l'onglet réellement rendu.

//
// Modes discrets (retour de Charles-Henri, 20/10/2026) : glisser un lien dans une conversation
// sans que les autres le remarquent, et retrouver la fiche quand on répond. Le geste ouvre une
// petite palette flottante (jamais une modale : la fiche d'origine reste ouverte, une seule
// modale à la fois étant permise) avec trois choix :
//   - code discret « réf. 3adb08 » : survit à tous les canaux et reste dans les citations ; se
//     colle ensuite dans 🔎 (js/components/search.js#extractReference) ;
//   - point cliquable : texte enrichi dont le seul caractère visible est un point porteur du lien
//     (repli en texte brut = le code discret, jamais le lien en clair) ;
//   - lien complet : le comportement d'origine.
import { buildDeepLink } from "../services/deeplink.js";
import { showToast } from "./toast.js";

// Caractère visible du lien masqué — un point médian, facile à changer ici.
const ANCHOR_TEXT = "·";

/** Code court d'une fiche : les 6 premiers caractères de son identifiant (UUID). */
export function entityCode(id) {
  return String(id).replace(/^id-/, "").slice(0, 6).toLowerCase();
}

function discreetText(id) {
  return `réf. ${entityCode(id)}`;
}

async function copyPlain(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(toast);
  } catch {
    window.prompt("Copie ce texte :", text);
  }
}

async function copyMaskedLink(link, id) {
  const fallback = discreetText(id);
  try {
    const html = `<a href="${link}">${ANCHOR_TEXT}</a>`;
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([fallback], { type: "text/plain" }),
      }),
    ]);
    showToast("🤫 Point cliquable copié");
  } catch {
    // Texte enrichi indisponible : on se replie sur le code discret.
    await copyPlain(fallback, "🤫 Code copié (texte enrichi indisponible)");
  }
}

function closePalette() {
  document.querySelector(".copy-link-palette")?.remove();
  document.removeEventListener("keydown", onEscape, true);
}

function onEscape(e) {
  if (e.key === "Escape") {
    e.stopPropagation();
    closePalette();
  }
}

/**
 * Propose les trois façons de copier la référence d'une fiche. `routeHash` = l'onglet où la
 * fiche vit normalement (`#/kanban`, `#/people`...), purement cosmétique dans l'URL copiée.
 * Ne dispense pas d'être une personne autorisée (`allowedUsers`, voir js/services/firebase.js).
 */
export function copyEntityLink(routeHash, type, id) {
  closePalette();
  const link = buildDeepLink(routeHash, type, id);

  const palette = document.createElement("div");
  palette.className = "copy-link-palette";
  palette.setAttribute("role", "menu");
  palette.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:200;" +
    "display:flex;flex-direction:column;gap:8px;min-width:240px;max-width:92vw;padding:12px;" +
    "background:var(--color-surface);border:1px solid var(--color-border);" +
    "border-radius:var(--radius-md);box-shadow:var(--shadow-md);font-family:var(--font-family);";

  const choices = [
    { label: `🤫 Code discret (${discreetText(id)})`, run: () => copyPlain(discreetText(id), "🤫 Code copié") },
    { label: `🤫 Point cliquable (${ANCHOR_TEXT})`, run: () => copyMaskedLink(link, id) },
    { label: "🔗 Lien complet", run: () => copyPlain(link, "🔗 Lien copié") },
  ];
  for (const choice of choices) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary btn-sm";
    btn.textContent = choice.label;
    btn.addEventListener("click", async () => {
      closePalette();
      await choice.run();
    });
    palette.appendChild(btn);
  }
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost btn-sm";
  cancel.textContent = "Annuler";
  cancel.addEventListener("click", closePalette);
  palette.appendChild(cancel);

  document.body.appendChild(palette);
  document.addEventListener("keydown", onEscape, true);
}

// Aide contextuelle au premier usage — piste UX du 31/08/2026 (retour de Charles-Henri :
// "je sais plus trop comment faire le suivi ou à quoi sert chaque onglet seul à seul").
// Complète le guide statique (js/views/guide.js, consulté ponctuellement) sans avoir à le
// rouvrir : un bandeau discret s'affiche la première fois qu'un écran ou un formulaire
// ambigu est ouvert, puis ne revient plus une fois fermé — mémorisé via
// js/domain/preferences.js, même principe que la visite guidée (js/components/onboarding.js).
// Jamais une modale : ça n'interrompt rien, ça se ferme d'un clic et ça ne bloque aucune saisie.

import * as preferencesApi from "../domain/preferences.js";

/**
 * Insère un bandeau en tête de `container`, une seule fois par `key`. `html` peut contenir du
 * balisage simple (gras) — appelant·e responsable de l'échapper si besoin, ces messages sont
 * tous écrits en dur dans le code, jamais depuis une saisie utilisateur.
 */
export async function showHintOnce(container, key, html) {
  if (!container) return;
  const prefs = await preferencesApi.getPreferences();
  if (prefs.seenHints?.[key]) return;

  const hint = document.createElement("div");
  hint.className = "hint-banner";
  hint.innerHTML = `
    <span class="hint-banner-icon">💡</span>
    <span class="hint-banner-text">${html}</span>
    <button type="button" class="hint-banner-close" aria-label="Fermer ce conseil">✕</button>
  `;
  hint.querySelector(".hint-banner-close").addEventListener("click", async () => {
    hint.remove();
    await preferencesApi.markHintSeen(key);
  });
  container.prepend(hint);
}

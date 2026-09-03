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

import { buildDeepLink } from "../services/deeplink.js";
import { showToast } from "./toast.js";

/**
 * Copie dans le presse-papiers un lien qui rouvre directement cette fiche — collé dans une
 * conversation Teams (ou tout autre canal texte), cliquer dessus ouvre Pilotage sur cette fiche
 * précise. Ne dispense pas d'être une personne autorisée (`allowedUsers`, voir js/services/
 * firebase.js) : le lien pointe vers CETTE instance de l'app, pas vers les données elles-mêmes.
 */
export async function copyEntityLink(routeHash, type, id) {
  const link = buildDeepLink(routeHash, type, id);
  try {
    await navigator.clipboard.writeText(link);
    showToast("🔗 Lien copié");
  } catch {
    // Presse-papiers indisponible (permission refusée, contexte non sécurisé...) : on affiche
    // quand même le lien pour un copier-coller manuel plutôt que de rester silencieux.
    window.prompt("Copie ce lien :", link);
  }
}

// Aide de test partagée (LOT 0B, TODO-002) — dès la toute première connexion d'un compte,
// l'app ouvre automatiquement deux modales successives, sans lien avec le parcours testé :
// js/app.js#maybeShowUsageNotice ("ℹ️ Suivi d'usage") puis, juste après (chaînée via
// `.then()`), js/components/onboarding.js#maybeShowFirstRunTour (visite guidée, 6 étapes).
//
// Trouvé lors du 4e passage réel du workflow GitHub Actions (21/09/2026) : les comptes de test
// créés par e2e/global-setup.js sont neufs à chaque exécution (préférences vidées avec le reste
// de l'émulateur), donc `seenUsageNotice`/`seenTour` sont toujours faux — ces deux modales
// apparaissent donc systématiquement après connexion et, jamais fermées explicitement par les
// tests, bloquaient (`.modal-overlay` intercepte tous les clics) l'étape suivante du parcours
// testé. N'importe aucun fichier applicatif : se contente de fermer, si elles apparaissent, deux
// modales déjà prévues par l'app elle-même (bouton "J'ai compris", bouton "Passer" — voir
// js/app.js et js/components/onboarding.js).
export async function dismissFirstRunModals(page) {
  const usageNoticeBtn = page.getByRole("button", { name: "J'ai compris" });
  const sawUsageNotice = await usageNoticeBtn
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (sawUsageNotice) await usageNoticeBtn.click();

  const skipTourBtn = page.getByRole("button", { name: "Passer" });
  const sawTour = await skipTourBtn
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (sawTour) await skipTourBtn.click();
}

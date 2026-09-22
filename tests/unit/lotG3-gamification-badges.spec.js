// LOT G3 (TODO_GAMIFICATION.md, badges permanents, 25/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md, voir l'en-tête de TODO_GAMIFICATION.md) : vérifie le moteur de badges ajouté
// à js/domain/gamification.js (catalogue `BADGES`, helpers `compterParPrefixe`/
// `marquerEvenementCompte`/`awardBadgeOnce`/`evaluerFamille`) ainsi que les trois nouveaux points
// d'écoute câblés par ce lot : js/domain/links.js#createLink (famille Collaboration),
// js/domain/stickyNotes.js#createStickyNote (famille Organisation) et
// js/domain/objectives.js#createObjective (famille Management). Même harnais que le reste de ce
// dossier (tests/support/harness.html, émulateur Firebase).
//
// PARTICULARITÉ DE CE FICHIER PAR RAPPORT À lotG1-gamification-xp-engine.spec.js : les badges ne
// se "réinitialisent" jamais (§5.1, "les badges permanents ne se réinitialisent jamais") et leurs
// compteurs (`compterParPrefixe`, ou le nombre de collaborateurs distincts pour Management) sont
// des valeurs CUMULATIVES sur tout le compte de test partagé, jamais des deltas — contrairement à
// l'XP brut testé par LOT G1. Un badge Bronze (seuil 1, le plus bas de chaque famille active) peut
// donc déjà avoir été attribué par une exécution précédente de ce même fichier, ou par
// l'accumulation naturelle d'autres fichiers de ce dossier qui créent des Tâches/Réunions/
// Décisions/etc. Chaque test ci-dessous lit donc l'état AVANT d'agir et distingue explicitement
// deux cas : badge pas encore obtenu (l'action de ce test doit le créditer, XP de badge inclus) ou
// badge déjà obtenu (l'action de ce test ne doit RIEN recréditer, et l'horodatage dans
// `badgesObtained` doit rester strictement identique à celui lu avant — c'est la preuve qu'aucun
// second crédit n'a eu lieu, plutôt que de supposer un compte vierge).
//
// Seuils Bronze uniquement testés par une action réelle : les seuils Argent/Or/Platine/Légendaire
// des familles à compteur (jusqu'à 600 pour Inbox, 500 pour Productivité) ne sont PAS déclenchés
// ici par des centaines de créations automatisées — ce serait long, coûteux, et n'exercerait
// aucune logique différente de celle déjà vérifiée pour Bronze (`evaluerFamille` applique
// exactement la même boucle quel que soit le seuil). Le dernier test de ce fichier ("Cohérence
// globale") compense cette limite : il vérifie, sur les valeurs RÉELLEMENT déjà accumulées par le
// compte de test (quelles qu'elles soient), que chaque seuil déjà franchi — Bronze comme
// Légendaire — correspond bien à un badge obtenu, sans avoir besoin de fabriquer les seuils hauts.
//
// AVERTISSEMENT (25/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js, js/domain/links.js, js/domain/stickyNotes.js et js/domain/objectives.js, mais
// JAMAIS EXÉCUTÉ dans cet environnement (registre npm/émulateur Firebase indisponibles ici, voir
// tests/README.md) — à lancer réellement via `npm run test:e2e` (GitHub Actions ou poste de
// Charles-Henri) avant d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

// Catalogue des 60 badges ACTIFS (12 familles × 5 raretés) de TODO_GAMIFICATION.md §5.1, transcrit
// depuis js/domain/gamification.js#BADGES pour un contrôle indépendant. Régularité et
// Documentation (10 badges restants du catalogue complet de 70) sont volontairement ABSENTS
// ci-dessous : ces deux familles sont différées dans ce lot (arbitrage AskUserQuestion du
// 25/09/2026, voir le commentaire sur `BADGES` dans gamification.js) et `evaluerFamille()` n'est
// jamais appelée pour elles — les inclure ici ferait échouer le test de cohérence dès qu'un compte
// de test dépasserait leurs seuils sans jamais pouvoir obtenir ces badges, ce qui est le
// comportement ATTENDU de ce lot, pas une anomalie.
const BADGES_ACTIFS = [
  { id: "productivite-1-tache", famille: "productivite", seuil: 1, xp: 5 },
  { id: "productivite-25-taches", famille: "productivite", seuil: 25, xp: 15 },
  { id: "productivite-100-taches", famille: "productivite", seuil: 100, xp: 40 },
  { id: "productivite-250-taches", famille: "productivite", seuil: 250, xp: 100 },
  { id: "productivite-500-taches", famille: "productivite", seuil: 500, xp: 250 },

  { id: "delivery-1-projet", famille: "delivery", seuil: 1, xp: 5 },
  { id: "delivery-5-projets", famille: "delivery", seuil: 5, xp: 15 },
  { id: "delivery-15-projets", famille: "delivery", seuil: 15, xp: 40 },
  { id: "delivery-30-projets", famille: "delivery", seuil: 30, xp: 100 },
  { id: "delivery-60-projets", famille: "delivery", seuil: 60, xp: 250 },

  { id: "collaboration-1-lien", famille: "collaboration", seuil: 1, xp: 5 },
  { id: "collaboration-25-liens", famille: "collaboration", seuil: 25, xp: 15 },
  { id: "collaboration-75-liens", famille: "collaboration", seuil: 75, xp: 40 },
  { id: "collaboration-150-liens", famille: "collaboration", seuil: 150, xp: 100 },
  { id: "collaboration-300-liens", famille: "collaboration", seuil: 300, xp: 250 },

  { id: "management-1-collaborateur", famille: "management", seuil: 1, xp: 5 },
  { id: "management-3-collaborateurs", famille: "management", seuil: 3, xp: 15 },
  { id: "management-6-collaborateurs", famille: "management", seuil: 6, xp: 40 },
  { id: "management-10-collaborateurs", famille: "management", seuil: 10, xp: 100 },
  { id: "management-15-collaborateurs", famille: "management", seuil: 15, xp: 250 },

  { id: "objectifs-1-revue", famille: "objectifs", seuil: 1, xp: 5 },
  { id: "objectifs-10-revues", famille: "objectifs", seuil: 10, xp: 15 },
  { id: "objectifs-25-revues", famille: "objectifs", seuil: 25, xp: 40 },
  { id: "objectifs-50-revues", famille: "objectifs", seuil: 50, xp: 100 },
  { id: "objectifs-100-revues", famille: "objectifs", seuil: 100, xp: 250 },

  { id: "organisation-1-postit", famille: "organisation", seuil: 1, xp: 5 },
  { id: "organisation-25-postits", famille: "organisation", seuil: 25, xp: 15 },
  { id: "organisation-75-postits", famille: "organisation", seuil: 75, xp: 40 },
  { id: "organisation-150-postits", famille: "organisation", seuil: 150, xp: 100 },
  { id: "organisation-300-postits", famille: "organisation", seuil: 300, xp: 250 },

  { id: "decisions-1-decision", famille: "decisions", seuil: 1, xp: 5 },
  { id: "decisions-10-decisions", famille: "decisions", seuil: 10, xp: 15 },
  { id: "decisions-25-decisions", famille: "decisions", seuil: 25, xp: 40 },
  { id: "decisions-50-decisions", famille: "decisions", seuil: 50, xp: 100 },
  { id: "decisions-100-decisions", famille: "decisions", seuil: 100, xp: 250 },

  { id: "reunions-1-reunion", famille: "reunions", seuil: 1, xp: 5 },
  { id: "reunions-25-reunions", famille: "reunions", seuil: 25, xp: 15 },
  { id: "reunions-60-reunions", famille: "reunions", seuil: 60, xp: 40 },
  { id: "reunions-120-reunions", famille: "reunions", seuil: 120, xp: 100 },
  { id: "reunions-250-reunions", famille: "reunions", seuil: 250, xp: 250 },

  { id: "inbox-1-qualification", famille: "inbox", seuil: 1, xp: 5 },
  { id: "inbox-50-qualifications", famille: "inbox", seuil: 50, xp: 15 },
  { id: "inbox-150-qualifications", famille: "inbox", seuil: 150, xp: 40 },
  { id: "inbox-300-qualifications", famille: "inbox", seuil: 300, xp: 100 },
  { id: "inbox-600-qualifications", famille: "inbox", seuil: 600, xp: 250 },

  { id: "ressources-1-ressource", famille: "ressources", seuil: 1, xp: 5 },
  { id: "ressources-15-ressources", famille: "ressources", seuil: 15, xp: 15 },
  { id: "ressources-40-ressources", famille: "ressources", seuil: 40, xp: 40 },
  { id: "ressources-80-ressources", famille: "ressources", seuil: 80, xp: 100 },
  { id: "ressources-150-ressources", famille: "ressources", seuil: 150, xp: 250 },

  { id: "prompts-1-prompt", famille: "prompts", seuil: 1, xp: 5 },
  { id: "prompts-15-prompts", famille: "prompts", seuil: 15, xp: 15 },
  { id: "prompts-40-prompts", famille: "prompts", seuil: 40, xp: 40 },
  { id: "prompts-80-prompts", famille: "prompts", seuil: 80, xp: 100 },
  { id: "prompts-150-prompts", famille: "prompts", seuil: 150, xp: 250 },

  { id: "expert-500-xp", famille: "expert", seuil: 500, xp: 5 },
  { id: "expert-2000-xp", famille: "expert", seuil: 2000, xp: 15 },
  { id: "expert-5000-xp", famille: "expert", seuil: 5000, xp: 40 },
  { id: "expert-9000-xp", famille: "expert", seuil: 9000, xp: 100 },
  { id: "expert-15000-xp", famille: "expert", seuil: 15000, xp: 250 },
];

test.describe("LOT G3 — Badges permanents (TODO_GAMIFICATION.md §5.1), 12 familles actives sur 14", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Productivité (famille déjà instrumentée par LOT G1) : badge Bronze (1 Tâche terminée) attribué au plus une fois", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, gamificationApi } = window.__pilotageTestApi;
      const badgeId = "productivite-1-tache";

      const before = await gamificationApi.getGamificationState();
      const obtainedBefore = before.badgesObtained[badgeId] || null;

      const task = await tasksApi.createTask({ title: `Test LOT G3 — badge productivité ${Date.now()}` });
      await tasksApi.updateTask(task.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        obtainedBefore,
        obtainedAfter: after.badgesObtained[badgeId] || null,
        deltaXp: after.xpTotal - before.xpTotal,
      };
    });

    expect(result.obtainedAfter).not.toBeNull();
    if (result.obtainedBefore === null) {
      // Premier franchissement observé par ce test : +10 XP (Tâche terminée, §3) + 5 XP (bonus
      // du badge Bronze Productivité, §2.3/§5.1) crédités dans le même appel.
      expect(result.deltaXp).toBe(15);
    } else {
      // Badge déjà obtenu par une exécution précédente (compte de test cumulatif) : horodatage
      // inchangé, seule l'XP de base de la Tâche est créditée cette fois-ci.
      expect(result.obtainedAfter).toBe(result.obtainedBefore);
      expect(result.deltaXp).toBe(10);
    }
  });

  test("Décisions (famille déjà instrumentée par LOT G1) : badge Bronze (1 Décision créée) attribué au plus une fois", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { decisionsApi, gamificationApi } = window.__pilotageTestApi;
      const badgeId = "decisions-1-decision";

      const before = await gamificationApi.getGamificationState();
      const obtainedBefore = before.badgesObtained[badgeId] || null;

      await decisionsApi.createDecision({ title: `Test LOT G3 — badge décisions ${Date.now()}`, decision: "Décidé pour le test LOT G3" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        obtainedBefore,
        obtainedAfter: after.badgesObtained[badgeId] || null,
        deltaXp: after.xpTotal - before.xpTotal,
      };
    });

    expect(result.obtainedAfter).not.toBeNull();
    if (result.obtainedBefore === null) {
      expect(result.deltaXp).toBe(11); // 6 XP (Décision créée, §3) + 5 XP (badge Bronze)
    } else {
      expect(result.obtainedAfter).toBe(result.obtainedBefore);
      expect(result.deltaXp).toBe(6);
    }
  });

  test("Collaboration (NOUVEAU point d'écoute, js/domain/links.js#createLink) : badge Bronze (1 lien créé) attribué au plus une fois", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { linksApi, gamificationApi } = window.__pilotageTestApi;
      const badgeId = "collaboration-1-lien";

      const before = await gamificationApi.getGamificationState();
      const obtainedBefore = before.badgesObtained[badgeId] || null;

      await linksApi.createLink(
        { type: "Task", id: `fake-lotg3-a-${Date.now()}`, label: "Fiche A (test LOT G3)" },
        { type: "Task", id: `fake-lotg3-b-${Date.now()}`, label: "Fiche B (test LOT G3)" }
      );
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        obtainedBefore,
        obtainedAfter: after.badgesObtained[badgeId] || null,
        deltaXp: after.xpTotal - before.xpTotal,
      };
    });

    expect(result.obtainedAfter).not.toBeNull();
    if (result.obtainedBefore === null) {
      // Collaboration n'est pas une ligne du barème §3 : aucun XP de base, seul le bonus de
      // badge (5 XP, Bronze) est crédité au premier franchissement.
      expect(result.deltaXp).toBe(5);
    } else {
      expect(result.obtainedAfter).toBe(result.obtainedBefore);
      expect(result.deltaXp).toBe(0);
    }
  });

  test("Organisation (NOUVEAU point d'écoute, js/domain/stickyNotes.js#createStickyNote) : badge Bronze (1 post-it créé) attribué au plus une fois", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi, gamificationApi } = window.__pilotageTestApi;
      const badgeId = "organisation-1-postit";

      const before = await gamificationApi.getGamificationState();
      const obtainedBefore = before.badgesObtained[badgeId] || null;

      await stickyNotesApi.createStickyNote({ title: `Test LOT G3 — badge organisation ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        obtainedBefore,
        obtainedAfter: after.badgesObtained[badgeId] || null,
        deltaXp: after.xpTotal - before.xpTotal,
      };
    });

    expect(result.obtainedAfter).not.toBeNull();
    if (result.obtainedBefore === null) {
      expect(result.deltaXp).toBe(5);
    } else {
      expect(result.obtainedAfter).toBe(result.obtainedBefore);
      expect(result.deltaXp).toBe(0);
    }
  });

  test("Management (NOUVEAU point d'écoute, js/domain/objectives.js#createObjective) : badge Bronze (1 collaborateur distinct) dérivé en direct, jamais un compteur persisté", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi, gamificationApi } = window.__pilotageTestApi;
      const badgeId = "management-1-collaborateur";
      const personId = `fake-person-lotg3-${Date.now()}`;

      const before = await gamificationApi.getGamificationState();
      const obtainedBefore = before.badgesObtained[badgeId] || null;

      await objectivesApi.createObjective({ personId, title: `Test LOT G3 — objectif EADP ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));
      const afterFirst = await gamificationApi.getGamificationState();

      // Un second Objectif pour le MÊME collaborateur : recordObjectiveCreated() recalcule le
      // nombre de collaborateurs DISTINCTS à chaque appel via une lecture directe de la
      // collection (aucun compteur persisté qui pourrait diverger) — ce nombre ne doit donc pas
      // bouger, et rien ne doit être recrédité.
      await objectivesApi.createObjective({ personId, title: `Test LOT G3 — second objectif même collaborateur ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));
      const afterSecond = await gamificationApi.getGamificationState();

      return {
        obtainedBefore,
        obtainedAfterFirst: afterFirst.badgesObtained[badgeId] || null,
        obtainedAfterSecond: afterSecond.badgesObtained[badgeId] || null,
        deltaFirst: afterFirst.xpTotal - before.xpTotal,
        deltaSecond: afterSecond.xpTotal - afterFirst.xpTotal,
      };
    });

    expect(result.obtainedAfterFirst).not.toBeNull();
    if (result.obtainedBefore === null) {
      expect(result.deltaFirst).toBe(5);
    } else {
      expect(result.obtainedAfterFirst).toBe(result.obtainedBefore);
      expect(result.deltaFirst).toBe(0);
    }
    // Dans tous les cas, le second Objectif (même collaborateur, aucun nouveau distinct) ne
    // recrédite jamais rien.
    expect(result.obtainedAfterSecond).toBe(result.obtainedAfterFirst);
    expect(result.deltaSecond).toBe(0);
  });

  // Ce test tourne délibérément en dernier dans ce fichier : Playwright exécute les tests d'un
  // même fichier en série sur le MÊME compte de test partagé (même principe que noté en tête de
  // lotG1-gamification-xp-engine.spec.js), donc à ce stade Collaboration/Organisation/Management
  // ont chacune déjà été exercées au moins une fois par les tests ci-dessus — mais ce test reste
  // volontairement autonome (il déclenche lui-même un exemplaire de chaque famille "nouvelle" au
  // cas où il serait un jour exécuté seul ou dans un ordre différent) et NE DÉPEND D'AUCUNE
  // hypothèse sur l'état de départ des 12 familles : il vérifie un invariant qui doit être vrai
  // quelle que soit la valeur déjà accumulée par le compte de test.
  test("Cohérence globale des 60 badges actifs (12 familles) : tout seuil déjà franchi correspond à un badge obtenu, preuve du moteur evaluerFamille et de la ré-évaluation en cascade Expert", async ({ page }) => {
    const result = await page.evaluate(async (badgesActifs) => {
      const { linksApi, stickyNotesApi, objectivesApi, gamificationApi } = window.__pilotageTestApi;

      // Garantit au moins un exemplaire de chaque famille "nouvelle" de ce lot, pour que ce test
      // reste significatif même sur un compte totalement vierge.
      await linksApi.createLink(
        { type: "Task", id: `fake-lotg3-coherence-a-${Date.now()}`, label: "Fiche A" },
        { type: "Task", id: `fake-lotg3-coherence-b-${Date.now()}`, label: "Fiche B" }
      );
      await stickyNotesApi.createStickyNote({ title: `Test LOT G3 — cohérence globale ${Date.now()}` });
      await objectivesApi.createObjective({ personId: `fake-person-lotg3-coherence-${Date.now()}`, title: `Test LOT G3 — cohérence globale ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));

      const state = await gamificationApi.getGamificationState();
      const objectifs = await objectivesApi.listAll();
      const collaborateursDistincts = new Set(objectifs.filter((o) => o.personId).map((o) => o.personId)).size;

      function compterParPrefixe(prefixe) {
        return Object.keys(state.rewardedKeys).filter((k) => k.startsWith(prefixe)).length;
      }

      const prefixesParFamille = {
        productivite: "tache-terminee:",
        delivery: "projet-cloture:",
        collaboration: "lien-cree:",
        objectifs: "revue-eadp:",
        inbox: "inbox-qualifiee:",
        ressources: "ressource-creee:",
        prompts: "prompt-cree:",
        decisions: "decision-creee:",
        reunions: "reunion-creee:",
        organisation: "postit-cree:",
      };

      const violations = [];
      for (const badge of badgesActifs) {
        let valeurCourante;
        if (badge.famille === "management") valeurCourante = collaborateursDistincts;
        else if (badge.famille === "expert") valeurCourante = state.xpTotal;
        else valeurCourante = compterParPrefixe(prefixesParFamille[badge.famille]);

        if (valeurCourante >= badge.seuil && !state.badgesObtained[badge.id]) {
          violations.push({ id: badge.id, famille: badge.famille, seuil: badge.seuil, valeurCourante });
        }
      }
      return { violations, xpTotal: state.xpTotal, collaborateursDistincts };
    }, BADGES_ACTIFS);

    // Toute entrée ici serait un seuil franchi sans badge attribué — soit un bug dans
    // evaluerFamille(), soit dans la ré-évaluation en cascade de la famille Expert.
    expect(result.violations).toEqual([]);
  });
});

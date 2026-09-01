// Persistance légère de brouillons interrompus — voir claude/etat-avancement-pilotage.md,
// piste "persister l'état d'un geste interrompu" (discussion TDAH permanence/repérage du
// 01/09/2026, relancée le 02/09/2026 avec les exemples concrets de Charles-Henri : reposer un
// yaourt pour passer l'aspirateur et ne plus s'en souvenir, oublier un café en étant absorbé
// ailleurs — une interruption efface totalement ce qui était en cours, sans qu'un signal
// extérieur ne le fasse remonter).
//
// Volontairement en localStorage, pas dans Firestore : c'est un état d'interface propre à
// l'appareil et au moment présent (on reprend une saisie interrompue en général dans la
// foulée, pas depuis un autre appareil des jours plus tard), pas une donnée métier à
// synchroniser — cohérent avec "le moins de saisie possible" : la sauvegarde est automatique,
// jamais un geste explicite à faire, et n'ajoute aucune nouvelle collection.
const PREFIX = "pilotage-draft:";

export function saveDraft(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // localStorage indisponible (navigation privée stricte, quota dépassé...) — jamais
    // bloquant, la saisie en cours continue de fonctionner normalement, juste sans ce filet de
    // récupération pour cette fois.
  }
}

export function getDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // silencieux — voir saveDraft.
  }
}

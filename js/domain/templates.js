// Canevas — §14 à §19, principe d'architecture §78.9 : "les canevas ne doivent pas être
// codés en dur, ils doivent être des données". Cette première version reprend tels quels
// les 4 canevas fixes décrits dans le cahier des charges (Réunion §15, Suivi collaborateur
// §16, Projet §17, Communication §18) sous la forme de données (`steps[]`), et non de règles
// écrites en dur dans chaque vue — c'est ce qui permettra plus tard de brancher un éditeur
// de canevas personnalisés (§19) sans toucher au code des fiches, seulement à ces données.
//
// Volontairement PAS d'éditeur de canevas dans cette livraison (choix confirmé par
// Charles-Henri) : ces 4 canevas sont fixes pour l'instant. Chaque étape n'est qu'une case à
// cocher (`{key, label}`) — les champs plus riches du §78.9 (required, defaultReminder,
// children[]) sont prévus dans la forme des données mais pas encore exploités par
// l'interface, pour ne pas construire une mécanique que rien n'utilise encore.

export const TEMPLATES = {
  meeting: {
    key: "meeting",
    label: "🗓️ Réunion",
    appliesTo: "Meeting",
    steps: [
      { key: "identify_topics", label: "Identifier les sujets" },
      { key: "identify_decisions", label: "Identifier les décisions attendues" },
      { key: "gather_info", label: "Rassembler les informations" },
      { key: "identify_participants", label: "Identifier les participants" },
      { key: "prepare_materials", label: "Préparer les supports" },
      { key: "hold_meeting", label: "Réaliser la réunion" },
      { key: "capture_decisions", label: "Saisir les décisions" },
      { key: "create_actions", label: "Créer les actions" },
      { key: "plan_followups", label: "Planifier les suivis" },
    ],
  },
  one_on_one: {
    key: "one_on_one",
    label: "👀 Point collaborateur",
    appliesTo: "Meeting",
    steps: [
      { key: "previous_commitments", label: "Engagements précédents" },
      { key: "done", label: "Réalisé" },
      { key: "in_progress", label: "En cours" },
      { key: "difficulties", label: "Difficultés" },
      { key: "blockers", label: "Blocages" },
      { key: "decisions_needed", label: "Décisions nécessaires" },
      { key: "next_actions", label: "Prochaines actions" },
      { key: "next_followup", label: "Prochain suivi" },
    ],
  },
  project: {
    key: "project",
    label: "📦 Projet",
    appliesTo: "Project",
    steps: [
      { key: "framing", label: "Cadrage" },
      { key: "actions", label: "Actions" },
      { key: "resources", label: "Ressources" },
      { key: "dependencies", label: "Dépendances" },
      { key: "decisions", label: "Décisions" },
      { key: "validation", label: "Validation" },
      { key: "delivery", label: "Réalisation" },
      { key: "review", label: "Bilan" },
    ],
  },
  communication: {
    key: "communication",
    label: "📣 Communication",
    appliesTo: "Task",
    steps: [
      { key: "subject", label: "Sujet" },
      { key: "audience", label: "Audience" },
      { key: "objective", label: "Objectif" },
      { key: "key_message", label: "Message principal" },
      { key: "gather_info", label: "Informations" },
      { key: "resources", label: "Ressources" },
      { key: "angle", label: "Angle" },
      { key: "writing", label: "Rédaction" },
      { key: "review", label: "Relecture" },
      { key: "validation", label: "Validation" },
      { key: "publication", label: "Publication" },
      { key: "communication", label: "Communication" },
      { key: "measure", label: "Retour / mesure" },
    ],
  },
};

/** Construit un tableau d'étapes {key, label, done:false} prêt à stocker sur l'entité, à
 *  partir d'une clé de canevas — jamais accédé directement, toujours via cette fonction, pour
 *  que le passage à un vrai éditeur de canevas (§19) plus tard n'ait qu'un seul endroit à
 *  changer. */
export function buildSteps(templateKey) {
  const template = TEMPLATES[templateKey];
  if (!template) return [];
  return template.steps.map((s) => ({ key: s.key, label: s.label, done: false }));
}

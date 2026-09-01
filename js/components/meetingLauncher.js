// Créer une réunion à partir d'une fiche (retour de Charles-Henri, 01/09/2026) : un titre
// composé — Catégorie de projet / Projet / Intitulé de l'élément / Personne, chaque partie
// omise si absente — copiable en un clic pour coller directement dans le titre d'une réunion
// Outlook, et un bouton qui va plus loin : télécharge un fichier .ics prêt à importer (à la
// date et l'heure du moment, avec un lien discret vers la fiche Pilotage dans la description)
// PUIS ouvre le formulaire de création de Réunion de l'app, préempli avec ce même titre et
// déjà lié à la fiche d'origine — même mécanique que "+ Créer et lier" (voir
// js/components/linkedItems.js), juste avec un titre déjà écrit à ta place.
//
// Reste volontairement une référence manuelle, comme le reste de l'intégration Outlook
// (js/domain/tasks.js, addOutlookMeeting) : un fichier .ics standard que n'importe quel
// client calendrier sait importer, pas une vraie intégration Microsoft Graph.

import { openCreateAndLinkDirect } from "./linkedItems.js";
import { showToast } from "./toast.js";
import { buildDeepLink } from "../services/deeplink.js";
import { generateId } from "../services/id.js";

/** Compose le titre — chaque segment absent est simplement omis, jamais de tiret orphelin ni
 *  de "undefined". Ordre fixe demandé par Charles-Henri : Catégorie - Projet - Intitulé -
 *  Personne. */
export function buildMeetingTitle({ category, projectName, itemTitle, personName } = {}) {
  return [category, projectName, itemTitle, personName]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" - ");
}

export async function copyMeetingTitle(title) {
  try {
    await navigator.clipboard.writeText(title);
    showToast("Titre copié");
  } catch {
    showToast("Copie impossible ici — sélectionne le champ et copie-le à la main (Ctrl/Cmd+C)");
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Format UTC (suffixe "Z") — la date/l'heure affichées par le client calendrier seront donc
// automatiquement converties dans son propre fuseau, ce qui est le comportement correct pour
// un fichier destiné à être importé par n'importe qui, n'importe où.
function toIcsDateUtc(date) {
  return (
    date.getUTCFullYear() +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    "T" +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    "Z"
  );
}

// RFC 5545 §3.3.11 : virgule, point-virgule, antislash et retour à la ligne doivent être
// échappés dans un champ texte.
function escapeIcsText(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildIcsContent({ title, description, start, durationMinutes = 30 }) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pilotage//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${generateId()}@pilotage`,
    `DTSTAMP:${toIcsDateUtc(new Date())}`,
    `DTSTART:${toIcsDateUtc(start)}`,
    `DTEND:${toIcsDateUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function downloadIcsFile(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * `ref` = {type, id} de la fiche d'origine (Task ou FollowUp aujourd'hui — voir Reste à
 * construire pour une extension à d'autres types). `routeHash` = l'onglet où cette fiche vit
 * (`#/kanban`, `#/people`...), utilisé pour composer le lien de retour glissé dans le .ics.
 * `onLinked`/`onCancel` : le formulaire de réunion qui s'ouvre ensuite ferme la fiche
 * courante (une seule modale à la fois, voir components/modal.js) — à l'appelant de la
 * rouvrir, exactement comme pour "+ Créer et lier".
 */
export function launchMeetingFromEntity({ ref, routeHash, title, onLinked, onCancel }) {
  const link = buildDeepLink(routeHash, ref.type, ref.id);
  const ics = buildIcsContent({
    title,
    description: `Généré depuis Pilotage : ${link}`,
    start: new Date(),
  });
  downloadIcsFile(`reunion-${ref.id}.ics`, ics);
  showToast("Fichier .ics téléchargé");
  openCreateAndLinkDirect("Meeting", ref, title, {
    defaults: { title },
    onLinked,
    onCancel,
  });
}

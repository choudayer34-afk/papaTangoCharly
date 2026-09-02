// Export "vue d'ensemble" (retour de Charles-Henri, vague 22) — troisième des trois pistes
// proposées en réponse à sa demande explicite du 02/09/2026 de visualiser automatiquement les
// éléments liés d'un sujet façon le diagramme 3 colonnes envoyé en référence ("Ne développe
// pas, propose moi"). Charles-Henri a choisi l'option (c) : "un document ponctuel plutôt qu'un
// écran maintenu en continu [...] pas forcément 3 colonnes, ça dépend du contexte".
//
// Génère une image PNG via l'API Canvas 2D native du navigateur — délibérément PAS un vrai PDF,
// qui aurait demandé une librairie tierce (jsPDF ou équivalent) dans une app qui n'a jusqu'ici
// aucune dépendance externe hors Firebase (vanilla JS, zéro bundler). Le nombre de colonnes
// réellement dessinées (1 à 3, jamais forcé à 3) dépend uniquement de ce que la fiche contient :
// Contexte (description + journal de notes), Actions (checklist), Éléments liés (fil
// conducteur) — chacune omise si vide, exactement la demande "ça dépend du contexte".
//
// Une seule fonction générique (`renderOverviewImage`) construit et télécharge l'image ; les
// deux wrappers exportés (`exportTaskOverview`/`exportFollowUpOverview`) se contentent de
// normaliser les données propres à chaque type de fiche vers ce format commun, pour que
// l'ajout d'un futur type (Projet ?) n'ait qu'à écrire un troisième petit wrapper plutôt que de
// dupliquer le dessin — voir "Reste à construire".

import * as linksApi from "../domain/links.js";
import { fetchBundle, resolveRef } from "./linkedItems.js";

const COL_WIDTHS = { 1: 560, 2: 400, 3: 340 };
const PADDING = 40;
const COL_GAP = 32;
const HEADER_HEIGHT = 128;
const COL_HEADER_HEIGHT = 36;
const LINE_HEIGHT = 22;
const FOOTER_HEIGHT = 36;
const FONT_BODY = "15px system-ui, -apple-system, sans-serif";
const FONT_TITLE = "bold 26px system-ui, -apple-system, sans-serif";
const FONT_META = "14px system-ui, -apple-system, sans-serif";
const FONT_COL_HEADER = "bold 15px system-ui, -apple-system, sans-serif";
const COLORS = {
  bg: "#ffffff",
  header: "#f3f1fb",
  border: "#e2ddf5",
  colBg: "#faf9fd",
  title: "#241f3d",
  meta: "#6b6484",
  colHeader: "#4a3f8a",
  body: "#2e2a45",
  bodyMuted: "#8b8499",
};

/** Découpe `text` en lignes tenant dans `maxWidth`, en respectant les retours à la ligne déjà
 *  présents dans le texte (un paragraphe par entrée du tableau d'origine). */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const attempt = current ? current + " " + word : word;
      if (ctx.measureText(attempt).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = attempt;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.metaLine - ex. "✅ Tâche · Statut : En cours · Échéance : 12 sept."
 * @param {Array<{icon:string, label:string, lines:string[]}>} opts.sections - une entrée par
 *   colonne candidate ; toute entrée avec `lines` vide est simplement ignorée (voir en-tête).
 */
function renderOverviewImage({ title, metaLine, sections }) {
  const cols = sections.filter((s) => s.lines.length);
  const nCols = Math.max(1, cols.length);
  const colWidth = COL_WIDTHS[Math.min(nCols, 3)];

  // Canvas de mesure : même police que le dessin final, largeur de colonne déjà fixée puisque
  // seule la hauteur dépend du contenu — deux passes (mesurer puis dessiner) sur un seul canvas.
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = FONT_BODY;
  const wrapped = cols.length
    ? cols.map((s) => ({ ...s, wrapped: wrapText(measure, s.lines.join("\n"), colWidth - 24) }))
    : [{ icon: "🗒️", label: "Résumé", wrapped: ["Aucun détail supplémentaire enregistré sur cette fiche pour l'instant."] }];

  const bodyHeight = Math.max(...wrapped.map((c) => c.wrapped.length)) * LINE_HEIGHT;
  const width = PADDING * 2 + colWidth * wrapped.length + COL_GAP * (wrapped.length - 1);
  const height = HEADER_HEIGHT + COL_HEADER_HEIGHT + bodyHeight + PADDING + FOOTER_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.header;
  ctx.fillRect(0, 0, width, HEADER_HEIGHT - 12);
  ctx.fillStyle = COLORS.title;
  ctx.font = FONT_TITLE;
  ctx.fillText(title, PADDING, 52);
  ctx.fillStyle = COLORS.meta;
  ctx.font = FONT_META;
  ctx.fillText(metaLine, PADDING, 80);

  let x = PADDING;
  const colTop = HEADER_HEIGHT;
  for (const col of wrapped) {
    ctx.fillStyle = COLORS.colBg;
    ctx.fillRect(x, colTop, colWidth, COL_HEADER_HEIGHT + bodyHeight + 20);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(x, colTop, colWidth, COL_HEADER_HEIGHT + bodyHeight + 20);

    ctx.fillStyle = COLORS.colHeader;
    ctx.font = FONT_COL_HEADER;
    ctx.fillText(`${col.icon} ${col.label}`, x + 12, colTop + 24);

    ctx.font = FONT_BODY;
    let y = colTop + COL_HEADER_HEIGHT + LINE_HEIGHT - 4;
    for (const line of col.wrapped) {
      ctx.fillStyle = line.startsWith("✓") ? COLORS.bodyMuted : COLORS.body;
      ctx.fillText(line, x + 12, y);
      y += LINE_HEIGHT;
    }
    x += colWidth + COL_GAP;
  }

  ctx.fillStyle = COLORS.bodyMuted;
  ctx.font = FONT_META;
  const stamp = `Exporté le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — Pilotage`;
  ctx.fillText(stamp, PADDING, height - 14);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = slugify(title) + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "vue-d-ensemble"
  );
}

/** Colonne "🔗 Éléments liés" — commune à tous les types de fiches liables (voir
 *  js/components/linkedItems.js), une seule implémentation ici pour ne jamais diverger de ce
 *  que la section "🔗 Lié" affiche déjà sur chaque fiche. */
async function linkedItemLines(ref) {
  const [bundle, allLinks] = await Promise.all([fetchBundle(), linksApi.listAll()]);
  const mine = linksApi.linksFor(allLinks, ref.type, ref.id);
  return mine
    .map(({ other }) => resolveRef(bundle, other))
    .filter(Boolean)
    .map((r) => `${r.emoji} ${r.title}`);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Export d'une Tâche — appelée depuis "📄 Exporter la vue d'ensemble" sur la fiche détail
 *  (js/views/kanban.js#openTaskDetail). `statusLabel` est déjà résolu par l'appelant
 *  (tasksApi.STATUS_LABELS[task.status]) plutôt que recalculé ici, pour ne dépendre d'aucun
 *  import du domaine Tâche dans ce module d'export générique. */
export async function exportTaskOverview(task, { project, statusLabel } = {}) {
  const metaParts = [
    `Statut : ${statusLabel || task.status}`,
    task.dueDate ? `Échéance : ${formatDate(task.dueDate)}` : null,
    project ? `Projet : ${project.name}` : null,
  ].filter(Boolean);

  const contextLines = [task.description || ""].filter(Boolean);
  for (const n of task.notesLog || []) contextLines.push(`${formatDate(new Date(n.createdAt).toISOString())} — ${n.text}`);

  const actionLines = (task.checklist || []).map((c) => (c.done ? `✓ ${c.text}` : `☐ ${c.text}`));

  const linked = await linkedItemLines({ type: "Task", id: task.id });

  renderOverviewImage({
    title: task.title,
    metaLine: `✅ Tâche · ${metaParts.join(" · ")}`,
    sections: [
      { icon: "🗒️", label: "Contexte", lines: contextLines },
      { icon: "☑️", label: "Actions", lines: actionLines },
      { icon: "🔗", label: "Éléments liés", lines: linked },
    ],
  });
}

/** Export d'un Suivi — appelée depuis "📄 Exporter la vue d'ensemble" sur la fiche
 *  d'édition (js/views/people.js#openEditFollowUpModal), la modale qui sert de fiche détail
 *  pour un Suivi. */
export async function exportFollowUpOverview(followUp, { project, person, statusLabel, directionLabel } = {}) {
  const metaParts = [
    directionLabel,
    `Statut : ${statusLabel || followUp.status}`,
    person ? `Personne : ${person.name}` : null,
    project ? `Projet : ${project.name}` : null,
  ].filter(Boolean);

  const contextLines = [followUp.description || ""].filter(Boolean);
  for (const n of followUp.notesLog || []) contextLines.push(`${formatDate(new Date(n.createdAt).toISOString())} — ${n.text}`);

  const actionLines = (followUp.checklist || []).map((c) => (c.done ? `✓ ${c.text}` : `☐ ${c.text}`));

  const linked = await linkedItemLines({ type: "FollowUp", id: followUp.id });

  renderOverviewImage({
    title: followUp.title,
    metaLine: `👀 Suivi · ${metaParts.join(" · ")}`,
    sections: [
      { icon: "🗒️", label: "Contexte", lines: contextLines },
      { icon: "☑️", label: "Actions", lines: actionLines },
      { icon: "🔗", label: "Éléments liés", lines: linked },
    ],
  });
}

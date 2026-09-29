// Générateur PDF minimal, SANS DÉPENDANCE (ajout du 28/09/2026, retour de Charles-Henri —
// exports "Objectif" et "EADP") — voir la question posée avant développement : cet environnement
// n'a accès ni au registre npm ni aux CDN habituels (jsdelivr/unpkg), donc aucune bibliothèque
// tierce (jsPDF, pdfmake...) n'a pu être récupérée. Réponse retenue : écrire nous-mêmes un
// générateur minimal, cohérent avec l'architecture JS vanilla / offline-first déjà en place
// (aucun script externe, aucune étape de build).
//
// Ce module ne couvre QUE ce dont les 2 exports ont besoin (titres, paragraphes avec retours à
// la ligne, liens cliquables, un tableau simple à colonnes) — pas un moteur de mise en page
// générique. Format produit : PDF 1.4, une police Helvetica/Helvetica-Bold standard (14 polices
// de base, jamais embarquées, encodage WinAnsi — couvre les caractères accentués français
// usuels : é è à ç ù ê â î ô û ë ï ü ö...).
//
// AVERTISSEMENT (même principe que tests/README.md) : les largeurs de caractères utilisées pour
// la césure des lignes sont une ESTIMATION PAR CATÉGORIE (majuscule/minuscule/chiffre/ponctuation),
// pas la table AFM exacte d'Helvetica — suffisant pour un document texte sobre, mais peut
// occasionnellement couper une ligne un peu tôt. Jamais testé par un rendu visuel réel dans cet
// environnement (aucun lecteur PDF disponible) : la structure (xref, objets, flux) a été vérifiée
// programmatiquement (voir tests/unit/pdfWriter-xlsxWriter-structure.spec.js), mais une relecture
// visuelle par Charles-Henri (ouverture réelle du fichier) reste nécessaire avant validation
// complète.

const PAGE_WIDTH = 595; // A4 en points, arrondi
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Estimation grossière des largeurs de caractères (unités / 1000, comme les fichiers AFM réels)
// — voir l'avertissement en tête de fichier : catégorisée, pas la table exacte.
function charWidth1000(code, bold) {
  if (code === 32) return 278;
  if (code >= 48 && code <= 57) return 556; // chiffres
  if (code >= 65 && code <= 90) return bold ? 722 : 667; // majuscules
  if (code >= 97 && code <= 122) return bold ? 556 : 500; // minuscules
  if (code >= 0xc0 && code <= 0xde) return bold ? 722 : 667; // majuscules accentuées (WinAnsi/Latin-1)
  if (code >= 0xdf && code <= 0xff) return bold ? 556 : 500; // minuscules accentuées
  return 278; // ponctuation / symboles
}

function textWidth(text, size, bold) {
  let total = 0;
  for (let i = 0; i < text.length; i++) total += charWidth1000(text.charCodeAt(i), bold);
  return (total / 1000) * size;
}

function escapePdfString(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// BUG corrigé (29/09/2026, retour de Charles-Henri : "j'ai des ? [...] dans le document PDF")
// : la plage d'octets 0x80-0x9F de WinAnsiEncoding (utilisée ici, /Encoding /WinAnsiEncoding sur
// les 2 polices, voir buildPdfBytes) N'EST PAS Latin-1 — c'est Windows-1252, qui y loge des
// caractères typographiques usuels (tiret cadratin, guillemets courbes, points de suspension...)
// à des OCTETS différents de leur point de code Unicode. `toLatin1Safe` ci-dessous ne gardait
// jusqu'ici que les points de code <= 255 tels quels (vrai Latin-1 strict), donc un tiret
// cadratin « — » (U+2014, code 8212) — utilisé PARTOUT dans les exports Objectifs/EADP entre
// chaque date et son texte, js/domain/objectivesExport.js — se retrouvait bêtement remplacé par
// "?" alors qu'il a une place parfaitement valide en WinAnsiEncoding (octet 0x97). Table de
// correspondance Unicode → octet WinAnsi pour les caractères typographiques courants (source :
// spec PDF 1.7 Annexe D / Windows-1252) — tout code point absent de cette table ET hors de la
// plage Latin-1 stricte reste remplacé par "?" (cas des emojis, qu'aucune police Helvetica de
// base ne sait dessiner de toute façon — voir le commentaire sur les émojis plus bas dans
// js/domain/objectivesExport.js).
const WINANSI_EXTRA_BYTES = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ' (apostrophe/guillemet simple ouvrant)
  0x2019: 0x92, // ' (apostrophe/guillemet simple fermant — très fréquent en français)
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // – (tiret demi-cadratin)
  0x2014: 0x97, // — (tiret cadratin)
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ (cœur, œuvre...)
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

// Toute chaîne manipulée ici doit rester "1 caractère JS = 1 octet" pour que la conversion finale
// en octets (voir buildPdfBytes) préserve les valeurs telles quelles.
function toLatin1Safe(s) {
  return (s || "")
    .normalize("NFC")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code <= 255) return ch;
      const mapped = WINANSI_EXTRA_BYTES[code];
      return mapped !== undefined ? String.fromCharCode(mapped) : "?";
    })
    .join("");
}

/** Découpe `text` (peut contenir des retours à la ligne \n) en lignes tenant dans `maxWidth`. */
function wrapText(text, maxWidth, size, bold) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (textWidth(candidate, size, bold) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function createPdfDoc({ title = "" } = {}) {
  const pages = []; // { ops: string[], annots: {rect:[x1,y1,x2,y2], url}[] }
  let cursorY = 0;
  let currentPage = null;

  function newPage() {
    currentPage = { ops: [], annots: [] };
    pages.push(currentPage);
    cursorY = PAGE_HEIGHT - MARGIN;
  }
  newPage();

  function ensureSpace(neededHeight) {
    if (cursorY - neededHeight < MARGIN) newPage();
  }

  function drawLine(text, { size = 10, bold = false, italic = false, x = MARGIN, color = null } = {}) {
    const safe = escapePdfString(toLatin1Safe(text));
    const font = bold && italic ? "/F4" : italic ? "/F3" : bold ? "/F2" : "/F1";
    const colorOp = color ? `${color[0]} ${color[1]} ${color[2]} rg\n` : "0 0 0 rg\n";
    currentPage.ops.push(`BT\n${colorOp}${font} ${size} Tf\n${x} ${cursorY} Td\n(${safe}) Tj\nET`);
  }

  const doc = {
    // Réécrit le 29/09/2026 (retour de Charles-Henri : "phrases tronquées" + nouvelle maquette
    // EADP demandant titre centré/orange, sous-titres gris foncé, indicateurs italique bleu) :
    // avant cette réécriture, heading() dessinait TOUJOURS le texte complet sur une seule ligne,
    // sans jamais appeler wrapText — un titre d'objectif un peu long partait donc au-delà de la
    // marge droite de la page et se retrouvait tronqué visuellement (le texte existait bien dans
    // le flux PDF, mais hors de la zone visible). heading() appelle maintenant wrapText comme le
    // fait déjà paragraph(), et gère en plus la couleur, l'italique et le centrage (nécessaires
    // pour le titre "EADP [Nom]" centré en orange et les sous-titres gris foncé).
    heading(text, { size = 14, bold = true, italic = false, color = null, align = "left" } = {}) {
      const lineHeight = size * 1.3;
      const lines = wrapText(text || "", CONTENT_WIDTH, size, bold);
      for (const line of lines) {
        ensureSpace(lineHeight);
        cursorY -= lineHeight;
        if (line) {
          const x = align === "center" ? MARGIN + (CONTENT_WIDTH - textWidth(line, size, bold)) / 2 : MARGIN;
          drawLine(line, { size, bold, italic, color, x });
        }
      }
      cursorY -= size * 0.4;
    },
    paragraph(text, { size = 10, bold = false, gapAfter = 8 } = {}) {
      const lineHeight = size * 1.35;
      const lines = wrapText(text || "", CONTENT_WIDTH, size, bold);
      for (const line of lines) {
        ensureSpace(lineHeight);
        cursorY -= lineHeight;
        if (line) drawLine(line, { size, bold });
      }
      cursorY -= gapAfter;
    },
    spacer(px = 8) {
      cursorY -= px;
    },
    rule() {
      ensureSpace(10);
      cursorY -= 4;
      currentPage.ops.push(`${MARGIN} ${cursorY} m ${MARGIN + CONTENT_WIDTH} ${cursorY} l 0.7 0.7 0.7 RG S`);
      cursorY -= 6;
    },
    /** Ligne cliquable — `label` est ce qui s'affiche (ex. "lien"), `url` la cible réelle. */
    link(label, url, { size = 10 } = {}) {
      const lineHeight = size * 1.35;
      ensureSpace(lineHeight);
      cursorY -= lineHeight;
      drawLine(label, { size, color: [0.15, 0.3, 0.7] });
      const w = textWidth(label, size, false);
      currentPage.annots.push({ rect: [MARGIN, cursorY - 2, MARGIN + w, cursorY + size], url });
      cursorY -= 4;
    },
    /**
     * Tableau simple à colonnes (utilisé pour le tableau de ressources). `columns`:
     * [{header, width}] (largeurs en points, doivent tenir dans CONTENT_WIDTH). `rows`: tableau
     * de lignes, chaque ligne un tableau de cellules `{text}` ou `{text, link}` (cellule
     * cliquable — voir le tableau de ressources : "lien" plutôt que l'URL complète).
     */
    table(columns, rows, { size = 9 } = {}) {
      const lineHeight = size * 1.35;
      let x = MARGIN;
      const xs = columns.map((c) => {
        const thisX = x;
        x += c.width;
        return thisX;
      });
      ensureSpace(lineHeight * 1.5);
      cursorY -= lineHeight;
      columns.forEach((c, i) => drawLine(c.header, { size, bold: true, x: xs[i] }));
      cursorY -= lineHeight * 0.4;
      currentPage.ops.push(`${MARGIN} ${cursorY} m ${MARGIN + CONTENT_WIDTH} ${cursorY} l 0.7 0.7 0.7 RG S`);
      cursorY -= 6;
      for (const row of rows) {
        const cellLines = row.map((cell, i) => wrapText(cell.text || "", columns[i].width - 4, size, false));
        const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
        ensureSpace(rowLines * lineHeight);
        const rowTopY = cursorY;
        for (let li = 0; li < rowLines; li++) {
          cursorY -= lineHeight;
          row.forEach((cell, i) => {
            const line = cellLines[i][li];
            if (line === undefined) return;
            if (cell.link && li === 0) {
              drawLine(line, { size, x: xs[i], color: [0.15, 0.3, 0.7] });
              const w = textWidth(line, size, false);
              currentPage.annots.push({ rect: [xs[i], cursorY - 2, xs[i] + w, cursorY + size], url: cell.link });
            } else {
              drawLine(line, { size, x: xs[i] });
            }
          });
        }
        cursorY -= 4;
      }
    },
    save() {
      return buildPdfBytes(pages, title);
    },
  };
  return doc;
}

function buildPdfBytes(pages, title) {
  const objects = []; // index 0 unused (objet 0 réservé PDF)
  function addObject(body) {
    objects.push(body);
    return objects.length; // numéro d'objet (1-based)
  }

  const fontRegularNum = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldNum = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  // Ajoutés le 29/09/2026 pour la maquette EADP (indicateurs "en italique bleu") — Helvetica-Oblique
  // et Helvetica-BoldOblique font partie des 14 polices de base PDF (comme Helvetica/Helvetica-Bold),
  // donc toujours disponibles sans embarquement, avec les mêmes largeurs AFM que leurs variantes
  // droites (seul le rendu penché change) : charWidth1000 n'a donc pas besoin d'être modifié.
  const fontItalicNum = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
  const fontBoldItalicNum = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>");

  const pageNums = [];
  const pagesRootNum = objects.length + 1 + pages.length * 2; // réservé, calculé après (voir plus bas)
  // On construit d'abord chaque page (contenu + annotations), le nœud /Pages est ajouté à la fin
  // une fois qu'on connaît tous les numéros d'objets Page.
  const pendingPages = [];
  for (const page of pages) {
    const stream = page.ops.join("\n");
    const contentNum = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const annotNums = page.annots.map((a) =>
      addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${a.rect.map((n) => n.toFixed(2)).join(" ")}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${escapePdfString(toLatin1Safe(a.url))}) >> >>`
      )
    );
    pendingPages.push({ contentNum, annotNums });
  }
  const pagesNodeNum = objects.length + pendingPages.length + 1;
  for (const p of pendingPages) {
    const annots = p.annotNums.length ? ` /Annots [${p.annotNums.map((n) => n + " 0 R").join(" ")}]` : "";
    const pageNum = addObject(
      `<< /Type /Page /Parent ${pagesNodeNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularNum} 0 R /F2 ${fontBoldNum} 0 R /F3 ${fontItalicNum} 0 R /F4 ${fontBoldItalicNum} 0 R >> >> /Contents ${p.contentNum} 0 R${annots} >>`
    );
    pageNums.push(pageNum);
  }
  const pagesNum = addObject(`<< /Type /Pages /Kids [${pageNums.map((n) => n + " 0 R").join(" ")}] /Count ${pageNums.length} >>`);
  const catalogNum = addObject(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);
  const infoNum = addObject(`<< /Title (${escapePdfString(toLatin1Safe(title))}) /Producer (Pilotage) >>`);

  // Assemblage final + table xref (offsets exacts, obligatoires pour un PDF valide).
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"; // ligne binaire conventionnelle (force un lecteur à traiter le fichier en binaire)
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // Code client (navigateur) : jamais `Buffer` (Node uniquement, absent du navigateur) — chaque
  // caractère de `out` représente déjà UN octet (voir toLatin1Safe ci-dessus), donc une simple
  // copie caractère→octet suffit à obtenir les octets exacts du fichier PDF.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** Déclenche le téléchargement du PDF (même principe que xlsxWriter.js#downloadXlsxBytes). */
export function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

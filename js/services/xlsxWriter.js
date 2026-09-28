// Générateur .xlsx minimal, SANS DÉPENDANCE (ajout du 28/09/2026, retour de Charles-Henri —
// export Excel des Objectifs) — même contexte que js/services/pdfWriter.js (voir son commentaire
// en tête de fichier pour le raisonnement complet : ni npm ni CDN accessibles ici, architecture
// JS vanilla existante à préserver).
//
// Un .xlsx est un fichier ZIP contenant des parties XML (format OOXML SpreadsheetML). Ce module
// construit lui-même ce ZIP (entrées STOCKÉES, sans compression DEFLATE — plus simple à écrire à
// la main et parfaitement valide pour un lecteur de ZIP/Excel, seule la taille du fichier en
// pâtit un peu) et le XML minimal nécessaire : UNE feuille, filtre automatique sur l'en-tête,
// cellules multi-lignes (retour à la ligne dans une cellule, "compilé dans la même cellule"
// demandé par Charles-Henri) via un style `wrapText`.
//
// AVERTISSEMENT (même principe que pdfWriter.js) : jamais ouvert dans un vrai Excel/LibreOffice
// dans cet environnement (aucun tableur disponible) — la structure ZIP (CRC32, offsets, table
// centrale) a été vérifiée programmatiquement (voir tests/unit/pdfWriter-xlsxWriter-structure.spec.js)
// et le XML relu manuellement contre le schéma OOXML, mais une ouverture réelle par Charles-Henri
// reste nécessaire avant validation complète.

function xmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// --- ZIP (STORED, sans compression) ---------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}
function u32(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function buildZip(files) {
  // `files`: [{name: "xl/workbook.xml", data: Uint8Array}]
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20), // version needed
      ...u16(0), // flags
      ...u16(0), // méthode : 0 = stocké (aucune compression)
      ...u16(0), ...u16(0), // date/heure de modification — non significatif ici
      ...u32(crc),
      ...u32(size), // taille compressée = taille réelle (stocké)
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0), // extra field length
    ]);
    localParts.push(localHeader, nameBytes, file.data);
    const localHeaderOffset = offset;
    offset += localHeader.length + nameBytes.length + file.data.length;

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20), ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0), // extra field length
      ...u16(0), // comment length
      ...u16(0), // disk number start
      ...u16(0), // internal attrs
      ...u32(0), // external attrs
      ...u32(localHeaderOffset),
    ]);
    centralParts.push(centralHeader, nameBytes);
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const p of centralParts) centralSize += p.length;

  const endRecord = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0), ...u16(0), // numéro de disque
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralSize),
    ...u32(centralStart),
    ...u16(0), // comment length
  ]);

  const allParts = [...localParts, ...centralParts, endRecord];
  let total = 0;
  for (const p of allParts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// --- Classeur ----------------------------------------------------------------------------------
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Objectifs" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

/**
 * Classeur à UNE feuille (suffisant pour l'export Objectifs demandé — pas de moteur multi-
 * feuilles). `columns`: [{header, width}] ; `rows`: tableau de lignes, chaque ligne un tableau
 * de chaînes (une cellule par colonne, dans le même ordre) — une cellule contenant des "\n"
 * s'affiche sur plusieurs lignes dans Excel grâce au style `wrapText` appliqué à TOUTES les
 * cellules de données (nécessaire pour "indicateurs"/"suivi" compilés dans une même cellule).
 */
export function buildXlsxBytes(columns, rows) {
  const headerRow = `<row r="1">${columns
    .map((c, i) => `<c r="${colLetter(i)}1" t="inlineStr" s="2"><is><t xml:space="preserve">${xmlEscape(c.header)}</t></is></c>`)
    .join("")}</row>`;
  const dataRows = rows
    .map((row, rIdx) => {
      const r = rIdx + 2;
      const cells = row
        .map((val, cIdx) => `<c r="${colLetter(cIdx)}${r}" t="inlineStr" s="1"><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`)
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  const lastCol = colLetter(columns.length - 1);
  const lastRow = rows.length + 1;
  const dimension = `A1:${lastCol}${lastRow}`;
  const cols = `<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 25}" customWidth="1"/>`).join("")}</cols>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
${cols}
<sheetData>${headerRow}${dataRows}</sheetData>
<autoFilter ref="${dimension}"/>
</worksheet>`;

  const enc = new TextEncoder();
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: enc.encode(RELS_XML) },
    { name: "xl/workbook.xml", data: enc.encode(WORKBOOK_XML) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(WORKBOOK_RELS_XML) },
    { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml) },
  ];
  return buildZip(files);
}

/** Déclenche le téléchargement du classeur. */
export function downloadXlsxBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

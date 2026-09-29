
// Générateurs PDF/XLSX vanilla sans dépendance (js/services/pdfWriter.js, js/services/
// xlsxWriter.js — ajout du 28/09/2026, "petite parenthèse" Objectifs/EADP, voir le commentaire en
// tête de ces deux fichiers pour le contexte complet : ni npm ni CDN accessibles dans
// l'environnement où ce patch a été développé).
//
// CAS PARTICULIER dans ce dossier `tests/` : contrairement à tout le reste (émulateur Firebase +
// Playwright, jamais exécutable ici faute d'accès au registre npm, voir tests/README.md), ces deux
// modules sont des fonctions PURES sans aucune dépendance externe ni DOM (leurs deux seules
// fonctions qui touchent au navigateur, `downloadPdfBytes`/`downloadXlsxBytes`, ne sont
// délibérément PAS exercées ici — elles ne font que déclencher un téléchargement via
// Blob/URL/document, indisponibles hors navigateur). Ce fichier n'importe donc que
// `createPdfDoc`/`buildXlsxBytes` et n'a besoin que de Node lui-même (`node:test`, `node:assert`,
// `node:zlib` — tous intégrés, aucune installation requise) : IL A RÉELLEMENT ÉTÉ EXÉCUTÉ dans cet
// environnement (contrairement aux avertissements qu'on trouve partout ailleurs dans ce dossier),
// via :
//
//   node --test tests/unit/pdfWriter-xlsxWriter-structure.spec.js
//
// Il fige les vérifications déjà faites à la main pendant le développement (table xref du PDF
// vérifiée offset par offset contre la position réelle de chaque "N 0 obj", et CRC32 du ZIP
// cross-vérifié contre l'implémentation intégrée de Node, `zlib.crc32`) — la seule chose qui
// reste hors de portée d'un test automatisé ici est l'OUVERTURE RÉELLE des fichiers produits dans
// un lecteur PDF / un tableur (aucun des deux disponible dans cet environnement), qui reste à
// faire par Charles-Henri avant validation complète.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { createPdfDoc } from "../../js/services/pdfWriter.js";
import { buildXlsxBytes } from "../../js/services/xlsxWriter.js";

function bytesToLatin1String(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

describe("pdfWriter.js — structure PDF 1.4 (xref, objets, pagination)", () => {
  it("en-tête %PDF-1.4 et trailer %%EOF présents", () => {
    const doc = createPdfDoc({ title: "Test" });
    doc.heading("Titre");
    doc.paragraph("Un paragraphe simple.");
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);
    assert.equal(text.slice(0, 8), "%PDF-1.4");
    assert.equal(text.slice(-5), "%%EOF");
  });

  it("chaque offset de la table xref pointe exactement sur le bon 'N 0 obj'", () => {
    const doc = createPdfDoc({ title: "Test xref" });
    doc.heading("Titre");
    doc.paragraph("Paragraphe A.\nAvec un retour à la ligne.");
    doc.rule();
    doc.link("lien", "https://example.com");
    doc.table(
      [
        { header: "Colonne 1", width: 150 },
        { header: "Colonne 2", width: 150 },
      ],
      [
        [{ text: "a" }, { text: "b", link: "https://example.com/b" }],
        [{ text: "c" }, { text: "d" }],
      ]
    );
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);

    const trailerMatch = text.match(/trailer\n<< \/Size (\d+) \/Root (\d+) 0 R \/Info (\d+) 0 R >>\nstartxref\n(\d+)\n%%EOF$/);
    assert.ok(trailerMatch, "trailer introuvable ou mal formé");
    const size = Number(trailerMatch[1]);
    const startxref = Number(trailerMatch[4]);

    const xrefHeaderMatch = text.slice(startxref).match(/^xref\n0 (\d+)\n/);
    assert.ok(xrefHeaderMatch, "en-tête xref introuvable à l'offset annoncé par startxref");
    assert.equal(Number(xrefHeaderMatch[1]), size);

    // Table xref : une ligne "free" (objet 0) puis N lignes de 20 caractères ("nnnnnnnnnn 00000 n \n").
    const xrefBody = text.slice(startxref + xrefHeaderMatch[0].length);
    const freeLine = xrefBody.slice(0, 20);
    assert.equal(freeLine, "0000000000 65535 f \n");
    const objectCount = size - 1;
    for (let i = 1; i <= objectCount; i++) {
      const line = xrefBody.slice(20 * i, 20 * i + 20);
      const m = line.match(/^(\d{10}) 00000 n \n$/);
      assert.ok(m, `ligne xref ${i} mal formée : ${JSON.stringify(line)}`);
      const offset = Number(m[1]);
      // Vérification directe : à cet offset exact, le fichier contient bien "i 0 obj".
      const atOffset = text.slice(offset, offset + `${i} 0 obj`.length);
      assert.equal(atOffset, `${i} 0 obj`, `l'offset de l'objet ${i} ne pointe pas sur son 'N 0 obj'`);
    }
  });

  it("pagination multi-pages : assez de contenu déclenche une deuxième page, /Kids et /Count cohérents", () => {
    const doc = createPdfDoc({ title: "Test pagination" });
    for (let i = 0; i < 120; i++) doc.paragraph(`Ligne de contenu numéro ${i} pour forcer un saut de page.`);
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);

    const pagesMatch = text.match(/(\d+) 0 obj\n<< \/Type \/Pages \/Kids \[([^\]]+)\] \/Count (\d+) >>/);
    assert.ok(pagesMatch, "nœud /Pages introuvable");
    const kids = pagesMatch[2].trim().split(/\s+/).filter((t) => t !== "0" && t !== "R");
    assert.ok(kids.length >= 2, "au moins 2 pages attendues avec ce volume de contenu");
    assert.equal(Number(pagesMatch[3]), kids.length);

    // Chaque page listée dans /Kids existe bien comme objet /Type /Page distinct.
    for (const kid of kids) {
      const pageObjRe = new RegExp(`${kid} 0 obj\\n<< /Type /Page `);
      assert.ok(pageObjRe.test(text), `page ${kid} listée dans /Kids mais introuvable comme objet /Page`);
    }
  });

  it("un lien cliquable (link()) produit bien une annotation /Subtype /Link avec l'URL fournie", () => {
    const doc = createPdfDoc({ title: "Test lien" });
    doc.link("lien", "https://example.com/ressource");
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);
    assert.match(text, /\/Type \/Annot \/Subtype \/Link/);
    assert.match(text, /\/URI \(https:\/\/example\.com\/ressource\)/);
  });

  // Ajouts du 29/09/2026 (retour de Charles-Henri : "j'ai des ? et des phrases tronqués" dans le
  // PDF EADP) — voir le commentaire détaillé au-dessus de WINANSI_EXTRA_BYTES/toLatin1Safe dans
  // pdfWriter.js pour le contexte complet du bug corrigé ici.
  it("un tiret cadratin (—, très fréquent dans les exports Objectifs/EADP) n'est plus remplacé par '?'", () => {
    const doc = createPdfDoc({ title: "Test tiret" });
    doc.paragraph("12/03/2026 — Point d'avancement");
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);
    // Le tiret cadratin (U+2014) doit apparaître comme l'octet WinAnsi 0x97 dans le flux de
    // contenu, jamais comme "?" (0x3F) — recherché directement dans l'opérateur Tj.
    assert.match(text, /\(12\/03\/2026 \x97 Point d'avancement\)/);
    assert.doesNotMatch(text, /\(12\/03\/2026 \? Point d'avancement\)/);
  });

  it("un émoji (hors WinAnsi, ex. indicateur/notable) reste remplacé par '?' — limite connue, jamais un octet WinAnsi erroné", () => {
    const doc = createPdfDoc({ title: "Test émoji" });
    doc.paragraph("Titre \u{1F4CA}");
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);
    // Un emoji astral (2 unités UTF-16 surrogates) donne deux "?" — c'est la limite documentée de
    // ce moteur (aucune police de base ne sait dessiner un émoji), d'où le remplacement par des
    // symboles simples (+/-/=) décidé par Charles-Henri plutôt que de laisser les émojis littéraux.
    assert.match(text, /\(Titre \?\?\)/);
  });

  it("heading() découpe désormais un titre trop long au lieu de le laisser filer hors marge (bug de troncature corrigé)", () => {
    const doc = createPdfDoc({ title: "Test heading long" });
    const longTitle = "Un titre d'objectif extrêmement long qui ne peut absolument pas tenir sur une seule ligne de 495 points de large avec cette taille de police";
    doc.heading(longTitle, { size: 14 });
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);
    // Le texte doit être présent dans le flux, découpé en plusieurs opérations Tj (donc plusieurs
    // lignes) plutôt qu'en une seule ligne unique contenant tout le titre.
    const tjCount = (text.match(/\) Tj/g) || []).length;
    assert.ok(tjCount >= 2, `attendu au moins 2 lignes pour ce titre long, trouvé ${tjCount} opération(s) Tj`);
  });

  it("heading() avec color+align:'center' colore le texte et le décale vers la droite (par rapport à align par défaut)", () => {
    const left = createPdfDoc({ title: "Gauche" });
    left.heading("EADP Alice", { size: 18 });
    const leftText = bytesToLatin1String(left.save());
    const leftTd = leftText.match(/(\d+(?:\.\d+)?) \d+(?:\.\d+)? Td/);
    assert.ok(leftTd, "opérateur Td introuvable (version gauche)");
    assert.equal(Number(leftTd[1]), 50, "align par défaut ('left') doit démarrer à la marge (50)");

    const centered = createPdfDoc({ title: "Centré" });
    centered.heading("EADP Alice", { size: 18, align: "center", color: [0.85, 0.42, 0.09] });
    const centeredText = bytesToLatin1String(centered.save());
    assert.match(centeredText, /0\.85 0\.42 0\.09 rg/, "la couleur demandée doit apparaître comme opérateur 'rg'");
    const centeredTd = centeredText.match(/(\d+(?:\.\d+)?) \d+(?:\.\d+)? Td/);
    assert.ok(centeredTd, "opérateur Td introuvable (version centrée)");
    assert.ok(Number(centeredTd[1]) > 50, "align:'center' doit décaler le texte au-delà de la marge gauche");
  });

  it("les 4 polices de base (Helvetica, Bold, Oblique, BoldOblique) sont déclarées en /Resources /Font de chaque page", () => {
    const doc = createPdfDoc({ title: "Test polices" });
    doc.heading("Indicateur en italique bleu", { italic: true, color: [0.3, 0.3, 0.8] });
    const bytes = doc.save();
    const text = bytesToLatin1String(bytes);
    assert.match(text, /\/BaseFont \/Helvetica /);
    assert.match(text, /\/BaseFont \/Helvetica-Bold/);
    assert.match(text, /\/BaseFont \/Helvetica-Oblique/);
    assert.match(text, /\/BaseFont \/Helvetica-BoldOblique/);
    assert.match(text, /\/Font << \/F1 \d+ 0 R \/F2 \d+ 0 R \/F3 \d+ 0 R \/F4 \d+ 0 R >>/);
  });
});

describe("xlsxWriter.js — structure ZIP (CRC32, offsets, table centrale) et XML minimal", () => {
  it("CRC32 fait maison identique à zlib.crc32 (Node) pour chaque partie du classeur", () => {
    const columns = [
      { header: "Personne", width: 20 },
      { header: "Suivi", width: 40 },
    ];
    const rows = [
      ["Alice", "Ligne 1\nLigne 2 avec retour à la ligne"],
      ["Bob", "Une seule ligne, avec un & un < à échapper"],
    ];
    const bytes = buildXlsxBytes(columns, rows);

    // Reparcourt le ZIP produit pour retrouver chaque en-tête local (signature 0x04034b50) et son
    // CRC32 stocké, puis compare au CRC32 réellement calculé par Node sur les données brutes.
    let pos = 0;
    let localHeadersSeen = 0;
    while (pos < bytes.length) {
      const sig = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
      if ((sig >>> 0) !== 0x04034b50) break;
      const storedCrc =
        (bytes[pos + 14] | (bytes[pos + 15] << 8) | (bytes[pos + 16] << 16) | (bytes[pos + 17] << 24)) >>> 0;
      const size = bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24);
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const nameStart = pos + 30;
      const dataStart = nameStart + nameLen;
      const data = bytes.slice(dataStart, dataStart + size);
      const nodeCrc = zlib.crc32(data) >>> 0;
      assert.equal(storedCrc, nodeCrc, `CRC32 divergent pour l'entrée à l'offset ${pos}`);
      pos = dataStart + size;
      localHeadersSeen++;
    }
    assert.equal(localHeadersSeen, 6, "6 parties attendues : [Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/_rels/workbook.xml.rels, xl/styles.xml, xl/worksheets/sheet1.xml");
  });

  it("table centrale : une entrée par fichier, chacune référence le bon en-tête local par son offset", () => {
    const columns = [{ header: "Col", width: 20 }];
    const rows = [["valeur"]];
    const bytes = buildXlsxBytes(columns, rows);

    // End Of Central Directory (dernier enregistrement, taille fixe 22 octets, pas de commentaire ici).
    const eocdOffset = bytes.length - 22;
    const eocdSig = bytes[eocdOffset] | (bytes[eocdOffset + 1] << 8) | (bytes[eocdOffset + 2] << 16) | (bytes[eocdOffset + 3] << 24);
    assert.equal((eocdSig >>> 0).toString(16), "6054b50");
    const totalEntries = bytes[eocdOffset + 10] | (bytes[eocdOffset + 11] << 8);
    const centralDirSize = bytes[eocdOffset + 12] | (bytes[eocdOffset + 13] << 8) | (bytes[eocdOffset + 14] << 16) | (bytes[eocdOffset + 15] << 24);
    const centralDirOffset = bytes[eocdOffset + 16] | (bytes[eocdOffset + 17] << 8) | (bytes[eocdOffset + 18] << 16) | (bytes[eocdOffset + 19] << 24);
    assert.equal(totalEntries, 6);
    assert.equal(centralDirOffset + centralDirSize, eocdOffset);

    let pos = centralDirOffset;
    let entriesWalked = 0;
    const names = [];
    while (pos < eocdOffset) {
      const sig = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
      assert.equal((sig >>> 0).toString(16), "2014b50", `signature de table centrale invalide à l'offset ${pos}`);
      const nameLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const localHeaderOffset =
        (bytes[pos + 42] | (bytes[pos + 43] << 8) | (bytes[pos + 44] << 16) | (bytes[pos + 45] << 24)) >>> 0;
      const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
      const name = Buffer.from(nameBytes).toString("utf8");
      names.push(name);
      // L'en-tête local référencé par cet offset doit bien porter la même signature ET le même nom.
      const localSig = bytes[localHeaderOffset] | (bytes[localHeaderOffset + 1] << 8) | (bytes[localHeaderOffset + 2] << 16) | (bytes[localHeaderOffset + 3] << 24);
      assert.equal((localSig >>> 0).toString(16), "4034b50");
      const localNameLen = bytes[localHeaderOffset + 26] | (bytes[localHeaderOffset + 27] << 8);
      const localName = Buffer.from(bytes.slice(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLen)).toString("utf8");
      assert.equal(localName, name);
      pos += 46 + nameLen;
      entriesWalked++;
    }
    assert.equal(entriesWalked, 6);
    assert.deepEqual(names, [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("sheet1.xml : balises <row>/<c> équilibrées, en-tête + une ligne par entrée, texte échappé", () => {
    const columns = [
      { header: "Personne", width: 20 },
      { header: "Suivi", width: 40 },
    ];
    const rows = [
      ["Alice", "Contient un & une <balise> à échapper"],
      ["Bob", "Multi\nligne"],
    ];
    const bytes = buildXlsxBytes(columns, rows);
    const text = bytesToLatin1String(bytes);
    const sheetMatch = text.match(/<worksheet[^]*?<\/worksheet>/);
    assert.ok(sheetMatch, "sheet1.xml introuvable dans le ZIP assemblé");
    const sheetXml = sheetMatch[0];

    const rowOpen = (sheetXml.match(/<row /g) || []).length;
    const rowClose = (sheetXml.match(/<\/row>/g) || []).length;
    assert.equal(rowOpen, rowClose);
    assert.equal(rowOpen, rows.length + 1, "1 ligne d'en-tête + 1 ligne par entrée");

    const cOpen = (sheetXml.match(/<c /g) || []).length;
    const cClose = (sheetXml.match(/<\/c>/g) || []).length;
    assert.equal(cOpen, cClose);
    assert.equal(cOpen, (rows.length + 1) * columns.length);

    // Échappement XML : ni "&" ni "<" bruts dans le texte de cellule d'origine ne doivent
    // apparaître tels quels (seulement sous forme &amp;/&lt;).
    assert.ok(sheetXml.includes("&amp;"));
    assert.ok(sheetXml.includes("&lt;balise&gt;"));
    assert.ok(!/[^&]& /.test(sheetXml.replace(/&amp;|&lt;|&gt;|&quot;/g, "")));

    // autoFilter et dimension couvrent bien tout le rectangle de données (en-tête + lignes).
    assert.match(sheetXml, /<autoFilter ref="A1:B3"\/>/);
    assert.match(sheetXml, /<dimension ref="A1:B3"\/>/);
  });
});

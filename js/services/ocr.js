// Moteur de reconnaissance de texte (OCR) — wrapper autour de Tesseract.js, volontairement isolé
// ici (aucune manipulation du DOM, voir js/components/ocrScan.js pour l'interface utilisateur) :
// besoin du 01/10/2026 transmis par Charles-Henri ("j'aimerai pouvoir intégrer dans un post it un
// texte que je scannerai via l'appareil photo et qui se mettrait en forme de la même manière
// qu'écrit"). Décisions prises via AskUserQuestion AVANT tout code (voir js/components/ocrScan.js
// pour le détail produit complet) :
//  - Moteur OCR : Tesseract.js (local/hors-ligne, gratuit), PAS d'API cloud — limite assumée et
//    expliquée à Charles-Henri avant son choix : Tesseract.js est conçu pour du texte IMPRIMÉ, sa
//    fiabilité sur de l'écriture manuscrite réelle est significativement plus faible qu'une API
//    cloud dédiée à l'écriture manuscrite. C'est pour cette raison précise qu'une relecture
//    manuelle est TOUJOURS obligatoire avant d'enregistrer (voir ocrScan.js) — jamais un
//    enregistrement automatique du texte reconnu tel quel.
//
// Bibliothèque volontairement AUTO-HÉBERGÉE (vendor/tesseract/, jamais chargée depuis un CDN
// externe) : seule cohérence possible avec une app qui n'a jusqu'ici AUCUNE dépendance externe
// (aucun <script src="http..."> nulle part dans ce dépôt) et qui a investi un effort réel dans la
// fiabilité hors-ligne (voir claude/audit-performance-hors-ligne-15-09-2026.md) — un chargement
// CDN romprait le hors-ligne dès la toute première utilisation, et casserait la fonctionnalité
// entière si ce CDN venait à tomber ou à bloquer l'origine de l'app.
//
// IMPORTANT — fichiers du moteur non fournis par ce lot : le bac à sable utilisé pour écrire ce
// code n'a pas d'accès réseau vers npm/les CDN publics (confirmé par plusieurs tentatives
// indépendantes), donc les fichiers binaires de Tesseract.js (bibliothèque, worker, moteur wasm,
// données de langue française) n'ont pas pu être téléchargés ni commités automatiquement. Voir
// claude/vendor-tesseract-instructions-01-10-2026.md pour la procédure exacte (fichiers, tailles,
// sources, emplacements) que Charles-Henri doit suivre UNE SEULE FOIS pour les ajouter lui-même
// dans vendor/tesseract/. Tant qu'ils ne sont pas en place, ce module échoue proprement avec un
// message d'erreur explicite (voir plus bas) — jamais un plantage silencieux ou un bouton mort.
//
// `sw.js` NE précache PAS vendor/tesseract/ (plusieurs dizaines de Mo au total pour les 4
// variantes du moteur + les données de langue) — même principe que js/services/illustrations.js
// (LOT G9, 29/09/2026) : chargement à la demande uniquement, mis en cache par le service worker
// au premier scan réussi via sa stratégie générique cache-first (voir sw.js#fetch), jamais imposé
// à l'installation de l'app pour un utilisateur qui ne scannera peut-être jamais de post-it.

const TESSERACT_SCRIPT_URL = "./vendor/tesseract/tesseract.min.js";
const TESSERACT_OPTIONS = {
  workerPath: "./vendor/tesseract/worker.min.js",
  // Doit pointer vers un DOSSIER contenant les 4 variantes (tesseract-core(-simd)(-lstm).wasm.js)
  // — jamais un fichier précis : Tesseract.js choisit lui-même la bonne variante selon les
  // capacités de l'appareil (support SIMD ou non). Voir docs/local-installation.md de Tesseract.js.
  corePath: "./vendor/tesseract/core/",
  // Sans slash final (format attendu par Tesseract.js, qui construit lui-même
  // `langPath + '/' + lang + '.traineddata.gz'`).
  langPath: "./vendor/tesseract/lang-data",
};
const LANG = "fra";

let scriptLoadingPromise = null;
let workerPromise = null;

function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TESSERACT_SCRIPT_URL;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      // Pas de blocage permanent : si Charles-Henri ajoute les fichiers manquants en cours de
      // session (improbable mais sans coût à couvrir), le scan suivant retentera normalement
      // plutôt que de rester bloqué sur le tout premier échec.
      scriptLoadingPromise = null;
      reject(new Error("tesseract-script-missing"));
    });
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = loadTesseractScript()
      .then(() => {
        if (!window.Tesseract || typeof window.Tesseract.createWorker !== "function") {
          throw new Error("tesseract-unavailable");
        }
        return window.Tesseract.createWorker(LANG, 1, TESSERACT_OPTIONS);
      })
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

/**
 * Reconnaît le texte d'une image (objet File/Blob, typiquement issu d'un
 * `<input type="file" accept="image/*" capture="environment">`, voir js/components/ocrScan.js).
 * Erreurs possibles, toutes propagées à l'appelant (jamais avalées ici) :
 *  - `Error("tesseract-script-missing")` : vendor/tesseract/tesseract.min.js absent du dépôt.
 *  - `Error("tesseract-unavailable")` : script chargé mais API inattendue (fichier
 *    corrompu/incomplet/mauvaise version).
 *  - toute autre erreur : échec interne de Tesseract.js (ex. image illisible) — message brut de
 *    la bibliothèque, à l'appelant de décider du message affiché.
 */
export async function recognizeText(imageFile) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageFile);
  return (data && data.text) || "";
}

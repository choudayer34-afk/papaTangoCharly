// 📷 Scan d'un post-it physique (reconnaissance de texte sur une photo prise avec l'appareil
// photo) — LOT [non numéroté, besoin direct du 01/10/2026 hors roadmap TODO_TECHNIQUE.md] transmis
// par Charles-Henri : "j'aimerai pouvoir intégrer dans un post it un texte que je scannerai via
// l'appareil photo et qui se mettrait en forme de la même manière qu'écrit".
//
// Décisions prises via AskUserQuestion AVANT tout code :
//  - Moteur OCR : Tesseract.js (local/hors-ligne, gratuit) — voir js/services/ocr.js pour le
//    détail et la limite assumée (conçu pour du texte imprimé, pas de l'écriture manuscrite).
//  - Relecture : TOUJOURS une étape de relecture/correction manuelle avant d'enregistrer — jamais
//    d'enregistrement automatique direct du texte reconnu (voir openReviewModal ci-dessous,
//    seule porte de sortie vers onConfirm).
//  - Portée : bouton de scan disponible à la fois à la CRÉATION d'un post-it
//    (js/components/bureau.js#buildNoteEl, bouton "📷 Scanner" à côté de "+ Nouveau post-it")
//    ET sur un post-it déjà existant (js/components/stickyNoteShared.js#renderNoteBody, bouton
//    "📷" superposé en haut à droite de la zone de texte) — un seul point d'entrée partagé ici
//    (`startScan`) pour les deux appelants, chacun lui passant simplement un `initialText`
//    différent (vide à la création) et son propre `onConfirm`.
//
// Scanner sur un post-it DÉJÀ rempli : le texte reconnu est toujours proposé en COMPLÉMENT du
// contenu existant (ajouté à la suite, jamais en remplacement silencieux) — cohérent avec la
// Règle 3 de l'app ("ne jamais perdre une capture", voir js/components/stickyNoteShared.js). La
// relecture, de toute façon systématique, laisse Charles-Henri libre d'effacer l'ancien contenu
// lui-même s'il préfère un remplacement complet — aucune question supplémentaire n'a semblé
// nécessaire pour ce détail, l'étape de relecture couvrant déjà le risque dans les deux sens.
//
// Capture photo : `<input type="file" accept="image/*" capture="environment">` — nouveau pattern
// dans cette app (aucun autre endroit n'utilise la caméra). `capture="environment"` ouvre
// directement l'appareil photo arrière sur mobile ; sur desktop (où l'attribut est ignoré), le
// sélecteur de fichier classique s'ouvre à la place — comportement natif du navigateur, aucune
// détection manuelle du type d'appareil nécessaire ici.
import { recognizeText } from "../services/ocr.js";
import { openModal, closeModal } from "./modal.js";
import { showToast } from "./toast.js";

function buildLoadingBody() {
  const body = document.createElement("div");
  body.innerHTML = `<p class="item-meta" style="margin:0;">⏳ Analyse de la photo en cours… (peut prendre jusqu'à une minute, surtout au tout premier scan — le moteur de reconnaissance doit d'abord se charger).</p>`;
  return body;
}

function errorMessage(err) {
  if (err instanceof Error && err.message === "tesseract-script-missing") {
    return "📷 Scan indisponible : le moteur de reconnaissance de texte n'est pas encore installé dans l'app.";
  }
  if (err instanceof Error && err.message === "tesseract-unavailable") {
    return "📷 Scan indisponible : le moteur de reconnaissance de texte est mal installé (fichier incomplet).";
  }
  return "📷 Échec de la reconnaissance du texte — réessaie avec une photo plus nette et mieux cadrée.";
}

/**
 * Déclenche la prise de photo, lance la reconnaissance, affiche la relecture obligatoire, puis
 * appelle `onConfirm(finalText)` — jamais appelé si l'utilisateur annule à n'importe quelle étape
 * (sélecteur de fichier fermé sans choix, modale de relecture annulée).
 * @param {Object} [opts]
 * @param {string} [opts.initialText] - contenu déjà présent sur le post-it (scan sur un post-it
 *   existant) ; vide à la création. Le texte reconnu est toujours ajouté à la suite, jamais en
 *   remplacement (voir commentaire en tête de fichier).
 * @param {(finalText: string) => (void|Promise<void>)} opts.onConfirm
 */
export function startScan({ initialText = "", onConfirm } = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.style.display = "none";
  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return; // sélecteur fermé sans choisir de photo — pas d'événement d'annulation natif distinct
    await runRecognition(file, { initialText, onConfirm });
  });
  input.click();
}

async function runRecognition(file, { initialText, onConfirm }) {
  openModal({ title: "📷 Scan en cours", body: buildLoadingBody(), actions: [], dismissible: false });
  let text = "";
  let error = null;
  try {
    text = await recognizeText(file);
  } catch (err) {
    error = err;
  }
  closeModal();
  if (error) {
    console.error("[ocrScan] Échec de la reconnaissance :", error);
    showToast(errorMessage(error));
    return;
  }
  openReviewModal({ recognizedText: text, initialText, onConfirm });
}

function openReviewModal({ recognizedText, initialText, onConfirm }) {
  const hasExisting = !!(initialText && initialText.trim());
  const merged = hasExisting ? `${initialText}\n${recognizedText}`.trim() : (recognizedText || "").trim();
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="item-meta" style="margin-top:0;">Relis et corrige le texte avant d'enregistrer — la reconnaissance n'est jamais parfaite, surtout sur de l'écriture manuscrite.${
      hasExisting ? " Le texte reconnu a été ajouté à la suite du contenu déjà présent : efface ce que tu ne veux pas garder." : ""
    }</p>
    <textarea id="ocr-review-textarea" rows="8" style="width:100%;resize:vertical;" placeholder="Texte reconnu…"></textarea>
  `;
  const textarea = body.querySelector("#ocr-review-textarea");
  textarea.value = merged;
  openModal({
    title: "📷 Relecture avant enregistrement",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          await onConfirm?.(textarea.value);
          closeModal();
        },
      },
    ],
  });
  setTimeout(() => textarea.focus(), 30);
}

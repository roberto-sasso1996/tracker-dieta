// ============================================================
// Stima macro da foto pasto usando l'API Claude (Anthropic) vision.
//
// Chiamata diretta dal browser: l'API Anthropic supporta CORS per
// chi imposta l'header "anthropic-dangerous-direct-browser-access".
// Questo è pensato esplicitamente per pattern "bring your own key"
// come questo: la key resta SOLO nel localStorage del tuo browser,
// non viene mai committata nel repo né inviata a un tuo server.
//
// Limite da conoscere: chiunque apra devtools sul TUO browser può
// leggere la key dalle richieste di rete. Per un tool personale va
// bene; non è adatto a un'app pubblica multi-utente con la tua key.
// ============================================================

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001"; // veloce ed economico, adatto a chiamate frequenti

function getApiKey() {
  return localStorage.getItem("anthropic_api_key") || "";
}

export function setApiKey(key) {
  localStorage.setItem("anthropic_api_key", key.trim());
}

export function hasApiKey() {
  return !!getApiKey();
}

function getModel() {
  return localStorage.getItem("anthropic_model") || DEFAULT_MODEL;
}

export function setModel(model) {
  localStorage.setItem("anthropic_model", model);
}

/**
 * Stima i macro di un pasto da una foto, da una descrizione testuale, o da entrambe
 * insieme: se ci sono sia foto che testo, il testo viene usato come contesto aggiuntivo
 * per affinare la lettura della foto (quantità, ingredienti non visibili, condimenti...).
 * Serve almeno uno dei due.
 * @param {{base64?:string, mediaType?:string, description?:string}} input
 *   base64/mediaType: foto già compressa da image-utils.js (opzionale)
 *   description: testo scritto dall'utente (opzionale)
 * @returns {Promise<{description:string, calories:number, protein_g:number, carbs_g:number, fat_g:number}>}
 */
export async function estimateMacros({ base64, mediaType, description } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Nessuna API key Anthropic impostata. Aprine una nelle Impostazioni.");
  }
  const text = (description || "").trim();
  if (!base64 && !text) {
    throw new Error("Aggiungi una foto o scrivi una descrizione del pasto prima di analizzare.");
  }

  let prompt;
  if (base64 && text) {
    prompt = `Analizza questa foto di un pasto. L'utente ha aggiunto anche queste informazioni: "${text}" — usale per affinare la stima (quantità, ingredienti non visibili nella foto, condimenti, ecc).
Stima gli alimenti totali e i loro macronutrienti.
Rispondi SOLO con un oggetto JSON valido, senza markdown e senza testo aggiuntivo, in questo formato esatto:
{"description": "breve descrizione in italiano del pasto, che integra quanto scritto dall'utente", "calories": numero_kcal, "protein_g": numero, "carbs_g": numero, "fat_g": numero}`;
  } else if (base64) {
    prompt = `Analizza questa foto di un pasto. Stima gli alimenti visibili e i loro macronutrienti totali.
Rispondi SOLO con un oggetto JSON valido, senza markdown e senza testo aggiuntivo, in questo formato esatto:
{"description": "breve descrizione in italiano degli alimenti visibili", "calories": numero_kcal, "protein_g": numero, "carbs_g": numero, "fat_g": numero}
Se la foto non mostra cibo chiaramente, fai comunque la stima migliore possibile e indicalo nella description.`;
  } else {
    prompt = `Stima i macronutrienti di questo pasto, descritto dall'utente (nessuna foto disponibile): "${text}"
Rispondi SOLO con un oggetto JSON valido, senza markdown e senza testo aggiuntivo, in questo formato esatto:
{"description": "breve descrizione in italiano del pasto", "calories": numero_kcal, "protein_g": numero, "carbs_g": numero, "fat_g": numero}`;
  }

  const content = base64
    ? [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: prompt }]
    : prompt;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
        body: JSON.stringify({
      model: getModel(),
      max_tokens: 1024,
      messages: [{ role: "user", content }]
    })
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Errore API Claude (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    const blockTypes = (data.content || []).map((b) => b.type).join(", ") || "nessuno";
    throw new Error(`Risposta AI senza testo (stop_reason: ${data.stop_reason}, blocchi: ${blockTypes}).`);
  }


  let cleaned = textBlock.text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("La risposta AI non era JSON valido. Puoi inserire i macro manualmente.");
  }

  return {
    description: parsed.description || "",
    calories: Number(parsed.calories) || 0,
    protein_g: Number(parsed.protein_g) || 0,
    carbs_g: Number(parsed.carbs_g) || 0,
    fat_g: Number(parsed.fat_g) || 0
  };
}

/**
 * Stima le kcal bruciate in una sessione sportiva, dato tipo di attività e durata.
 * Se viene passato un profilo (peso/età/altezza, da js/profile.js) la stima usa
 * quei dati reali per il calcolo MET; altrimenti assume un adulto medio ~70kg.
 * @param {string} activity - es. "Corsa", "Nuoto", "Basket"
 * @param {number} durationMin - durata in minuti
 * @param {number} [distanceKm] - distanza percorsa in km, se pertinente/disponibile
 * @param {{weightKg?:number, age?:number, heightCm?:number}} [profile] - dati utente, se disponibili
 * @returns {Promise<number>} kcal stimate
 */
export async function estimateKcalForActivity(activity, durationMin, distanceKm, profile) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Nessuna API key Anthropic impostata. Aprine una nelle Impostazioni.");
  }

  const personLine = profile?.weightKg
    ? `Persona: peso ${profile.weightKg}kg${profile.age ? `, età ${profile.age} anni` : ""}${profile.heightCm ? `, altezza ${profile.heightCm}cm` : ""}.`
    : `Persona: dati non disponibili, usa una stima per un adulto medio di circa 70kg.`;

  const prompt = `Stima le calorie bruciate in questa sessione sportiva.
${personLine}
Attività: ${activity}
Durata: ${durationMin} minuti
${distanceKm ? `Distanza percorsa: ${distanceKm} km` : ""}
Usa i valori MET tipici per questo tipo di attività e intensità media, moltiplicati per il peso corporeo indicato. Rispondi SOLO con un oggetto JSON valido, senza markdown e senza testo aggiuntivo, in questo formato esatto:
{"kcal": numero_kcal_stimato}`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Errore API Claude (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("Risposta AI senza contenuto testuale.");

  let cleaned = textBlock.text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("La risposta AI non era JSON valido. Puoi inserire le kcal manualmente.");
  }

  return Number(parsed.kcal) || 0;
}

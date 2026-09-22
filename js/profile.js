// ============================================================
// Profilo utente: peso/età/altezza/foto, salvati su Firestore
// in users/{uid}/profile/data così sono disponibili da qualsiasi
// dispositivo per alimentare i calcoli AI (es. stima kcal bruciate
// in gym.html), non solo nel browser in cui li hai inseriti.
// Sotto-collezione (non il documento users/{uid} stesso) per restare
// coperti senza ambiguità dalla regola esistente
// "match /users/{userId}/{document=**}", la stessa che copre già
// workouts e meals.
//
// La foto profilo segue lo stesso schema delle foto pasto: mai
// Firebase Storage, compressa lato client e salvata come base64
// nel campo photoData del documento stesso.
// ============================================================

import { db } from "./firebase-init.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/**
 * @param {string} uid
 * @returns {Promise<{weightKg?:number, age?:number, heightCm?:number, photoData?:string}|null>}
 */
export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid, "profile", "data"));
  return snap.exists() ? snap.data() : null;
}

/**
 * Merge parziale: passa solo i campi che vuoi aggiornare.
 * @param {string} uid
 * @param {{weightKg?:number|null, age?:number|null, heightCm?:number|null, photoData?:string}} fields
 */
export async function saveProfile(uid, fields) {
  await setDoc(doc(db, "users", uid, "profile", "data"), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
}

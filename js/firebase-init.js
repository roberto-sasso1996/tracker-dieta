// ============================================================
// CONFIGURAZIONE FIREBASE
// Sostituisci i valori sotto con quelli del TUO progetto Firebase.
// Li trovi in: Console Firebase → Impostazioni progetto → Le tue app → SDK config.
// Istruzioni complete nel README.md.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAz7JyXf-LCx9fVNRt207850_juvnKqR-M",
  authDomain: "tracker-personale-b4394.firebaseapp.com",
  projectId: "tracker-personale-b4394",
  storageBucket: "tracker-personale-b4394.firebasestorage.app",
  messagingSenderId: "501559225175",
  appId: "1:501559225175:web:a59de8bbb4f31654ee6c12"
};

// Nota: niente Firebase Storage. Da inizio 2026 richiede il piano
// Blaze (carta di credito collegata). Le foto dei pasti vengono
// invece compresse e salvate come base64 direttamente in Firestore
// (vedi js/image-utils.js) — tutto resta sul piano Spark, gratuito.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

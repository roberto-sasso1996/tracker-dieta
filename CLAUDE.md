# Contesto progetto — Tracker allenamenti + pasti

App statica per GitHub Pages: log allenamenti/carichi in palestra + diario pasti con stima AI dei macro da foto. Vanilla HTML/CSS/JS, nessun build step, Firebase come backend.

## Vincoli architetturali — leggere prima di modificare

Queste sono scelte deliberate, non dimenticanze. Se sembrano subottimali, il motivo è sotto — non "correggerle" senza aver letto perché sono così, e se proprio serve cambiarle chiedi conferma prima.

- **Niente build step.** Moduli ES nativi (`<script type="module">`), Firebase SDK modulare v10.14.1 importato via CDN (`gstatic.com`). Il sito va servito così com'è, file statici, direttamente da GitHub Pages.
- **Niente Firebase Storage.** Da inizio 2026 richiede il piano Blaze (carta di credito collegata, anche se l'uso resta gratuito sotto quota). L'utente non vuole collegare una carta. Le foto dei pasti vengono quindi **compresse lato client** (`js/image-utils.js`: canvas, resize a 640px sul lato lungo, JPEG a qualità decrescente finché il risultato non sta sotto ~700KB) e salvate come **base64 dentro il documento Firestore stesso** (campo `photoData`, una data URL completa `data:image/jpeg;base64,...`). Tutto resta sul piano Spark (gratuito, nessuna carta richiesta).
- **Stima macro AI: chiamata diretta browser → `api.anthropic.com`**, niente backend/proxy. Header `anthropic-dangerous-direct-browser-access: true` (pattern "bring your own key", ufficialmente supportato da Anthropic per questo caso d'uso). La API key Anthropic vive **solo in `localStorage`** del browser dell'utente: mai nel codice, mai nel repo. Compromesso noto e accettato: chi ha devtools aperti sullo stesso browser può leggerla dal traffico di rete — accettabile per un tool a uso personale, da NON estendere a un'app multi-utente senza mettere la key dietro un vero backend.
  - Modello default: `claude-haiku-4-5-20251001` (economico, veloce). Alternativa esposta nelle Impostazioni: `claude-sonnet-5` (più accurato, più costoso).
- **Auth: Firebase Authentication, solo email/password.** Nessun social login — scelta di semplicità, non un limite tecnico.
- **Dati per utente sotto `users/{uid}/...`**, regole Firestore: solo l'utente autenticato può leggere/scrivere i propri documenti.

## Stato attuale

- Progetto Firebase creato: `tracker-personale-b4394` (region `eur3`).
- Authentication → Email/Password abilitato.
- Firestore creato, regole di sicurezza pubblicate.
- `js/firebase-init.js` già compilato con la `firebaseConfig` reale del progetto (non è un placeholder, non serve toccarlo).
- Storage **non** abilitato, per scelta (vedi sopra) — non riattivarlo.
- **Non ancora fatto**: l'utente non ha ancora inserito la sua API key Anthropic nelle Impostazioni dell'app (lo farà lui dall'interfaccia, non va nel codice), non ha ancora fatto push su GitHub né attivato Pages, non c'è stato ancora un test end-to-end reale.

## Struttura file

```
index.html        login/registrazione + dashboard (allenamento di oggi, pasti di oggi, tile Palestra/Pasti, sheet Impostazioni)
gym.html           storico allenamenti + form dinamico esercizi/serie/carichi (pesi) e sessioni cardio (distanza/durata/kcal)
food.html          diario pasti: cattura foto → compressione → analisi AI opzionale (foto e/o testo) → macro editabili → salvataggio; più sezione Andamento (grafici Chart.js kcal/macro per 10/20/30/60 giorni + export CSV aggregato per giorno)
css/style.css      design system via CSS var: --gym (corallo) e --food (verde salvia) come accenti funzionali
js/firebase-init.js  init Firebase + config (già compilata)
js/auth.js         login/registrazione/logout + requireAuth() come guardia di route sulle pagine protette
js/image-utils.js  compressImage(file) → {dataUrl, base64, mediaType, approxBytes}
js/ai-vision.js    estimateMacros({base64, mediaType, description}) → foto e/o testo (almeno uno dei due), il testo integra/sostituisce la foto come contesto per Claude; estimateKcalForActivity(activity, durationMin, distanceKm, profile) → Claude testuale, stima kcal via MET usando il profilo utente se disponibile (altrimenti adulto medio ~70kg)
js/profile.js      getProfile(uid) / saveProfile(uid, fields) → users/{uid}/profile/data (peso/età/altezza/foto profilo/obiettivo giornaliero/elenco esercizi personalizzato)
js/csv-utils.js    downloadCsv(filename, rows) → export CSV lato client (Blob + <a download>), usato da gym.html e food.html
icons/              apple-touch-icon.png (180x180), icon-512.png, favicon-32.png — generate con `sips` da un'immagine sorgente 1024x1024 fornita dall'utente, nessuna dipendenza aggiunta
README.md          istruzioni di setup complete (Firebase, API key, deploy) — utili anche a te per capire il "perché"
```

Chart.js caricato via CDN (`cdn.jsdelivr.net`, UMD build pinnata a una versione) solo in `food.html` (sezione Andamento) — stesso principio "niente build step" del resto: script tag classico, nessun bundler. Rimosso da `gym.html` su richiesta esplicita dell'utente (il grafico di progressione carichi per esercizio non c'è più).

## Schema dati (Firestore)

```
users/{uid}/profile/data             // documento singolo: profilo utente
  weightKg: number
  age: number
  heightCm: number
  photoData: string   // data URL base64, foto profilo compressa (stesso schema delle foto pasto)
  dailyGoal: { calories, protein_g, carbs_g, fat_g }   // obiettivo giornaliero, opzionale, alimenta le barre di progresso
  exerciseList: string[]   // esercizi personalizzati dell'utente, gestiti da Impostazioni; popolano il menu a tendina in gym.html e si auto-aggiornano quando l'utente scrive un nome nuovo lì
  updatedAt: timestamp

users/{uid}/workouts/{id}
  date: "YYYY-MM-DD"
  exercises: [{ name, sets: [{ reps, weight }] }]
  cardio: [{ activity, distanceKm, durationMin, speedKmh, kcal }]   // speedKmh calcolata client-side da distanza/durata
  notes: string
  createdAt: timestamp

users/{uid}/meals/{id}
  date: "YYYY-MM-DD"
  mealType: "Colazione" | "Pranzo" | "Cena" | "Spuntino"
  description: string
  photoData: string   // data URL base64, già compressa
  macros: { calories, protein_g, carbs_g, fat_g }
  createdAt: timestamp
```

## Prossimi step noti (non richiedono codice)

1. Utente inserisce la sua API key Anthropic dalle Impostazioni dell'app, una volta online.
2. Push del repo su GitHub (consigliato privato — `firebase-init.js` contiene la config del progetto, non segreta ma non necessario esporla).
3. GitHub → Settings → Pages → Source: `main`, `/(root)`.
4. Primo test end-to-end: registrazione utente, aggiunta allenamento, aggiunta pasto con foto + analisi AI.

## Estensioni implementate

Obiettivo calorico/macro giornaliero con barra di progresso (`dailyGoal` nel profilo, mostrato in `food.html` e nella dashboard), export CSV dello storico (`js/csv-utils.js`, bottoni in `gym.html`/`food.html`), dashboard con allenamento+pasti di oggi (`index.html`), sezione Andamento in `food.html` con grafici kcal/macro per periodo (10/20/30/60gg) ed export CSV aggregato per giorno.

**Esercizi personalizzati** (`gym.html` + Impostazioni in `index.html`): in "Nuovo allenamento" il nome esercizio è un `<select>` popolato da `currentProfile.exerciseList`, con opzione "+ Nuovo esercizio…" che rivela un input di testo libero (toggle `select`/`input` via proprietà `.hidden`, non `style.display` — mai mischiare i due sullo stesso elemento, l'inline style vince sempre sull'attributo `hidden` e lo rende inefficace). Un nome scritto a mano viene aggiunto automaticamente a `exerciseList` al salvataggio dell'allenamento (dedup case-insensitive), così la prossima volta compare nel menu senza bisogno di passare da Impostazioni. La sezione "I tuoi esercizi" in Impostazioni permette di rinominare (inline, salva su blur) o eliminare voci esistenti, e di aggiungerne di nuove direttamente.

**Sheet di dettaglio al click su una card** (pasto o allenamento): implementato separatamente in ciascuna delle tre pagine (`index.html`, `gym.html`, `food.html`) — ognuna ha il proprio `#detailBackdrop`/`openMealDetail`/`openWorkoutDetail`, non è un componente condiviso (nessun sistema di import di componenti in un progetto senza build step). Se lo modifichi in una pagina, replica la modifica nelle altre se serve coerenza.

**Refresh dopo add/delete**: ogni pagina ri-fetcha e ri-renderizza subito dopo una modifica (nessun listener Firestore `onSnapshot`, per scelta di semplicità — refresh esplicito dopo ogni mutazione, non push in tempo reale multi-tab/multi-dispositivo). In `food.html`, sia il salvataggio che l'eliminazione di un pasto richiamano anche `refreshTrend()` per tenere sincronizzati i grafici della sezione Andamento — se aggiungi altre azioni che modificano i pasti, ricordati di chiamarla anche lì.

## Estensioni proposte ma non implementate

Elencata anche nel README: PWA (manifest + service worker) per installazione da telefono.

## Preferenze di stile per questo utente

Risposte dirette e pratiche, tono da consulente senior, no filler teorico. Se una richiesta porta verso una scelta subottimale, segnalalo chiaramente con la motivazione invece di eseguire silenziosamente. Preferisce output completi e pronti all'uso piuttosto che snippet parziali.

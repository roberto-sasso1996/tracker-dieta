# Tracker — allenamenti + pasti

App statica (HTML/CSS/JS vanilla, nessun build step) pensata per GitHub Pages.
Due sezioni:
- **Palestra**: log di esercizi, serie, ripetizioni e carichi.
- **Pasti**: foto del pasto → stima automatica dei macro tramite Claude Vision (API Anthropic, chiamata diretta dal browser con la tua key) → salvataggio con possibilità di correggere i valori prima di salvare.

Dati sincronizzati su Firestore, con login email/password così puoi usarla sia da telefono che da laptop con lo stesso account. **Solo piano Spark (gratuito), nessuna carta di credito richiesta**: le foto dei pasti non passano da Firebase Storage (che da inizio 2026 richiede il piano Blaze) ma vengono compresse lato client e salvate come base64 direttamente dentro il documento Firestore del pasto.

---

## 1. Crea il progetto Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) → **Aggiungi progetto**. Nome libero, es. `tracker-personale`. Google Analytics non serve, puoi disattivarlo.
2. **Authentication** → scheda *Sign-in method* → abilita **Email/Password**.
3. **Firestore Database** → *Crea database* (se non esiste già — alcuni progetti ne hanno già uno di default) → modalità **production** → scegli una region vicina (es. `eur3`).
4. **Impostazioni progetto** (icona ingranaggio) → scorri fino a *Le tue app* → clicca l'icona web `</>` → registra l'app (nome libero, non serve Hosting) → copia l'oggetto `firebaseConfig` che ti viene mostrato.

Niente Firebase Storage: da febbraio 2026 richiede il piano Blaze (pay-as-you-go, serve una carta collegata anche se l'uso resta gratuito sotto i 5GB). Per restare sul piano Spark, le foto dei pasti sono salvate come base64 dentro Firestore stesso — vedi sezione 4 più sotto.

Incolla quei valori in `js/firebase-init.js`, sostituendo i placeholder `INSERISCI_QUI`.

### Regole di sicurezza

Su un progetto nuovo le regole di default in modalità production bloccano tutto. Vanno impostate così, in modo che solo l'utente autenticato possa leggere/scrivere i propri dati:

**Firestore** (scheda *Regole* di Firestore Database):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Pubblica dopo averla incollata.

### Il tuo account

L'app non ha un flusso di invito: la prima volta apri `index.html`, clicchi "Crea un account", inserisci una tua email e password. Da quel momento accedi con le stesse credenziali da qualsiasi dispositivo.

---

## 2. API key Anthropic (per la stima macro da foto)

1. Vai su [console.anthropic.com](https://console.anthropic.com) → **API Keys** → crea una key.
2. Nell'app, apri **Home → ⚙ Impostazioni**, incolla la key e salva.

La key resta **solo nel `localStorage` del tuo browser**: non viene mai scritta nel codice, non finisce nel repo Git, non passa da Firebase. Viene inviata direttamente da browser a `api.anthropic.com` a ogni richiesta di analisi foto (pattern "bring your own key", esplicitamente supportato da Anthropic tramite l'header `anthropic-dangerous-direct-browser-access`).

**Compromesso di cui essere consapevoli**: chiunque abbia accesso fisico al tuo browser con devtools aperti può leggere la key dal traffico di rete. Per un tool a uso personale è un rischio accettabile; non renderebbe sicuro esporre così la key in un'app pubblica multi-utente.

Costo: con il modello di default (Haiku 4.5) ogni analisi foto costa frazioni di centesimo. Puoi passare a Sonnet 5 dalle Impostazioni se vuoi stime più accurate, a fronte di un costo leggermente più alto.

Se in un dato momento non vuoi/puoi usare l'AI, il campo macro è comunque editabile a mano: la foto resta solo come riferimento visivo.

### Foto compresse in Firestore, non su Storage

Prima di essere salvata o analizzata, la foto viene ridimensionata (lato più lungo 640px) e ricompressa in JPEG a qualità decrescente finché non sta comodamente sotto il limite di ~1 MiB per documento di Firestore — nella pratica il campo `photoData` pesa in genere 30-100 KB. È una foto di log, non un file da stampare: qualità più che sufficiente per riconoscere il pasto nello storico, a costo di non essere una foto ad alta risoluzione.

Con lo storage gratuito di Firestore (1 GiB sul piano Spark) e una foto media da ~50KB, hai margine per diverse migliaia di pasti registrati prima di doverti preoccupare del limite — per un uso personale è più che sufficiente per anni.

---

## 3. Deploy su GitHub Pages

```bash
cd tracker
git init
git add .
git commit -m "Setup iniziale tracker"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/<nome-repo>.git
git push -u origin main
```

Poi su GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main, /(root)**. Dopo un paio di minuti il sito è live su `https://<tuo-utente>.github.io/<nome-repo>/`.

> **Attenzione**: il repo conterrà `js/firebase-init.js` con la tua `firebaseConfig`. Non è un segreto in senso stretto (è progettata per essere pubblica, la sicurezza reale è nelle Firestore rules sopra), ma se preferisci non esporla in un repo pubblico, crea il repo come **privato** — GitHub Pages funziona anche da repo privati sui piani Pro/Team/Enterprise, oppure valuta GitHub Pages con Actions e un secret. Per un tool personale il repo privato è la scelta più semplice.

---

## 4. Struttura dati (Firestore)

```
users/{uid}/profile/data             // documento singolo: profilo utente
  weightKg: number
  age: number
  heightCm: number
  photoData: string   // data URL base64, foto profilo compressa (stesso schema delle foto pasto)
  dailyGoal: { calories, protein_g, carbs_g, fat_g }   // obiettivo giornaliero, opzionale
  updatedAt: timestamp

users/{uid}/workouts/{id}
  date: "YYYY-MM-DD"
  exercises: [{ name, sets: [{ reps, weight }] }]
  cardio: [{ activity, distanceKm, durationMin, speedKmh, kcal }]
  notes: string
  createdAt: timestamp

users/{uid}/meals/{id}
  date: "YYYY-MM-DD"
  mealType: "Colazione" | "Pranzo" | "Cena" | "Spuntino"
  description: string
  photoData: string   // data URL "data:image/jpeg;base64,...", compressa lato client
  macros: { calories, protein_g, carbs_g, fat_g }
  createdAt: timestamp
```

---

## 5. Funzionalità aggiuntive

- **Cardio**: oltre agli esercizi con pesi, ogni allenamento può includere sessioni cardio/sport (corsa, nuoto, ciclismo, ecc.) con distanza, durata e kcal bruciate — stimabili anche con l'AI (testo, non foto) usando i dati del tuo profilo se li hai impostati.
- **Profilo utente**: peso, età, altezza e foto profilo, impostabili dalla Home → Impostazioni. Alimentano le stime AI (es. kcal bruciate) per risultati più precisi.
- **Grafico progressione carichi**: nella pagina Palestra, seleziona un esercizio per vedere il carico massimo per sessione nel tempo (Chart.js via CDN).
- **Obiettivo calorico/macro giornaliero**: impostabile in Home → Impostazioni; la pagina Pasti (e la dashboard, per le kcal) mostrano una barra di progresso rispetto al consumato del giorno.
- **Export CSV**: dalle pagine Palestra e Pasti puoi scaricare l'intero storico in CSV (esclude le foto, che restano solo su Firestore).

## 6. Possibili estensioni (non incluse)

- PWA (manifest + service worker) per installarla come app da telefono

Se vuoi, posso implementarla.

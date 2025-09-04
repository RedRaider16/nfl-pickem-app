import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================
// 🔹 STEP 1: Firebase Config
// ==========================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "nfl-pickem-week1";

let userId = null;
const games = [
  "Cowboys vs Eagles", "Chiefs vs Chargers", "Falcons vs Buccaneers",
  "Bengals vs Browns", "Colts vs Dolphins", "Raiders vs Patriots",
  "Saints vs Cardinals", "Jets vs Steelers", "Commanders vs Giants",
  "Jaguars vs Panthers", "Broncos vs Titans", "Packers vs Vikings",
  "Rams vs Seahawks", "49ers vs Bears", "Lions vs Bills",
  "Texans vs Ravens"
];

// ==========================
// 🔹 STEP 2: Authentication
// ==========================
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    document.getElementById("userIdDisplay").textContent = `Your User ID: ${userId}`;
    generateFormFields();
    loadScoreboard();
    generateResultsFields();
    hideAdminPanel();
  }
});

// ==========================
// 🔹 STEP 3: Form generation
// ==========================
function generateFormFields() {
  const container = document.getElementById("gamesContainer");
  container.innerHTML = "";
  games.forEach((game, idx) => {
    container.innerHTML += `
      <div class="game">
        <label><strong>${game}</strong></label><br/>
        Winner: <input type="text" name="winner${idx}" required/><br/>
        Confidence (1-16): <input type="number" name="conf${idx}" min="1" max="16" required/><br/>
        Predicted Total: <input type="number" name="pred${idx}" required/>
      </div>`;
  });
}

document.getElementById("picksForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!userId) return;

  const data = {};
  games.forEach((_, idx) => {
    data[`game${idx}`] = {
      winner: e.target[`winner${idx}`].value,
      confidence: parseInt(e.target[`conf${idx}`].value),
      predicted: parseInt(e.target[`pred${idx}`].value)
    };
  });

  await setDoc(doc(db, `artifacts/${appId}/users/${userId}`), data);
  await setDoc(doc(db, `artifacts/${appId}/public/data/${userId}`), { name: userId, picks: data });

  alert("Picks submitted! They are now locked.");
  e.target.reset();
});

// ==========================
// 🔹 STEP 4: Scoring
// ==========================
function calculateScore(userPicks, officialResults) {
  let total = 0;
  if (!officialResults) return total;
  Object.keys(userPicks).forEach((gameKey) => {
    const pick = userPicks[gameKey];
    const result = officialResults[gameKey];
    if (!result) return;

    if (pick.winner && result.winner && pick.winner.toLowerCase() === result.winner.toLowerCase()) {
      total += pick.confidence;
    }
    if (pick.predicted && result.totalScore) {
      let diff = Math.abs(pick.predicted - result.totalScore);
      total += Math.max(0, 10 - diff);
    }
  });
  return total;
}

// ==========================
// 🔹 STEP 5: Scoreboard
// ==========================
async function loadScoreboard() {
  const resultsSnap = await getDoc(doc(db, `artifacts/${appId}/public/results/week1`));
  let officialResults = resultsSnap.exists() ? resultsSnap.data() : null;

  const publicRef = collection(db, `artifacts/${appId}/public/data`);
  onSnapshot(publicRef, (snapshot) => {
    const div = document.getElementById("scoreboard");
    div.innerHTML = "";

    let players = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      let score = calculateScore(d.picks, officialResults);
      players.push({ name: d.name, score });
    });

    players.sort((a, b) => b.score - a.score);
    let html = "<table><tr><th>Rank</th><th>Player</th><th>Score</th></tr>";
    players.forEach((p, idx) => html += `<tr><td>${idx+1}</td><td>${p.name}</td><td>${p.score}</td></tr>`);
    html += "</table>";
    div.innerHTML = html;
  });
}

// ==========================
// 🔹 STEP 6: Admin Panel
// ==========================
function generateResultsFields() {
  const container = document.getElementById("resultsContainer");
  container.innerHTML = "";
  games.forEach((game, idx) => {
    container.innerHTML += `
      <div class="game">
        <label><strong>${game} Result</strong></label><br/>
        Winner: <input type="text" name="resultWinner${idx}" /><br/>
        Total Score: <input type="number" name="resultScore${idx}" />
      </div>`;
  });
}

document.getElementById("resultsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const results = {};
  games.forEach((_, idx) => {
    results[`game${idx}`] = {
      winner: e.target[`resultWinner${idx}`].value,
      totalScore: parseInt(e.target[`resultScore${idx}`].value)
    };
  });
  await setDoc(doc(db, `artifacts/${appId}/public/results/week1`), results);
  alert("Official results submitted!");
});

// ==========================
// 🔹 STEP 7: Simple Admin Hide
// ==========================
function hideAdminPanel() {
  const password = prompt("Enter admin password (leave blank for players):");
  if (password !== "YOUR_SECRET_PASSWORD") {
    document.getElementById("adminPanel").style.display = "none";
  }
}

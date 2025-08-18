const urls = window.DATA_URLS;
let DATA = {};

// fetch JSON with cache-buster
async function getJSON(u) {
  const r = await fetch(u + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error(u + " " + r.status);
  return r.json();
}

// load all data
async function loadData() {
  [DATA.profile, DATA.smalltalk, DATA.jokes, DATA.memes] = await Promise.all([
    getJSON(urls.profile),
    getJSON(urls.smalltalk),
    getJSON(urls.jokes),
    getJSON(urls.memes)
  ]);
}
loadData();

function addMessage(who, text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.innerText = (who === "user" ? "You: " : "Bot: ") + text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// witty intro for "who is chaitanya"
function wittyWho() {
  return "Chaitanya is an electronic device 😜 Just kidding!\n" +
         "Chaitanya is a Junior Software Engineer at iTriangle Infotech, skilled in Power BI, MySQL, and Python ETL. " +
         "He built Financial MIS dashboards, EOL dashboards (Stage 1 & 2), automated pipelines, and deployed reports with live refresh.";
}

// bot reply logic
function botReply(msg) {
  msg = msg.toLowerCase();

  if (msg.includes("who is chaitanya")) return wittyWho();
  if (msg.includes("joke")) {
    let j = DATA.jokes?.jokes;
    return j ? j[Math.floor(Math.random() * j.length)] : "No jokes found!";
  }
  if (msg.includes("meme")) {
    let m = DATA.memes?.memes;
    return m ? m[Math.floor(Math.random() * m.length)] : "No memes found!";
  }

  // fallback smalltalk
  let st = DATA.smalltalk?.intents || [];
  for (let i of st) {
    if (msg.includes(i.tag)) {
      let res = i.responses;
      return res[Math.floor(Math.random() * res.length)];
    }
  }

  return "I didn’t get that, try asking differently!";
}

// input handler
document.getElementById("input").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const text = e.target.value.trim();
    if (!text) return;
    addMessage("user", text);
    const reply = botReply(text);
    addMessage("bot", reply);
    e.target.value = "";
  }
});

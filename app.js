/* TatTvam — JS port of your Python script (runs on GitHub Pages)
   - Loads: smalltalk.json, about_chaitanya.json, jokes.json, memes.json
   - Features: witty “who” intro, math, stronger NLP cues, smalltalk (skip jokes/memes here),
               external jokes/memes, web summaries (no links), polite fallbacks
*/

/* ---------- 1) Loader ---------- */
const urls = window.DATA_URLS || {
  smalltalk: "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/smalltalk.json",
  profile:   "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/about_chaitanya.json",
  jokes:     "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/jokes.json",
  memes:     "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/memes.json"
};

async function getJSON(url){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

const DATA = {};
(async () => {
  try {
    const [smalltalk, profile, jokes, memes] = await Promise.all([
      getJSON(urls.smalltalk), getJSON(urls.profile), getJSON(urls.jokes), getJSON(urls.memes)
    ]);
    DATA.smalltalk = smalltalk;
    DATA.profile   = profile;
    DATA.jokes     = jokes;
    DATA.memes     = memes;
    boot();
  } catch (e) {
    console.error("Load error:", e);
    addMsg("bot", "Startup error: couldn’t load data. Please refresh.");
  }
})();

/* ---------- 2) UI helpers ---------- */
const chat  = document.getElementById("chat");
const form  = document.getElementById("form");
const input = document.getElementById("input");

function escapeHtml(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function addMsg(role, text){
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}
const rand  = a => a[Math.floor(Math.random()*a.length)];
const clamp = (t,n=550)=> t.length<=n ? t : (t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ") || t.slice(0,n))+"…";
const norm  = t => t.toLowerCase()
  .replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ")
  .replace(/\s+/g," ").trim();
const anyIn = (t, arr) => arr.some(x => t.includes(x));

/* ---------- 3) Smalltalk (skip internal jokes/memes) ---------- */
const SKIP = new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);
let INTENTS = [];
function buildIntents(){
  INTENTS = (DATA.smalltalk?.intents || [])
    .filter(it => !SKIP.has(it.name))
    .map(it => ({ name: it.name, patterns: (it.patterns||[]).map(norm), responses: it.responses||[] }));
}
function smalltalkReply(t){
  const hits = INTENTS.filter(it => it.patterns.some(p => p && t.includes(p)));
  if(hits.length) return rand(rand(hits).responses);
  // light fuzzy: try token overlap
  let best=null, score=0;
  for(const it of INTENTS){
    for(const p of it.patterns){
      if(!p) continue;
      const s = jaccard(t, p);
      if(s > score){score=s; best=it;}
    }
  }
  if(best && score >= 0.28) return rand(best.responses);
  return null;
}
function jaccard(a,b){
  const A = new Set(a.split(" ")), B = new Set(b.split(" "));
  const inter = [...A].filter(x=>B.has(x)).length;
  const uni   = new Set([...A,...B]).size || 1;
  return inter/uni;
}

/* ---------- 4) Jokes & Memes (external JSON) ---------- */
function randomJoke(){ return rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]); }
function randomMeme(){ return rand(DATA.memes?.memes || ["No memes loaded 😅"]); }

/* ---------- 5) Math (safe-ish) ---------- */
const mathRe = /(?<!\w)([\d\.\s+\-*/%()]+)(?!\w)/;
function tryMath(s){
  const m = s.toLowerCase().match(mathRe);
  if(!m) return null;
  const expr = m[1].replace(/\^/g,"**").replace(/[^\d\.\s+\-*/%()]/g,"").trim();
  try{
    // eslint-disable-next-line no-eval
    const v = eval(expr);
    if(typeof v==="number" && Number.isFinite(v)) return "= " + (Number.isInteger(v)? v : v.toString());
  }catch(_){}
  return null;
}

/* ---------- 6) Stronger NLP cues (Python parity) ---------- */
const CUES = {
  who: ["who is chaitanya","what is chaitanya","who is chay","who is chaitaya","introduce chaitanya","about chaitanya","profile summary","who is he"],
  company: ["company","current company","which company","present company","employer","where does he work"],
  education: ["education","degree","qualification","college","study","studies","what did he study"],
  skills: ["skills","tech stack","stack","tools","technology","what tools"],
  projects: ["projects","project list","what all projects","overview of projects","work done","recent work"],
  eol: ["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl: ["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
  finance: ["finance","q1","april may","financial summary","performance dashboard"],
  deployment: ["deploy","deployment","iframe","website","embed","publish"]
};
function bestLabel(t){
  t = norm(t);
  let best=null, score=0;
  for(const [lbl,cues] of Object.entries(CUES)){
    for(const c of cues){
      const s = similarity(t, norm(c));
      if(s>score){score=s; best=lbl;}
    }
  }
  return score >= 0.72 ? best : null; // mirrors Python threshold
}
function similarity(a,b){
  const len = Math.max(a.length,b.length)||1;
  let same=0; for(const w of b.split(" ")){ if(a.includes(w)) same += w.length; }
  return same/len;
}

/* ---------- 7) Profile answers (incl. witty 'who') ---------- */
function titleCase(s){return s.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());}
function wittyWho(){
  return "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n" +
         "Chaitanya is a Junior Software Engineer skilled in Power BI, MySQL, and Python ETL. " +
         "Built finance & EOL dashboards, automated 12 AM refresh via Gateway, and deployed via iFrame.";
}
function profileCompany(){
  const e = DATA.profile?.experience?.[0];
  return e ? `Current company: ${e.company} — role: ${e.title} (${e.duration}).` : "Company info not available.";
}
function profileEducation(){
  const ed = DATA.profile?.education || [];
  if(!ed.length) return "Education: Bachelor of Commerce + Data Analyst/Data Science specializations.";
  const rows = ed.map(e => e.degree ? `${e.degree} — ${e.institute} (${e.date})`
                                     : `${e.course} — ${e.institute} (${e.date})`);
  return "Education:\n- " + rows.join("\n- ");
}
function profileSkills(){
  const ts = DATA.profile?.technical_skills || {};
  const lines = Object.entries(ts).map(([k,v]) => `${titleCase(k)}: ${v.join(", ")}`);
  return "Skills:\n- " + lines.join("\n- ");
}
function profileProjects(limit=6){
  const p = (DATA.profile?.projects||[]).slice(0,limit).map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length ? "Projects:\n" + p.join("\n") : "Projects: See profile.";
}
function profileEOL(){
  return "EOL shows Total Tested, Passed, Retested-Recovered, and Failed with Stage/Model/Date slicers. " +
         "Failure reasons parsed by tokens ending ':0'. Default-to-today via epoch logic.";
}
function profileETL(){
  return "Python ETL automates MySQL → Power BI with daily refresh at 12:00 AM IST via Gateway. " +
         "Goal: zero manual reporting and stable leadership views.";
}
function profileFinance(){
  return "Finance dashboards (April–May & Q1): revenue, purchase, margin, closing stock; " +
         "Branch/Type/Month slicers; OEM vs After-Market comparisons; clean trend visuals.";
}
function profileDeploy(){
  return "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";
}
function profileAnswer(user){
  const t = norm(user);
  const lbl = bestLabel(t);
  if(lbl==="who")        return wittyWho();
  if(lbl==="company")    return profileCompany();
  if(lbl==="education")  return profileEducation();
  if(lbl==="skills")     return profileSkills();
  if(lbl==="projects")   return profileProjects();
  if(lbl==="eol")        return profileEOL();
  if(lbl==="etl")        return profileETL();
  if(lbl==="finance")    return profileFinance();
  if(lbl==="deployment") return profileDeploy();

  if(t.includes("who is chaitanya") || t.includes("what is chaitanya") || t.includes("introduce chaitanya")) return wittyWho();
  if(["education","degree","qualification","study","studies","college"].some(k=>t.includes(k))) return profileEducation();
  if(["company","current company","which company","employer","present company","where does he work"].some(k=>t.includes(k))) return profileCompany();
  if(["skills","tech stack","stack","tools","technology"].some(k=>t.includes(k))) return profileSkills();
  if(["projects","project","work done","what all projects","overview of projects","recent work"].some(k=>t.includes(k))) return profileProjects();

  // compact default
  return DATA.profile?.summary || "I can share skills, projects, or education.";
}

/* ---------- 8) Web summaries (no links) ---------- */
async function ddgIA(q){
  try{
    const u = "https://api.duckduckgo.com/?format=json&no_html=1&no_redirect=1&q="+encodeURIComponent(q);
    const r = await fetch(u, {cache:"no-store"}); if(!r.ok) return null;
    const j = await r.json();
    if(j.AbstractText) return clamp(j.AbstractText);
    const t = (j.RelatedTopics||[]).find(x=>x && x.Text);
    return t ? clamp(t.Text) : null;
  }catch(_){ return null }
}
async function wikiSummary(q){
  try{
    const s = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&limit=1&namespace=0&format=json&search=${encodeURIComponent(q)}`);
    if(!s.ok) return null; const arr = await s.json();
    if(!arr[1] || !arr[1][0]) return null;
    const title = arr[1][0];
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if(!r.ok) return null; const j = await r.json();
    return j.extract ? clamp(j.extract) : null;
  }catch(_){ return null }
}
async function webSummary(q){ return await ddgIA(q) || await wikiSummary(q) || null; }

/* ---------- 9) Router (mirrors Python) ---------- */
const RUDE   = ["shut up","stop it","stop","be quiet","chup","band kar","chup kar"];
const CASUAL = ["hi","hello","hey","namaste","hola","yo","wassup","what's up","whats up",
                "good morning","gm","good evening","ge","thanks","shukriya","lol","hahaha","who are you","bhai"];
const CAREER = ["project","projects","experience","skills","tech stack","tools","eol","finance","q1","april","may",
                "deployment","iframe","gateway","resume","summary","profile","linkedin","email",
                "company","current company","which company","where does he work","who is chaitanya","what is chaitanya",
                "education","degree","qualification","introduce chaitanya","who is he","about chaitanya","present company"];

function playfulFallback(){
  return rand([
    "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
    "Thoda lightweight AI hu 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!"
  ]);
}

async function respond(q){
  const t = norm(q);

  // rude
  if(RUDE.some(k=>t.includes(k))) return "Chill bhai 😄 — jokes sunaoon ya projects bataoon?";

  // math
  const m = tryMath(q);
  if(m) return m;

  // smalltalk
  const st = smalltalkReply(t);
  if(st) return st;

  // jokes / memes
  if(t.includes("joke") || t.includes("jokes") || t.includes("funny")) return randomJoke();
  if(t.includes("meme") || t.includes("memes")) return randomMeme();

  // career
  if(CAREER.some(k=>t.includes(k)) || bestLabel(t)) return profileAnswer(q);

  // last resort: web summary (no links)
  const web = await webSummary(q);
  if(web) return web;

  return playfulFallback();
}

/* ---------- 10) Boot & events ---------- */
function boot(){
  buildIntents();
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim();
  if(!q) return;
  addMsg("user", q);
  input.value="";
  addMsg("bot","…"); // typing placeholder
  const last = chat.lastElementChild;
  try{
    const a = await respond(q);
    last.querySelector(".bubble").textContent = a;
  }catch(err){
    console.error(err);
    last.querySelector(".bubble").textContent = "Something went wrong. Try again.";
  }
});

/* quick chips (optional, if present in HTML) */
const chipBox = document.getElementById("chips");
if(chipBox){
  chipBox.addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    input.value = b.dataset.q || ""; form.requestSubmit();
  });
}


// ====== Load data ======
const urls = window.DATA_URLS;

async function getJSON(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

const DATA = {};
(async () => {
  const [profile, smalltalk, jokes, memes] = await Promise.all([
    getJSON(urls.profile),
    getJSON(urls.smalltalk),
    getJSON(urls.jokes),
    getJSON(urls.memes)
  ]);
  DATA.profile = profile;
  DATA.smalltalk = smalltalk;
  DATA.jokes = jokes;
  DATA.memes = memes;
  buildIntents();
  boot();
})();

// ====== DOM helpers ======
const chat  = document.getElementById("chat");
const form  = document.getElementById("form");
const input = document.getElementById("input");

function addMsg(role, text, typing=false){
  const el = document.createElement("div");
  el.className = `msg ${role}${typing ? " typing": ""}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  if(typing){
    bubble.textContent = "";
    bubble.appendChild(dot()); bubble.appendChild(dot()); bubble.appendChild(dot());
  }
  el.appendChild(bubble);
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
function dot(){ const d=document.createElement("div"); d.className="dot"; return d; }
function replaceText(el, text){ el.querySelector(".bubble").textContent = text; }
const rand = a => a[Math.floor(Math.random()*a.length)];
const clamp = (t,n=550)=> t.length<=n ? t : (t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ") || t.slice(0,n))+"…";
const norm  = t => t.toLowerCase().replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ").replace(/\s+/g," ").trim();
const anyIn = (t, arr) => arr.some(x => t.includes(x));
const sleep = ms => new Promise(r=>setTimeout(r, ms));

// ====== Smalltalk (skip joke/meme from pack; we use external files) ======
const SKIP = new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);
let INTENTS = [];

function buildIntents(){
  INTENTS = (DATA.smalltalk?.intents || [])
    .filter(it => !SKIP.has(it.name))
    .map(it => ({
      name: it.name,
      patterns: (it.patterns||[]).map(norm),
      responses: it.responses||[]
    }));
}
function smalltalkReply(t){
  const hits = INTENTS.filter(it => it.patterns.some(p => p && t.includes(p)));
  if(hits.length) return rand(rand(hits).responses);
  return null;
}

// ====== Profile answers (+ playful WHO) ======
function wittyWho(){
  // Uses your `about` array from about_chaitanya.json
  const aboutLines = DATA.profile?.about || [];
  const funny = aboutLines[0] || "Chaitanya is an electronic device 😜 Just kidding! Here you go:";
  const detail = aboutLines[1] || DATA.profile?.summary || "";
  return `${funny}\n${detail}`;
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
  const lines = Object.entries(ts).map(([k,v]) => `${title(k)}: ${v.join(", ")}`);
  return "Skills:\n- " + lines.join("\n- ");
}
function title(s){return s.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase())}
function profileProjects(limit=8){
  const p = (DATA.profile?.projects||[]).slice(0,limit).map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length ? "Projects:\n" + p.join("\n") : "Projects: See profile.";
}
function profilePersonalProjects(){
  const all = DATA.profile?.projects || [];
  const personals = all.filter(p =>
    /personal/i.test(p.name) ||
    /(Chatbot|Fraud|Recommendation|Recommender|Spam)/i.test(p.name)
  );
  if(!personals.length) return profileProjects();
  return "Personal Projects:\n" + personals.map(x=>`- ${x.name}: ${x.purpose||x.details?.[0]||""}`).join("\n");
}
function profileEOL(){
  return "EOL shows Total Tested, Passed, Retested-Recovered, and Failed with Stage/Model/Date slicers. Failure reasons parsed by tokens ending ':0'. Default-to-today via epoch logic.";
}
function profileETL(){
  return "Python ETL automates MySQL → Power BI with daily refresh at 12:00 AM IST via Gateway. Goal: zero manual reporting and stable leadership views.";
}
function profileFinance(){
  return "Finance dashboards (April–May & Q1): revenue, purchase, margin, closing stock; Branch/Type/Month slicers; OEM vs After-Market comparisons; clean trend visuals.";
}
function profileDeploy(){
  return "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";
}

// ====== Lightweight NLP cues ======
const CUES = {
  who: ["who is chaitanya","what is chaitanya","introduce chaitanya","about chaitanya","profile summary","who is he","who is chaitanya kulkarni"],
  company: ["company","current company","which company","present company","employer","where does he work"],
  education: ["education","degree","qualification","college","study","studies","what did he study","qualifications"],
  skills: ["skills","tech stack","stack","tools","technology","what tools"],
  projects: ["projects","project list","what all projects","overview of projects","work done","recent work"],
  personal: ["personal projects","side projects","own projects","private projects"],
  eol: ["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl: ["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
  finance: ["finance","q1","april may","financial summary","performance dashboard"],
  deployment: ["deploy","deployment","iframe","website","embed","publish"]
};
function bestLabel(t){
  let best=null, score=0;
  for(const [lbl,cues] of Object.entries(CUES)){
    for(const c of cues){
      const s = similarity(t,c);
      if(s>score){score=s; best=lbl}
    }
  }
  return score>=0.72 ? best : null;
}
function similarity(a,b){
  a=norm(a); b=norm(b);
  const len = Math.max(a.length,b.length)||1;
  let same=0;
  for(const w of b.split(" ")){ if(a.includes(w)) same+=w.length }
  return same/len;
}

// ====== Jokes & Memes (from your files) ======
function randomJoke(){ return rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]); }
function randomMeme(){ return rand(DATA.memes?.memes || ["No memes loaded 😅"]); }

// ====== Math (safe-ish) ======
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

// ====== Web summaries (no links) ======
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

// ====== Router ======
const RUDE = ["shut up","stop it","be quiet","chup","band kar","chup kar"];
const CASUAL = ["hi","hello","hey","namaste","hola","wassup","what's up","whats up","good morning","gm","good evening","ge","thanks","shukriya","lol","hahaha","who are you"];
const CAREER = ["project","projects","experience","skills","tech stack","eol","finance","q1","april","may","deployment","iframe","gateway","resume","summary","profile","linkedin","email","company","current company","which company","who is chaitanya","what is chaitanya","education","degree","qualification","introduce chaitanya","present company","personal projects"];

function playfulFallback(){
  const lines = [
    "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
    "Thoda lightweight AI hu 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!"
  ];
  return rand(lines);
}

async function respond(q){
  const t = norm(q);

  if(RUDE.some(k=>t.includes(k))) return "Chill bhai 😄 — jokes sunaoon ya projects bataoon?";

  const math = tryMath(q);
  if(math) return math;

  // Jokes / Memes fast path
  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme") || t.includes("memes")) return randomMeme();

  // Smalltalk direct match
  const st = smalltalkReply(t);
  if(st) return st;

  // Career / profile
  if(CAREER.some(k=>t.includes(k)) || bestLabel(t)){
    const lbl = bestLabel(t);
    if(lbl==="who")       return wittyWho();
    if(lbl==="company")   return profileCompany();
    if(lbl==="education") return profileEducation();
    if(lbl==="skills")    return profileSkills();
    if(lbl==="projects")  return profileProjects();
    if(lbl==="personal")  return profilePersonalProjects();
    if(lbl==="eol")       return profileEOL();
    if(lbl==="etl")       return profileETL();
    if(lbl==="finance")   return profileFinance();
    if(lbl==="deployment")return profileDeploy();

    // explicit keywords fallback
    if(t.includes("who is chaitanya") || t.includes("what is chaitanya") || t.includes("introduce chaitanya"))
      return wittyWho();
  }

  // Last resort: web summary (no links)
  const web = await webSummary(q);
  if(web) return web;

  return playfulFallback();
}

// ====== Boot & UI behaviour ======
function boot(){
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim();
  if(!q) return;

  addMsg("user", q);
  input.value = "";

  // typing indicator + small random delay for “thinking…” feel
  const typing = addMsg("bot","", true);
  await sleep(500 + Math.random()*600);

  try{
    const a = await respond(q);
    replaceText(typing, a);
    typing.classList.remove("typing");
  }catch(err){
    replaceText(typing, "Something went wrong. Try again.");
    typing.classList.remove("typing");
    console.error(err);
  }
});

// quick chips
document.getElementById("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip");
  if(!b) return;
  input.value = b.dataset.q;
  form.requestSubmit();
});

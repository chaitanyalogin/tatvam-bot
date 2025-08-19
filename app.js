// ========= Loader =========
const urls = window.DATA_URLS;
const DATA = { smalltalk: null, profile: null, jokes: null, memes: null };
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const profileCard = document.getElementById("profileCard");

const TIMEOUT_MS = 9000;
const MAX_SUMMARY = 550;
const SKIP_INTENTS = new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);

const state = { lastTopic: null, lastCategory: null };

// fetch with no cache
async function getJSON(url){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), TIMEOUT_MS);
  const r = await fetch(url, { cache:"no-store", signal: ctrl.signal });
  clearTimeout(t);
  if(!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

(async () => {
  // Load all JSON
  const [st, pr, jk, mm] = await Promise.all([
    getJSON(urls.smalltalk), getJSON(urls.profile), getJSON(urls.jokes), getJSON(urls.memes)
  ]);
  DATA.smalltalk = st;
  DATA.profile   = pr;
  DATA.jokes     = jk;
  DATA.memes     = mm;

  buildIntents();
  renderProfileCard();
  greet();
})().catch(err=>{
  addMsg("bot", "Loading failed. Please refresh.");
  console.error(err);
});

// ========= Helpers =========
function nowTime(){ const d=new Date(); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function clamp(t, n=MAX_SUMMARY){
  if(!t) return "";
  t = t.trim();
  if(t.length<=n) return t;
  const cut = t.slice(0,n);
  const parts = cut.split(/(?<=[.!?])\s/);
  return (parts.length>1 ? parts.slice(0,-1).join(" ") : cut).trim() + "…";
}
function norm(t){ return t.toLowerCase().replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ").replace(/\s+/g," ").trim(); }
function anyIn(t, arr){ return arr.some(x => t.includes(x)); }
function addMsg(role, text){
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = nowTime();
  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}
function addTyping(){
  const wrap = document.createElement("div");
  wrap.className = "msg bot";
  wrap.dataset.typing = "1";
  const bubble = document.createElement("div");
  bubble.className = "bubble typing";
  bubble.textContent = "…";
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}
function replaceTyping(text){
  const last = [...chat.querySelectorAll(".msg.bot")].reverse().find(el=>el.dataset.typing==="1");
  if(!last) { addMsg("bot", text); return; }
  const bubble = last.querySelector(".bubble");
  bubble.classList.remove("typing");
  bubble.textContent = text;
  delete last.dataset.typing;
}

// ========= Profile card =========
function renderProfileCard(){
  const p = DATA.profile || {};
  const name = p.name || "Chaitanyachidambar Kulkarni";
  const loc  = p.location || "Bengaluru, Karnataka";
  const mail = p.email || "";
  const link = p.linkedin || "";
  const sum  = p.summary || "";

  profileCard.innerHTML = `
    <h3>${escapeHtml(name)}</h3>
    <div class="summary">${escapeHtml(sum)}</div>
    <div class="row"><span class="tag">📍</span><span class="val">${escapeHtml(loc)}</span></div>
    <div class="row"><span class="tag">✉️</span><span class="val">${escapeHtml(mail)}</span></div>
    <div class="row"><span class="tag">🔗</span><span class="val"><a class="btn outline" target="_blank" href="${escapeHtml(link)}">LinkedIn</a></span></div>
  `;
}

// ========= Smalltalk intents (minus jokes/memes) =========
let INTENTS = [];
function buildIntents(){
  INTENTS = (DATA.smalltalk?.intents || [])
    .filter(it => !SKIP_INTENTS.has(it.name))
    .map(it => ({ name: it.name, patterns: (it.patterns||[]).map(norm), responses: it.responses||[] }));
}
function smalltalkReply(t){
  const hits = INTENTS.filter(it => it.patterns.some(p => p && t.includes(p)));
  if(hits.length) return rand(rand(hits).responses);
  return null;
}

// ========= Jokes & Memes (strictly external files) =========
function rand(a){ return a[Math.floor(Math.random()*a.length)]; }
function randomJoke(){ return rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]); }
function randomMeme(){ return rand(DATA.memes?.memes || ["No memes loaded 😅"]); }

// ========= Math (safe-ish) =========
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

// ========= Stronger NLP cues =========
const CUES = {
  who: ["who is chaitanya","what is chaitanya","introduce chaitanya","who is he","about chaitanya","profile summary"],
  company: ["current company","present company","which company","company","employer","where does he work"],
  education: ["education","degree","qualification","study","studies","college"],
  skills: ["skills","tech stack","stack","tools","technology","what tools"],
  projects: ["projects","project list","what all projects","overview of projects","work done","recent work"],
  personal: ["personal projects","side projects","own projects","tatvam","fraud detection","movie recommender","sms spam"],
  eol: ["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl: ["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
  finance: ["finance","q1","april may","financial summary","performance dashboard"],
  deployment: ["deploy","deployment","iframe","website","embed","publish"],
  internship: ["internship","intern experience","ai variant"]
};

function similarity(a,b){ // token overlap ratio
  a = norm(a); b = norm(b);
  const A = new Set(a.split(" ")); const B = new Set(b.split(" "));
  const inter = [...A].filter(x=>B.has(x));
  return inter.length / Math.max(1, Math.min(A.size, B.size));
}

function bestLabel(t){
  let best=null, score=0;
  for(const [lbl, cues] of Object.entries(CUES)){
    for(const c of cues){
      const s = similarity(t,c);
      if(s>score){score=s; best=lbl}
    }
  }
  return score>=0.60 ? best : null; // slightly permissive
}

// ========= Profile answers (+ playful who) =========
function wittyWho(){
  const intro = "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n";
  const sum = DATA.profile?.about?.[1]
    || "Chaitanya is a Junior Software Engineer skilled in Power BI, MySQL, and Python ETL. Built finance & EOL dashboards, automated 12 AM refresh via Gateway, and deployed via iFrame.";
  return intro + sum;
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
function allProjects(){
  return (DATA.profile?.projects||[]).map(x=>({name:x.name, purpose:x.purpose||"", details:x.details||[], tech:x.tech||[]}));
}
function profileProjects(limit=6){
  const items = allProjects().filter(x=>!/\(Personal\)/i.test(x.name));
  const rows = items.slice(0,limit).map(x=>`- ${x.name}: ${x.purpose}`);
  return rows.length ? "Projects:\n" + rows.join("\n") : "Projects: See profile.";
}
function personalProjects(limit=6){
  const items = allProjects().filter(x=>/\(Personal\)|TatTvam|Fraud|Recommender|Spam/i.test(x.name));
  const rows = items.slice(0,limit).map(x=>`- ${x.name}${x.purpose?": "+x.purpose:""}`);
  return rows.length ? "Personal Projects:\n" + rows.join("\n")
                     : "Personal Projects: TatTvam chatbot, Fraud Detection (RF), Movie Recommender (TF-IDF), SMS Spam Classifier (NLP).";
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
function internshipAnswer(){
  const e = (DATA.profile?.experience||[]).find(x=>/intern/i.test(x.title||""));
  return e
    ? `Data Analyst Intern — AI Variant Company (08/2023 – 05/2024)\n- Built dashboards (Power BI/Tableau/Excel) cutting report time by ~40%.\n- Cleaned large datasets with Python & SQL; presented PPT insights.`
    : "Internship: AI Variant Company — dashboards, Python/SQL data cleaning, stakeholder insights.";
}

function profileAnswer(q){
  const t = norm(q);
  const lbl = bestLabel(t);

  if(lbl==="who")        { state.lastTopic="who";       return wittyWho(); }
  if(lbl==="company")    { state.lastTopic="company";   return profileCompany(); }
  if(lbl==="education")  { state.lastTopic="education"; return profileEducation(); }
  if(lbl==="skills")     { state.lastTopic="skills";    return profileSkills(); }
  if(lbl==="projects")   { state.lastTopic="projects";  return profileProjects(); }
  if(lbl==="personal")   { state.lastTopic="personal";  return personalProjects(); }
  if(lbl==="eol")        { state.lastTopic="eol";       return profileEOL(); }
  if(lbl==="etl")        { state.lastTopic="etl";       return profileETL(); }
  if(lbl==="finance")    { state.lastTopic="finance";   return profileFinance(); }
  if(lbl==="deployment") { state.lastTopic="deploy";    return profileDeploy(); }
  if(lbl==="internship") { state.lastTopic="intern";    return internshipAnswer(); }

  // keywords fallback
  if(t.includes("who is chaitanya") || t.includes("what is chaitanya") || t.includes("introduce chaitanya")){
    state.lastTopic="who"; return wittyWho();
  }
  if(anyIn(t, ["personal projects","tatvam","fraud detection","movie recommender","sms spam"])){
    state.lastTopic="personal"; return personalProjects();
  }
  if(anyIn(t, ["education","degree","qualification","study","studies","college"])){
    state.lastTopic="education"; return profileEducation();
  }
  if(anyIn(t, ["current company","present company","which company","employer","company"])){
    state.lastTopic="company"; return profileCompany();
  }
  if(anyIn(t, ["skills","tech stack","stack","tools"])){
    state.lastTopic="skills"; return profileSkills();
  }
  if(anyIn(t, ["projects","project","work done","what all projects","overview"])){
    state.lastTopic="projects"; return profileProjects();
  }

  state.lastTopic="summary";
  return DATA.profile?.summary || "I can share skills, projects, personal projects, or education.";
}

// ========= Follow-up expanders =========
function expandTopic(tag){
  switch(tag){
    case "eol": return "EOL details:\n- Measures: Total Tested, Passed, Retested-Recovered, Failed.\n- Slicers: Stage (1/2), Model, Date.\n- Fail reason tokens ending ':0'.\n- ‘Today by default’ via epoch in DAX.";
    case "etl": return "ETL details:\n- MySQL → Python clean/transform → Power BI.\n- Schedule: Daily 12:00 AM IST via Gateway.\n- Goal: zero-touch refresh for stable leadership view.";
    case "finance": return "Finance details:\n- April–May & Q1 KPIs: revenue, purchase, margin, closing stock.\n- OEM vs After-Market comparisons, trend visuals.\n- Consistent DAX naming & UX.";
    case "projects": return profileProjects(12);
    case "personal": return personalProjects(12);
    case "company": return profileCompany();
    case "education": return profileEducation();
    case "skills": return profileSkills();
    default: return "Kis topic pe? (eol / etl / finance / projects / personal / skills / education)";
  }
}

// ========= Playful fallback =========
function playfulFallback(){
  const lines = [
    "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
    "Thoda lightweight AI hu 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!"
  ];
  return rand(lines);
}

// ========= Web summary (DuckDuckGo + Wikipedia, no links) =========
function cleanQuery(q){
  q = q.replace(/\b(yes|yeah|ok|okay|hmm|hmmm|continue|next|another|more|please|pls|explain|details|detail|summarize)\b/gi," ").trim();
  return q || "general information";
}
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
async function webSummary(q){
  const cleaned = cleanQuery(q);
  return await ddgIA(cleaned) || await wikiSummary(cleaned) || null;
}

// ========= Router =========
const RUDE = ["shut up","stop it","be quiet","chup","band kar","chup kar"];
const FOLLOWUP = ["another one","next","one more","more","continue","explain","details","detail","thoda aur","expand","why","how"];

async function respond(q){
  const t = norm(q);

  // rude
  if(RUDE.some(k=>t.includes(k))) return "Chill bhai 😄 — jokes sunaoon ya projects bataoon?";

  // math
  const m = tryMath(q);
  if(m) return m;

  // explicit jokes/memes first (so smalltalk can’t override)
  if(t.includes("joke") || t.includes("funny")) return randomJoke();
  if(t.includes("meme") || t.includes("memes")) return randomMeme();

  // follow-up deepening
  if(FOLLOWUP.some(k=>t.includes(k))) return expandTopic(state.lastTopic);

  // smalltalk hit
  const st = smalltalkReply(t);
  if(st) return st;

  // career / profile content
  const needCareer = bestLabel(t) ||
    anyIn(t, ["who is chaitanya","what is chaitanya","current company","present company","which company","skills","projects","personal projects","education","eol","etl","finance","deployment","internship"]);
  if(needCareer) return profileAnswer(q);

  // unknown → web summary (no links)
  const web = await webSummary(q);
  if(web) return web;

  return playfulFallback();
}

// ========= Boot & UI =========
function greet(){
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim();
  if(!q) return;
  addMsg("user", q);
  input.value="";
  addTyping();
  try{
    const a = await respond(q);
    replaceTyping(a);
  }catch(err){
    replaceTyping("Something went wrong. Try again.");
    console.error(err);
  }
});

// Quick chips
document.getElementById("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip");
  if(!b) return;
  input.value = b.dataset.q;
  form.requestSubmit();
});

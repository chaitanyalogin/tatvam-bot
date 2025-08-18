// ---------- simple loader with safe fallbacks ----------
const urls = window.DATA_URLS;

async function getJSON(url){
  try{
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){
    console.warn("Fetch failed:", url, e);
    return null;
  }
}

const DATA = { smalltalk:null, profile:null, jokes:null, memes:null };

(async () => {
  const [s, p, j, m] = await Promise.all([
    getJSON(urls.smalltalk),
    getJSON(urls.profile),
    getJSON(urls.jokes),
    getJSON(urls.memes)
  ]);
  DATA.smalltalk = s || {intents:[]};
  DATA.profile   = p || {};
  DATA.jokes     = j || {jokes:["No jokes loaded 😅"]};
  DATA.memes     = m || {memes:["No memes loaded 😅"]};
  boot();
})();

// ---------- helpers ----------
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

function addMsg(role, text){
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}
function escapeHtml(s){return (s||"").toString().replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
const rand = a => a[Math.floor(Math.random()*a.length)];
const clamp = (t,n=550)=> t.length<=n ? t : (t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ") || t.slice(0,n))+"…";
const norm = t => (t||"").toLowerCase().replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ").replace(/\s+/g," ").trim();
const anyIn = (t, arr) => arr.some(x => t.includes(x));

// ---------- smalltalk (skip internal jokes/memes) ----------
const SKIP = new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);
let INTENTS = [];

function buildIntents(){
  INTENTS = (DATA.smalltalk?.intents || [])
    .filter(it => !SKIP.has(it.name))
    .map(it => ({name: it.name, patterns: (it.patterns||[]).map(norm), responses: it.responses||[]}));
}
function smalltalkReply(t){
  const hits = INTENTS.filter(it => it.patterns.some(p => p && t.includes(p)));
  if(hits.length) return rand(rand(hits).responses);
  return null;
}

// ---------- profile answers (with playful “who”) ----------
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

function similarity(a,b){
  a=norm(a); b=norm(b);
  const len=Math.max(a.length,b.length)||1; let same=0;
  for(const w of b.split(" ")){ if(a.includes(w)) same+=w.length }
  return same/len;
}
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
  const lines = Object.entries(ts).map(([k,v]) => `${k.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase())}: ${v.join(", ")}`);
  return "Skills:\n- " + lines.join("\n- ");
}
function profileProjects(limit=6){
  const p = (DATA.profile?.projects||[]).slice(0,limit).map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length ? "Projects:\n" + p.join("\n") : "Projects: See profile.";
}
const profileEOL = () => "EOL shows Total Tested, Passed, Retested-Recovered, and Failed with Stage/Model/Date slicers. Failure reasons parsed by tokens ending ':0'. Default-to-today via epoch logic.";
const profileETL = () => "Python ETL automates MySQL → Power BI with daily refresh at 12:00 AM IST via Gateway. Goal: zero manual reporting and stable leadership views.";
const profileFinance = () => "Finance dashboards (April–May & Q1): revenue, purchase, margin, closing stock; Branch/Type/Month slicers; OEM vs After-Market comparisons; clean trend visuals.";
const profileDeploy = () => "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";

function profileAnswer(user){
  const t = norm(user);
  const lbl = bestLabel(t);
  if(lbl==="who") return wittyWho();
  if(lbl==="company") return profileCompany();
  if(lbl==="education") return profileEducation();
  if(lbl==="skills") return profileSkills();
  if(lbl==="projects") return profileProjects();
  if(lbl==="eol") return profileEOL();
  if(lbl==="etl") return profileETL();
  if(lbl==="finance") return profileFinance();
  if(lbl==="deployment") return profileDeploy();

  if(t.includes("who is chaitanya") || t.includes("what is chaitanya") || t.includes("introduce chaitanya")) return wittyWho();
  if(["education","degree","qualification","study","studies","college"].some(k=>t.includes(k))) return profileEducation();
  if(["company","current company","which company","employer"].some(k=>t.includes(k))) return profileCompany();
  if(["skills","tech stack","stack","tools"].some(k=>t.includes(k))) return profileSkills();
  if(["projects","project","work done","what all projects"].some(k=>t.includes(k))) return profileProjects();

  const sum = DATA.profile?.summary;
  return sum || "I can share skills, projects, or education.";
}

// ---------- jokes & memes ----------
const randomJoke = () => rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]);
const randomMeme = () => rand(DATA.memes?.memes || ["No memes loaded 😅"]);

// ---------- math quick eval ----------
const mathRe = /(?<!\w)([\d\.\s+\-*/%()]+)(?!\w)/;
function tryMath(s){
  const m = (s||"").toLowerCase().match(mathRe);
  if(!m) return null;
  const expr = m[1].replace(/\^/g,"**").replace(/[^\d\.\s+\-*/%()]/g,"").trim();
  try{
    // eslint-disable-next-line no-eval
    const v = eval(expr);
    if(typeof v==="number" && Number.isFinite(v)) return "= " + (Number.isInteger(v)? v : v.toString());
  }catch(_){}
  return null;
}

// ---------- playful fallback ----------
function playfulFallback(){
  const lines = [
    "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
    "Thoda lightweight AI hu 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!"
  ];
  return rand(lines);
}

// ---------- router ----------
async function respond(q){
  const t = norm(q);

  if(["shut up","stop it","be quiet","chup","band kar","chup kar"].some(k=>t.includes(k)))
    return "Chill bhai 😄 — jokes sunaoon ya projects bataoon?";

  const m = tryMath(q);
  if(m) return m;

  const st = smalltalkReply(t);
  if(st) return st;

  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme")) return randomMeme();

  if(["project","projects","experience","skills","tech stack","eol","finance","q1","april","may","deployment","iframe","gateway","resume","summary","profile","linkedin","email","company","current company","which company","who is chaitanya","what is chaitanya","education","degree","qualification","introduce chaitanya","present company"].some(k=>t.includes(k)) || bestLabel(t)){
    return profileAnswer(q);
  }

  return playfulFallback();
}

// ---------- boot & UI ----------
function boot(){
  buildIntents();
  addMsg("bot","Hello! 🤖 I’m TatTvam Bot. How can I help you today?");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim();
  if(!q) return;
  addMsg("user", q);
  input.value="";
  addMsg("bot","…");
  const last = chat.lastElementChild;
  try{
    const a = await respond(q);
    last.querySelector(".bubble").textContent = a;
  }catch(err){
    last.querySelector(".bubble").textContent = "Something went wrong. Try again.";
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

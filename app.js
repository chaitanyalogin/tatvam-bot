/* ========= Load data ========= */
const urls = window.DATA_URLS;
async function getJSON(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
const DATA = {};
(async () => {
  try{
    const [profile, smalltalk, jokes, memes] = await Promise.all([
      getJSON(urls.profile), getJSON(urls.smalltalk), getJSON(urls.jokes), getJSON(urls.memes)
    ]);
    Object.assign(DATA, {profile, smalltalk, jokes, memes});
    boot();
  }catch(e){
    console.error(e);
    addMsg("bot","Setup error loading data. Please refresh.");
  }
})();

/* ========= DOM helpers ========= */
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

function addMsg(role, text){
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  const icon = role==="bot" ? "🤖" : "🧑";
  el.innerHTML = `<div class="avatar" aria-hidden="true">${icon}</div>
                  <div class="bubble">${escapeHtml(text)}</div>`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
function showTyping(){
  addMsg("bot","…");
  const el = chat.lastElementChild;
  el.classList.add("typing");
  el.querySelector(".bubble").innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  return el;
}
function escapeHtml(s){return (s??"").toString().replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
const rand = a => a[Math.floor(Math.random()*a.length)];
const clamp = (t,n=550)=> t.length<=n ? t : (t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ") || t.slice(0,n))+"…";
const norm = t => t.toLowerCase().replace(/['’]s/g," ").replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ").replace(/\s+/g," ").trim();
const anyIn = (t, arr) => arr.some(x => t.includes(x));

/* ========= Smalltalk (excluding jokes/memes buckets) ========= */
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

/* ========= Stronger NLP for career Qs ========= */
const CUES = {
  who: ["who is chaitanya","introduce chaitanya","about chaitanya","profile summary","who is he"],
  company: ["current company","present company","which company","employer","working right now","works at","working at","company chaitanya","where does he work"],
  education: ["qualification","qualifications","education","degree","degrees","studied","study","studies","college"],
  skills: ["skills","tech stack","stack","tools","technology","expertise","proficient in"],
  projects: ["projects","what projects","project did","work did he do","what did he build","recent work"],
  experience: ["experience","prior experience","past experience","previous role","internship","intern"],
  eol: ["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl: ["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
  finance: ["finance","q1","april may","financial summary","performance dashboard"],
  deployment: ["deploy","deployment","iframe","website","embed","publish"],
  fullname: ["full name","complete name","name please"]
};
function similarity(a,b){
  a=norm(a); b=norm(b);
  const len=Math.max(a.length,b.length)||1; let same=0;
  for(const w of b.split(" ")) if(a.includes(w)) same+=w.length;
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
  return score>=0.70 ? best : null; // a bit more forgiving
}

/* ========= Profile answers (with playful who-intro) ========= */
const state = { lastTopic:null };
function setTopic(lbl){ state.lastTopic = lbl; }

function wittyWho(){
  const about = DATA.profile?.about || [];
  const introLine = "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n";
  if(about.length){
    const blob = about.join("\n");
    return blob.startsWith("Chaitanya is an electronic device") ? blob : (introLine + blob);
  }
  return introLine + (DATA.profile?.summary || "Junior Software Engineer (Power BI, MySQL, Python ETL).");
}
function title(s){return s.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase())}
function profileCompany(){ setTopic("company");
  const e = DATA.profile?.experience?.[0];
  return e ? `Current company: ${e.company} — role: ${e.title} (${e.duration}).` : "Company info not available.";
}
function profileEducation(){ setTopic("education");
  const ed = DATA.profile?.education||[];
  if(!ed.length) return "Education: Bachelor of Commerce + Data Analyst/Data Science specializations.";
  const rows = ed.map(e=> e.degree ? `${e.degree} — ${e.institute} (${e.date})`
                                   : `${e.course} — ${e.institute} (${e.date})`);
  return "Education:\n- " + rows.join("\n- ");
}
function profileSkills(){ setTopic("skills");
  const ts = DATA.profile?.technical_skills||{};
  const lines = Object.entries(ts).map(([k,v])=>`${title(k)}: ${v.join(", ")}`);
  return lines.length ? "Skills:\n- " + lines.join("\n- ") : "Skills not available.";
}
function profileProjects(limit=6){ setTopic("projects");
  const p=(DATA.profile?.projects||[]).slice(0,limit).map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length ? "Projects:\n"+p.join("\n") : "Projects: See profile.";
}
function profileExperience(){ setTopic("experience");
  const ex = DATA.profile?.experience||[];
  if(!ex.length) return "Experience info not available.";
  return ex.map(e=>`${e.title} — ${e.company} (${e.duration})`).join("\n");
}
function profileEOL(){ setTopic("eol");
  return "EOL shows Total Tested, Passed, Retested-Recovered, and Failed with Stage/Model/Date slicers. Failure reasons parsed by tokens ending ':0'. Default-to-today via epoch logic.";
}
function profileETL(){ setTopic("etl");
  return "Python ETL automates MySQL → Power BI with daily refresh at 12:00 AM IST via Gateway. Goal: zero manual reporting and stable leadership views.";
}
function profileFinance(){ setTopic("finance");
  return "Finance dashboards (April–May & Q1): revenue, purchase, margin, closing stock; Branch/Type/Month slicers; OEM vs After-Market comparisons; clean trend visuals.";
}
function profileDeploy(){ setTopic("deployment");
  return "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";
}
function profileName(){ setTopic("fullname"); return DATA.profile?.name || "Chaitanyachidambar Kulkarni"; }

function profileAnswer(user){
  const t = norm(user);
  const lbl = bestLabel(t);
  if(lbl==="who") return (setTopic("who"), wittyWho());
  if(lbl==="company") return profileCompany();
  if(lbl==="education") return profileEducation();
  if(lbl==="skills") return profileSkills();
  if(lbl==="projects") return profileProjects();
  if(lbl==="experience") return profileExperience();
  if(lbl==="eol") return profileEOL();
  if(lbl==="etl") return profileETL();
  if(lbl==="finance") return profileFinance();
  if(lbl==="deployment") return profileDeploy();
  if(lbl==="fullname") return profileName();

  // keyword fallbacks
  if(t.includes("who is chaitanya") || t.includes("introduce chaitanya")) return (setTopic("who"), wittyWho());
  if(["full name","complete name"].some(k=>t.includes(k))) return profileName();
  if(["education","degree","qualification","qualifications","study","studies","college"].some(k=>t.includes(k))) return profileEducation();
  if(["company","current company","which company","employer","working right now","working at"].some(k=>t.includes(k))) return profileCompany();
  if(["skills","tech stack","stack","tools","expertise"].some(k=>t.includes(k))) return profileSkills();
  if(["projects","project","what projects","work done"].some(k=>t.includes(k))) return profileProjects();
  if(["experience","prior experience","past experience","internship"].some(k=>t.includes(k))) return profileExperience();

  return DATA.profile?.summary || "I can share skills, projects, or education.";
}

/* ========= Jokes & Memes ========= */
function randomJoke(){ return rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]); }
function randomMeme(){ return rand(DATA.memes?.memes || ["No memes loaded 😅"]); }

/* ========= Math ========= */
const mathRe = /(?<!\w)([\d\.\s+\-*/%()]+)(?!\w)/;
function tryMath(s){
  const m = s.toLowerCase().match(mathRe);
  if(!m) return null;
  const expr = m[1].replace(/\^/g,"**").replace(/[^\d\.\s+\-*/%()]/g,"").trim();
  try{ const v = eval(expr); if(typeof v==="number" && Number.isFinite(v)) return "= " + (Number.isInteger(v)? v : v.toString()); }
  catch(_){}
  return null;
}

/* ========= Better web summaries (clean query) ========= */
function cleanQuery(q){
  return q.replace(/\bplease|plz|bro|bhai|explain|tell me|what is|who is|whats|what's|about\b/gi,"").trim();
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

/* ========= Router ========= */
const RUDE = ["shut up","stop it","be quiet","chup","band kar","chup kar"];
const PLAYFUL = [
  "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
  "Thoda lightweight AI hu 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
  "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!"
];
async function respond(q){
  const t = norm(q);

  if(RUDE.some(k=>t.includes(k))) return "Chill bhai 😄 — jokes sunaoon ya projects bataoon?";

  const m = tryMath(q);
  if(m) return m;

  // First: career intent (so smalltalk doesn't steal it)
  const lbl = bestLabel(t);
  if(lbl) return profileAnswer(q);

  // Jokes / Memes (from your JSON)
  if(t.includes("joke"))  return randomJoke();
  if(t.includes("meme") || t.includes("memes")) return randomMeme();

  // Smalltalk
  const st = smalltalkReply(t);
  if(st) return st;

  // Follow-up words like "continue", "more"
  if(["continue","more","aur","another one","next"].some(k=>t.includes(k)) && state.lastTopic){
    if(state.lastTopic==="projects") return profileProjects(10);
    if(state.lastTopic==="education") return profileEducation();
    if(state.lastTopic==="experience") return profileExperience();
    if(state.lastTopic==="skills") return profileSkills();
  }

  // Web summary fallback (live)
  const web = await webSummary(q);
  if(web) return web;

  return rand(PLAYFUL);
}

/* ========= Boot & UI ========= */
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
  const typing = showTyping();
  try{
    const a = await respond(q);
    typing.classList.remove("typing");
    typing.querySelector(".bubble").textContent = a;
  }catch(err){
    typing.classList.remove("typing");
    typing.querySelector(".bubble").textContent = "Something went wrong. Try again.";
    console.error(err);
  }
});
document.getElementById("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip");
  if(!b) return;
  input.value = b.dataset.q;
  form.requestSubmit();
});

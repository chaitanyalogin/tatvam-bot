// ----- load all JSON -----
const urls = window.DATA_URLS;
async function getJSON(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
const DATA = {};
(async () => {
  const [smalltalk, profile, jokes, memes] = await Promise.all([
    getJSON(urls.smalltalk), getJSON(urls.profile), getJSON(urls.jokes), getJSON(urls.memes)
  ]);
  DATA.smalltalk = smalltalk;
  DATA.profile   = profile;
  DATA.jokes     = jokes;
  DATA.memes     = memes;
  boot();
})();

// ----- tiny helpers -----
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const norm = t => t.toLowerCase().replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ").replace(/\s+/g," ").trim();
const rand = a => a[Math.floor(Math.random()*a.length)];
function addMsg(role, text){
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="bubble">${text.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ----- intents (skip joke/meme packs; use separate files) -----
const SKIP = new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);
let INTENTS = [];
function buildIntents(){
  INTENTS = (DATA.smalltalk?.intents || [])
    .filter(it => !SKIP.has(it.name))
    .map(it => ({name:it.name, patterns:(it.patterns||[]).map(norm), responses:it.responses||[]}));
}
function smalltalkReply(t){
  const hit = INTENTS.find(it => it.patterns.some(p => p && t.includes(p)));
  return hit ? rand(hit.responses) : null;
}

// ----- profile answers -----
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
function profileProjects(limit=8){
  const p = (DATA.profile?.projects||[]).slice(0,limit)
        .map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length ? "Projects:\n" + p.join("\n") : "Projects: See profile.";
}
function wittyWho(){
  return "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n"
       + "Chaitanyachidambar Kulkarni is a Junior Software Engineer at iTriangle Infotech (Bengaluru), focused on Power BI, MySQL, Python ETL, and embedded live reporting. He built financial MIS and EOL testing dashboards, automated daily refresh via Gateway at 12 AM IST, parsed IMEI-level failure reasons, and deployed secure iFrame dashboards for internal/leadership use.";
}

// ----- jokes & memes -----
const randomJoke = () => rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]);
const randomMeme = () => rand(DATA.memes?.memes || ["No memes loaded 😅"]);

// ----- web summaries (DuckDuckGo / Wikipedia, no links shown) -----
async function ddg(q){
  try{
    const u = "https://api.duckduckgo.com/?format=json&no_html=1&no_redirect=1&q="+encodeURIComponent(q);
    const r = await fetch(u, {cache:"no-store"}); if(!r.ok) return null;
    const j = await r.json();
    if(j.AbstractText) return j.AbstractText;
    const t = (j.RelatedTopics||[]).find(x=>x && x.Text);
    return t ? t.Text : null;
  }catch(_){ return null }
}
async function wiki(q){
  try{
    const s = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&limit=1&namespace=0&format=json&search=${encodeURIComponent(q)}`);
    if(!s.ok) return null; const arr = await s.json();
    if(!arr[1] || !arr[1][0]) return null;
    const title = arr[1][0];
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if(!r.ok) return null; const j = await r.json();
    return j.extract || null;
  }catch(_){ return null }
}
async function webSummary(q){ return await ddg(q) || await wiki(q) || null; }

// ----- router -----
async function respond(q){
  const t = norm(q);

  // smalltalk
  const st = smalltalkReply(t);
  if(st) return st;

  // jokes & memes
  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme")) return randomMeme();

  // who/skills/projects/company/education
  if(t.includes("who is chaitanya") || t === "who is chaitanya" || t.includes("about chaitanya")) return wittyWho();
  if(["skills","tech stack","stack","tools"].some(k=>t.includes(k))) return profileSkills();
  if(["projects","personal projects","what projects"].some(k=>t.includes(k))) return profileProjects();
  if(["company","current company","present company","employer"].some(k=>t.includes(k))) return profileCompany();
  if(["education","degree","qualification"].some(k=>t.includes(k))) return profileEducation();

  // fallback: quick web summary (no links)
  const web = await webSummary(q);
  if(web) return web;

  return "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!";
}

// ----- boot & UI -----
function boot(){
  buildIntents();
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim(); if(!q) return;
  addMsg("user", q); input.value = "";
  addMsg("bot","…"); const last = chat.lastElementChild;
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
  const b = e.target.closest(".chip"); if(!b) return;
  input.value = b.dataset.q; form.requestSubmit();
});

// ========= load all JSON =========
const urls = window.DATA_URLS;

async function getJSON(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

const DATA = {};
(async () => {
  const [smalltalk, profile, jokes, memes] = await Promise.all([
    getJSON(urls.smalltalk), getJSON(urls.profile),
    getJSON(urls.jokes),     getJSON(urls.memes)
  ]);
  DATA.smalltalk = smalltalk;
  DATA.profile   = profile;
  DATA.jokes     = jokes;
  DATA.memes     = memes;
  boot();
})();

// ========= DOM helpers =========
const chat  = document.getElementById("chat");
const form  = document.getElementById("form");
const input = document.getElementById("input");

const norm = t => t.toLowerCase()
  .replace(/[^\w\s\u0900-\u097F+\-*/%().!?']/g," ")
  .replace(/\s+/g," ").trim();

const rand = a => a[Math.floor(Math.random()*a.length)];
function esc(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}

function addMsg(role, text, opts={}){
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="bubble">${esc(text||"")}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if(opts.typing){
    let dots = 1;
    const bubble = div.querySelector(".bubble");
    const id = setInterval(()=>{ dots = (dots%3)+1; bubble.textContent = "Thinking" + ".".repeat(dots); }, 300);
    div.__typing = id;
  }
  return div;
}
function stopTyping(el, finalText){
  if(el?.__typing){ clearInterval(el.__typing); delete el.__typing; }
  el.querySelector(".bubble").textContent = finalText;
}

// ========= smalltalk intents (skip joke/meme packs -> separate files) =========
const SKIP = new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);
let INTENTS = [];
function buildIntents(){
  INTENTS = (DATA.smalltalk?.intents || [])
    .filter(it => !SKIP.has(it.name))
    .map(it => ({name: it.name, patterns: (it.patterns||[]).map(norm), responses: it.responses||[]}));
}
function smalltalkReply(t){
  const hit = INTENTS.find(it => it.patterns.some(p => p && t.includes(p)));
  return hit ? rand(hit.responses) : null;
}

// ========= profile answers & expansions =========
const state = { lastTopic: null };

function wittyWho(){
  return "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n" +
         "Chaitanyachidambar Kulkarni is a Junior Software Engineer at iTriangle Infotech (Bengaluru), focused on Power BI, MySQL, Python ETL, and embedded live reporting. He built financial MIS and End-of-Line (EOL) testing dashboards, automated daily refresh via Gateway at 12 AM IST, parsed IMEI-level failure reasons, and deployed secure iFrame dashboards for internal/leadership use.";
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
  const lines = Object.entries(ts).map(([k,v]) =>
    `${k.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase())}: ${v.join(", ")}`);
  return "Skills:\n- " + lines.join("\n- ");
}
function listProjects(filterFn, limit=8){
  const arr = (DATA.profile?.projects||[]).filter(filterFn || (()=>true)).slice(0,limit);
  return arr.length ? "Projects:\n" + arr.map(p=>`- ${p.name}: ${p.purpose||""}`).join("\n")
                    : "Projects: See profile.";
}
function profileProjects(){ return listProjects(); }
function personalProjects(){
  const keywords = /(tatvam|chatbot|spam|fraud|recommend|movie)/i;
  return listProjects(p => keywords.test(JSON.stringify(p)));
}
function expandTopic(topic){
  switch(topic){
    case "who":        return wittyWho();
    case "company":    return profileCompany();
    case "education":  return profileEducation();
    case "skills":     return profileSkills();
    case "projects":   return profileProjects();
    case "personal":   return personalProjects();
    case "eol":        return "EOL details:\n- Measures: Total Tested, Passed, Retested-Recovered, Failed.\n- Slicers: Stage (1/2), Model, Date.\n- Failure tokens ending ':0' are counted as true fails.\n- Default-to-today via epoch-based DAX.";
    case "etl":        return "ETL details:\n- MySQL → Python clean/transform → Power BI.\n- Daily refresh at 12:00 AM IST via Gateway.\n- Goal: zero-manual reporting and stable leadership views.";
    case "finance":    return "Finance dashboards:\n- April–May & Q1: revenue, purchase, margin, closing stock.\n- Slicers: Branch/Type/Month; OEM vs After-Market comparisons.\n- Clean trend visuals + P&L-style cards.";
    default:           return null;
  }
}
function tagTopic(t){
  if(/\b(who is|introduce|about)\b.*chaitanya/.test(t)) return "who";
  if(t.includes("current company") || t.includes("present company") || t.includes("employer") || t.includes("company")) return "company";
  if(t.includes("education") || t.includes("degree") || t.includes("qualification")) return "education";
  if(t.includes("skills") || t.includes("tech stack") || t.includes("tools")) return "skills";
  if(t.includes("personal project")) return "personal";
  if(t.includes("project")) return "projects";
  if(t.includes("eol") || t.includes("imei") || t.includes("stage 1") || t.includes("stage 2")) return "eol";
  if(t.includes("etl") || t.includes("pipeline") || t.includes("gateway") || t.includes("refresh")) return "etl";
  if(t.includes("finance") || t.includes("q1") || t.includes("april") || t.includes("may")) return "finance";
  return null;
}

// ========= jokes & memes =========
const randomJoke = () => rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]);
const randomMeme = () => rand(DATA.memes?.memes || ["No memes loaded 😅"]);

// ========= web summaries (no links) =========
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
async function webSummary(q){
  // avoid web lookups for confirmations and tiny words
  const t = norm(q);
  if(t.length < 4) return null;
  if(/^(yes|yeah|yep|ok|okay|sure|continue|next|go on|explain|summarize|details?)$/.test(t)) return null;
  return await ddg(q) || await wiki(q) || null;
}

// ========= main router =========
async function respond(q){
  const t = norm(q);

  // confirmations expand last topic
  if(/^(yes|yeah|yep|ok|okay|sure|continue|next|go on|explain|summarize|details?)$/.test(t) && state.lastTopic){
    return expandTopic(state.lastTopic);
  }

  // jokes & memes
  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme")) return randomMeme();

  // direct who/intro
  if(/\b(who is|introduce|about)\b.*chaitanya/.test(t) || t === "who is chaitanya") {
    state.lastTopic = "who";
    return wittyWho();
  }

  // career topics
  const topic = tagTopic(t);
  if(topic){
    state.lastTopic = topic;
    return expandTopic(topic);
  }

  // smalltalk
  const st = smalltalkReply(t);
  if(st) return st;

  // general knowledge
  const web = await webSummary(q);
  if(web) return web;

  // playful fallback
  return "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!";
}

// ========= boot & UI =========
function boot(){
  buildIntents();
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim(); if(!q) return;
  addMsg("user", q);
  input.value = "";

  const typing = addMsg("bot","",{typing:true});
  try{
    const a = await respond(q);
    // small natural delay so it feels chatty
    setTimeout(()=>stopTyping(typing, a), 500);
  }catch(err){
    stopTyping(typing, "Something went wrong. Try again.");
    console.error(err);
  }
});

// quick chips
document.getElementById("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if(!b) return;
  input.value = b.dataset.q; form.requestSubmit();
});

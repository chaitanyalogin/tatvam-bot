// ========= loader =========
const urls = window.DATA_URLS;
async function getJSON(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
const DATA = {};
(async () => {
  [DATA.smalltalk, DATA.profile, DATA.jokes, DATA.memes] = await Promise.all([
    getJSON(urls.smalltalk), getJSON(urls.profile), getJSON(urls.jokes), getJSON(urls.memes)
  ]);
  boot();
})();

// ========= helpers/UI =========
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

function addMsg(role, text){
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
  return el;
}
function addTyping(){
  const el = document.createElement("div");
  el.className = "msg bot typing";
  el.innerHTML = `<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
  return (finalText)=>{
    el.classList.remove("typing");
    el.querySelector(".bubble").textContent = finalText;
    chat.scrollTop = chat.scrollHeight;
  };
}
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
const rand = a => a[Math.floor(Math.random()*a.length)];
const clamp = (t,n=550)=> t.length<=n ? t : (t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ") || t.slice(0,n))+"…";
const norm  = t => t.toLowerCase().replace(/[^\w\s\u0900-\u097F\+\-\*\/%().!?']/g," ").replace(/\s+/g," ").trim();
const anyIn = (t, arr) => arr.some(x => t.includes(x));
const STOPWORDS = new Set("the a an of and or to is are was were be been being this that these those i you he she they we me my our your his her their in on at for with from by as it it's its about tell say define explain".split(" "));

// ========= smalltalk (skip joke/meme intents; we use external files) =========
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

// ========= profile answers & cues =========
const CUES = {
  who: ["who is chaitanya","who is chaitanya kulkarni","introduce chaitanya","about chaitanya","profile summary","who is he","what is chaitanya"],
  company: ["current company","which company","present company","employer","where does he work"],
  education: ["education","degree","qualification","college","study","studies"],
  skills: ["skills","tech stack","stack","tools","technology","what tools"],
  projects: ["projects","project list","what all projects","recent work","project overview"],
  personal: ["personal projects","chatbot project","tatvam chatbot","sms spam","fraud detection","movie recommendation","recommender"],
  eol: ["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl: ["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
  finance: ["finance","q1","april may","financial summary","performance dashboard"],
  deployment: ["deploy","deployment","iframe","website","embed","publish"]
};
function similarity(a,b){
  a=norm(a); b=norm(b);
  const len = Math.max(a.length,b.length)||1;
  let same=0; for(const w of b.split(" ")){ if(a.includes(w)) same+=w.length }
  return same/len;
}
function bestLabel(t){
  let best=null, score=0;
  for(const [lbl,cues] of Object.entries(CUES)){
    for(const c of cues){ const s = similarity(t,c); if(s>score){score=s; best=lbl} }
  }
  return score>=0.72 ? best : null;
}

// witty who
function wittyWho(){
  return "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n" +
         "Chaitanyachidambar Kulkarni is a Junior Software Engineer at iTriangle Infotech (Bengaluru) focused on Power BI, MySQL and Python ETL. Built finance & EOL dashboards, automated 12 AM refresh via Gateway, parsed IMEI failure reasons, and deployed secure iFrame dashboards.";
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
function profileProjects(limit=8){
  const p = (DATA.profile?.projects||[]).slice(0,limit).map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length ? "Projects:\n" + p.join("\n") : "Projects: See profile.";
}
function profilePersonalProjects(){
  const list = (DATA.profile?.projects||[]).filter(p =>
    /personal/i.test(p.name) ||
    /(chatbot|spam|fraud|recommend)/i.test([p.name, ...(p.details||[])].join(" "))
  );
  if(!list.length) return "Personal projects: TatTvam chatbot, SMS Spam Classifier, Fraud Detection, Movie Recommender.";
  return "Personal projects:\n" + list.map(p=>`- ${p.name}: ${p.purpose||p.details?.[0]||""}`).join("\n");
}
function profileChatbot(){ // explicit answer when user asks "chatbot"
  const p = (DATA.profile?.projects||[]).find(x=>/tatvam.*chatbot/i.test(x.name));
  if(!p) return "TatTvam — personal chatbot hosted on GitHub Pages; answers career questions using JSON knowledge base.";
  return `${p.name}:\n- ${p.purpose}\n- ${((p.details||[]).slice(0,3)).map(d=>"• "+d).join("\n")}`;
}

// ========= jokes & memes =========
function randomJoke(){ return rand(DATA.jokes?.jokes || ["No jokes loaded 😅"]); }
function randomMeme(){ return rand(DATA.memes?.memes || ["No memes loaded 😅"]); }

// ========= math =========
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

// ========= web summary (guarded) =========
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
function shouldWebSearch(q){
  const t = norm(q);
  const words = t.split(" ").filter(w=>w && !STOPWORDS.has(w));
  const longEnough = words.length >= 3;
  const hasQ = /(what|who|when|where|why|how|define|meaning|explain)\b/.test(t);
  return longEnough && hasQ;
}
async function webSummary(q){ return await ddgIA(q) || await wikiSummary(q) || null; }

// ========= router =========
const RUDE = ["shut up","stop it","be quiet","chup","band kar","chup kar"];

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

  // rude
  if(anyIn(t, RUDE)) return "Chill bhai 😄 — jokes sunaoon ya projects bataoon?";

  // math
  const m = tryMath(q); if(m) return m;

  // jokes / memes (first-class)
  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme") || t.includes("memes")) return randomMeme();

  // explicit project names
  if(anyIn(t, CUES.personal)) return profilePersonalProjects();
  if(/chat\s*bot|chatbot/i.test(q)) return profileChatbot();

  // strong “who is chaitanya” rule
  if(/who\s+is\s+chaitanya/.test(t) || /introduce\s+chaitanya/.test(t) || /about\s+chaitanya/.test(t)){
    return wittyWho();
  }

  // smalltalk hit
  const st = smalltalkReply(t);
  if(st) return st;

  // career-ish via cues
  const lbl = bestLabel(t);
  if(lbl==="company") return profileCompany();
  if(lbl==="education") return profileEducation();
  if(lbl==="skills") return profileSkills();
  if(lbl==="projects") return profileProjects();
  if(lbl==="eol") return "EOL shows Total Tested, Passed, Retested-Recovered, Failed with Stage/Model/Date slicers. Failure reasons parsed by tokens ending ':0'.";
  if(lbl==="etl") return "Python ETL automates MySQL → Power BI with daily refresh at 12:00 AM IST via Gateway.";
  if(lbl==="finance") return "Finance dashboards (April–May & Q1): revenue, purchase, margin, closing stock; OEM vs After-Market comparisons.";
  if(lbl==="deployment") return "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";
  if(lbl==="who") return wittyWho();

  // guarded web answer
  if(shouldWebSearch(q)){
    const web = await webSummary(q);
    if(web) return web;
  }

  return playfulFallback();
}

// ========= boot + UX (typing) =========
function boot(){
  buildIntents();
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = input.value.trim(); if(!q) return;
  addMsg("user", q); input.value="";

  const finishTyping = addTyping();
  const started = performance.now();
  let a = "…";
  try{ a = await respond(q); }catch(err){ a = "Something went wrong. Try again."; console.error(err); }
  const elapsed = performance.now() - started;
  const MIN = 700; // ms
  const wait = Math.max(0, MIN - elapsed);
  setTimeout(()=>finishTyping(a), wait);
});

// chips
document.getElementById("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if(!b) return;
  input.value = b.dataset.q; form.requestSubmit();
});

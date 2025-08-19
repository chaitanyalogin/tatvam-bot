// ========= data links from index.html =========
const urls = window.DATA_URLS;

// ========= fetch all JSON =========
async function getJSON(url){ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(url); return r.json(); }
const DATA = {};
(async()=>{
  [DATA.smalltalk, DATA.profile, DATA.jokes, DATA.memes] = await Promise.all([
    getJSON(urls.smalltalk), getJSON(urls.profile), getJSON(urls.jokes), getJSON(urls.memes)
  ]);
  boot();
})();

// ========= DOM refs =========
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

// ========= UI helpers =========
function addMsg(role, text){
  const el=document.createElement("div");
  el.className=`msg ${role}`;
  el.innerHTML=`<div class="bubble">${escapeHtml(text)}</div>`;
  chat.appendChild(el); chat.scrollTop=chat.scrollHeight; return el;
}
function addTyping(){
  const el=document.createElement("div");
  el.className="msg bot typing";
  el.innerHTML=`<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chat.appendChild(el); chat.scrollTop=chat.scrollHeight;
  return (finalText)=>{ el.classList.remove("typing"); el.querySelector(".bubble").textContent=finalText; chat.scrollTop=chat.scrollHeight; };
}
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
const rand = a => a[Math.floor(Math.random()*a.length)];
const clamp=(t,n=550)=>t.length<=n?t:(t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ")||t.slice(0,n))+"…";
const norm=t=>t.toLowerCase().replace(/[^\w\s\u0900-\u097F+\-*/%().!?']/g," ").replace(/\s+/g," ").trim();
const STOPWORDS=new Set("the a an of and or to is are was were be been being this that these those i you he she they we me my our your his her their in on at for with from by as it it's its about tell say define explain".split(" "));

// ========= smalltalk (skip joke/meme intents – use external files) =========
const SKIP=new Set(["jokes_tech","jokes_general","memes_indian","memes_english","memes_tatvam_self"]);
let INTENTS=[];
function buildIntents(){
  INTENTS=(DATA.smalltalk?.intents||[])
    .filter(it=>!SKIP.has(it.name))
    .map(it=>({name:it.name, patterns:(it.patterns||[]).map(norm), responses:it.responses||[]}));
}
function smalltalkHit(t){
  const hits=INTENTS.filter(it=>it.patterns.some(p=>p && t.includes(p)));
  if(!hits.length) return null;
  return rotate(itPick(hits).responses, `st:${itPick(hits).name}`);
}
function itPick(h){return h[Math.floor(Math.random()*h.length)]}

// ========= state (for follow-ups + rotation) =========
const state = {
  lastOffer: null,       // e.g. {type:"etl"|"eol"|"projects"|...}
  lastTopic: null,       // remember inferred topic
  recent: new Map()      // key -> last index served (avoid repeats)
};
function rotate(arr, key){
  if(!arr?.length) return null;
  const last = state.recent.get(key) ?? -1;
  const idx = (last+1) % arr.length;
  state.recent.set(key, idx);
  return arr[idx];
}

// ========= knowledge formatters =========
function wittyWho(){
  return "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n" +
         "Chaitanyachidambar Kulkarni is a Junior Software Engineer at iTriangle Infotech (Bengaluru), focused on Power BI, MySQL, and Python ETL. He built finance & EOL dashboards, automated 12 AM refresh via Gateway, parsed IMEI-level failure reasons, and deployed secure iFrame dashboards.";
}
function profileCompany(){
  const e=DATA.profile?.experience?.[0];
  return e?`Current company: ${e.company} — role: ${e.title} (${e.duration}).`:"Company info not available.";
}
function profileEducation(){
  const ed=DATA.profile?.education||[];
  if(!ed.length) return "Education: Bachelor of Commerce + Data Analyst/Data Science specializations.";
  const rows=ed.map(e=>e.degree?`${e.degree} — ${e.institute} (${e.date})`:`${e.course} — ${e.institute} (${e.date})`);
  return "Education:\n- "+rows.join("\n- ");
}
function profileSkills(){
  const ts=DATA.profile?.technical_skills||{};
  const lines=Object.entries(ts).map(([k,v])=>`${k.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase())}: ${v.join(", ")}`);
  return "Skills:\n- "+lines.join("\n- ");
}
function profileProjects(limit=8){
  const p=(DATA.profile?.projects||[]).slice(0,limit).map(x=>`- ${x.name}: ${x.purpose||""}`);
  return p.length? "Projects:\n"+p.join("\n"): "Projects: See profile.";
}
function profilePersonalProjects(){
  const list=(DATA.profile?.projects||[]).filter(p =>
    /personal/i.test(p.name) || /(chatbot|spam|fraud|recommend)/i.test([p.name, ...(p.details||[])].join(" "))
  );
  if(!list.length) return "Personal projects:\n- TatTvam — AI Chatbot\n- SMS Spam Classifier\n- Fraud Detection Model\n- Movie Recommendation System";
  return "Personal projects:\n"+list.map(p=>`- ${p.name}: ${p.purpose||p.details?.[0]||""}`).join("\n");
}
function profileChatbot(){
  const p=(DATA.profile?.projects||[]).find(x=>/tatv(am)?.*chatbot/i.test(x.name));
  return p? `${p.name}:\n- ${p.purpose}\n- ${((p.details||[]).slice(0,3)).map(d=>"• "+d).join("\n")}` :
            "TatTvam — personal chatbot on GitHub Pages; answers career questions using JSON knowledge base.";
}

// ========= cues & detection =========
const CUES={
  who:["who is chaitanya","who is chaitanya kulkarni","introduce chaitanya","about chaitanya","profile summary"],
  company:["current company","which company","present company","employer","where does he work"],
  education:["education","degree","qualification","college","study","studies"],
  skills:["skills","tech stack","stack","tools","technology","what tools"],
  projects:["projects","project list","what all projects","recent work","project overview"],
  personal:["personal projects","chatbot project","tatvam chatbot","sms spam","fraud detection","movie recommendation","recommender"],
  eol:["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl:["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
  finance:["finance","q1","april may","financial summary","performance dashboard"],
  deployment:["deploy","deployment","iframe","website","embed","publish"]
};
function hasAny(t, list){return list.some(s=>t.includes(s))}
function bestLabel(t){
  for(const [k, cues] of Object.entries(CUES)){ if(hasAny(t, cues.map(norm))) return k; }
  return null;
}

// ========= jokes/memes/math =========
const randomJoke=()=>rand(DATA.jokes?.jokes||["No jokes loaded 😅"]);
const randomMeme=()=>rand(DATA.memes?.memes||["No memes loaded 😅"]);
const mathRe=/(?<!\w)([\d\.\s+\-*/%()]+)(?!\w)/;
function tryMath(s){
  const m=s.toLowerCase().match(mathRe); if(!m) return null;
  const expr=m[1].replace(/\^/g,"**").replace(/[^\d\.\s+\-*/%()]/g,"").trim();
  try{ const v=eval(expr); if(Number.isFinite(v)) return "= "+(Number.isInteger(v)?v:v.toString()); }catch(_){}
  return null;
}

// ========= web summaries (guarded) =========
async function ddgIA(q){
  try{ const r=await fetch("https://api.duckduckgo.com/?format=json&no_html=1&no_redirect=1&q="+encodeURIComponent(q),{cache:"no-store"});
       if(!r.ok) return null; const j=await r.json();
       if(j.AbstractText) return clamp(j.AbstractText);
       const t=(j.RelatedTopics||[]).find(x=>x && x.Text); return t?clamp(t.Text):null;
  }catch(_){return null}
}
async function wikiSummary(q){
  try{
    const s=await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&limit=1&namespace=0&format=json&search=${encodeURIComponent(q)}`);
    if(!s.ok) return null; const arr=await s.json();
    if(!arr[1]?.[0]) return null; const title=arr[1][0];
    const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if(!r.ok) return null; const j=await r.json(); return j.extract?clamp(j.extract):null;
  }catch(_){return null}
}
function shouldWebSearch(q){
  const t=norm(q); const words=t.split(" ").filter(w=>w && !STOPWORDS.has(w));
  return words.length>=3 && /(what|who|when|where|why|how|define|meaning|explain)\b/.test(t);
}
async function webSummary(q){ return await ddgIA(q) || await wikiSummary(q) || null; }

// ========= fallback lines =========
function playfulFallback(){
  return rotate([
    "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
    "Thoda lightweight AI hu 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!"
  ], "fallback");
}

// ========= main router with follow-ups =========
const YES_WORDS = ["yes","haan","ha","ok","okay","sure","go ahead","continue","bolo","tell me","explain","go on"];

async function respond(q){
  const t=norm(q);

  // YES to last offer
  if(YES_WORDS.some(w=>t===w || t.startsWith(w))){
    if(state.lastOffer){
      const k=state.lastOffer;
      state.lastOffer=null;  // consume
      if(k==="etl")      return "ETL details:\n- Source: MySQL → Python clean/transform → Power BI.\n- Schedule: Daily 12:00 AM IST via Gateway; zero manual steps.\n- Goal: reliable, zero-touch refresh for leadership.";
      if(k==="eol")      return "EOL details:\n- Measures: Total Tested, Passed, Retested-Recovered, Failed.\n- Slicers: Stage (1/2), Model, Date.\n- Failure parsing: only tokens ending ':0' counted as true fails.\n- Default date: ‘today’ via epoch DAX.";
      if(k==="projects") return profileProjects();
      if(k==="skills")   return profileSkills();
    }
  }

  // math
  const m=tryMath(q); if(m) return m;

  // jokes/memes fast path
  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme")||t.includes("memes")) return randomMeme();

  // explicit personal
  if(hasAny(t, CUES.personal.map(norm))) return profilePersonalProjects();
  if(/chat\s*bot|chatbot/i.test(q)) return profileChatbot();

  // strong WHO rule
  if(/who\s+is\s+chaitanya/.test(t) || /introduce\s+chaitanya/.test(t) || /about\s+chaitanya/.test(t)){
    // set a follow-up offer automatically
    state.lastOffer="projects";
    return wittyWho();
  }

  // smalltalk hit (and set contextual offer)
  const st=smalltalkHit(t);
  if(st){
    // if smalltalk greeting, propose a topic
    if(/(hi|hello|hey|namaste|kaise ho|kya chal)/.test(t)){ state.lastOffer="projects"; }
    return st;
  }

  // career via cues (and set follow-up)
  const lbl=bestLabel(t);
  if(lbl){
    state.lastOffer = ["projects","skills","etl","eol"].includes(lbl) ? lbl : null;
    if(lbl==="company")    return profileCompany();
    if(lbl==="education")  return profileEducation();
    if(lbl==="skills")     return profileSkills();
    if(lbl==="projects")   return profileProjects();
    if(lbl==="eol")        return "EOL shows Total Tested, Passed, Retested-Recovered, and Failed with Stage/Model/Date slicers. Failure reasons are tokens ending ':0'. (Say 'yes' for details.)";
    if(lbl==="etl")        return "Python ETL automates MySQL → Power BI with daily 12 AM Gateway refresh. (Say 'yes' for details.)";
    if(lbl==="finance")    return "Finance dashboards: revenue, purchase, margin, closing stock; OEM vs After-Market comparisons.";
    if(lbl==="deployment") return "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";
    if(lbl==="who")        return wittyWho();
  }

  // guarded web
  if(shouldWebSearch(q)){ const w=await webSummary(q); if(w) return w; }

  // generic nudge + offer
  state.lastOffer="projects";
  return playfulFallback();
}

// ========= boot & typing UX =========
function boot(){
  buildIntents();
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q=input.value.trim(); if(!q) return;
  addMsg("user", q); input.value="";

  const finish=addTyping();
  const start=performance.now();
  let a="…";
  try{ a=await respond(q); }catch(err){ a="Something went wrong. Try again."; console.error(err); }
  const elapsed=performance.now()-start;
  const MIN=700; // ms so it “thinks”
  setTimeout(()=>finish(a), Math.max(0, MIN-elapsed));
});

// chips -> submit
document.getElementById("chips").addEventListener("click", e=>{
  const b=e.target.closest(".chip"); if(!b) return;
  input.value=b.dataset.q; form.requestSubmit();
});

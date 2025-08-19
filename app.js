// ========= data links from index.html =========
const urls = window.DATA_URLS;

// ========= fetch all JSON =========
async function getJSON(url){
  const r = await fetch(url,{cache:"no-store"});
  if(!r.ok) throw new Error(url);
  return r.json();
}
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
  chat.appendChild(el);
  chat.scrollTop=chat.scrollHeight;
  return el;
}
function addTyping(){
  const el=document.createElement("div");
  el.className="msg bot typing";
  el.innerHTML=`<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chat.appendChild(el); chat.scrollTop=chat.scrollHeight;
  return (finalText)=>{
    el.classList.remove("typing");
    el.querySelector(".bubble").textContent=finalText;
    chat.scrollTop=chat.scrollHeight;
  };
}
function escapeHtml(s){
  return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;","">":"&gt;"}[c]))
}
const rand = a => a[Math.floor(Math.random()*a.length)];
const clamp=(t,n=550)=>t.length<=n?t:(t.slice(0,n).split(/(?<=[.!?])\s/).slice(0,-1).join(" ")||t.slice(0,n))+"…";
const norm=t=>t.toLowerCase().replace(/[^\w\s\u0900-\u097F+\-*/%().!?']/g," ").replace(/\s+/g," ").trim();
const STOPWORDS=new Set("the a an of and or to is are was were be been being this that these those i you he she they we me my our your his her their in on at for with from by as it it's its about tell say define explain meaning what who when where why how".split(" "));

// ========= smalltalk =========
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

// ========= state =========
const state = { lastOffer:null, lastTopic:null, recent:new Map() };
function rotate(arr, key){
  if(!arr?.length) return null;
  const last = state.recent.get(key) ?? -1;
  const idx = (last+1) % arr.length;
  state.recent.set(key, idx);
  return arr[idx];
}

// ========= knowledge =========
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

// ========= cues =========
const CUES={
  who:["who is chaitanya","introduce chaitanya","about chaitanya"],
  company:["current company","employer","where does he work"],
  education:["education","degree","qualification","college","studies"],
  skills:["skills","tech stack","tools","technology"],
  projects:["projects","project list","recent work"],
  personal:["personal projects","chatbot project","tatvam chatbot","sms spam","fraud detection","movie recommendation"],
  eol:["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
  etl:["etl","pipeline","python etl","refresh","gateway","automation"],
  finance:["finance","financial summary","performance dashboard"],
  deployment:["deploy","deployment","iframe","website","publish"]
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
  if(/^\d{4}$/.test(expr)) return null; // avoid plain years
  try{ const v=eval(expr); if(Number.isFinite(v)) return "= "+(Number.isInteger(v)?v:v.toString()); }catch(_){}
  return null;
}

// ========= web summaries =========
function getForcedQuery(q){
  const m = q.match(/^\s*(search|google)\s*:\s*(.+)$/i);
  return m ? m[2].trim() : null;
}
async function ddgIA(q){
  try{
    const r=await fetch("https://api.duckduckgo.com/?format=json&no_html=1&no_redirect=1&q="+encodeURIComponent(q),{cache:"no-store"});
    if(!r.ok) return null;
    const j=await r.json();
    if(j.AbstractText) return clamp(j.AbstractText);
    const t=(j.RelatedTopics||[]).find(x=>x && x.Text);
    return t?clamp(t.Text):null;
  }catch(_){return null}
}
async function wikiSummary(q){
  try{
    const s=await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&limit=1&namespace=0&format=json&search=${encodeURIComponent(q)}`);
    if(!s.ok) return null;
    const arr=await s.json();
    if(!arr[1]?.[0]) return null;
    const title=arr[1][0];
    const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if(!r.ok) return null;
    const j=await r.json();
    return j.extract?clamp(j.extract):null;
  }catch(_){return null}
}
async function webSummary(q){ return await ddgIA(q) || await wikiSummary(q) || null; }

function shouldWebSearch(q){
  const t=norm(q);
  if(getForcedQuery(q)) return true;
  const words=t.split(" ").filter(w=>w && !STOPWORDS.has(w));
  const hasQ=/\b(what|who|when|where|why|how|define|meaning|explain)\b/.test(t);
  return hasQ || /\?$/.test(q.trim()) || (/\d/.test(t)&&words.length>=2);
}

// ========= fallback =========
function playfulFallback(){
  return rotate([
    "Bhai, ChatGPT nahi hu 😅. Par jokes, memes, skills ya projects pucho!",
    "Thoda lightweight AI hu 🤏 — kaam ka hu. Jokes, memes, skills, projects bolo.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL’ bol!"
  ], "fallback");
}

// ========= main router =========
const YES_WORDS=["yes","haan","ha","ok","okay","sure","continue","bolo","tell me","explain"];

async function respond(q){
  const forced=getForcedQuery(q);
  const t=norm(forced||q);

  if(!forced && YES_WORDS.some(w=>t===w||t.startsWith(w))){
    if(state.lastOffer){
      const k=state.lastOffer; state.lastOffer=null;
      if(k==="etl") return "ETL details:\n- MySQL → Python → Power BI.\n- Daily 12AM IST refresh via Gateway.";
      if(k==="eol") return "EOL details:\n- Tested, Passed, Retested, Failed.\n- Filters: Stage, Model, Date.\n- Failures = tokens ending ':0'.";
      if(k==="projects") return profileProjects();
      if(k==="skills") return profileSkills();
    }
  }

  if(!forced){
    const m=tryMath(q); if(m) return m;
  }

  if(t.includes("joke")) return randomJoke();
  if(t.includes("meme")) return randomMeme();

  if(hasAny(t,CUES.personal.map(norm))) return profilePersonalProjects();
  if(/chat\s*bot|chatbot/i.test(t)) return profileChatbot();

  if(/who\s+is\s+chaitanya/.test(t)||/introduce\s+chaitanya/.test(t)||/about\s+chaitanya/.test(t)){
    state.lastOffer="projects"; return wittyWho();
  }

  const st=smalltalkHit(t);
  if(st){ if(/(hi|hello|hey|namaste|kaise ho)/.test(t)){state.lastOffer="projects";} return st; }

  const lbl=bestLabel(t);
  if(lbl){
    state.lastOffer=["projects","skills","etl","eol"].includes(lbl)?lbl:null;
    if(lbl==="company") return profileCompany();
    if(lbl==="education") return profileEducation();
    if(lbl==="skills") return profileSkills();
    if(lbl==="projects") return profileProjects();
    if(lbl==="eol") return "EOL shows Tested, Passed, Retested, Failed. (Say 'yes' for details.)";
    if(lbl==="etl") return "Python ETL automates daily 12AM refresh. (Say 'yes' for details.)";
    if(lbl==="finance") return "Finance dashboards: revenue, margin, stock, OEM vs AM.";
    if(lbl==="deployment") return "Dashboards deployed via secure iFrame + Gateway refresh.";
    if(lbl==="who") return wittyWho();
  }

  if(forced || shouldWebSearch(q)){
    const w=await webSummary(forced||q);
    if(w) return w;
  }

  state.lastOffer="projects";
  return playfulFallback();
}

// ========= boot =========
function boot(){
  buildIntents();
  addMsg("bot","Hey there! 👋 I’m TatTvam.\nAsk me about Chaitanya’s work, projects, skills — or say “tell me a joke”.");
}

// ========= form submit =========
form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q=input.value.trim(); if(!q) return;
  addMsg("user", q); input.value="";
  const finish=addTyping();
  let a="…";
  try{ a=await respond(q);}catch(err){a="Something went wrong."; console.error(err);}
  setTimeout(()=>finish(a),700);
});

// ========= chips =========
document.getElementById("chips").addEventListener("click", e=>{
  const b=e.target.closest(".chip"); if(!b) return;
  input.value=b.dataset.q; form.requestSubmit();
});

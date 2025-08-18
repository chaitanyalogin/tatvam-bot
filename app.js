/* TatTvam – Web version with:
   - Separate jokes/memes files
   - Witty "who is Chaitanya?" intro
   - Math answers
   - Simple fuzzy+rules NLP
   - Web fallback summaries (no links)
*/

(async function () {
  // ---------- DOM ----------
  const $input   = document.querySelector("#userInput") || document.querySelector("input[type=text]");
  const $send    = document.querySelector("#sendBtn")   || document.querySelector("button[type=submit]");
  const $msgs    = document.querySelector("#messages")  || document.querySelector(".messages");
  const $chips   = document.querySelector("#chips");

  function addMsg(text, who = "bot") {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.textContent = text;
    $msgs?.appendChild(div);
    $msgs?.scrollTo({ top: $msgs.scrollHeight, behavior: "smooth" });
  }

  function addUser(text) { addMsg(text, "user"); }
  function addBot(text)  { addMsg(text, "bot");  }

  // ---------- Helpers ----------
  const norm = (t) =>
    t.toLowerCase()
     .replace(/[^\w\s\u0900-\u097F\+\-\*\/\%\.\(\)\?\!']/g, " ")
     .replace(/\s+/g, " ")
     .trim();

  const anyIn = (t, bag) => bag.some((x) => t.includes(x));

  // tiny fuzzy (token overlap 0..100)
  function fuzzyScore(a, b) {
    const A = new Set(norm(a).split(" "));
    const B = new Set(norm(b).split(" "));
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    const denom = Math.max(1, Math.min(A.size, B.size));
    return Math.round((inter / denom) * 100);
  }

  function clamp(txt, n = 550) {
    if (!txt || txt.length <= n) return txt || "";
    const cut = txt.slice(0, n);
    const m = cut.lastIndexOf(". ");
    return (m > n * 0.6 ? cut.slice(0, m + 1) : cut) + "…";
  }

  // math
  const MATH_RE = /(?<!\w)([\d\.\s\+\-\*\/\%\(\)]+)(?!\w)/g;
  function mathExpr(s) {
    const t = s.toLowerCase();
    if (![..."+-*/%()"].some((c) => t.includes(c)) || !/[0-9]/.test(t)) return null;
    const cands = [...t.matchAll(MATH_RE)].map((m) => m[1]);
    if (!cands.length) return null;
    let expr = cands.sort((a, b) => b.length - a.length)[0];
    expr = expr.replace(/\^/g, "**").replace(/[^0-9\.\s\+\-\*\/\%\(\)]/g, "");
    return expr.trim() || null;
  }
  function mathEval(expr) {
    try {
      const val = Function(`"use strict";return (${expr});`)();
      if (Number.isFinite(val)) return `= ${Number.isInteger(val) ? val : val}`;
    } catch (e) {}
    return null;
  }

  // ---------- Load knowledge ----------
  async function getJSON(path) {
    const res = await fetch(path + `?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch ${path} ${res.status}`);
    return res.json();
  }

  // NOTE: using top-level /data (the good folder)
  const SMALLTALK = await getJSON("data/smalltalk.json");
  const PROFILE   = await getJSON("data/about_chaitanya.json");
  const JOKES     = await getJSON("data/jokes.json");    // { jokes: [...] }
  const MEMES     = await getJSON("data/memes.json");    // { memes: [...] }

  // Filter out joke/meme intents from smalltalk; we’ll use separate files
  const SKIP = new Set(["jokes_tech", "jokes_general", "memes_indian", "memes_english", "memes_tatvam_self"]);
  const INTENTS = (SMALLTALK.intents || [])
    .filter((it) => !SKIP.has(it.name))
    .map((it) => ({
      name: it.name,
      patterns: (it.patterns || []).map(norm).filter(Boolean),
      responses: it.responses || [],
    }));

  const randomOf = (arr, fallback) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback);
  const randomJoke = () => randomOf(JOKES.jokes, "No jokes loaded 😅");
  const randomMeme = () => randomOf(MEMES.memes, "No memes loaded 😅");

  // ---------- Memory ----------
  const state = { lastCategory: null, recent: [], lastTopic: null };
  const FOLLOWUP = new Set(["another one", "next", "one more", "more", "aur ek", "aur", "more jokes", "continue"]);
  const FOLLOWUP_DETAILS = new Set(["explain", "details", "detail", "more", "thoda aur", "expand", "why", "how"]);

  function setTopic(user) {
    const t = norm(user);
    if (t.includes("eol") || t.includes("imei") || t.includes("stage")) state.lastTopic = "eol";
    else if (["etl", "pipeline", "refresh", "gateway"].some((x) => t.includes(x))) state.lastTopic = "etl";
    else if (["finance", "april", "may", "q1"].some((x) => t.includes(x))) state.lastTopic = "finance";
    else if (t.includes("project")) state.lastTopic = "projects";
  }

  function expandTopic(topic) {
    if (topic === "eol")
      return "EOL details:\n- Measures: Total Tested, Passed, Retested-Recovered, Failed.\n- Slicers: Stage (1/2), Model, Date.\n- Failure reasons: tokens ending ':0' counted as true fails.\n- Date logic: ‘today by default’ via epoch in DAX; respects slicers.";
    if (topic === "etl")
      return "ETL details:\n- Source: MySQL → Python clean/transform → Power BI.\n- Schedule: Daily 12:00 AM IST via Gateway; no manual steps.\n- Goal: zero-touch refresh, stable leadership view.";
    if (topic === "finance")
      return "Finance dashboard details:\n- April–May & Q1: revenue, purchase, margin, closing stock.\n- Slicers: Branch/Type/Month; OEM vs After-Market comparisons.\n- Cards + trend visuals; consistent DAX naming & UX.";
    if (topic === "projects") {
      const items = (PROFILE.projects || []).slice(0, 6).map((p) => `- ${p.name}: ${p.purpose || ""}`);
      return items.length ? items.join("\n") : "Projects: See profile.";
    }
    return "Kis topic pe? (eol / etl / finance / projects)";
  }

  // ---------- Smalltalk engine ----------
  const playfulFallbacks = [
    "Bhai, ChatGPT nahi hu — itna funding nahi hai 😅. Par jokes, memes, skills ya projects pucho, mast bataunga!",
    "Thoda lightweight AI hu bhai 🤏 — par kaam ka hu. Pucho: jokes, memes, skills, projects, EOL.",
    "Confused ho gaya 😅. ‘joke’, ‘meme’, ‘skills’, ‘projects’ ya ‘EOL project’ bol, turant reply dunga!",
  ];
  const playful = () => randomOf(playfulFallbacks, "🙂");

  function pick(options) {
    if (!options || !options.length) return null;
    for (let i = 0; i < 5; i++) {
      const x = options[Math.floor(Math.random() * options.length)];
      if (!state.recent.includes(x)) {
        state.recent.push(x);
        if (state.recent.length > 8) state.recent.shift();
        return x;
      }
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  function smalltalkReply(user) {
    const t = norm(user);
    if (FOLLOWUP.has(t) && state.lastCategory) {
      const hit = INTENTS.find((i) => i.name === state.lastCategory);
      return pick(hit?.responses);
    }
    const hits = INTENTS.filter((it) => it.patterns.some((p) => p && t.includes(p)));
    if (hits.length) {
      const ch = hits[Math.floor(Math.random() * hits.length)];
      state.lastCategory = ch.name;
      return pick(ch.responses);
    }
    // fuzzy by name/pattern tokens
    let best = null, score = 0;
    for (const it of INTENTS) {
      for (const p of it.patterns) {
        const s = fuzzyScore(t, p);
        if (s > score) { score = s; best = it; }
      }
      const s2 = fuzzyScore(t, it.name.replace(/_/g, " "));
      if (s2 > score) { score = s2; best = it; }
    }
    if (best && score >= 72) {
      state.lastCategory = best.name;
      return pick(best.responses);
    }
    return null;
  }

  // ---------- Career Qs ----------
  const CUES = {
    who: [
      "who is chaitanya","what is chaitanya","who is chay","who is chaitaya",
      "introduce chaitanya","who are you","who is he","about chaitanya","tell me about chaitanya","profile summary"
    ],
    company: ["company","current company","which company","employer","where does he work","present company"],
    education: ["education","degree","qualification","college","study","studies","what did he study"],
    skills: ["skills","tech stack","stack","tools","what tools","technology"],
    projects: ["projects","project list","what all projects","overview of projects","work done","recent work"],
    eol: ["eol","stage 1","stage 2","imei","failure reason","testing dashboard"],
    etl: ["etl","pipeline","python etl","refresh","gateway","automation","daily refresh"],
    finance: ["finance","q1","april may","financial summary","performance dashboard"],
    deployment: ["deploy","deployment","iframe","website","embed","publish"]
  };

  function bestLabel(text) {
    const t = norm(text);
    let best = null, score = -1;
    for (const [lbl, cues] of Object.entries(CUES)) {
      for (const c of cues) {
        const s = fuzzyScore(t, c);
        if (s > score) { score = s; best = lbl; }
      }
    }
    return score >= 72 ? best : null;
  }

  const wittyIntro = () => "Chaitanya is an electronic device 😜 Just kidding! Here you go:\n";

  function profileCompany() {
    const e = (PROFILE.experience || [])[0];
    return e ? `Current company: ${e.company || ""} — role: ${e.title || ""} (${e.duration || ""}).` : null;
  }
  function profileEducation() {
    const ed = PROFILE.education || [];
    if (!ed.length) return "Education: Bachelor of Commerce + Data Analyst/Data Science specializations.";
    const lines = ed.map((e) =>
      e.degree ? `${e.degree} — ${e.institute || ""} (${e.date || ""})`
               : `${e.course || ""} — ${e.institute || ""} (${e.date || ""})`
    );
    return "Education:\n" + lines.map((x) => `- ${x}`).join("\n");
  }
  function profileSkills() {
    const ts = PROFILE.technical_skills || {};
    const lines = Object.entries(ts).map(([k, v]) => `${k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}: ${v.join(", ")}`);
    return "Skills:\n" + lines.map((x) => `- ${x}`).join("\n");
  }
  function profileProjects(limit = 6) {
    const items = (PROFILE.projects || []).slice(0, limit).map((p) => `- ${p.name}: ${p.purpose || ""}`);
    return items.length ? "Projects:\n" + items.join("\n") : "Projects: See profile.";
  }
  const profileEOL   = () => "EOL shows Total Tested, Passed, Retested-Recovered, and Failed with Stage/Model/Date slicers. Failure reasons parsed by tokens ending ':0'. Default-to-today via epoch logic.";
  const profileETL   = () => "Python ETL automates MySQL → Power BI with daily refresh at 12:00 AM IST via Gateway. Goal: zero manual reporting and stable leadership views.";
  const profileFin   = () => "Finance dashboards (April–May & Q1): revenue, purchase, margin, closing stock; Branch/Type/Month slicers; OEM vs After-Market comparisons; clean trend visuals.";
  const profileDeploy= () => "Dashboards embedded via secure iFrame on the company portal (Service auth) with daily refresh via Gateway.";

  function profileWho() {
    return (
      wittyIntro() +
      "Chaitanya is a Junior Software Engineer skilled in Power BI, MySQL, and Python ETL. " +
      "Built finance & EOL dashboards, automated 12 AM refresh via Gateway, and deployed via iFrame."
    );
  }

  function profileAnswer(user) {
    const lbl = bestLabel(user);
    if (lbl === "who")       return profileWho();
    if (lbl === "company")   return profileCompany() || "Company info not available.";
    if (lbl === "education") return profileEducation();
    if (lbl === "skills")    return profileSkills();
    if (lbl === "projects")  return profileProjects();
    if (lbl === "eol")       return profileEOL();
    if (lbl === "etl")       return profileETL();
    if (lbl === "finance")   return profileFin();
    if (lbl === "deployment")return profileDeploy();

    const t = norm(user);
    if (t.includes("who is chaitanya") || t.includes("what is chaitanya") || t.includes("who is chay") || t.includes("who is chaitaya"))
      return profileWho();

    if (anyIn(t, ["education","degree","qualification","study","studies","college"])) return profileEducation();
    if (anyIn(t, ["company","current company","which company","where does he work","employer"])) return profileCompany() || "Company info not available.";
    if (anyIn(t, ["skills","tech stack","stack","tools"])) return profileSkills();
    if (anyIn(t, ["projects","project","work done","what all projects","overview"])) return profileProjects();

    // try keyword overlap to list relevant projects
    const qt = new Set(norm(user).split(" "));
    const hits = (PROFILE.projects || []).filter((p) => {
      const blob = norm([p.name, p.purpose, ...(p.details||[]), ...(p.tech||[])].join(" "));
      const bt = new Set(blob.split(" "));
      for (const w of qt) if (bt.has(w)) return true;
      return false;
    }).slice(0, 6).map((p) => `- ${p.name}: ${p.purpose || ""}`);
    if (hits.length) return "Relevant projects:\n" + hits.join("\n");

    const s = [PROFILE.summary?.trim()].filter(Boolean);
    const cc = profileCompany(); if (cc) s.push(cc);
    return s.join("\n") || "I can share skills, projects, or education.";
  }

  // ---------- Web summaries (no links) ----------
  async function ddgSummary(q) {
    try {
      const u = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
      const r = await fetch(u, { cache: "no-store" });
      const j = await r.json();
      if (j.AbstractText) return clamp(j.AbstractText);
      const rt = j.RelatedTopics || [];
      for (const t of rt) if (t && t.Text) return clamp(t.Text);
    } catch {}
    return null;
  }
  async function wikiSummary(q) {
    try {
      const u = `https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json`;
      const r = await fetch(u, { cache: "no-store" });
      const arr = await r.json();
      if (arr && arr[1] && arr[1][0]) {
        const title = arr[1][0];
        const s = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        const j = await s.json();
        if (j && j.extract) return clamp(j.extract);
      }
    } catch {}
    return null;
  }
  async function webSummary(q) {
    return (await ddgSummary(q)) || (await wikiSummary(q));
  }

  // ---------- Router ----------
  const RUDE = new Set(["shut up","stop it","stop","be quiet","chup","band kar","chup kar"]);
  const CASUAL = new Set([
    "hi","hello","hey","namaste","hola","yo","bhai","arre","arrey","wassup","what's up","whats up",
    "kaise","kaise ho","kaise hai","funny","meme","memes","dark","edgy","humor","humour",
    "good morning","gm","good evening","ge","thanks","shukriya","lol","hahaha","are you chatbot","who are you","bhai bhai","bhai bhai bhai","joke","jokes"
  ]);
  const CAREER = new Set([
    "project","projects","experience","skills","tech stack","tools","eol","finance","q1","april","may",
    "deployment","iframe","gateway","resume","summary","profile","linkedin","email",
    "company","current company","which company","where does he work","who is chaitanya","what is chaitanya",
    "education","degree","qualification","introduce chaitanya","who is he","about chaitanya","present company"
  ]);

  async function reply(user) {
    setTopic(user);

    // rude
    if (RUDE.has(norm(user))) return addBot("Chill bhai 😄 — jokes sunaoon ya projects bataoon?");

    // math
    const m = mathExpr(user);
    if (m) {
      const val = mathEval(m);
      return addBot(val || playful());
    }

    // smalltalk direct hit / fuzzy
    const st = smalltalkReply(user);
    if (st) return addBot(st);

    // jokes / memes (casual)
    const t = norm(user);
    if (anyIn(t, ["joke", "jokes", "funny"])) {
      state.lastCategory = "external_jokes";
      return addBot(randomJoke());
    }
    if (anyIn(t, ["meme", "memes"])) {
      state.lastCategory = "external_memes";
      return addBot(randomMeme());
    }

    // career (who/company/education/skills/projects etc.)
    if (bestLabel(user) || [...CAREER].some((k) => t.includes(k)))
      return addBot(profileAnswer(user));

    // detail follow-ups
    if ([...FOLLOWUP_DETAILS].some((k) => t.includes(k)))
      return addBot(expandTopic(state.lastTopic));

    // unknown → web summary (no links) → playful
    const ws = await webSummary(user);
    if (ws) return addBot(ws);

    return addBot(playful());
  }

  // ---------- Wire up ----------
  function handleSend() {
    const text = ($input?.value || "").trim();
    if (!text) return;
    addUser(text);
    $input.value = "";
    reply(text);
  }
  $send?.addEventListener("click", handleSend);
  $input?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });
  $chips?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-q]");
    if (!btn) return;
    const q = btn.getAttribute("data-q");
    addUser(btn.textContent.trim());
    reply(q);
  });

  // Greet once
  addBot("Hey there! 👋 I’m TatTvam.");
})();

const chatWindow = document.getElementById('chatWindow');
const form = document.getElementById('chatForm');
const input = document.getElementById('userInput');
const statusEl = document.getElementById('status');

let session = null;

const SYSTEM_PROMPT = `You are TatTvam, a calm and wise assistant who answers questions about Chaitanya's experience, skills, and journey. You may also answer basic casual and logic questions. Be friendly and concise.`;

function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function init() {
  statusEl.textContent = 'Loading model… (please wait)';
  const engine = new window.WebLLM.MLEngine();

  try {
    await engine.reload("Qwen2-1.5B-Instruct-q4f16_1");
    session = await engine.createChatSession(SYSTEM_PROMPT);
    addMsg('bot', "Hi, I'm TatTvam 👋 Ask me anything about Chaitanya’s journey or even test my reasoning.");
    statusEl.textContent = 'Model ready.';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Failed to load model.';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q || !session) return;
  addMsg('user', q);
  input.value = '';
  statusEl.textContent = 'Thinking…';

  try {
    const reply = await session.generate(q);
    addMsg('bot', reply);
  } catch (err) {
    addMsg('bot', 'Error occurred while replying.');
  } finally {
    statusEl.textContent = 'Model ready.';
  }
});

init();

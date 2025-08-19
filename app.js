const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

function addMessage(message, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");
  msgDiv.textContent = message;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function botReply(userText) {
  // Simple responses for demo
  if (userText.toLowerCase().includes("hello")) {
    return "Hi, I’m Tatvam! How can I help you?";
  } else if (userText.toLowerCase().includes("how are you")) {
    return "I’m just code, but I’m doing great 😄";
  } else {
    return "I'm still learning. Please ask me something simple!";
  }
}

sendBtn.addEventListener("click", () => {
  const text = userInput.value.trim();
  if (text === "") return;

  addMessage(text, "user");
  userInput.value = "";

  setTimeout(() => {
    const reply = botReply(text);
    addMessage(reply, "bot");
  }, 500);
});

userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

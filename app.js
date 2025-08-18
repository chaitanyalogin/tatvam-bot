import React, { useState } from "react";

const files = {
  about: "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/about_chaitanya.json",
  jokes: "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/jokes.json",
  memes: "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/memes.json",
  smalltalk: "https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/smalltalk.json"
};

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  async function fetchData(url, key) {
    const res = await fetch(url);
    const data = await res.json();
    return data[key] || data.about || [];
  }

  async function getBotResponse(userText) {
    const text = userText.toLowerCase();

    if (text.includes("joke")) {
      const jokes = await fetchData(files.jokes, "jokes");
      return jokes[Math.floor(Math.random() * jokes.length)];
    }

    if (text.includes("meme")) {
      const memes = await fetchData(files.memes, "memes");
      return memes[Math.floor(Math.random() * memes.length)];
    }

    if (text.includes("who is chaitanya") || text.includes("about chaitanya")) {
      const about = await fetchData(files.about, "about");
      return about[0]; // first proper description
    }

    const smalltalk = await fetchData(files.smalltalk, "smalltalk");
    return smalltalk[Math.floor(Math.random() * smalltalk.length)];
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);

    const botText = await getBotResponse(input);
    const botMsg = { sender: "bot", text: botText };
    setMessages((prev) => [...prev, botMsg]);

    setInput("");
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <div style={{ border: "1px solid #ccc", padding: 10, height: 300, overflowY: "scroll" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ margin: "5px 0", color: msg.sender === "user" ? "blue" : "green" }}>
            <b>{msg.sender}:</b> {msg.text}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        style={{ width: "80%", padding: 5 }}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}


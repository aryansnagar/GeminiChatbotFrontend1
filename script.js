// ---------- Settings ----------
const API_URL = "https://geminichatbotbackend1.onrender.com/chat"; // change to your deployed API URL
const STORAGE_KEY = "chatbot_chats";

// ---------- Elements ----------
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const newChatBtn = document.getElementById("new-chat");
const chatList = document.getElementById("chat-list");
const messages = document.getElementById("messages");
const input = document.getElementById("input");

// ---------- State ----------
let chats = loadChats(); // [{ id, title, history: [{ role, text }] }]
let currentId = null;    // null = a new, empty chat
let busy = false;

// ---------- Storage ----------
function loadChats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

// ---------- Chat data ----------
function currentChat() {
  return chats.find((c) => c.id === currentId);
}

function createChat(firstMessage) {
  const chat = { id: String(Date.now()), title: firstMessage.slice(0, 40), history: [] };
  chats.unshift(chat);
  currentId = chat.id;
  saveChats();
  return chat;
}

function openChat(id) {
  currentId = id;
  renderMessages();
  renderChatList();
  closeSidebar();
}

function startNewChat() {
  currentId = null;
  renderMessages();
  renderChatList();
  closeSidebar();
  input.focus();
}

function deleteChat(id) {
  chats = chats.filter((c) => c.id !== id);
  if (id === currentId) currentId = null;
  saveChats();
  renderMessages();
  renderChatList();
}

// ---------- Rendering ----------
function appendMessage(role, text, extraClass = "") {
  const empty = messages.querySelector(".empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = `msg ${role} ${extraClass}`.trim();
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function renderMessages() {
  messages.innerHTML = "";
  const chat = currentChat();
  if (!chat || chat.history.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty";
    hint.textContent = "Send a message to start chatting.";
    messages.appendChild(hint);
    return;
  }
  chat.history.forEach((m) => appendMessage(m.role === "user" ? "user" : "bot", m.text));
}

function renderChatList() {
  chatList.innerHTML = "";
  chats.forEach((chat) => {
    const li = document.createElement("li");
    if (chat.id === currentId) li.className = "active";

    const open = document.createElement("button");
    open.className = "chat-title";
    open.textContent = chat.title;
    open.addEventListener("click", () => openChat(chat.id));

    const del = document.createElement("button");
    del.className = "chat-del";
    del.textContent = "\u00d7";
    del.title = "Delete chat";
    del.addEventListener("click", () => deleteChat(chat.id));

    li.append(open, del);
    chatList.appendChild(li);
  });
}

// ---------- API ----------
async function fetchReply(message, history) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
  } catch {
    throw new Error("Could not reach the server.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    // response was not JSON; fall through to the status check
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data.reply;
}

// ---------- Sending ----------
function setBusy(value) {
  busy = value;
  input.disabled = value;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || busy) return;

  input.value = "";
  resizeInput();

  const chat = currentChat() || createChat(text);
  renderChatList();
  setBusy(true);

  appendMessage("user", text);
  const pending = appendMessage("bot", "Thinking...", "pending");

  try {
    const reply = await fetchReply(text, chat.history);
    chat.history.push({ role: "user", text }, { role: "model", text: reply });
    saveChats();
    pending.textContent = reply;
    pending.classList.remove("pending");
  } catch (err) {
    pending.textContent = `Error: ${err.message}`;
    pending.classList.remove("pending");
    pending.classList.add("error");
  } finally {
    setBusy(false);
    input.focus();
  }
}

// ---------- UI helpers ----------
function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function closeSidebar() {
  sidebar.classList.remove("open");
}

// ---------- Events ----------
input.addEventListener("input", resizeInput);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendMessage();
  }
});

menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
newChatBtn.addEventListener("click", startNewChat);

// Click anywhere outside the sidebar to close it
document.addEventListener("click", (e) => {
  const path = e.composedPath();
  if (!path.includes(sidebar) && !path.includes(menuBtn)) closeSidebar();
});

// ---------- Start ----------
renderMessages();
renderChatList();
input.focus();

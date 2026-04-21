/**
 * Secure IoT Communication Simulator — Frontend Script
 *
 * Handles:
 *  - Message sending / receiving
 *  - API calls to Flask /encrypt and /decrypt
 *  - Bubble rendering with animations
 *  - Encrypted packet travel animation
 *  - Hacker interception visualization
 *  - Details panel updates
 *  - Auto-demo mode
 */

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  msgCount:     0,    // Total messages exchanged
  busy:         false, // Prevent double-sends
  panelVisible: false,
  lastPayload:  null,  // Last encrypted payload (for display)
};

// ─── DOM References ───────────────────────────────────────────────────────────
const DOM = {
  chatAhmed:    () => document.getElementById("chatAhmed"),
  chatKhaled:   () => document.getElementById("chatKhaled"),
  msgInput:     () => document.getElementById("msgInput"),
  replyInput:   () => document.getElementById("replyInput"),
  dataPacket:   () => document.getElementById("dataPacket"),
  packetText:   () => document.getElementById("packetText"),
  hackerBubble: () => document.getElementById("hackerBubble"),
  hackerText:   () => document.getElementById("hackerText"),
  inputKhaled:  () => document.getElementById("inputKhaled"),
  detailsPanel: () => document.getElementById("detailsPanel"),
  statusBadge:  () => document.getElementById("statusBadge"),
  // Details values
  valOriginal:  () => document.getElementById("valOriginal"),
  valCipher:    () => document.getElementById("valCipher"),
  valIV:        () => document.getElementById("valIV"),
  valKey:       () => document.getElementById("valKey"),
  valDecrypted: () => document.getElementById("valDecrypted"),
};

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Pause execution for ms milliseconds */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Generate a random-looking encrypted string for visual effect */
function fakeEncryptedText(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Truncate long strings for display */
function truncate(str, maxLen = 40) {
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

/** Get current time as HH:MM */
function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * POST /encrypt
 * Sends the message to Flask backend for hybrid encryption.
 * Returns: { ciphertext, iv, encrypted_key }
 */
async function encryptMessage(message) {
  const res = await fetch("/encrypt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Encryption failed");
  return res.json();
}

/**
 * POST /decrypt
 * Sends encrypted payload to Flask for decryption.
 * Returns: { message }
 */
async function decryptMessage(payload) {
  const res = await fetch("/decrypt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Decryption failed");
  return res.json();
}

// ─── UI: Bubble Creation ──────────────────────────────────────────────────────

/**
 * Add a chat bubble to a chat window.
 * @param {HTMLElement} chatEl - The chat container
 * @param {string} text       - Message text
 * @param {"sent"|"received"} type
 * @param {boolean} isEncrypted - Show as encrypted (glitch effect)?
 * @returns {HTMLElement} The created bubble
 */
function addBubble(chatEl, text, type, isEncrypted = false) {
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${type}${isEncrypted ? " bubble--encrypting" : ""}`;

  bubble.innerHTML = `
    <div class="bubble__text">${escapeHtml(text)}</div>
    <div class="bubble__meta">
      <span>${now()}</span>
      ${type === "received" ? '<span class="bubble__status">✓ Decrypted</span>' : ""}
    </div>
  `;

  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

/** Update an existing bubble's text */
function updateBubble(bubble, newText, isEncrypted = false) {
  const textEl = bubble.querySelector(".bubble__text");
  if (textEl) textEl.textContent = newText;
  bubble.classList.toggle("bubble--encrypting", isEncrypted);
}

/** Safely escape HTML to prevent XSS */
function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ─── UI: Packet Animation ─────────────────────────────────────────────────────

/**
 * Animate the encrypted packet traveling in the lane.
 * @param {"down"|"up"} direction - "down" = Ahmed→Khaled, "up" = Khaled→Ahmed
 * @param {string} cipherPreview - Short encrypted string to display on the packet
 */
async function animatePacket(direction, cipherPreview) {
  const packet = DOM.dataPacket();
  const label  = DOM.packetText();

  // Reset
  packet.classList.remove("traveling-down", "traveling-up");
  packet.style.opacity = 0;
  label.textContent = truncate(cipherPreview, 12);

  // Force reflow
  void packet.offsetWidth;

  // Start animation
  packet.classList.add(direction === "down" ? "traveling-down" : "traveling-up");

  // Wait for animation to complete (2s defined in CSS)
  await sleep(2000);

  packet.classList.remove("traveling-down", "traveling-up");
  packet.style.opacity = 0;
}

// ─── UI: Hacker Visualization ────────────────────────────────────────────────

/**
 * Show the hacker "intercepting" the encrypted message.
 * The hacker can read the bytes, but they are useless without the RSA key.
 */
async function animateHacker(ciphertext) {
  const bubble = DOM.hackerBubble();
  const text   = DOM.hackerText();

  bubble.classList.add("active");
  text.textContent = truncate(ciphertext, 24);

  await sleep(1800);

  // Hacker gives up – can't decrypt without private key
  text.textContent = "🔒 Cannot decrypt!";
  bubble.classList.remove("active");

  await sleep(1000);
  text.textContent = "Waiting…";
}

// ─── UI: Details Panel ────────────────────────────────────────────────────────

function updateDetailsPanel(original, payload, decrypted) {
  DOM.valOriginal().textContent  = original;
  DOM.valCipher().textContent    = truncate(payload.ciphertext, 60);
  DOM.valIV().textContent        = payload.iv;
  DOM.valKey().textContent       = truncate(payload.encrypted_key, 60);
  DOM.valDecrypted().textContent = decrypted;
}

// ─── Core Flow ────────────────────────────────────────────────────────────────

/**
 * Full exchange animation: encrypt → travel → hack attempt → decrypt
 *
 * @param {string} message    - Plaintext message
 * @param {"ahmed"|"khaled"} sender
 */
async function exchangeMessage(message, sender) {
  if (state.busy) return;
  state.busy = true;

  const isAhmed = sender === "ahmed";

  const senderChat   = isAhmed ? DOM.chatAhmed()  : DOM.chatKhaled();
  const receiverChat = isAhmed ? DOM.chatKhaled() : DOM.chatAhmed();
  const direction    = isAhmed ? "down" : "up";

  // ── Step 1: Show original message in sender's chat ──
  const sentBubble = addBubble(senderChat, message, "sent");
  await sleep(400);

  // ── Step 2: Encrypt via Flask API ──
  let payload;
  try {
    payload = await encryptMessage(message);
  } catch (err) {
    console.error("Encryption error:", err);
    state.busy = false;
    return;
  }

  // ── Step 3: Show "encrypting" animation on the sent bubble ──
  const encText = fakeEncryptedText(message.length * 3 + 8);
  updateBubble(sentBubble, encText, true);
  await sleep(700);

  // Back to original (sender sees what they sent)
  updateBubble(sentBubble, message, false);
  state.lastPayload = payload;

  // ── Step 4: Animate encrypted packet traveling ──
  const cipherPreview = payload.ciphertext.slice(0, 16);

  // Run hacker + packet animation in parallel
  await Promise.all([
    animatePacket(direction, cipherPreview),
    animateHacker(payload.ciphertext),
  ]);

  // ── Step 5: Decrypt via Flask API ──
  let decrypted;
  try {
    const result = await decryptMessage(payload);
    decrypted = result.message;
  } catch (err) {
    console.error("Decryption error:", err);
    state.busy = false;
    return;
  }

  // ── Step 6: Show encrypted then reveal decrypted in receiver's chat ──
  const recvBubble = addBubble(receiverChat, encText, "received", true);
  await sleep(600);
  updateBubble(recvBubble, decrypted, false);

  // ── Step 7: Update the details panel ──
  updateDetailsPanel(message, payload, decrypted);

  state.msgCount++;

  // ── Step 8: Enable receiver's reply input ──
  if (isAhmed) {
    DOM.inputKhaled().classList.remove("hidden");
  }

  state.busy = false;
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/** Ahmed sends a message */
async function sendMessage() {
  const input = DOM.msgInput();
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = "";
  await exchangeMessage(msg, "ahmed");
}

/** Khaled sends a reply */
async function sendReply() {
  const input = DOM.replyInput();
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = "";
  await exchangeMessage(msg, "khaled");
}

/** Toggle the encryption details panel */
function togglePanel() {
  state.panelVisible = !state.panelVisible;
  DOM.detailsPanel().classList.toggle("hidden", !state.panelVisible);
  document.getElementById("toggleDetails").textContent =
    state.panelVisible ? "✕ Hide Details" : "⚙ Show Encryption Details";
}

/** Enter key support */
document.addEventListener("DOMContentLoaded", () => {
  DOM.msgInput().addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  DOM.replyInput().addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendReply();
  });
});

// ─── Auto Demo Mode ───────────────────────────────────────────────────────────

const AUTO_SCRIPT = [
  { sender: "ahmed",  msg: "Hello Khaled! Are you receiving me?" },
  { sender: "khaled", msg: "Yes Ahmed! Signal is secure. 🔒" },
  { sender: "ahmed",  msg: "I'm sending sensor data now." },
  { sender: "khaled", msg: "Received! All packets encrypted end-to-end." },
  { sender: "ahmed",  msg: "Temperature: 36.7°C — all good." },
  { sender: "khaled", msg: "Logged. No interception detected. ✅" },
];

async function startAutoMode() {
  if (state.busy) return;

  // Disable button during demo
  const btn = document.getElementById("autoBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Running Demo…";

  resetChat();
  await sleep(500);

  for (const step of AUTO_SCRIPT) {
    await sleep(800);
    await exchangeMessage(step.msg, step.sender);
    await sleep(600);
  }

  btn.disabled = false;
  btn.textContent = "▶ Auto Demo";
}

/** Clear all chat messages and reset state */
function resetChat() {
  DOM.chatAhmed().innerHTML   = "";
  DOM.chatKhaled().innerHTML  = "";
  DOM.inputKhaled().classList.add("hidden");
  DOM.hackerText().textContent = "Waiting…";
  state.msgCount = 0;
  state.busy     = false;
  state.lastPayload = null;

  // Reset details panel
  ["valOriginal","valCipher","valIV","valKey","valDecrypted"].forEach(id => {
    document.getElementById(id).textContent = "—";
  });
}

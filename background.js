// ─────────────────────────────────────────────────────────────
// AI Message Refiner – Background Service Worker
// Handles Groq API calls on behalf of the content script.
// Only the raw message text is sent; no other data is transmitted.
// Works with WhatsApp Web, Facebook Chat & Messenger.
// ─────────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a helpful writing assistant. The user will give you a chat message they are about to send on WhatsApp. Your job is to refine the message so it is:
- Clear, concise, and well-structured
- Polite and professional (but not overly formal — keep a friendly tone)
- Free of grammar and spelling errors
- Preserving the original intent and meaning exactly

Rules:
1. Return ONLY the refined message text — no quotes, no explanation, no preamble.
2. Keep the same language as the input. If the user writes in Hindi, reply in Hindi, etc.
3. Do NOT add greetings or sign-offs unless they were already present.
4. If the message is already well-written, return it as-is.`;

// ── Listen for messages from the content script ──────────────
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "REFINE_MESSAGE") {
    refineMessage(request.text)
      .then((refined) => sendResponse({ success: true, refined }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep the message channel open for async response
  }

  if (request.type === "GET_API_KEY") {
    chrome.storage.sync.get(["groqApiKey"], (result) => {
      sendResponse({ apiKey: result.groqApiKey || "" });
    });
    return true;
  }

  if (request.type === "SET_API_KEY") {
    chrome.storage.sync.set({ groqApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// ── Call Groq API ────────────────────────────────────────────
async function refineMessage(text) {
  const { groqApiKey } = await chrome.storage.sync.get(["groqApiKey"]);

  if (!groqApiKey) {
    throw new Error(
      "Groq API key not set. Click the extension icon to configure it."
    );
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error("Invalid Groq API key. Please update it in the extension popup.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited by Groq. Please wait a moment and try again.");
    }
    throw new Error(`Groq API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const refined = data.choices?.[0]?.message?.content?.trim();

  if (!refined) {
    throw new Error("Received an empty response from Groq.");
  }

  return refined;
}

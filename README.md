# WhatsApp AI Message Refiner 🪄

A Chrome extension that adds an AI-powered message refinement button to WhatsApp Web. Click the ✨ sparkle icon next to your message to instantly polish it before sending.

**Powered by [Groq](https://groq.com)** — blazing-fast AI inference using Llama 3.3 70B.

---

## Features

- ✨ **One-click refinement** — enhances grammar, clarity, and tone
- 🌐 **Multi-language support** — works in any language you type
- 🔒 **Privacy-first** — only the message text is sent to Groq, nothing else
- 🎨 **Native UI integration** — blends seamlessly with WhatsApp Web's design
- ⚡ **Fast** — responses in under 1 second thanks to Groq's LPU inference
- 🔔 **Toast notifications** — visual feedback for success, errors, and info

## File Structure

```
whatsapp-ai-refiner/
├── manifest.json          # Chrome Extension manifest (v3)
├── background.js          # Service worker – handles Groq API calls
├── content.js             # Content script – injects UI into WhatsApp Web
├── content.css            # Styles for the injected button & toasts
├── popup/
│   ├── popup.html         # Extension popup for API key configuration
│   ├── popup.css          # Popup styles (WhatsApp dark theme)
│   └── popup.js           # Popup logic
├── icons/
│   ├── icon16.png         # 16×16 toolbar icon
│   ├── icon48.png         # 48×48 extension icon
│   └── icon128.png        # 128×128 Chrome Web Store icon
├── generate_icons.py      # Script to regenerate icons (optional)
└── README.md
```

## Installation

### 1. Get a Groq API Key

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up / log in and create a new API key
3. Copy the key (starts with `gsk_...`)

### 2. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `whatsapp-ai-refiner` folder
5. The extension icon will appear in your toolbar

### 3. Configure the API Key

1. Click the extension icon in Chrome's toolbar
2. Paste your Groq API key
3. Click **Save Key**

### 4. Use It

1. Open [web.whatsapp.com](https://web.whatsapp.com)
2. Open any chat and type a message
3. Click the **✨ sparkle** button next to the input box
4. Your message will be refined by AI and replaced in the input field
5. Review the refined message and send it!

## How It Works

```
┌──────────────┐    Click ✨    ┌──────────────┐
│  You type a  │ ───────────▶  │ content.js   │
│  message     │               │ grabs text   │
└──────────────┘               └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │ background.js│
                               │ calls Groq   │
                               │ API          │
                               └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │ Refined text │
                               │ replaces     │ 
                               │ input        │
                               └──────────────┘
```

1. **Content script** (`content.js`) watches WhatsApp Web's DOM for the message input field
2. It injects a sparkle button (✨) into the chat footer
3. When clicked, the message text is sent to the **background service worker**
4. `background.js` calls the **Groq API** with a system prompt tuned for message refinement
5. The refined text is sent back and inserted into the input field
6. Toast notifications show success/error states

## Privacy & Security

- ✅ All extension code runs **locally in your browser**
- ✅ Only the **raw message text** is sent to Groq's API — no metadata, no chat history, no contact info
- ✅ Your API key is stored in `chrome.storage.sync` (encrypted by Chrome, synced to your Google account)
- ✅ No analytics, no tracking, no third-party scripts

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Button doesn't appear | Refresh WhatsApp Web, or check that the extension is enabled in `chrome://extensions/` |
| "API key not set" error | Click the extension icon and save your Groq API key |
| "Invalid API key" error | Double-check your key at [console.groq.com/keys](https://console.groq.com/keys) |
| "Rate limited" error | Wait a moment and try again — Groq has per-minute rate limits on free tier |
| Message not updating | WhatsApp Web may have updated its DOM structure; please open an issue |

## Customization

### Change the AI Model

In `background.js`, modify the `DEFAULT_MODEL` constant:

```js
const DEFAULT_MODEL = "llama-3.3-70b-versatile"; // default
// Other options:
// "llama-3.1-8b-instant"     — faster, less capable
// "mixtral-8x7b-32768"       — good balance
```

### Change the Refinement Style

Edit the `SYSTEM_PROMPT` in `background.js` to customize the AI's behavior. For example, make it more casual, more formal, or add emoji suggestions.

## License

MIT — use it however you like.

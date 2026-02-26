# AI Message Refiner ✨

A Chrome extension that adds a floating AI-powered refinement button to **WhatsApp Web**, **Facebook Chat**, and **Messenger**. Click the ✨ sparkle icon near the send button to instantly polish your message before sending.

**Powered by [Groq](https://groq.com)** — blazing-fast AI inference using Llama 3.3 70B.

---

## Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| WhatsApp Web | web.whatsapp.com | ✅ Supported |
| Facebook Chat | www.facebook.com | ✅ Supported |
| Messenger | www.messenger.com | ✅ Supported |

## Features

- ✨ **Floating AI button** — hovers near the send button, always accessible
- 🌐 **Multi-platform** — works on WhatsApp Web, Facebook Chat & Messenger
- 🔒 **Privacy-first** — only the message text is sent to Groq, nothing else
- ⚡ **Fast** — sub-second responses thanks to Groq's LPU inference
- 🎨 **Glassmorphism UI** — translucent button blends with any chat theme
- 🔔 **Toast notifications** — visual feedback for success, errors, and info

## File Structure

```
whatsapp-ai-refiner/
├── manifest.json          # Chrome Extension manifest v3 (multi-site)
├── background.js          # Service worker – handles Groq API calls
├── content.js             # Content script – multi-platform injection
├── content.css            # Floating button & toast styles
├── popup/
│   ├── popup.html         # Extension popup for API key configuration
│   ├── popup.css          # Popup styles (dark theme)
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
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `whatsapp-ai-refiner` folder
5. The extension icon will appear in your toolbar

### 3. Configure the API Key

1. Click the extension icon in Chrome's toolbar
2. Paste your Groq API key
3. Click **Save Key**

### 4. Use It

1. Open any supported chat platform (WhatsApp Web / Facebook / Messenger)
2. Open any conversation and type a message
3. Click the **✨ floating sparkle button** near the send button
4. Your message will be refined and replaced in the input field
5. Review and send!

## How It Works

```
┌──────────────┐    Click ✨    ┌──────────────┐
│  You type a  │ ───────────▶  │ content.js   │
│  message     │               │ grabs text   │
└──────────────┘               └──────┬───────┘
                                      │
                           ┌──────────┴──────────┐
                           │ Detects platform:    │
                           │ WhatsApp / FB / Msg  │
                           └──────────┬──────────┘
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

1. **Content script** detects which platform you're on (WhatsApp / Facebook / Messenger)
2. It uses platform-specific DOM selectors to find the message input and send button
3. A floating ✨ button is rendered near the send button using `position: fixed`
4. When clicked, the message text is sent to the **background service worker**
5. `background.js` calls the **Groq API** with a system prompt tuned for message refinement
6. The refined text is injected back into the input field

## Privacy & Security

- ✅ All extension code runs **locally in your browser**
- ✅ Only the **raw message text** is sent to Groq — no metadata, no chat history, no contacts
- ✅ Your API key is stored in `chrome.storage.sync` (encrypted by Chrome)
- ✅ No analytics, no tracking, no third-party scripts

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Button doesn't appear | Refresh the page. Check `chrome://extensions/` that the extension is enabled |
| Button appears in wrong position | Scroll or resize to trigger re-positioning, or refresh |
| "API key not set" error | Click the extension icon and save your Groq API key |
| "Invalid API key" error | Verify your key at [console.groq.com/keys](https://console.groq.com/keys) |
| "Rate limited" error | Wait a moment — Groq has per-minute rate limits on free tier |
| Facebook/Messenger not working | Make sure you're on `www.facebook.com` or `www.messenger.com` |

## License

MIT

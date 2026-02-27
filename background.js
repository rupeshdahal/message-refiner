// -----------------------------------------------------------
// AI Message Refiner - Background Service Worker
// Multi-provider: Groq, Gemini, OpenAI, OpenRouter, Mistral, Anthropic
// Only the raw message text is sent; no other data is transmitted.
// -----------------------------------------------------------

var SYSTEM_PROMPT = [
  "You are a helpful writing assistant. The user will give you a chat message they are about to send. Your job is to refine the message so it is:",
  "- Clear, concise, and well-structured",
  "- Polite and professional (but not overly formal - keep a friendly tone)",
  "- Free of grammar and spelling errors",
  "- Preserving the original intent and meaning exactly",
  "",
  "Rules:",
  "1. Return ONLY the refined message text - no quotes, no explanation, no preamble.",
  "2. Keep the same language as the input. If the user writes in Hindi, reply in Hindi, etc.",
  "3. Do NOT add greetings or sign-offs unless they were already present.",
  "4. If the message is already well-written, return it as-is."
].join("\n");

// -----------------------------------------------------------
// Provider Registry
// -----------------------------------------------------------
var PROVIDERS = {
  groq: {
    name: "Groq",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    keyPrefix: "gsk_",
    keyPlaceholder: "gsk_...",
    keyLink: "https://console.groq.com/keys",
    buildRequest: function(apiKey, model, text) {
      return {
        url: this.apiUrl,
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: {
          model: model || this.defaultModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
          temperature: 0.4,
          max_tokens: 1024
        }
      };
    },
    extractResponse: function(data) {
      if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content.trim();
      return null;
    }
  },

  gemini: {
    name: "Google Gemini",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
    defaultModel: "gemini-2.0-flash",
    keyPrefix: "AI",
    keyPlaceholder: "AIza...",
    keyLink: "https://aistudio.google.com/apikey",
    buildRequest: function(apiKey, model, text) {
      var m = model || this.defaultModel;
      var url = this.apiUrl.replace("{MODEL}", m) + "?key=" + apiKey;
      return {
        url: url,
        headers: { "Content-Type": "application/json" },
        body: {
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: text }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
        }
      };
    },
    extractResponse: function(data) {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) return data.candidates[0].content.parts[0].text.trim();
      return null;
    }
  },

  openai: {
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-...",
    keyLink: "https://platform.openai.com/api-keys",
    buildRequest: function(apiKey, model, text) {
      return {
        url: this.apiUrl,
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: {
          model: model || this.defaultModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
          temperature: 0.4,
          max_tokens: 1024
        }
      };
    },
    extractResponse: function(data) {
      if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content.trim();
      return null;
    }
  },

  openrouter: {
    name: "OpenRouter",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    keyPrefix: "sk-or-",
    keyPlaceholder: "sk-or-...",
    keyLink: "https://openrouter.ai/keys",
    buildRequest: function(apiKey, model, text) {
      return {
        url: this.apiUrl,
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: {
          model: model || this.defaultModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
          temperature: 0.4,
          max_tokens: 1024
        }
      };
    },
    extractResponse: function(data) {
      if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content.trim();
      return null;
    }
  },

  mistral: {
    name: "Mistral AI",
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    keyPrefix: "",
    keyPlaceholder: "your-mistral-api-key",
    keyLink: "https://console.mistral.ai/api-keys",
    buildRequest: function(apiKey, model, text) {
      return {
        url: this.apiUrl,
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: {
          model: model || this.defaultModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }],
          temperature: 0.4,
          max_tokens: 1024
        }
      };
    },
    extractResponse: function(data) {
      if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content.trim();
      return null;
    }
  },

  anthropic: {
    name: "Anthropic (Claude)",
    apiUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-sonnet-20241022",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-...",
    keyLink: "https://console.anthropic.com/settings/keys",
    buildRequest: function(apiKey, model, text) {
      return {
        url: this.apiUrl,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json"
        },
        body: {
          model: model || this.defaultModel,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: text }],
          temperature: 0.4,
          max_tokens: 1024
        }
      };
    },
    extractResponse: function(data) {
      if (data.content && data.content[0]) return data.content[0].text.trim();
      return null;
    }
  }
};

// -- Storage Keys --
var STORE_PROVIDER = "aiProvider";
var STORE_API_KEY = "aiApiKey";
var STORE_MODEL = "aiModel";

// -- Message Listener --
chrome.runtime.onMessage.addListener(function(request, _sender, sendResponse) {
  if (request.type === "REFINE_MESSAGE") {
    refineMessage(request.text)
      .then(function(refined) { sendResponse({ success: true, refined: refined }); })
      .catch(function(err) { sendResponse({ success: false, error: err.message }); });
    return true;
  }

  if (request.type === "GET_SETTINGS") {
    chrome.storage.sync.get([STORE_PROVIDER, STORE_API_KEY, STORE_MODEL], function(result) {
      sendResponse({
        provider: result[STORE_PROVIDER] || "groq",
        apiKey: result[STORE_API_KEY] || "",
        model: result[STORE_MODEL] || ""
      });
    });
    return true;
  }

  if (request.type === "SAVE_SETTINGS") {
    var data = {};
    data[STORE_PROVIDER] = request.provider;
    data[STORE_API_KEY] = request.apiKey;
    data[STORE_MODEL] = request.model || "";
    chrome.storage.sync.set(data, function() {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === "GET_PROVIDERS") {
    var list = [];
    for (var id in PROVIDERS) {
      if (PROVIDERS.hasOwnProperty(id)) {
        var p = PROVIDERS[id];
        list.push({
          id: id,
          name: p.name,
          keyPlaceholder: p.keyPlaceholder,
          keyLink: p.keyLink,
          defaultModel: p.defaultModel
        });
      }
    }
    sendResponse({ providers: list });
    return true;
  }
});

// -- Call the selected provider API --
async function refineMessage(text) {
  var result = await chrome.storage.sync.get([STORE_PROVIDER, STORE_API_KEY, STORE_MODEL]);

  var providerId = result[STORE_PROVIDER] || "groq";
  var apiKey = result[STORE_API_KEY] || "";
  var model = result[STORE_MODEL] || "";

  var provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error("Unknown provider. Please reconfigure in the extension popup.");
  }

  if (!apiKey) {
    throw new Error("API key not set. Click the extension icon to configure your " + provider.name + " key.");
  }

  var req = provider.buildRequest(apiKey, model, text);

  var response = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body)
  });

  if (!response.ok) {
    var body = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid " + provider.name + " API key. Please update it in the extension popup.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited by " + provider.name + ". Please wait a moment and try again.");
    }
    throw new Error(provider.name + " API error (" + response.status + "): " + body);
  }

  var data = await response.json();
  var refined = provider.extractResponse(data);

  if (!refined) {
    throw new Error("Received an empty response from " + provider.name + ".");
  }

  return refined;
}

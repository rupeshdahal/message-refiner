// -----------------------------------------------------------
// AI Message Refiner - Popup Script
// Manages provider selection and API key configuration.
// -----------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  var providerSelect = document.getElementById("provider-select");
  var apiKeyInput = document.getElementById("api-key");
  var modelInput = document.getElementById("model-input");
  var modelDefault = document.getElementById("model-default");
  var providerLink = document.getElementById("provider-link");
  var saveBtn = document.getElementById("save-btn");
  var statusMsg = document.getElementById("status-msg");
  var toggleBtn = document.getElementById("toggle-visibility");

  // Provider metadata (synced with background.js)
  var providerMeta = {
    groq:       { placeholder: "gsk_...",              link: "https://console.groq.com/keys",             linkText: "console.groq.com",        defaultModel: "llama-3.3-70b-versatile" },
    gemini:     { placeholder: "AIza...",              link: "https://aistudio.google.com/apikey",        linkText: "aistudio.google.com",     defaultModel: "gemini-2.0-flash" },
    openai:     { placeholder: "sk-...",               link: "https://platform.openai.com/api-keys",     linkText: "platform.openai.com",     defaultModel: "gpt-4o-mini" },
    openrouter: { placeholder: "sk-or-...",            link: "https://openrouter.ai/keys",               linkText: "openrouter.ai",           defaultModel: "meta-llama/llama-3.3-70b-instruct" },
    mistral:    { placeholder: "your-mistral-api-key", link: "https://console.mistral.ai/api-keys",      linkText: "console.mistral.ai",      defaultModel: "mistral-large-latest" },
    anthropic:  { placeholder: "sk-ant-...",           link: "https://console.anthropic.com/settings/keys", linkText: "console.anthropic.com", defaultModel: "claude-3-5-sonnet-20241022" }
  };

  // -- Update UI when provider changes --
  function updateProviderUI() {
    var id = providerSelect.value;
    var meta = providerMeta[id];
    if (!meta) return;

    apiKeyInput.placeholder = meta.placeholder;
    providerLink.href = meta.link;
    providerLink.textContent = meta.linkText;
    modelDefault.innerHTML = "Default: <code>" + meta.defaultModel + "</code>";
  }

  providerSelect.addEventListener("change", updateProviderUI);

  // -- Load saved settings --
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, function (response) {
    if (!response) return;
    if (response.provider) {
      providerSelect.value = response.provider;
    }
    if (response.apiKey) {
      apiKeyInput.value = response.apiKey;
    }
    if (response.model) {
      modelInput.value = response.model;
    }
    updateProviderUI();
  });

  // -- Save settings --
  saveBtn.addEventListener("click", function () {
    var provider = providerSelect.value;
    var apiKey = apiKeyInput.value.trim();
    var model = modelInput.value.trim();

    if (!apiKey) {
      showStatus("Please enter your API key.", "error");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "SAVE_SETTINGS",
        provider: provider,
        apiKey: apiKey,
        model: model
      },
      function (response) {
        if (response && response.success) {
          showStatus("Settings saved successfully! \u2713", "success");
        } else {
          showStatus("Failed to save settings.", "error");
        }
      }
    );
  });

  // -- Toggle key visibility --
  toggleBtn.addEventListener("click", function () {
    var isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";

    var eyeIcon = document.getElementById("eye-icon");
    if (isPassword) {
      eyeIcon.innerHTML =
        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
        '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
        '<line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      eyeIcon.innerHTML =
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
        '<circle cx="12" cy="12" r="3"/>';
    }
  });

  // -- Enter to save --
  apiKeyInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") saveBtn.click();
  });
  modelInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") saveBtn.click();
  });

  // -- Status helper --
  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className = "status-msg " + type;

    if (type === "success") {
      setTimeout(function () {
        statusMsg.textContent = "";
        statusMsg.className = "status-msg";
      }, 3000);
    }
  }
});

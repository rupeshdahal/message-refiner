// ─────────────────────────────────────────────────────────────
// WhatsApp AI Refiner – Popup Script
// Manages the API key configuration UI.
// ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveBtn = document.getElementById("save-btn");
  const statusMsg = document.getElementById("status-msg");
  const toggleBtn = document.getElementById("toggle-visibility");

  // ── Load saved key ───────────────────────────────────────
  chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (response) => {
    if (response?.apiKey) {
      apiKeyInput.value = response.apiKey;
    }
  });

  // ── Save key ─────────────────────────────────────────────
  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus("Please enter your Groq API key.", "error");
      return;
    }

    if (!apiKey.startsWith("gsk_")) {
      showStatus('Groq API keys typically start with "gsk_". Please check your key.', "error");
      return;
    }

    chrome.runtime.sendMessage(
      { type: "SET_API_KEY", apiKey },
      (response) => {
        if (response?.success) {
          showStatus("API key saved successfully! ✓", "success");
        } else {
          showStatus("Failed to save API key.", "error");
        }
      }
    );
  });

  // ── Toggle visibility ────────────────────────────────────
  toggleBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";

    // Update icon
    const eyeIcon = document.getElementById("eye-icon");
    if (isPassword) {
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });

  // ── Allow Enter to save ──────────────────────────────────
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });

  // ── Status helper ────────────────────────────────────────
  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className = `status-msg ${type}`;

    if (type === "success") {
      setTimeout(() => {
        statusMsg.textContent = "";
        statusMsg.className = "status-msg";
      }, 3000);
    }
  }
});

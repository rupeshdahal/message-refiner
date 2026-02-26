// ─────────────────────────────────────────────────────────────
// AI Message Refiner – Content Script
// Works on WhatsApp Web, Facebook Chat & Messenger.
// Injects a floating AI "enhance" button near the send button
// and manages the refinement workflow entirely in the browser.
// ─────────────────────────────────────────────────────────────

(() => {
  "use strict";

  // ── Constants ────────────────────────────────────────────
  const BUTTON_CLASS = "wai-refine-btn";
  const POLL_INTERVAL = 1500;

  const SPARKLE_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round" width="20" height="20">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
      <path d="M18 14l1.18 3.54L23 19l-3.82 1.46L18 24l-1.18-3.54L13 19l3.82-1.46L18 14z" opacity="0.6"/>
    </svg>`;

  const SPINNER_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
         width="20" height="20" class="wai-spinner">
      <path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>`;

  // ── Platform Detection ───────────────────────────────────
  const PLATFORM = detectPlatform();

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("web.whatsapp.com")) return "whatsapp";
    if (host.includes("messenger.com")) return "messenger";
    if (host.includes("facebook.com")) return "facebook";
    return "unknown";
  }

  /**
   * Each platform has its own DOM selectors.
   *  - inputSelectors: contenteditable message input
   *  - sendButtonSelectors: send / mic button area (we float next to it)
   */
  const PLATFORM_CONFIG = {
    whatsapp: {
      inputSelectors: [
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][role="textbox"][title]',
      ],
      sendButtonSelectors: [
        'span[data-icon="send"]',
        'button[data-tab="11"]',
        'span[data-icon="mic"]',
      ],
    },
    facebook: {
      inputSelectors: [
        'div[contenteditable="true"][role="textbox"][aria-label*="essage"]',
        'div[contenteditable="true"][role="textbox"]',
      ],
      sendButtonSelectors: [
        'div[aria-label="Send"]:not(.wai-refine-btn)',
        'span[aria-label="Send"]',
        'div[aria-label="Press Enter to send"]',
      ],
    },
    messenger: {
      inputSelectors: [
        'div[contenteditable="true"][role="textbox"]',
      ],
      sendButtonSelectors: [
        'div[aria-label="Send"]:not(.wai-refine-btn)',
        'span[aria-label="Send"]',
        'div[aria-label="Press enter to send"]',
        'div[aria-label="Press Enter to send"]',
      ],
    },
  };

  // ── State ────────────────────────────────────────────────
  let isProcessing = false;

  // ── Utilities ────────────────────────────────────────────

  /** Find the active message input element. */
  function findInputEl() {
    const config = PLATFORM_CONFIG[PLATFORM];
    if (!config) return null;
    for (const sel of config.inputSelectors) {
      // For Facebook, there may be multiple chat windows. Pick the
      // one that is visible or focused.
      const all = document.querySelectorAll(sel);
      for (const el of all) {
        if (el.offsetParent !== null) return el; // visible
      }
    }
    return null;
  }

  /** Find the send / mic button to anchor near. */
  function findSendButton() {
    const config = PLATFORM_CONFIG[PLATFORM];
    if (!config) return null;
    for (const sel of config.sendButtonSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  /**
   * Read plain-text from any contenteditable input.
   * Works across WhatsApp (Lexical), Facebook, and Messenger.
   */
  function getInputText(inputEl) {
    // Lexical-style spans (WhatsApp)
    const lexicalSpans = inputEl.querySelectorAll('span[data-lexical-text="true"]');
    if (lexicalSpans.length > 0) {
      return Array.from(lexicalSpans).map((s) => s.textContent).join("");
    }
    // Facebook / Messenger may use <p> blocks
    const paragraphs = inputEl.querySelectorAll("p");
    if (paragraphs.length > 0) {
      return Array.from(paragraphs).map((p) => p.textContent).join("\n");
    }
    return inputEl.innerText || inputEl.textContent || "";
  }

  /**
   * Set text inside a contenteditable input.
   * Uses execCommand("insertText") so React/Lexical picks up the change.
   */
  function setInputText(inputEl, text) {
    inputEl.focus();

    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    selection.removeAllRanges();
    selection.addRange(range);

    // insertText works with contenteditable across all platforms
    document.execCommand("insertText", false, text);

    // Dispatch events so the framework picks up the change
    inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ── Toast Notification ───────────────────────────────────
  function showToast(message, type = "error") {
    document.querySelectorAll(".wai-toast").forEach((t) => t.remove());

    const toast = document.createElement("div");
    toast.className = `wai-toast wai-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add("wai-toast--visible");

    setTimeout(() => {
      toast.classList.remove("wai-toast--visible");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── Floating Button Creation ─────────────────────────────
  function createRefineButton() {
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.title = "Refine message with AI ✨";
    btn.innerHTML = SPARKLE_SVG;
    btn.setAttribute("aria-label", "Refine message with AI");

    // Prevent WhatsApp / FB from swallowing the click
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
    btn.addEventListener("click", handleRefineClick);
    return btn;
  }

  // ── Refinement Handler ───────────────────────────────────
  async function handleRefineClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    const inputEl = findInputEl();
    if (!inputEl) {
      showToast("Could not find the message input box.");
      return;
    }

    const text = getInputText(inputEl).trim();
    if (!text) {
      showToast("Type a message first, then click the AI button.", "info");
      return;
    }

    const btn = e.currentTarget;

    // ── Show loading state ─────────────────────────────────
    isProcessing = true;
    btn.innerHTML = SPINNER_SVG;
    btn.classList.add("wai-refine-btn--loading");
    btn.title = "Refining your message…";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "REFINE_MESSAGE",
        text,
      });

      if (response.success) {
        setInputText(inputEl, response.refined);
        showToast("Message refined ✨", "success");
      } else {
        showToast(response.error || "Failed to refine message.");
      }
    } catch (err) {
      console.error("[AI Message Refiner]", err);
      showToast("Extension error. Check the console for details.");
    } finally {
      isProcessing = false;
      btn.innerHTML = SPARKLE_SVG;
      btn.classList.remove("wai-refine-btn--loading");
      btn.title = "Refine message with AI ✨";
    }
  }

  // ── Position the Floating Button ─────────────────────────
  /**
   * Computes the floating button's position so it hovers just to
   * the left of the send button. Falls back to the right edge
   * of the input if the send button isn't found.
   */
  function positionButton(btn) {
    const sendBtn = findSendButton();
    const inputEl = findInputEl();
    const anchor = sendBtn || inputEl;
    if (!anchor) {
      btn.style.display = "none";
      return;
    }

    btn.style.display = "flex";
    const rect = anchor.getBoundingClientRect();

    if (sendBtn) {
      // Float just to the LEFT of the send / mic button
      const top = rect.top + (rect.height / 2) - 16 + window.scrollY;
      const left = rect.left - 40 + window.scrollX;
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
    } else {
      // Fallback: top-right corner of the input area
      const top = rect.top - 36 + window.scrollY;
      const left = rect.right - 36 + window.scrollX;
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
    }
  }

  // ── Injection Logic ──────────────────────────────────────
  function injectButton() {
    if (PLATFORM === "unknown") return;

    const inputEl = findInputEl();

    // If there's no input visible, remove any stale buttons
    if (!inputEl) {
      document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((b) => b.remove());
      return;
    }

    let btn = document.querySelector(`.${BUTTON_CLASS}`);
    if (!btn) {
      btn = createRefineButton();
      document.body.appendChild(btn);
    }

    positionButton(btn);
  }

  // ── Reposition on Scroll / Resize ────────────────────────
  function handleReposition() {
    const btn = document.querySelector(`.${BUTTON_CLASS}`);
    if (btn) positionButton(btn);
  }

  // ── Observer + Poll ──────────────────────────────────────
  function startObserving() {
    injectButton();

    // MutationObserver for SPA re-renders
    const observer = new MutationObserver(() => {
      injectButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Safety-net poll
    setInterval(injectButton, POLL_INTERVAL);

    // Keep position updated on scroll / resize
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
  }

  // ── Boot ─────────────────────────────────────────────────
  if (PLATFORM === "unknown") {
    console.log("[AI Message Refiner] Unsupported platform, skipping.");
  } else {
    console.log(`[AI Message Refiner] Detected platform: ${PLATFORM}`);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserving);
    } else {
      startObserving();
    }
  }
})();

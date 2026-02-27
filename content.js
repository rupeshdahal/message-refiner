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
  // Map from input element → our injected button element
  const buttonMap = new WeakMap();

  // ── Utilities ────────────────────────────────────────────

  /**
   * Find ALL visible message input elements.
   * On Facebook there can be multiple chat pop-ups open at once;
   * on WhatsApp / Messenger there is typically just one.
   */
  function findAllInputEls() {
    const config = PLATFORM_CONFIG[PLATFORM];
    if (!config) return [];
    const results = [];
    const seen = new Set();
    for (const sel of config.inputSelectors) {
      const all = document.querySelectorAll(sel);
      for (const el of all) {
        if (!seen.has(el) && el.offsetParent !== null) {
          seen.add(el);
          results.push(el);
        }
      }
    }
    return results;
  }

  /** Convenience: return the first (or only) visible input. */
  function findInputEl() {
    return findAllInputEls()[0] || null;
  }

  /**
   * Find the send button that belongs to a specific input element.
   * We walk up from the input to its chat container and search
   * within that container so we get the right send button when
   * multiple chats are open (Facebook).
   */
  function findSendButtonFor(inputEl) {
    const config = PLATFORM_CONFIG[PLATFORM];
    if (!config) return null;

    // Determine a scoped container to search within.
    // On Facebook chat pop-ups, each chat is inside a container with
    // role="dialog" or a form. On Messenger it's role="main" or a form.
    // On WhatsApp the footer works.
    const container =
      inputEl.closest('[role="dialog"]') ||
      inputEl.closest("form") ||
      inputEl.closest("footer") ||
      inputEl.closest('[role="footer"]') ||
      inputEl.parentElement?.parentElement?.parentElement?.parentElement;

    if (!container) return null;

    for (const sel of config.sendButtonSelectors) {
      const el = container.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  /** Legacy single-result helper (used by the click handler). */
  function findSendButton() {
    const inputEl = findInputEl();
    return inputEl ? findSendButtonFor(inputEl) : null;
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
   * Set text inside a contenteditable input (replaces ALL content).
   * Uses a multi-strategy approach to work with WhatsApp Lexical,
   * Facebook, and Messenger editors.
   */
  async function setInputText(inputEl, text) {
    inputEl.focus();
    await new Promise((r) => setTimeout(r, 30));

    // ── Step 1: Select all existing content ────────────────
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    sel.removeAllRanges();
    sel.addRange(range);

    await new Promise((r) => setTimeout(r, 30));

    // ── Step 2: Delete existing content ────────────────────
    document.execCommand("delete", false, null);
    await new Promise((r) => setTimeout(r, 30));

    // Re-focus (Lexical can shift focus after delete)
    inputEl.focus();
    await new Promise((r) => setTimeout(r, 30));

    // ── Step 3: Insert new text via synthetic paste event ──
    // Lexical / React listen for paste events and handle them
    // internally. This avoids the Clipboard API entirely.
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    inputEl.dispatchEvent(pasteEvent);

    await new Promise((r) => setTimeout(r, 100));

    // ── Step 4: Verify — if paste didn't work, use insertText
    if (getInputText(inputEl).trim().length === 0) {
      inputEl.focus();
      document.execCommand("insertText", false, text);
    }

    await new Promise((r) => setTimeout(r, 50));

    // ── Step 5: Last resort — direct DOM write ─────────────
    if (getInputText(inputEl).trim().length === 0) {
      inputEl.innerHTML = "";
      if (PLATFORM === "whatsapp") {
        const p = document.createElement("p");
        const span = document.createElement("span");
        span.setAttribute("data-lexical-text", "true");
        span.textContent = text;
        p.appendChild(span);
        inputEl.appendChild(p);
      } else {
        const p = document.createElement("p");
        p.textContent = text;
        inputEl.appendChild(p);
      }
      inputEl.dispatchEvent(new InputEvent("input", {
        bubbles: true, inputType: "insertText", data: text,
      }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /**
   * Check if there is a text selection inside the given input element.
   * Returns the selected text string, or "" if nothing is selected
   * (or if the entire input is selected — treat that as "refine all").
   */
  function getSelectedTextInInput(inputEl) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return "";

    const range = sel.getRangeAt(0);

    // Make sure the selection is actually inside our input
    if (!inputEl.contains(range.startContainer) || !inputEl.contains(range.endContainer)) {
      return "";
    }

    const selectedText = sel.toString();
    const fullText = getInputText(inputEl).trim();

    // If the selection covers the entire text, treat as "refine all"
    if (selectedText.trim() === fullText) return "";

    return selectedText;
  }

  /**
   * Replace only the currently selected text inside a contenteditable input.
   * The selection must still be active. We restore focus, re-validate the
   * selection, then use execCommand("insertText") to swap in the new text.
   */
  function replaceSelectedText(inputEl, newText, savedRange) {
    inputEl.focus();

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    document.execCommand("insertText", false, newText);

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
  function createRefineButton(pairedInputEl) {
    const btn = document.createElement("button");
    btn.className = `${BUTTON_CLASS} wai-refine-btn--${PLATFORM}`;
    btn.title = "Refine message with AI ✨";
    btn.innerHTML = SPARKLE_SVG;
    btn.setAttribute("aria-label", "Refine message with AI");

    // Store a reference to the input this button serves
    btn._pairedInput = pairedInputEl;

    // Prevent WhatsApp / FB from swallowing the click AND
    // keep the user's text selection alive inside the input
    btn.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    btn.addEventListener("click", handleRefineClick);
    return btn;
  }

  // ── Refinement Handler ───────────────────────────────────
  async function handleRefineClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    const btn = e.currentTarget;

    // Use the paired input stored on the button, fallback to global search
    const inputEl = btn._pairedInput && btn._pairedInput.offsetParent !== null
      ? btn._pairedInput
      : findInputEl();

    if (!inputEl) {
      showToast("Could not find the message input box.");
      return;
    }

    const fullText = getInputText(inputEl).trim();
    if (!fullText) {
      showToast("Type a message first, then click the AI button.", "info");
      return;
    }

    // ── Detect partial selection ───────────────────────────
    const selectedText = getSelectedTextInInput(inputEl);
    const isPartial = selectedText.length > 0;
    const textToRefine = isPartial ? selectedText : fullText;

    // Save the selection range so we can restore it after the API call
    let savedRange = null;
    if (isPartial) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    }

    // ── Show loading state ─────────────────────────────────
    isProcessing = true;
    btn.innerHTML = SPINNER_SVG;
    btn.classList.add("wai-refine-btn--loading");
    btn.title = isPartial ? "Refining selected text…" : "Refining your message…";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "REFINE_MESSAGE",
        text: textToRefine,
      });

      if (!response) {
        showToast("No response from background. Try reloading the extension.");
      } else if (response.success) {
        if (isPartial && savedRange) {
          replaceSelectedText(inputEl, response.refined, savedRange);
          showToast("Selected text refined ✨", "success");
        } else {
          await setInputText(inputEl, response.refined);
          showToast("Message refined ✨", "success");
        }
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
   * Positions the button so it floats just to the left of the
   * send button for a given input. Uses the input's own bounding
   * rect as the vertical anchor so it aligns with the compose
   * area regardless of platform quirks.
   */
  function positionButton(btn) {
    const inputEl = btn._pairedInput;
    if (!inputEl || inputEl.offsetParent === null) {
      btn.style.display = "none";
      return;
    }

    const sendBtn = findSendButtonFor(inputEl);
    const inputRect = inputEl.getBoundingClientRect();

    btn.style.display = "flex";

    // Platform-specific offsets:
    // FB & Messenger get a smaller button (26px) so offsets differ
    const isFBLike = PLATFORM === "facebook" || PLATFORM === "messenger";
    const btnHalf = isFBLike ? 13 : 16;    // half the button size
    const hGap = isFBLike ? 46 : 38;       // horizontal gap from send button

    if (sendBtn) {
      const sendRect = sendBtn.getBoundingClientRect();
      const left = sendRect.left - hGap;
      const top = inputRect.top + (inputRect.height / 2) - btnHalf;
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
    } else {
      const top = inputRect.bottom - (btnHalf * 2 + 2);
      const left = inputRect.right + 4;
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
    }
  }

  // ── Injection Logic ──────────────────────────────────────
  /**
   * Handles multiple chat windows (Facebook can have several pop-up
   * chats open). Each visible input gets its own floating button.
   */
  function injectButtons() {
    if (PLATFORM === "unknown") return;

    const visibleInputs = findAllInputEls();
    const activeInputSet = new Set(visibleInputs);

    // 1. Remove buttons whose paired input no longer exists / is hidden
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => {
      if (!btn._pairedInput || !activeInputSet.has(btn._pairedInput)) {
        buttonMap.delete(btn._pairedInput);
        btn.remove();
      }
    });

    // 2. For each visible input, ensure a button exists and is positioned
    for (const inputEl of visibleInputs) {
      let btn = buttonMap.get(inputEl);

      if (!btn || !btn.isConnected) {
        // Create a new button for this input
        btn = createRefineButton(inputEl);
        document.body.appendChild(btn);
        buttonMap.set(inputEl, btn);
      }

      positionButton(btn);
    }
  }

  // ── Reposition on Scroll / Resize ────────────────────────
  function handleReposition() {
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => {
      positionButton(btn);
    });
  }

  // ── Observer + Poll ──────────────────────────────────────
  function startObserving() {
    injectButtons();

    // MutationObserver for SPA re-renders
    const observer = new MutationObserver(() => {
      injectButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Safety-net poll
    setInterval(injectButtons, POLL_INTERVAL);

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

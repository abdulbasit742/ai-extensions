(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:5050/api/notebooklm";
  const STATE_KEY = "__ARIA_NOTEBOOKLM_HELPER__";
  const PANEL_ID = "aria-notebooklm-helper-panel";

  if (window[STATE_KEY]) return;

  const state = {
    running: false,
    claimed: false,
    timer: null,
    poller: null,
    runCount: 0,
    lastClickAt: 0,
    lastMessage: "NotebookLM helper loaded."
  };

  function instanceId() {
    try {
      const key = "ariaNotebookLmInstanceId";
      let value = sessionStorage.getItem(key);
      if (!value) {
        value = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(key, value);
      }
      return value;
    } catch (err) {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  const INSTANCE_ID = instanceId();

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 8 &&
      rect.height > 8 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0";
  }

  function textOf(el) {
    return String(
      el.innerText ||
      el.textContent ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.id ||
      ""
    ).trim().toLowerCase();
  }

  function sameTarget(config) {
    if (!location.hostname.includes("notebooklm.google.com")) return false;
    const targetUrl = String(config.target_url || "").trim();
    const projectKeyword = String(config.project_keyword || "").trim().toLowerCase();
    if (targetUrl) {
      try {
        const target = new URL(targetUrl);
        const current = new URL(location.href);
        if (target.host && target.host !== current.host) return false;
        const targetClean = target.href.replace(/[#].*$/, "").replace(/\/$/, "");
        const currentClean = current.href.replace(/[#].*$/, "").replace(/\/$/, "");
        const targetIsRoot = (target.pathname === "/" || target.pathname === "") && !target.search;
        if (!targetIsRoot && currentClean !== targetClean && !currentClean.startsWith(targetClean)) return false;
      } catch (err) {
        if (!location.href.toLowerCase().includes(targetUrl.toLowerCase())) return false;
      }
    }
    if (projectKeyword) {
      const haystack = `${document.title} ${location.href} ${document.body ? document.body.innerText.slice(0, 4000) : ""}`.toLowerCase();
      if (!haystack.includes(projectKeyword)) return false;
    }
    return true;
  }

  function makePanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "background:#101827",
      "color:#f9fafb",
      "border:1px solid #60a5fa",
      "border-radius:10px",
      "padding:10px 12px",
      "font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.25)",
      "max-width:340px"
    ].join(";");
    panel.innerHTML = [
      "<div style='font-weight:700;color:#93c5fd'>ARIA NotebookLM Helper</div>",
      "<div id='aria-notebooklm-status' style='margin-top:4px;color:#d1d5db'>Waiting...</div>",
      "<button id='aria-notebooklm-stop' style='margin-top:8px;border:0;border-radius:6px;padding:5px 8px;background:#ef4444;color:white;cursor:pointer'>Stop</button>"
    ].join("");
    document.body.appendChild(panel);
    panel.querySelector("#aria-notebooklm-stop").onclick = () => stop(false);
  }

  function removePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
  }

  function setStatus(message) {
    state.lastMessage = message;
    const el = document.getElementById("aria-notebooklm-status");
    if (el) el.textContent = `${message} | actions: ${state.runCount}`;
    console.log("[ARIA NotebookLM]", message);
  }

  async function post(path, body) {
    try {
      await fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    } catch (err) {
      console.warn("[ARIA NotebookLM] post failed", err);
    }
  }

  async function postJson(path, body) {
    const response = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    return response.json();
  }

  function sendLog(message, extra) {
    post("/extension-log", {
      message,
      extra: extra || {},
      url: location.href,
      title: document.title,
      runCount: state.runCount
    });
  }

  function buttonCandidates() {
    return Array.from(document.querySelectorAll("button,[role='button'],a"))
      .filter((el) => visible(el) && !el.closest("#" + PANEL_ID))
      .map((el) => ({ el, text: textOf(el), rect: el.getBoundingClientRect() }));
  }

  function findButton(words) {
    const normalizedWords = words.map((word) => word.toLowerCase());
    const candidates = buttonCandidates()
      .filter((item) => normalizedWords.some((word) => item.text.includes(word)))
      .filter((item) => !item.text.match(/delete|remove|cancel|close|dismiss/))
      .sort((a, b) => {
        const aExact = normalizedWords.some((word) => a.text === word) ? 1 : 0;
        const bExact = normalizedWords.some((word) => b.text === word) ? 1 : 0;
        return (bExact - aExact) || (b.rect.width * b.rect.height - a.rect.width * a.rect.height);
      });
    return candidates.length ? candidates[0].el : null;
  }

  function safeClick(el, message) {
    if (!el) return false;
    const now = Date.now();
    if (now - state.lastClickAt < 4500) return true;
    state.lastClickAt = now;
    el.scrollIntoView({ block: "center", inline: "center" });
    el.click();
    state.runCount += 1;
    setStatus(message);
    sendLog(message, { clickedText: textOf(el) });
    return true;
  }

  function pageLooksBusy() {
    const text = document.body ? document.body.innerText.toLowerCase() : "";
    return text.includes("generating") ||
      text.includes("creating") ||
      text.includes("preparing") ||
      text.includes("working") ||
      text.includes("loading");
  }

  async function attemptVideoWorkflow() {
    if (!state.running) return;
    if (pageLooksBusy()) {
      setStatus("NotebookLM is working. Waiting...");
      schedule(5000);
      return;
    }

    const download = findButton(["download video", "download", "export"]);
    if (download && safeClick(download, "Clicked download video. Waiting for file.")) {
      schedule(9000);
      return;
    }

    const generate = findButton([
      "generate video",
      "create video",
      "create video overview",
      "video overview",
      "generate",
      "create"
    ]);
    if (generate && safeClick(generate, "Clicked video generation button.")) {
      schedule(6500);
      return;
    }

    const studio = findButton(["studio", "video", "overview"]);
    if (studio && safeClick(studio, "Opened NotebookLM video/studio area.")) {
      schedule(6500);
      return;
    }

    setStatus("Waiting: video controls not found. Manual click may be needed.");
    sendLog("Manual step needed: video controls not found.");
    schedule(5000);
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    if (state.running) {
      state.timer = setTimeout(attemptVideoWorkflow, Math.max(1500, Number(ms) || 5000));
    }
  }

  async function claim() {
    const result = await postJson("/extension-claim", {
      instance_id: INSTANCE_ID,
      page_url: location.href,
      page_title: document.title
    });
    state.claimed = Boolean(result.claim_allowed);
    return state.claimed;
  }

  function start(config) {
    if (!state.running) {
      state.running = true;
      makePanel();
      setStatus("Connected. Starting NotebookLM workflow.");
      sendLog("NotebookLM helper connected.");
      schedule(800);
    }
  }

  function stop(localOnly) {
    state.running = false;
    state.claimed = false;
    clearTimeout(state.timer);
    setStatus("Stopped");
    if (!localOnly) {
      post("/extension-state", {
        running: false,
        message: "Stopped from NotebookLM page panel."
      });
    }
  }

  async function pollDashboard() {
    try {
      const response = await fetch(API_BASE + "/extension-state", { cache: "no-store" });
      const config = await response.json();
      const targetOk = sameTarget(config);
      if (config.running && targetOk) {
        const allowed = await claim();
        if (allowed) start(config);
        else if (state.running) stop(true);
      } else if (config.running && !targetOk) {
        if (state.running) stop(true);
        removePanel();
      } else {
        if (state.running) stop(true);
        if (targetOk) {
          if (!document.getElementById(PANEL_ID)) makePanel();
          setStatus(config.message || "NotebookLM helper idle. Click dashboard Start.");
        } else {
          removePanel();
        }
      }
    } catch (err) {
      if (!document.getElementById(PANEL_ID)) makePanel();
      setStatus("ARIA dashboard server not reachable");
    }
  }

  window[STATE_KEY] = {
    status: () => ({
      running: state.running,
      claimed: state.claimed,
      runCount: state.runCount,
      lastMessage: state.lastMessage
    }),
    stop,
    start
  };

  state.poller = setInterval(pollDashboard, 1200);
  pollDashboard();
})();

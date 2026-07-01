const OPTIONS_KEY = "ariaSuperOptions";
const PRESETS_KEY = "ariaSuperAdvancedPresets";
const TEMPLATES_KEY = "ariaSuperTemplates";
const CONDITIONAL_RULES_KEY = "ariaSuperCondRules";
const SITE_PROFILES_KEY = "ariaSuperSiteProfiles";
const params = new URLSearchParams(location.search);
const PANEL_TARGET_TAB_ID = Number.parseInt(params.get("targetTabId") || "", 10);
const DEFAULTS = {
  mode: "auto",
  seconds: "5",
  sendMode: "numbers",
  customText: "continue",
  nextNumber: "1",
  smartPromptInstruction: "",
  initialPrompt: "",
  sendPromptFirst: false,
  promptQueue: "",
  usePromptQueue: false,
  imageFolder: "Basit Social Media",
  videoTopicPrompt: "",
  videoFolder: "Basit Social Media/HeyGen Videos",
  socialPlatform: "auto",
  socialTopic: "",
  socialTone: "friendly",
  socialExtra: "",
  pulseComment: "",
  whatsappSourceName: "",
  whatsappReceiverName: "",
  wordTopic: "",
  autoWordSave: false,
  autoCodexSave: false,
  driveAutoSave: false,
  driveTitle: "",
  wordSaveMode: "full",
  wordOpenAfterSave: false,
  desktopTarget: "focused",
  desktopPasteDelay: "3",
  desktopOpenTarget: false,
  desktopOpenAppName: "notepad",
  desktopSearchQuery: "",
  // ARIA v4.14.0 - Quick Command Launcher
  quickCommandText: "",
  // ARIA v4.16.0 - AI Tool Radar / verified tool router
  toolRadarGoal: "",
  toolRadarType: "auto",
  toolRadarLastPrompt: "",
  toolRadarLastUrl: "",
  // ARIA v4.17.0 - Prompt Recipe Builder
  recipeGoal: "",
  recipeType: "code",
  recipeConstraints: "",
  recipeLastPrompt: "",
  // ARIA v4.18.0 - Prompt Queue Wizard
  queueWizardSource: "",
  queueWizardCount: "8",
  queueWizardStyle: "build",
  queueWizardLastQueue: "",
  limitGuardEnabled: true,
  limitCooldownMinutes: "10",
  stopAfterN: "0",
  // ARIA v4.8.0 — Feature 1: Auto-scroll to bottom before send
  autoScroll: true,
  // ARIA v4.8.0 — Feature 2: Response length guard
  minResponseChars: "0",
  // ARIA v4.26.7 - Self-Healing Failed Send Retry
  selfHealFailedSends: true,
  selfHealRetryMs: "60000",
  // ARIA v4.8.0 — Feature 3: Scheduled start / time-based trigger
  scheduledStartTime: "",
  // ARIA v4.8.0 — Feature 4: Tab sleep / wake schedule
  sleepFrom: "",
  sleepUntil: "",
  // ARIA v4.8.0 — Feature 6: Keyword-based auto-stop
  stopKeywords: "",
  // ARIA v4.8.0 — Feature 7: Per-site custom selectors
  customInputSelector: "",
  customSendSelector: "",
  customResponseSelector: "",
  // ARIA v4.8.0 — Feature 14: Auto-pause on tab visibility change
  pauseOnHidden: false,
  // ARIA v4.8.0 — Feature 15: Webhook notification on stop/limit
  webhookUrl: "",
  webhookOnStop: false,
  // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
  syncMode: "off",
  // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
  tokenBudget: "0",
  tokenSpent: 0,
  // ARIA v4.9.0 — Feature 4: Response Quality Filter
  skipShortReplies: false,
  minReplyWords: "10",
  // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
  autoRegen: false,
  regenKeywords: "error,failed,sorry,I cannot,I'm unable,try again",
  // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
  imageSaveFilter: "",
  // ARIA v4.9.0 — Feature 10/12/13: Screenshot, chain, clipboard watch
  screenshotOnStop: false,
  chainTargetTabId: "0",
  clipboardWatch: false,
  manusMaxSends: "300",
  manusMorningRefresh: true,
  manusMorningRefreshHour: "7",
  manusFallbackText: "do what is best",
  scholarshipProfile: "",
  scholarshipExtra: "",
  codingTarget: "codex",
  clickupChatgptSendNow: false,
  appRouterTask: "",
  pipelineTopic: "",
  responseVaultZipName: "",
  responseVaultWebhookUrl: "",
  responseVaultFormat: "txt",
  responseVaultStorages: ["local"],
  responseVaultAgents: []
};
const ARIA_SERVER_URLS = ["http://127.0.0.1:5050", "http://localhost:5050"];

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  $("status").textContent = text;
}

function isFullPanel() {
  return params.get("panel") === "1";
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));
}

function storageSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

// ARIA v4.13.0 - Desktop app/search bridge from the extension popup.
async function localServerJson(path, payload) {
  let lastError = "";
  for (const base of ARIA_SERVER_URLS) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        data = { message: text };
      }
      if (!response.ok || data.success === false || data.ok === false) {
        lastError = data.message || data.error || `HTTP ${response.status}`;
        continue;
      }
      return data;
    } catch (err) {
      lastError = String(err && err.message || err);
    }
  }
  throw new Error(lastError || "ARIA local server not reachable. Start ARIA dashboard first.");
}

// ARIA v4.8.0 — Feature 12: Popup dark/light theme toggle
async function loadPopupTheme() {
  const data = await storageGet(["ariaSuperPopupTheme"]);
  const theme = data.ariaSuperPopupTheme || "dark";
  document.body.classList.toggle("dark-mode", theme === "dark");
  document.body.classList.toggle("light-mode", theme === "light");
  const button = $("themeToggle");
  if (button) button.textContent = theme === "dark" ? "Light" : "Dark";
}

async function togglePopupTheme() {
  const darkNow = document.body.classList.contains("dark-mode");
  const next = darkNow ? "light" : "dark";
  await storageSet({ ariaSuperPopupTheme: next });
  await loadPopupTheme();
}

function timestampForFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadTextFile(filename, text, mime = "application/json") {
  return new Promise((resolve) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename, saveAs: true, conflictAction: "uniquify" }, (downloadId) => {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (chrome.runtime.lastError || !downloadId) {
        resolve({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Download failed." });
      } else {
        resolve({ ok: true, downloadId, filename });
      }
    });
  });
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(tab);
    });
  });
}

function createTab(url, active = true) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active }, (tab) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(tab);
    });
  });
}

function shortUrl(url) {
  const text = String(url || "");
  return text.length > 95 ? text.slice(0, 92) + "..." : text;
}

async function refreshTargetInfo() {
  const box = $("targetInfo");
  if (!box) return;
  if (!isFullPanel()) {
    box.style.display = "none";
    return;
  }
  try {
    const tab = await activeTab();
    box.style.display = "block";
    box.innerHTML = `<strong>Full panel target tab:</strong><br>${escapeHtml(tab.title || "Untitled")}<br><span class="small">${escapeHtml(shortUrl(tab.url))}</span>`;
  } catch (err) {
    box.style.display = "block";
    box.textContent = `Target tab error: ${err.message}`;
  }
}

async function activeTab() {
  if (Number.isFinite(PANEL_TARGET_TAB_ID) && PANEL_TARGET_TAB_ID > 0) {
    const tab = await getTab(PANEL_TARGET_TAB_ID);
    if (tab && supportedUrl(tab.url)) return tab;
    throw new Error("Target tab closed or not supported. Open ARIA panel again from the target page.");
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^(https?:|file:)\/\//i.test(tab.url || "")) {
    throw new Error("Open a normal website tab first. Chrome/Edge internal pages cannot run content extensions.");
  }
  return tab;
}

function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (reply) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message || "";
        if (chrome.scripting && error.match(/receiving end|could not establish|no tab/i)) {
          chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, message, (secondReply) => {
                if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
                else resolve(secondReply || { ok: false, error: "No reply from tab after injection." });
              });
            }, 250);
          });
        } else {
          resolve({ ok: false, error });
        }
      } else {
        resolve(reply || { ok: false, error: "No reply from tab." });
      }
    });
  });
}

function supportedUrl(url) {
  return /^(https?:|file:)\/\//i.test(String(url || ""));
}

function hostKey(url) {
  try {
    const u = new URL(url);
    return u.protocol === "file:" ? "file:" : u.hostname;
  } catch (err) {
    return "";
  }
}

function blockedBulkHost(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if ((host === "127.0.0.1" || host === "localhost") && parsed.port === "5050") return true;
    return host.includes("facebook.com") ||
      host.includes("instagram.com") ||
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host.includes("twitter.com") ||
      host.includes("linkedin.com") ||
      host.includes("mail.google.com") ||
      host.includes("outlook.") ||
      host.includes("web.whatsapp.com") ||
      host.includes("bank") ||
      host.includes("paypal.") ||
      host.includes("stripe.");
  } catch (err) {
    return true;
  }
}

function aiCodingHost(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const href = String(url || "").toLowerCase();
    return host.includes("chatgpt.com") ||
      host.includes("chat.openai.com") ||
      host.includes("codex.openai.com") ||
      href.includes("/codex") ||
      host.includes("antigravity") ||
      href.includes("antigravity") ||
      host.includes("claude.ai") ||
      host.includes("gemini.google.com") ||
      host.includes("aistudio.google.com") ||
      host.includes("makersuite.google.com") ||
      (host.includes("ai.google.dev") && href.includes("aistudio")) ||
      host.includes("grok.com") ||
      host.includes("poe.com") ||
      host.includes("perplexity.ai") ||
      host.includes("deepseek.com") ||
      host.includes("chat.mistral.ai") ||
      host.includes("phind.com") ||
      host.includes("you.com") ||
      host.includes("character.ai") ||
      host.includes("coze.com") ||
      host.includes("coze.cn") ||
      host.includes("huggingface.co") ||
      host.includes("together.ai") ||
      host.includes("openrouter.ai") ||
      host.includes("cerebras.ai") ||
      host.includes("ideogram.ai") ||
      host.includes("suno.com") ||
      host.includes("suno.ai") ||
      host.includes("runwayml.com") ||
      host.includes("runway.com") ||
      host.includes("lumalabs.ai") ||
      host.includes("luma.ai") ||
      host.includes("krea.ai") ||
      host.includes("replicate.com") ||
      host.includes("dify.ai") ||
      host.includes("devin.ai") ||
      host.includes("copilot.microsoft.com") ||
      (host.includes("github.com") && href.includes("copilot")) ||
      host.includes("app.clickup.com") ||
      host.includes("smith.langchain.com") ||
      host.includes("langchain.com") ||
      host.includes("fireworks.ai") ||
      host.includes("cursor.sh") ||
      host.includes("cursor.com") ||
      host.includes("v0.dev") ||
      host.includes("bolt.new") ||
      host.includes("lovable.dev") ||
      host.includes("manus.im") ||
      host.includes("same.new") ||
      host.includes("windsurf") ||
      host.includes("fleet") ||
      host.includes("replit.com") ||
      host.includes("stackblitz.com") ||
      host.includes("codesandbox.io") ||
      host.includes("github.dev") ||
      host.includes("notebooklm.google.com") ||
      host.includes("localhost") ||
      host === "127.0.0.1";
  } catch (err) {
    return false;
  }
}

function sendRuntime(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(reply || { ok: false });
      }
    });
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function todayZipName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `AI_Responses_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function selectedChipValues(containerId, attr) {
  const box = $(containerId);
  if (!box) return [];
  return Array.from(box.querySelectorAll("button.active")).map((btn) => btn.dataset[attr]).filter(Boolean);
}

function setChipValues(containerId, attr, values, single = false) {
  const wanted = new Set(Array.isArray(values) ? values : []);
  const box = $(containerId);
  if (!box) return;
  box.querySelectorAll("button").forEach((btn) => {
    const value = btn.dataset[attr];
    btn.classList.toggle("active", wanted.has(value));
    btn.onclick = () => {
      if (single) {
        box.querySelectorAll("button").forEach((other) => other.classList.remove("active"));
        btn.classList.add("active");
      } else {
        btn.classList.toggle("active");
        if (containerId === "responseVaultStorageChips") {
          const active = selectedChipValues(containerId, attr);
          if (!active.length) btn.classList.add("active");
        }
      }
      saveOptions().catch(() => {});
    };
  });
}

function responseVaultOptions(forceAll = false) {
  const ids = forceAll ? [] : selectedResponseVaultIds();
  return {
    ...(ids.length ? { ids } : { selectedOnly: false }),
    format: selectedChipValues("responseVaultFormatChips", "format")[0] || "txt",
    zipName: $("responseVaultZipName").value || todayZipName(),
    storages: selectedChipValues("responseVaultStorageChips", "storage"),
    agents: selectedChipValues("responseVaultAgentChips", "agent"),
    webhookUrl: $("responseVaultWebhookUrl").value || ""
  };
}

function selectedResponseVaultIds() {
  return Array.from(document.querySelectorAll("#responseVaultList input[data-response-id]:checked"))
    .map((input) => Number(input.dataset.responseId))
    .filter((id) => Number.isFinite(id));
}

async function setResponseVaultSelected(id, selected) {
  const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_UPDATE", id, data: { selected: Boolean(selected) } });
  if (!reply.ok) setStatus(`Vault update error: ${reply.error || "unknown"}`);
}

function renderResponseVault(reply) {
  const list = $("responseVaultList");
  const rows = Array.isArray(reply && reply.responses) ? reply.responses : [];
  $("responseVaultCount").textContent = String(reply && reply.count || rows.length || 0);
  $("responseVaultZipCount").textContent = String(reply && reply.zipCount || 0);
  if (!rows.length) {
    list.innerHTML = `<div class="vault-row"><div></div><div class="vault-meta">No saved responses yet. Click Copy Latest, Copy All, or Save Visible.</div><div></div></div>`;
    return;
  }
  list.innerHTML = rows.slice(0, 80).map((row) => {
    const created = row.createdAt ? new Date(row.createdAt).toLocaleString() : "";
    const chars = String(row.text || "").length;
    return `
      <div class="vault-row">
        <input data-response-id="${row.id}" type="checkbox" ${row.selected === false ? "" : "checked"} />
        <div>
          <div class="vault-title">${escapeHtml(row.topic || row.title || "AI response")}</div>
          <div class="vault-meta"><span class="badge">${escapeHtml(row.source || "AI")}</span> ${escapeHtml(created)} · ${chars} chars<br>${escapeHtml(row.sourceUrl || "")}</div>
        </div>
        <button data-delete-response="${row.id}" class="warn" style="padding:5px 8px">x</button>
      </div>`;
  }).join("");
  list.querySelectorAll("input[data-response-id]").forEach((input) => {
    input.onchange = () => setResponseVaultSelected(Number(input.dataset.responseId), input.checked);
  });
  list.querySelectorAll("button[data-delete-response]").forEach((btn) => {
    btn.onclick = async () => {
      const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_DELETE", id: Number(btn.dataset.deleteResponse) });
      setStatus(reply.ok ? "Response removed from vault." : `Vault delete error: ${reply.error}`);
      await refreshResponseVault();
    };
  });
}

async function refreshResponseVault() {
  const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_LIST" });
  renderResponseVault(reply);
  return reply;
}

function socialPayload() {
  return {
    platform: $("socialPlatform").value || "auto",
    topic: $("socialTopic").value || "",
    tone: $("socialTone").value || "friendly",
    extra: $("socialExtra").value || ""
  };
}

function whatsappPayload() {
  return {
    sourceName: $("whatsappSourceName").value || "",
    receiverName: $("whatsappReceiverName").value || ""
  };
}

function platformUrl(platform) {
  const p = String(platform || "auto").toLowerCase();
  if (p === "instagram") return "https://www.instagram.com/";
  if (p === "linkedin") return "https://www.linkedin.com/feed/";
  if (p === "x" || p === "twitter") return "https://x.com/home";
  return "https://www.facebook.com/";
}

function codingTargetName(target) {
  const value = String(target || "codex").toLowerCase();
  if (value === "vscode" || value === "vs code" || value === "code") return "VS Code";
  if (value === "cursor") return "Cursor";
  if (value === "android_studio" || value === "android studio" || value === "androidstudio" || value === "studio") return "Android Studio";
  if (value === "claude") return "Claude";
  if (value === "chatgpt") return "ChatGPT";
  if (value === "gemini") return "Gemini";
  if (value === "clickup") return "ClickUp";
  return "Codex";
}

function optionsFromUi() {
  return {
    mode: $("mode").value,
    seconds: $("seconds").value || "5",
    sendMode: $("sendMode").value,
    customText: $("customText").value || "continue",
    nextNumber: $("nextNumber").value || "1",
    smartPromptInstruction: $("smartPromptInstruction").value || "",
    initialPrompt: $("initialPrompt").value || "",
    sendPromptFirst: $("sendPromptFirst").checked,
    promptQueue: $("promptQueue").value || "",
    usePromptQueue: $("usePromptQueue").checked,
    imageFolder: $("imageFolder").value || "Basit Social Media",
    videoTopicPrompt: $("videoTopicPrompt").value || "",
    videoFolder: $("videoFolder").value || "Basit Social Media/HeyGen Videos",
    socialPlatform: $("socialPlatform").value || "auto",
    socialTopic: $("socialTopic").value || "",
    socialTone: $("socialTone").value || "friendly",
    socialExtra: $("socialExtra").value || "",
    pulseComment: $("pulseComment") ? $("pulseComment").value || "" : "",
    whatsappSourceName: $("whatsappSourceName").value || "",
    whatsappReceiverName: $("whatsappReceiverName").value || "",
    wordTopic: $("wordTopic").value || "",
    autoWordSave: $("autoWordSave").checked,
    autoCodexSave: $("autoCodexSave").checked,
    driveAutoSave: $("driveAutoSave").checked,
    driveTitle: $("driveTitle").value || "",
    wordSaveMode: $("wordSaveMode").value || "full",
    wordOpenAfterSave: $("wordOpenAfterSave").checked,
    desktopTarget: $("desktopTarget").value || "focused",
    desktopPasteDelay: $("desktopPasteDelay").value || "3",
    desktopOpenTarget: $("desktopOpenTarget").checked,
    desktopOpenAppName: $("desktopOpenAppName") ? $("desktopOpenAppName").value || "notepad" : "notepad",
    desktopSearchQuery: $("desktopSearchQuery") ? $("desktopSearchQuery").value || "" : "",
    // ARIA v4.14.0 - Quick Command Launcher
    quickCommandText: $("quickCommandInput") ? $("quickCommandInput").value || "" : "",
    // ARIA v4.16.0 - AI Tool Radar / verified tool router
    toolRadarGoal: $("toolRadarGoal") ? $("toolRadarGoal").value || "" : "",
    toolRadarType: $("toolRadarType") ? $("toolRadarType").value || "auto" : "auto",
    // ARIA v4.17.0 - Prompt Recipe Builder
    recipeGoal: $("recipeGoal") ? $("recipeGoal").value || "" : "",
    recipeType: $("recipeType") ? $("recipeType").value || "code" : "code",
    recipeConstraints: $("recipeConstraints") ? $("recipeConstraints").value || "" : "",
    // ARIA v4.18.0 - Prompt Queue Wizard
    queueWizardSource: $("queueWizardSource") ? $("queueWizardSource").value || "" : "",
    queueWizardCount: $("queueWizardCount") ? String(Math.max(2, Math.min(50, Number.parseInt($("queueWizardCount").value || "8", 10) || 8))) : "8",
    queueWizardStyle: $("queueWizardStyle") ? $("queueWizardStyle").value || "build" : "build",
    limitGuardEnabled: $("limitGuardEnabled").checked,
    limitCooldownMinutes: String(Math.max(5, Number.parseInt($("limitCooldownMinutes").value || "10", 10) || 10)),
    stopAfterN: String(Math.max(0, Number.parseInt(($("stopAfterN") && $("stopAfterN").value) || "0", 10) || 0)),
    // ARIA v4.8.0 — Feature 1: Auto-Scroll to Bottom Before Send
    autoScroll: $("autoScroll") ? $("autoScroll").checked : true,
    // ARIA v4.8.0 — Feature 2: Response Length Guard
    minResponseChars: String(Math.max(0, Number.parseInt(($("minResponseChars") && $("minResponseChars").value) || "0", 10) || 0)),
    // ARIA v4.26.7 - Self-Healing Failed Send Retry
    selfHealFailedSends: $("selfHealFailedSends") ? $("selfHealFailedSends").checked : true,
    selfHealRetryMs: String(Math.max(30000, (Number.parseInt(($("selfHealRetrySeconds") && $("selfHealRetrySeconds").value) || "60", 10) || 60) * 1000)),
    // ARIA v4.8.0 — Feature 3: Scheduled Start / Time-Based Trigger
    scheduledStartTime: $("scheduledStartTime") ? $("scheduledStartTime").value || "" : "",
    // ARIA v4.8.0 — Feature 4: Tab Sleep / Wake Schedule
    sleepFrom: $("sleepFrom") ? $("sleepFrom").value || "" : "",
    sleepUntil: $("sleepUntil") ? $("sleepUntil").value || "" : "",
    // ARIA v4.8.0 — Feature 6: Keyword-Based Auto-Stop
    stopKeywords: $("stopKeywords") ? $("stopKeywords").value || "" : "",
    // ARIA v4.8.0 — Feature 7: Per-Site Custom Selectors
    customInputSelector: $("customInputSelector") ? $("customInputSelector").value || "" : "",
    customSendSelector: $("customSendSelector") ? $("customSendSelector").value || "" : "",
    customResponseSelector: $("customResponseSelector") ? $("customResponseSelector").value || "" : "",
    // ARIA v4.8.0 — Feature 14: Auto-Pause on Tab Visibility Change
    pauseOnHidden: $("pauseOnHidden") ? $("pauseOnHidden").checked : false,
    // ARIA v4.8.0 — Feature 15: Webhook Notification on Stop/Limit
    webhookUrl: $("webhookUrl") ? $("webhookUrl").value || "" : "",
    webhookOnStop: $("webhookOnStop") ? $("webhookOnStop").checked : false,
    // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
    syncMode: $("syncMode") ? $("syncMode").value || "off" : "off",
    // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
    tokenBudget: String(Math.max(0, Number.parseInt(($("tokenBudget") && $("tokenBudget").value) || "0", 10) || 0)),
    // ARIA v4.9.0 — Feature 4: Response Quality Filter
    skipShortReplies: $("skipShortReplies") ? $("skipShortReplies").checked : false,
    minReplyWords: String(Math.max(1, Number.parseInt(($("minReplyWords") && $("minReplyWords").value) || "10", 10) || 10)),
    // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
    autoRegen: $("autoRegen") ? $("autoRegen").checked : false,
    regenKeywords: $("regenKeywords") ? $("regenKeywords").value || DEFAULTS.regenKeywords : DEFAULTS.regenKeywords,
    // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
    imageSaveFilter: $("imageSaveFilter") ? $("imageSaveFilter").value || "" : "",
    // ARIA v4.9.0 — Feature 10/12/13: Screenshot, chain, clipboard watch
    screenshotOnStop: $("screenshotOnStop") ? $("screenshotOnStop").checked : false,
    chainTargetTabId: $("chainTargetTabId") ? $("chainTargetTabId").value || "0" : "0",
    clipboardWatch: $("clipboardWatch") ? $("clipboardWatch").checked : false,
    manusMaxSends: String(Math.max(1, Math.min(300, Number.parseInt($("manusMaxSends").value || "300", 10) || 300))),
    manusMorningRefresh: $("manusMorningRefresh").checked,
    manusMorningRefreshHour: String(Math.max(0, Math.min(23, Number.parseInt($("manusMorningRefreshHour").value || "7", 10) || 7))),
    manusFallbackText: $("manusFallbackText").value || "do what is best",
    scholarshipProfile: $("scholarshipProfile").value || "",
    scholarshipExtra: $("scholarshipExtra").value || "",
    codingTarget: $("codingTarget").value || "codex",
    clickupChatgptSendNow: $("clickupChatgptSendNow").checked,
    appRouterTask: $("appRouterTask").value || "",
    pipelineTopic: $("pipelineTopic").value || "",
    responseVaultZipName: $("responseVaultZipName").value || todayZipName(),
    responseVaultWebhookUrl: $("responseVaultWebhookUrl").value || "",
    responseVaultFormat: selectedChipValues("responseVaultFormatChips", "format")[0] || "txt",
    responseVaultStorages: selectedChipValues("responseVaultStorageChips", "storage"),
    responseVaultAgents: selectedChipValues("responseVaultAgentChips", "agent")
  };
}

async function saveOptions() {
  const options = optionsFromUi();
  await storageSet({ [OPTIONS_KEY]: options });
  return options;
}

async function loadOptions() {
  const data = await storageGet([OPTIONS_KEY]);
  const options = { ...DEFAULTS, ...(data[OPTIONS_KEY] || {}) };
  $("mode").value = options.mode;
  $("seconds").value = options.seconds;
  $("sendMode").value = options.sendMode;
  $("customText").value = options.customText;
  $("nextNumber").value = options.nextNumber;
  $("smartPromptInstruction").value = options.smartPromptInstruction || "";
  $("initialPrompt").value = options.initialPrompt || "";
  $("sendPromptFirst").checked = Boolean(options.sendPromptFirst);
  $("promptQueue").value = options.promptQueue || "";
  $("usePromptQueue").checked = Boolean(options.usePromptQueue);
  $("imageFolder").value = options.imageFolder;
  $("videoTopicPrompt").value = options.videoTopicPrompt || "";
  $("videoFolder").value = options.videoFolder || "Basit Social Media/HeyGen Videos";
  $("socialPlatform").value = options.socialPlatform || "auto";
  $("socialTopic").value = options.socialTopic || "";
  $("socialTone").value = options.socialTone || "friendly";
  $("socialExtra").value = options.socialExtra || "";
  if ($("pulseComment")) $("pulseComment").value = options.pulseComment || "";
  $("whatsappSourceName").value = options.whatsappSourceName || "";
  $("whatsappReceiverName").value = options.whatsappReceiverName || "";
  $("wordTopic").value = options.wordTopic || "";
  $("autoWordSave").checked = Boolean(options.autoWordSave);
  $("autoCodexSave").checked = Boolean(options.autoCodexSave);
  $("driveAutoSave").checked = Boolean(options.driveAutoSave);
  $("driveTitle").value = options.driveTitle || "";
  $("wordSaveMode").value = options.wordSaveMode || "full";
  $("wordOpenAfterSave").checked = Boolean(options.wordOpenAfterSave);
  $("desktopTarget").value = options.desktopTarget || "focused";
  $("desktopPasteDelay").value = options.desktopPasteDelay || "3";
  $("desktopOpenTarget").checked = Boolean(options.desktopOpenTarget);
  if ($("desktopOpenAppName")) $("desktopOpenAppName").value = options.desktopOpenAppName || "notepad";
  if ($("desktopSearchQuery")) $("desktopSearchQuery").value = options.desktopSearchQuery || "";
  // ARIA v4.14.0 - Quick Command Launcher
  if ($("quickCommandInput")) $("quickCommandInput").value = options.quickCommandText || "";
  // ARIA v4.16.0 - AI Tool Radar / verified tool router
  if ($("toolRadarGoal")) $("toolRadarGoal").value = options.toolRadarGoal || "";
  if ($("toolRadarType")) $("toolRadarType").value = options.toolRadarType || "auto";
  // ARIA v4.17.0 - Prompt Recipe Builder
  if ($("recipeGoal")) $("recipeGoal").value = options.recipeGoal || "";
  if ($("recipeType")) $("recipeType").value = options.recipeType || "code";
  if ($("recipeConstraints")) $("recipeConstraints").value = options.recipeConstraints || "";
  // ARIA v4.18.0 - Prompt Queue Wizard
  if ($("queueWizardSource")) $("queueWizardSource").value = options.queueWizardSource || "";
  if ($("queueWizardCount")) $("queueWizardCount").value = String(Math.max(2, Math.min(50, Number.parseInt(options.queueWizardCount || "8", 10) || 8)));
  if ($("queueWizardStyle")) $("queueWizardStyle").value = options.queueWizardStyle || "build";
  $("limitGuardEnabled").checked = options.limitGuardEnabled !== false;
  $("limitCooldownMinutes").value = String(Math.max(5, Number.parseInt(options.limitCooldownMinutes || "10", 10) || 10));
  if ($("stopAfterN")) $("stopAfterN").value = String(Math.max(0, Number.parseInt(options.stopAfterN || "0", 10) || 0));
  // ARIA v4.8.0 — Feature 1: Auto-Scroll to Bottom Before Send
  if ($("autoScroll")) $("autoScroll").checked = options.autoScroll !== false;
  // ARIA v4.8.0 — Feature 2: Response Length Guard
  if ($("minResponseChars")) $("minResponseChars").value = String(Math.max(0, Number.parseInt(options.minResponseChars || "0", 10) || 0));
  // ARIA v4.26.7 - Self-Healing Failed Send Retry
  if ($("selfHealFailedSends")) $("selfHealFailedSends").checked = options.selfHealFailedSends !== false;
  if ($("selfHealRetrySeconds")) $("selfHealRetrySeconds").value = String(Math.max(30, Math.round((Number.parseInt(options.selfHealRetryMs || "60000", 10) || 60000) / 1000)));
  // ARIA v4.8.0 — Feature 3: Scheduled Start / Time-Based Trigger
  if ($("scheduledStartTime")) $("scheduledStartTime").value = options.scheduledStartTime || "";
  // ARIA v4.8.0 — Feature 4: Tab Sleep / Wake Schedule
  if ($("sleepFrom")) $("sleepFrom").value = options.sleepFrom || "";
  if ($("sleepUntil")) $("sleepUntil").value = options.sleepUntil || "";
  // ARIA v4.8.0 — Feature 6: Keyword-Based Auto-Stop
  if ($("stopKeywords")) $("stopKeywords").value = options.stopKeywords || "";
  // ARIA v4.8.0 — Feature 7: Per-Site Custom Selectors
  if ($("customInputSelector")) $("customInputSelector").value = options.customInputSelector || "";
  if ($("customSendSelector")) $("customSendSelector").value = options.customSendSelector || "";
  if ($("customResponseSelector")) $("customResponseSelector").value = options.customResponseSelector || "";
  // ARIA v4.8.0 — Feature 14: Auto-Pause on Tab Visibility Change
  if ($("pauseOnHidden")) $("pauseOnHidden").checked = Boolean(options.pauseOnHidden);
  // ARIA v4.8.0 — Feature 15: Webhook Notification on Stop/Limit
  if ($("webhookUrl")) $("webhookUrl").value = options.webhookUrl || "";
  if ($("webhookOnStop")) $("webhookOnStop").checked = Boolean(options.webhookOnStop);
  // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
  if ($("syncMode")) $("syncMode").value = options.syncMode || "off";
  // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
  if ($("tokenBudget")) $("tokenBudget").value = String(Math.max(0, Number.parseInt(options.tokenBudget || "0", 10) || 0));
  // ARIA v4.9.0 — Feature 4: Response Quality Filter
  if ($("skipShortReplies")) $("skipShortReplies").checked = Boolean(options.skipShortReplies);
  if ($("minReplyWords")) $("minReplyWords").value = String(Math.max(1, Number.parseInt(options.minReplyWords || "10", 10) || 10));
  // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
  if ($("autoRegen")) $("autoRegen").checked = Boolean(options.autoRegen);
  if ($("regenKeywords")) $("regenKeywords").value = options.regenKeywords || DEFAULTS.regenKeywords;
  // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
  if ($("imageSaveFilter")) $("imageSaveFilter").value = options.imageSaveFilter || "";
  // ARIA v4.9.0 — Feature 10/12/13: Screenshot, chain, clipboard watch
  if ($("screenshotOnStop")) $("screenshotOnStop").checked = Boolean(options.screenshotOnStop);
  if ($("chainTargetTabId")) $("chainTargetTabId").value = String(options.chainTargetTabId || "0");
  if ($("clipboardWatch")) $("clipboardWatch").checked = Boolean(options.clipboardWatch);
  $("manusMaxSends").value = String(Math.max(1, Math.min(300, Number.parseInt(options.manusMaxSends || "300", 10) || 300)));
  $("manusMorningRefresh").checked = options.manusMorningRefresh !== false;
  $("manusMorningRefreshHour").value = String(Math.max(0, Math.min(23, Number.parseInt(options.manusMorningRefreshHour || "7", 10) || 7)));
  $("manusFallbackText").value = options.manusFallbackText || "do what is best";
  $("scholarshipProfile").value = options.scholarshipProfile || "";
  $("scholarshipExtra").value = options.scholarshipExtra || "";
  $("codingTarget").value = options.codingTarget || "codex";
  $("clickupChatgptSendNow").checked = options.clickupChatgptSendNow !== false;
  $("appRouterTask").value = options.appRouterTask || "";
  $("pipelineTopic").value = options.pipelineTopic || "";
  $("responseVaultZipName").value = options.responseVaultZipName || todayZipName();
  $("responseVaultWebhookUrl").value = options.responseVaultWebhookUrl || "";
  setChipValues("responseVaultStorageChips", "storage", options.responseVaultStorages || ["local"]);
  setChipValues("responseVaultAgentChips", "agent", options.responseVaultAgents || []);
  setChipValues("responseVaultFormatChips", "format", [options.responseVaultFormat || "txt"], true);
}

// ARIA v4.9.0 — Feature 2: Prompt Template Library
async function getTemplates() {
  const data = await storageGet([TEMPLATES_KEY]);
  return Array.isArray(data[TEMPLATES_KEY]) ? data[TEMPLATES_KEY] : [];
}

async function saveTemplates(templates) {
  await storageSet({ [TEMPLATES_KEY]: Array.isArray(templates) ? templates : [] });
}

function templateVariables(text) {
  const found = new Set();
  String(text || "").replace(/{{\s*([\w-]+)\s*}}/g, (_match, name) => {
    found.add(String(name || "").trim());
    return "";
  });
  return Array.from(found).filter(Boolean);
}

async function renderTemplates() {
  const box = $("templatesList");
  if (!box) return;
  const templates = await getTemplates();
  if (!templates.length) {
    box.textContent = "No templates loaded.";
    return;
  }
  box.innerHTML = templates.map((tpl) => `
    <div style="border-bottom:1px solid #e7ddc8;padding:7px 0">
      <strong>${escapeHtml(tpl.name || "Untitled template")}</strong>
      <div class="muted">${escapeHtml((tpl.variables || []).join(", ") || "no variables")}</div>
      <button class="secondary" data-template-id="${escapeHtml(tpl.id)}" style="margin-top:6px">Load Template</button>
    </div>
  `).join("");
  box.querySelectorAll("[data-template-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const latest = await getTemplates();
      const template = latest.find((item) => item.id === btn.dataset.templateId);
      if (!template) return;
      $("initialPrompt").value = template.text || "";
      $("sendPromptFirst").checked = true;
      await saveOptions();
      setStatus(`Template loaded: ${template.name}`);
    });
  });
}

async function saveCurrentTemplate() {
  const text = ($("initialPrompt") && $("initialPrompt").value) || ($("customText") && $("customText").value) || "";
  if (!text.trim()) throw new Error("Template text is empty. Paste prompt text first.");
  const name = ($("templateName") && $("templateName").value.trim()) || `template_${timestampForFile()}`;
  const templates = await getTemplates();
  const item = {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    text,
    variables: templateVariables(text),
    updatedAt: new Date().toISOString()
  };
  templates.push(item);
  await saveTemplates(templates);
  await renderTemplates();
  return item;
}

async function exportTemplates() {
  const templates = await getTemplates();
  return downloadTextFile(`ARIA_Nexus_Templates_${timestampForFile()}.json`, JSON.stringify({ templates }, null, 2));
}

async function importTemplatesFile() {
  const input = $("importTemplatesFile");
  const file = input && input.files && input.files[0];
  if (!file) return;
  const parsed = await readJsonFile(file);
  const templates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.templates) ? parsed.templates : [];
  await saveTemplates(templates);
  await renderTemplates();
  setStatus(`Imported ${templates.length} template(s).`);
}

// ARIA v4.9.0 — Feature 8: Conditional Next Prompt
async function getConditionalRules() {
  const data = await storageGet([CONDITIONAL_RULES_KEY]);
  return Array.isArray(data[CONDITIONAL_RULES_KEY]) ? data[CONDITIONAL_RULES_KEY] : [];
}

async function saveConditionalRules(rules) {
  await storageSet({ [CONDITIONAL_RULES_KEY]: Array.isArray(rules) ? rules : [] });
}

async function renderConditionalRules() {
  const box = $("condRulesList");
  if (!box) return;
  const rules = await getConditionalRules();
  if (!rules.length) {
    box.textContent = "No rules.";
    return;
  }
  box.innerHTML = rules.map((rule, index) => `
    <div style="border-bottom:1px solid #e7ddc8;padding:7px 0">
      <strong>If:</strong> ${escapeHtml(rule.keyword || "")}
      <div><strong>Then:</strong> ${escapeHtml(String(rule.prompt || "").slice(0, 160))}</div>
      <div class="muted">Uses left: ${Number(rule.maxUses) || 1}</div>
      <button class="warn" data-rule-index="${index}" style="margin-top:6px">Remove</button>
    </div>
  `).join("");
  box.querySelectorAll("[data-rule-index]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = await getConditionalRules();
      next.splice(Number(btn.dataset.ruleIndex), 1);
      await saveConditionalRules(next);
      await renderConditionalRules();
      setStatus("Conditional rule removed.");
    });
  });
}

async function addConditionalRule() {
  const keyword = ($("condKeyword") && $("condKeyword").value.trim()) || "";
  const prompt = ($("condPrompt") && $("condPrompt").value.trim()) || "";
  const maxUses = Math.max(1, Number.parseInt(($("condMaxUses") && $("condMaxUses").value) || "1", 10) || 1);
  if (!keyword || !prompt) throw new Error("Keyword and prompt are required.");
  const rules = await getConditionalRules();
  rules.push({ keyword, prompt, maxUses, createdAt: new Date().toISOString() });
  await saveConditionalRules(rules);
  $("condKeyword").value = "";
  $("condPrompt").value = "";
  $("condMaxUses").value = "1";
  await renderConditionalRules();
  return rules.length;
}

// ARIA v4.9.0 — Feature 12: Prompt Chaining Across Tabs
async function refreshChainTabs() {
  const select = $("chainTargetTabId");
  if (!select) return;
  const previous = select.value || "0";
  const current = await activeTab().catch(() => null);
  const tabs = await chrome.tabs.query({});
  const choices = tabs
    .filter((tab) => tab.id !== (current && current.id) && supportedUrl(tab.url) && aiCodingHost(tab.url))
    .map((tab) => `<option value="${tab.id}">${escapeHtml((tab.title || "AI tab").slice(0, 70))}</option>`);
  select.innerHTML = `<option value="0">No chain target</option>${choices.join("")}`;
  select.value = Array.from(select.options).some((opt) => opt.value === previous) ? previous : "0";
}

// ARIA v4.9.0 — Feature 11: Response Diff Viewer
async function diffLastResponses() {
  const reply = await runAction("ARIA_SUPER_GET_RESPONSE_HISTORY");
  const history = reply && Array.isArray(reply.history) ? reply.history : [];
  if (history.length < 2) {
    setStatus("Need at least 2 captured responses to diff.");
    return;
  }
  const before = String(history[history.length - 2].text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const after = String(history[history.length - 1].text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const removed = before.filter((line) => !afterSet.has(line)).slice(0, 80).map((line) => `- ${line}`);
  const added = after.filter((line) => !beforeSet.has(line)).slice(0, 80).map((line) => `+ ${line}`);
  setStatus(`Diff last 2 responses\n\n${removed.concat(added).join("\n") || "No line-level difference found."}`);
}

// ARIA v4.9.0 — Feature 9: Tab Group Automation
async function runTabGroup(shouldStart) {
  const current = await activeTab();
  if (current.groupId === undefined || current.groupId === null || current.groupId < 0) {
    setStatus("Current tab is not in a Chrome tab group.");
    return;
  }
  const options = await saveOptions();
  const tabs = await chrome.tabs.query({ groupId: current.groupId });
  let done = 0;
  for (const tab of tabs) {
    if (!supportedUrl(tab.url)) continue;
    try {
      await sendToTab(tab.id, {
        type: shouldStart ? "ARIA_SUPER_START" : "ARIA_SUPER_STOP",
        options,
        activeTabId: tab.id,
        resetPromptFirst: true
      });
      done += 1;
    } catch (_err) {
      // Keep moving through the group.
    }
  }
  setStatus(`${shouldStart ? "Started" : "Stopped"} ${done} tab(s) in this tab group.`);
}

// ARIA v4.9.0 — Feature 15: One-Click Full Automation Profile
async function applyQuickProfile(name, patch) {
  Object.entries(patch).forEach(([id, value]) => {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = String(value);
  });
  await saveOptions();
  setStatus(`Applied profile: ${name}`);
}

async function getPresets() {
  const data = await storageGet([PRESETS_KEY]);
  const presets = data[PRESETS_KEY];
  return presets && typeof presets === "object" && !Array.isArray(presets) ? presets : {};
}

async function renderPresetList() {
  const select = $("advancedPresetSelect");
  if (!select) return;
  const presets = await getPresets();
  const names = Object.keys(presets).sort((a, b) => a.localeCompare(b));
  select.innerHTML = names.length
    ? names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")
    : `<option value="">No saved presets yet</option>`;
}

async function saveCurrentPreset() {
  const name = ($("advancedPresetName").value || "").trim() || `preset_${timestampForFile()}`;
  const presets = await getPresets();
  presets[name] = { ...optionsFromUi(), savedAt: new Date().toISOString() };
  await storageSet({ [PRESETS_KEY]: presets });
  $("advancedPresetName").value = name;
  await renderPresetList();
  $("advancedPresetSelect").value = name;
  return name;
}

async function loadSelectedPreset() {
  const name = $("advancedPresetSelect").value;
  if (!name) return { ok: false, error: "No preset selected." };
  const presets = await getPresets();
  const preset = presets[name];
  if (!preset) return { ok: false, error: "Preset not found." };
  const cleanPreset = { ...preset };
  delete cleanPreset.savedAt;
  await storageSet({ [OPTIONS_KEY]: { ...DEFAULTS, ...cleanPreset } });
  await loadOptions();
  return { ok: true, name };
}

async function deleteSelectedPreset() {
  const name = $("advancedPresetSelect").value;
  if (!name) return { ok: false, error: "No preset selected." };
  const presets = await getPresets();
  delete presets[name];
  await storageSet({ [PRESETS_KEY]: presets });
  await renderPresetList();
  return { ok: true, name };
}

async function exportSettingsBundle() {
  const data = await storageGet([OPTIONS_KEY, PRESETS_KEY]);
  const active = await activeTab().catch(() => null);
  const bundle = {
    app: "ARIA Nexus One Hub",
    version: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    activeTab: active ? { title: active.title || "", url: active.url || "" } : null,
    options: { ...DEFAULTS, ...(data[OPTIONS_KEY] || {}) },
    presets: data[PRESETS_KEY] || {}
  };
  return downloadTextFile(
    `ARIA_Nexus_Settings_${timestampForFile()}.json`,
    JSON.stringify(bundle, null, 2)
  );
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read settings file."));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch (err) {
        reject(new Error("Invalid JSON settings file."));
      }
    };
    reader.readAsText(file);
  });
}

async function importSettingsBundle(file) {
  const bundle = await readJsonFile(file);
  const options = bundle.options || bundle[OPTIONS_KEY] || null;
  const presets = bundle.presets || bundle[PRESETS_KEY] || null;
  const update = {};
  if (options && typeof options === "object") update[OPTIONS_KEY] = { ...DEFAULTS, ...options };
  if (presets && typeof presets === "object" && !Array.isArray(presets)) update[PRESETS_KEY] = presets;
  if (!Object.keys(update).length) return { ok: false, error: "Settings file did not contain ARIA options or presets." };
  await storageSet(update);
  await loadOptions();
  await renderPresetList();
  return { ok: true, importedOptions: Boolean(update[OPTIONS_KEY]), importedPresets: Boolean(update[PRESETS_KEY]) };
}

// ARIA v4.8.0 — Feature 13: Export/Import Session State
async function exportSiteProfilesBundle() {
  const data = await storageGet([SITE_PROFILES_KEY]);
  const profiles = data[SITE_PROFILES_KEY] || {};
  const bundle = {
    app: "ARIA Nexus One Hub",
    type: "siteProfiles",
    version: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    count: Object.keys(profiles).length,
    profiles
  };
  return downloadTextFile(
    `ARIA_Nexus_Site_Profiles_${timestampForFile()}.json`,
    JSON.stringify(bundle, null, 2)
  );
}

async function importSiteProfilesBundle(file) {
  const bundle = await readJsonFile(file);
  const incoming = bundle.profiles || bundle[SITE_PROFILES_KEY] || bundle;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return { ok: false, error: "Site profile file did not contain profiles." };
  }
  const existingData = await storageGet([SITE_PROFILES_KEY]);
  const existing = existingData[SITE_PROFILES_KEY] || {};
  const clean = {};
  Object.entries(incoming).forEach(([key, profile]) => {
    if (!profile || typeof profile !== "object") return;
    const nextKey = String(profile.key || key || "").trim();
    if (!nextKey) return;
    clean[nextKey] = {
      ...profile,
      key: nextKey,
      importedAt: new Date().toISOString()
    };
  });
  if (!Object.keys(clean).length) return { ok: false, error: "No valid trained profiles found." };
  const merged = { ...existing, ...clean };
  await storageSet({ [SITE_PROFILES_KEY]: merged });
  return { ok: true, imported: Object.keys(clean).length, total: Object.keys(merged).length };
}
function stateExportAllowed(key, value) {
  if (/jszip|blob|binary/i.test(String(key || ""))) return false;
  if (typeof value === "string" && value.length > 900000) return false;
  return true;
}

async function exportFullStateBundle() {
  const data = await storageGet(null);
  const filtered = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (stateExportAllowed(key, value)) filtered[key] = value;
  });
  const bundle = {
    app: "ARIA Nexus One Hub",
    version: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    storage: filtered
  };
  return downloadTextFile(
    `ARIA_Nexus_State_${timestampForFile()}.json`,
    JSON.stringify(bundle, null, 2)
  );
}

async function importFullStateBundle(file) {
  const bundle = await readJsonFile(file);
  const storage = bundle.storage || bundle;
  if (!storage || typeof storage !== "object" || Array.isArray(storage)) {
    return { ok: false, error: "State file did not contain a storage object." };
  }
  const update = {};
  Object.entries(storage).forEach(([key, value]) => {
    if (stateExportAllowed(key, value)) update[key] = value;
  });
  if (!Object.keys(update).length) return { ok: false, error: "No safe state keys found to import." };
  await storageSet(update);
  await loadOptions();
  await renderPresetList();
  return { ok: true, keys: Object.keys(update).length };
}

async function runAction(type, extra = {}) {
  const tab = await activeTab();
  const options = await saveOptions();
  return sendToTab(tab.id, { type, options, activeTabId: tab.id, ...extra });
}

// ARIA v4.14.0 - Quick Command Launcher: one small command box for safe app/search/site actions.
const QUICK_APP_ALIASES = {
  "notepad": "notepad",
  "note pad": "notepad",
  "wordpad": "wordpad",
  "word pad": "wordpad",
  "word": "word",
  "ms word": "word",
  "microsoft word": "word",
  "excel": "excel",
  "powerpoint": "powerpoint",
  "power point": "powerpoint",
  "ppt": "powerpoint",
  "vscode": "vscode",
  "vs code": "vscode",
  "visual studio code": "vscode",
  "cursor": "cursor",
  "android studio": "android_studio",
  "androidstudio": "android_studio",
  "studio": "android_studio",
  "chrome": "chrome",
  "google chrome": "chrome",
  "edge": "edge",
  "microsoft edge": "edge",
  "explorer": "explorer",
  "file explorer": "explorer",
  "files": "explorer",
  "calculator": "calculator",
  "calc": "calculator",
  "paint": "paint",
  "cmd": "cmd",
  "command prompt": "cmd",
  "powershell": "powershell",
  "whatsapp": "whatsapp",
  "chatgpt app": "chatgpt",
  "codex": "codex"
};

const QUICK_SITE_URLS = {
  "chatgpt": "https://chatgpt.com/",
  "gpt": "https://chatgpt.com/",
  "claude": "https://claude.ai/",
  "gemini": "https://gemini.google.com/app",
  "google ai studio": "https://aistudio.google.com/",
  "ai studio": "https://aistudio.google.com/",
  "aistudio": "https://aistudio.google.com/",
  "clickup": "https://app.clickup.com/",
  "manus": "https://manus.im/",
  "deepseek": "https://chat.deepseek.com/",
  "notebooklm": "https://notebooklm.google.com/",
  "notebook lm": "https://notebooklm.google.com/",
  "google": "https://www.google.com/"
};

function normalizeQuickCommand(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function quickCommandHelpText() {
  return [
    "Quick commands:",
    "open word / open excel / open chrome / open explorer",
    "open chatgpt / open claude / open gemini / open ai studio / open clickup",
    "search web ai tools",
    "search files invoice",
    "run / start",
    "stop / pause",
    "status / check",
    "money brief / revenue brief",
    "fill money draft / revenue draft",
    "tool radar [goal]",
    "open best tool [goal]",
    "fill tool prompt [goal]",
    "recipe [goal]",
    "fill recipe [goal]",
    "copy recipe",
    "queue [goal]",
    "load queue [goal]",
    "start queue [goal]",
    "reload extension"
  ].join("\n");
}

function stripCommandPrefix(command, prefixes) {
  const lower = command.toLowerCase();
  for (const prefix of prefixes) {
    if (lower === prefix) return "";
    if (lower.startsWith(`${prefix} `)) return command.slice(prefix.length).trim();
  }
  return "";
}

// ARIA v4.16.0 - AI Tool Radar / verified tool router.
function inferToolRadarKind(goal, selectedType) {
  const type = String(selectedType || "auto").toLowerCase();
  if (type && type !== "auto") return type;
  const text = String(goal || "").toLowerCase();
  if (/\b(security|audit|vulnerability|vuln|threat|pentest|privacy|risk)\b/.test(text)) return "security";
  if (/\b(video|reel|short|tiktok|youtube|heygen|kling|caption|script|thumbnail)\b/.test(text)) return "video";
  if (/\b(social|facebook|instagram|linkedin|twitter|x\.com|campaign|post|growth|lead)\b/.test(text)) return "social";
  if (/\b(research|market|competitor|brief|report|latest|compare|analysis)\b/.test(text)) return "research";
  if (/\b(error|bug|debug|fix|test|failing|crash|trace|logs|refactor)\b/.test(text)) return "debug";
  if (/\b(app|website|web app|landing|dashboard|ui|frontend|saas|prototype|bolt|lovable|v0)\b/.test(text)) return "webapp";
  if (/\b(sheet|excel|csv|database|data|automation|workflow|api|etl)\b/.test(text)) return "data";
  return "code";
}

function toolRadarRecommendation(goal, selectedType) {
  const kind = inferToolRadarKind(goal, selectedType);
  const common = {
    kind,
    goal: String(goal || "").trim() || "Build the next useful step for my current project",
    stack: ["ChatGPT/Codex", "Claude Code", "Google AI Studio", "Gemini CLI", "Cursor"],
    url: "https://chatgpt.com/",
    tool: "ChatGPT / Codex",
    why: "Best general starting point for coding, planning, and agent handoff.",
    mode: "agent handoff"
  };
  const byKind = {
    code: {
      tool: "Claude Code or ChatGPT Codex",
      url: "https://claude.ai/",
      why: "Use this for multi-file code generation, repo planning, and implementation instructions.",
      stack: ["Claude Code", "ChatGPT/Codex", "Gemini CLI", "Cursor"],
      mode: "repo agent"
    },
    debug: {
      tool: "Claude Code / Cursor",
      url: "https://claude.ai/",
      why: "Use this for bug isolation, patch plans, test-driven fixes, and code review.",
      stack: ["Claude Code", "Cursor", "ChatGPT/Codex"],
      mode: "debug agent"
    },
    webapp: {
      tool: "Google AI Studio + v0/Lovable/Bolt",
      url: "https://aistudio.google.com/",
      why: "Use this for fast app prototypes, UI flows, and Gemini prompt-to-app experiments.",
      stack: ["Google AI Studio", "v0", "Lovable", "Bolt", "ChatGPT"],
      mode: "prototype builder"
    },
    research: {
      tool: "Gemini / Perplexity-style research + ChatGPT synthesis",
      url: "https://gemini.google.com/app",
      why: "Use this for source-backed research, comparison, market scans, and clear reports.",
      stack: ["Gemini", "ChatGPT", "Claude"],
      mode: "research brief"
    },
    video: {
      tool: "ChatGPT creative brief + HeyGen/Kling pipeline",
      url: "https://chatgpt.com/",
      why: "Use this for video topics, scripts, shot lists, captions, and publishing checklists.",
      stack: ["ChatGPT", "Google AI Studio", "HeyGen", "Kling", "ARIA video helper"],
      mode: "creative pipeline"
    },
    social: {
      tool: "ChatGPT social strategy + ARIA social draft tools",
      url: "https://chatgpt.com/",
      why: "Use this for ethical captions, campaign calendars, follow-up scripts, and post drafts.",
      stack: ["ChatGPT", "Claude", "ARIA social draft", "Google Sheets"],
      mode: "social campaign"
    },
    security: {
      tool: "Claude Code / Codex security review",
      url: "https://claude.ai/",
      why: "Use this for threat modeling, secure refactors, and vulnerability-focused review.",
      stack: ["Claude Code", "ChatGPT/Codex", "Cursor"],
      mode: "security review"
    },
    data: {
      tool: "Gemini CLI / ChatGPT automation planner",
      url: "https://github.com/google-gemini/gemini-cli",
      why: "Use this for local terminal automation, data transforms, CSV/Sheets workflows, and scripts.",
      stack: ["Gemini CLI", "ChatGPT", "Google Sheets", "ARIA desktop bridge"],
      mode: "data automation"
    }
  };
  return { ...common, ...(byKind[kind] || {}) };
}

function toolRadarPrompt(rec) {
  const goal = rec.goal || "Build the next useful step for my project";
  return [
    `Goal: ${goal}`,
    "",
    `Recommended workflow: ${rec.tool}`,
    `Mode: ${rec.mode}`,
    `Why this tool: ${rec.why}`,
    `Suggested stack: ${(rec.stack || []).join(" -> ")}`,
    "",
    "Act as a senior AI product/coding operator. Help me move this task forward safely and practically.",
    "",
    "Rules:",
    "1. If required context is missing, ask only the smallest blocking questions.",
    "2. If you can proceed, give a concrete step-by-step execution plan.",
    "3. For code, include file paths, complete snippets, commands, and test steps.",
    "4. For research, separate verified facts, assumptions, and next actions.",
    "5. For social/public actions, prepare drafts only; do not ask me to spam or bypass platform rules.",
    "6. End with the exact next prompt I should send if more work remains.",
    "",
    "Output format:",
    "- Best tool/workflow",
    "- Execution plan",
    "- Files or assets needed",
    "- Risks/limits",
    "- Next action"
  ].join("\n");
}

function toolRadarPlanText(rec) {
  return [
    "AI Tool Radar recommendation",
    `Tool: ${rec.tool}`,
    `Workflow: ${rec.mode}`,
    `Open: ${rec.url}`,
    `Why: ${rec.why}`,
    `Stack: ${(rec.stack || []).join(" -> ")}`,
    "",
    "Ready prompt:",
    toolRadarPrompt(rec)
  ].join("\n");
}

async function runToolRadar({ openTool = false, fillPrompt = false, goalOverride = "" } = {}) {
  const saved = await saveOptions();
  const goal = String(goalOverride || ($("toolRadarGoal") && $("toolRadarGoal").value) || saved.toolRadarGoal || "").trim();
  const rec = toolRadarRecommendation(goal, ($("toolRadarType") && $("toolRadarType").value) || saved.toolRadarType || "auto");
  const prompt = toolRadarPrompt(rec);
  await storageSet({
    [OPTIONS_KEY]: {
      ...saved,
      toolRadarGoal: goal,
      toolRadarType: ($("toolRadarType") && $("toolRadarType").value) || saved.toolRadarType || "auto",
      toolRadarLastPrompt: prompt,
      toolRadarLastUrl: rec.url
    }
  });
  if (openTool) {
    await createTab(rec.url, true);
  }
  if (fillPrompt) {
    const reply = await runAction("ARIA_SUPER_TOOL_PROMPT_FILL", { text: prompt });
    if (!reply || !reply.ok) {
      return { ok: false, message: `${toolRadarPlanText(rec)}\n\nFill failed: ${(reply && reply.error) || "no input found"}` };
    }
    return { ok: true, message: `${toolRadarPlanText(rec)}\n\nFilled current tab input. Review and send when ready.` };
  }
  return { ok: true, message: toolRadarPlanText(rec) };
}

// ARIA v4.17.0 - Prompt Recipe Builder: reusable high-quality prompt templates for safe agent work.
function recipeTypeProfile(type) {
  const key = String(type || "code").toLowerCase();
  const profiles = {
    code: {
      title: "Code build recipe",
      role: "senior full-stack engineer and repo operator",
      outcome: "working implementation with clear file paths, commands, and tests",
      sections: ["Architecture", "Files to create or edit", "Implementation steps", "Test plan", "Edge cases", "Next prompt if more work remains"]
    },
    debug: {
      title: "Debug and fix recipe",
      role: "principal debugging engineer",
      outcome: "root-cause analysis, minimal patch, and verification checklist",
      sections: ["Observed behavior", "Likely causes", "Exact investigation commands", "Minimal fix", "Regression tests", "Rollback plan"]
    },
    research: {
      title: "Research report recipe",
      role: "research analyst with source discipline",
      outcome: "clear brief with verified facts, assumptions, risks, and next actions",
      sections: ["Question", "Known facts", "Research plan", "Findings table", "Risks and uncertainty", "Actionable recommendation"]
    },
    social: {
      title: "Social campaign recipe",
      role: "ethical growth strategist and copywriter",
      outcome: "platform-ready drafts that remain user-approved before public posting",
      sections: ["Audience", "Offer angle", "Content calendar", "Captions", "CTA", "Safety and platform rules"]
    },
    video: {
      title: "Video/content pipeline recipe",
      role: "short-form video producer and automation planner",
      outcome: "topic list, scripts, shot list, captions, asset checklist, and upload plan",
      sections: ["Hook ideas", "Script", "Scene list", "Voice/caption notes", "Asset checklist", "Posting checklist"]
    },
    automation: {
      title: "Automation workflow recipe",
      role: "automation architect",
      outcome: "safe repeatable workflow with triggers, guards, logs, and manual approvals for public actions",
      sections: ["Trigger", "Inputs", "Workflow steps", "Human checkpoints", "Failure handling", "Logs and metrics"]
    },
    handoff: {
      title: "Agent handoff recipe",
      role: "AI project manager",
      outcome: "clean handoff package for another AI coding agent or app builder",
      sections: ["Goal", "Current state", "Files/context needed", "Tasks", "Acceptance criteria", "Next command"]
    }
  };
  return profiles[key] || profiles.code;
}

function buildPromptRecipe({ goal, type, constraints } = {}) {
  const profile = recipeTypeProfile(type);
  const cleanGoal = String(goal || "").trim() || "Move my current project forward with the highest-impact next step";
  const cleanConstraints = String(constraints || "").trim() || "Keep changes scoped, preserve existing behavior, include verification steps, and keep public/social actions manual unless I explicitly confirm.";
  return [
    `${profile.title}`,
    "",
    `Goal: ${cleanGoal}`,
    `Role: Act as a ${profile.role}.`,
    `Expected outcome: ${profile.outcome}.`,
    "",
    "Constraints:",
    cleanConstraints,
    "",
    "Operating rules:",
    "1. Ask only blocking questions. If assumptions are reasonable, state them and proceed.",
    "2. Prefer the existing project structure and do not remove working features.",
    "3. For code tasks, give complete file paths, exact patches or snippets, commands, and tests.",
    "4. For AI/social/content tasks, prepare drafts and checklists; do not perform public actions without explicit confirmation.",
    "5. When the response is long, split it into numbered parts and end with a clear next prompt.",
    "",
    "Required sections:",
    ...profile.sections.map((section, index) => `${index + 1}. ${section}`),
    "",
    "Now execute the recipe for the goal above."
  ].join("\n");
}

async function currentRecipePrompt(goalOverride = "") {
  const saved = await saveOptions();
  const goal = String(goalOverride || ($("recipeGoal") && $("recipeGoal").value) || saved.recipeGoal || "").trim();
  const type = ($("recipeType") && $("recipeType").value) || saved.recipeType || "code";
  const constraints = ($("recipeConstraints") && $("recipeConstraints").value) || saved.recipeConstraints || "";
  const prompt = buildPromptRecipe({ goal, type, constraints });
  await storageSet({
    [OPTIONS_KEY]: {
      ...saved,
      recipeGoal: goal,
      recipeType: type,
      recipeConstraints: constraints,
      recipeLastPrompt: prompt
    }
  });
  return { ok: true, goal, type, constraints, prompt };
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.focus();
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

async function runRecipeBuilder({ copy = false, fill = false, goalOverride = "" } = {}) {
  const recipe = await currentRecipePrompt(goalOverride);
  if (copy) {
    await copyTextToClipboard(recipe.prompt);
    return { ok: true, message: `Recipe copied.\nType: ${recipe.type}\nGoal: ${recipe.goal || "(default goal)"}\n\n${recipe.prompt}` };
  }
  if (fill) {
    const reply = await runAction("ARIA_SUPER_TOOL_PROMPT_FILL", { text: recipe.prompt });
    if (!reply || !reply.ok) {
      return { ok: false, message: `Recipe built but fill failed: ${(reply && reply.error) || "no input found"}\n\n${recipe.prompt}` };
    }
    return { ok: true, message: `Recipe filled into current tab. Review and send.\nType: ${recipe.type}\nGoal: ${recipe.goal || "(default goal)"}` };
  }
  return { ok: true, message: recipe.prompt };
}

// ARIA v4.18.0 - Prompt Queue Wizard: convert one goal into a response-aware multi-prompt queue.
function queueWizardPhaseNames(style, count) {
  const templates = {
    build: ["requirements", "architecture", "file map", "core implementation", "UI/UX", "data/storage", "tests", "run/debug", "docs", "deployment"],
    debug: ["symptom summary", "reproduction", "root cause", "minimal patch", "regression tests", "edge cases", "verification", "cleanup"],
    research: ["scope", "source plan", "market scan", "comparison table", "risks", "opportunities", "recommendation", "action plan"],
    content: ["audience", "angles", "post drafts", "caption set", "visual prompts", "calendar", "CTA variants", "review checklist"],
    handoff: ["context summary", "asset list", "task breakdown", "acceptance criteria", "agent prompt", "handoff checklist", "final package"]
  };
  const list = templates[style] || templates.build;
  const phases = [];
  for (let i = 0; i < count; i += 1) {
    phases.push(list[i] || `step ${i + 1}`);
  }
  return phases;
}

function buildQueuePromptText(goal, style, phase, index, total) {
  const cleanGoal = String(goal || "").trim() || "Move my current project forward";
  const styleLabel = {
    build: "project build",
    debug: "debug/fix",
    research: "research/report",
    content: "content/social",
    handoff: "agent handoff"
  }[style] || "project build";
  return [
    `Prompt ${index + 1}/${total} - ${phase}`,
    "",
    `Goal: ${cleanGoal}`,
    `Workflow: ${styleLabel}`,
    "",
    "Do this step only, but make it complete and useful.",
    "Include:",
    "1. The concrete output for this step.",
    "2. Any files, commands, assets, or data needed.",
    "3. Risks or assumptions.",
    "4. The exact next prompt to send if this step needs continuation.",
    "",
    "Keep existing project behavior safe. Do not perform public/social actions; prepare drafts/checklists unless I explicitly confirm."
  ].join("\n");
}

function buildPromptQueue({ source, count, style } = {}) {
  const total = Math.max(2, Math.min(50, Number.parseInt(count || "8", 10) || 8));
  const queueStyle = String(style || "build").toLowerCase();
  const goal = String(source || "").trim() || "Build the next highest-value feature for my ARIA automation project";
  const phases = queueWizardPhaseNames(queueStyle, total);
  return phases.map((phase, index) => buildQueuePromptText(goal, queueStyle, phase, index, total)).join("\n\n---\n\n");
}

async function currentQueueWizard(goalOverride = "") {
  const saved = await saveOptions();
  const source = String(goalOverride || ($("queueWizardSource") && $("queueWizardSource").value) || saved.queueWizardSource || "").trim();
  const count = ($("queueWizardCount") && $("queueWizardCount").value) || saved.queueWizardCount || "8";
  const style = ($("queueWizardStyle") && $("queueWizardStyle").value) || saved.queueWizardStyle || "build";
  const queue = buildPromptQueue({ source, count, style });
  await storageSet({
    [OPTIONS_KEY]: {
      ...saved,
      queueWizardSource: source,
      queueWizardCount: String(Math.max(2, Math.min(50, Number.parseInt(count || "8", 10) || 8))),
      queueWizardStyle: style,
      queueWizardLastQueue: queue
    }
  });
  return { ok: true, source, count: Number.parseInt(count || "8", 10) || 8, style, queue };
}

async function runQueueWizard({ copy = false, load = false, start = false, goalOverride = "" } = {}) {
  const built = await currentQueueWizard(goalOverride);
  if (copy) {
    await copyTextToClipboard(built.queue);
    return { ok: true, message: `Prompt queue copied.\nStyle: ${built.style}\nPrompts: ${built.count}\n\n${built.queue}` };
  }
  if (load || start) {
    if ($("promptQueue")) $("promptQueue").value = built.queue;
    if ($("usePromptQueue")) $("usePromptQueue").checked = true;
    if ($("sendPromptFirst")) $("sendPromptFirst").checked = false;
    if ($("sendMode")) $("sendMode").value = "numbers";
    await saveOptions();
    if (start) {
      const reply = await runAction("ARIA_SUPER_START", { resetPromptFirst: true });
      if (!reply || !reply.ok) {
        return { ok: false, message: `Queue loaded, but start failed: ${(reply && reply.error) || "no reply"}` };
      }
      return { ok: true, message: `Queue loaded and automation started.\nStyle: ${built.style}\nPrompts: ${built.count}` };
    }
    return { ok: true, message: `Queue loaded into Prompt Queue.\nEnable/Start current tab when ready.\nStyle: ${built.style}\nPrompts: ${built.count}` };
  }
  return { ok: true, message: built.queue };
}

async function openQuickApp(appName) {
  const normalized = normalizeQuickCommand(appName).toLowerCase();
  const app = QUICK_APP_ALIASES[normalized] || normalized;
  if (!Object.values(QUICK_APP_ALIASES).includes(app)) {
    return { ok: false, message: `App not allowed: ${appName}\n\n${quickCommandHelpText()}` };
  }
  const data = await localServerJson("/api/desktop/open-app", { app });
  return { ok: true, message: data.message || `Opened ${app}.` };
}

async function runQuickCommand(raw) {
  const command = normalizeQuickCommand(raw);
  const lower = command.toLowerCase();
  if (!command) return { ok: false, message: quickCommandHelpText() };

  if (["help", "commands", "?", "/help"].includes(lower)) {
    return { ok: true, message: quickCommandHelpText() };
  }

  if (["run", "start", "start automation", "run current tab", "start current tab"].includes(lower)) {
    const reply = await runAction("ARIA_SUPER_START", { resetPromptFirst: true });
    return {
      ok: Boolean(reply && reply.ok),
      message: reply && reply.ok ? (reply.message || "Automation started on current tab.") : `Run failed: ${(reply && reply.error) || "no reply"}`
    };
  }

  if (["stop", "pause", "stop automation", "pause automation"].includes(lower)) {
    const reply = await runAction("ARIA_SUPER_STOP");
    return {
      ok: Boolean(reply && reply.ok),
      message: reply && reply.ok ? (reply.message || "Automation stopped on current tab.") : `Stop failed: ${(reply && reply.error) || "no reply"}`
    };
  }

  if (["status", "check", "check tab", "tab status"].includes(lower)) {
    const reply = await runAction("ARIA_SUPER_STATUS");
    if (!reply || !reply.ok) return { ok: false, message: `Status failed: ${(reply && reply.error) || "no reply"}` };
    return {
      ok: true,
      message: `Status on ${reply.site || "website"}\nRunning: ${reply.running ? "YES" : "NO"}\nSent: ${reply.runCount || 0}${reply.stopAfterN ? `/${reply.stopAfterN}` : ""}\nNext: ${reply.nextText || ""}\nBusy: ${reply.busy ? "YES" : "NO"}\nCopy allowed: ${reply.responseCopyAllowed ? "YES" : "NO"}`
    };
  }

  if (["reload", "reload extension", "restart extension"].includes(lower)) {
    await sendRuntime({ type: "ARIA_SUPER_RELOAD_EXTENSION" });
    return { ok: true, message: "Reloading ARIA Nexus One Hub..." };
  }

  let radarGoal = stripCommandPrefix(command, ["tool radar", "ai tool radar", "best tool", "best ai tool"]);
  if (radarGoal || ["tool radar", "ai tool radar", "best tool", "best ai tool"].includes(lower)) {
    if (radarGoal && $("toolRadarGoal")) $("toolRadarGoal").value = radarGoal;
    return runToolRadar({ goalOverride: radarGoal });
  }

  radarGoal = stripCommandPrefix(command, ["open best tool", "open ai tool", "open recommended tool"]);
  if (radarGoal || ["open best tool", "open ai tool", "open recommended tool"].includes(lower)) {
    if (radarGoal && $("toolRadarGoal")) $("toolRadarGoal").value = radarGoal;
    return runToolRadar({ openTool: true, goalOverride: radarGoal });
  }

  radarGoal = stripCommandPrefix(command, ["fill tool prompt", "fill ai prompt", "tool prompt"]);
  if (radarGoal || ["fill tool prompt", "fill ai prompt", "tool prompt"].includes(lower)) {
    if (radarGoal && $("toolRadarGoal")) $("toolRadarGoal").value = radarGoal;
    return runToolRadar({ fillPrompt: true, goalOverride: radarGoal });
  }

  // ARIA v4.17.0 - Prompt Recipe Builder quick commands.
  let recipeGoal = stripCommandPrefix(command, ["recipe", "build recipe", "prompt recipe", "make recipe"]);
  if (recipeGoal || ["recipe", "build recipe", "prompt recipe", "make recipe"].includes(lower)) {
    if (recipeGoal && $("recipeGoal")) $("recipeGoal").value = recipeGoal;
    return runRecipeBuilder({ goalOverride: recipeGoal });
  }

  recipeGoal = stripCommandPrefix(command, ["fill recipe", "fill recipe prompt", "send recipe prompt"]);
  if (recipeGoal || ["fill recipe", "fill recipe prompt", "send recipe prompt"].includes(lower)) {
    if (recipeGoal && $("recipeGoal")) $("recipeGoal").value = recipeGoal;
    return runRecipeBuilder({ fill: true, goalOverride: recipeGoal });
  }

  recipeGoal = stripCommandPrefix(command, ["copy recipe", "copy recipe prompt"]);
  if (recipeGoal || ["copy recipe", "copy recipe prompt"].includes(lower)) {
    if (recipeGoal && $("recipeGoal")) $("recipeGoal").value = recipeGoal;
    return runRecipeBuilder({ copy: true, goalOverride: recipeGoal });
  }

  // ARIA v4.18.0 - Prompt Queue Wizard quick commands.
  let queueGoal = stripCommandPrefix(command, ["queue", "build queue", "prompt queue", "make queue"]);
  if (queueGoal || ["queue", "build queue", "prompt queue", "make queue"].includes(lower)) {
    if (queueGoal && $("queueWizardSource")) $("queueWizardSource").value = queueGoal;
    return runQueueWizard({ goalOverride: queueGoal });
  }

  queueGoal = stripCommandPrefix(command, ["copy queue", "copy prompt queue"]);
  if (queueGoal || ["copy queue", "copy prompt queue"].includes(lower)) {
    if (queueGoal && $("queueWizardSource")) $("queueWizardSource").value = queueGoal;
    return runQueueWizard({ copy: true, goalOverride: queueGoal });
  }

  queueGoal = stripCommandPrefix(command, ["load queue", "load prompt queue"]);
  if (queueGoal || ["load queue", "load prompt queue"].includes(lower)) {
    if (queueGoal && $("queueWizardSource")) $("queueWizardSource").value = queueGoal;
    return runQueueWizard({ load: true, goalOverride: queueGoal });
  }

  queueGoal = stripCommandPrefix(command, ["start queue", "run queue", "load and start queue"]);
  if (queueGoal || ["start queue", "run queue", "load and start queue"].includes(lower)) {
    if (queueGoal && $("queueWizardSource")) $("queueWizardSource").value = queueGoal;
    return runQueueWizard({ start: true, goalOverride: queueGoal });
  }

  if (["money brief", "revenue brief", "business brief", "make money brief", "make revenue brief"].includes(lower)) {
    const reply = await runAction("ARIA_SUPER_REVENUE_BRIEF", { social: socialPayload() });
    return {
      ok: Boolean(reply && reply.ok),
      message: reply && reply.ok ? (reply.message || "Money brief ready.") : `Money brief failed: ${(reply && reply.error) || "no reply"}`
    };
  }

  if (["fill money draft", "money draft", "revenue draft", "fill revenue draft", "business draft"].includes(lower)) {
    const reply = await runAction("ARIA_SUPER_REVENUE_FILL_DRAFT", { social: socialPayload() });
    return {
      ok: Boolean(reply && reply.ok),
      message: reply && reply.ok ? (reply.message || "Money draft filled.") : `Money draft failed: ${(reply && reply.error) || "no reply"}`
    };
  }

  let target = stripCommandPrefix(command, ["open", "launch", "start app"]);
  if (target) {
    const targetLower = target.toLowerCase();
    if (QUICK_SITE_URLS[targetLower]) {
      await createTab(QUICK_SITE_URLS[targetLower], true);
      return { ok: true, message: `Opened ${target}.` };
    }
    return openQuickApp(target);
  }

  target = stripCommandPrefix(command, ["search web", "google search", "search google", "google"]);
  if (target) {
    await createTab(`https://www.google.com/search?q=${encodeURIComponent(target)}`, true);
    return { ok: true, message: `Opened Google search: ${target}` };
  }

  target = stripCommandPrefix(command, ["search files", "search file", "search windows", "windows search", "search pc", "search desktop"]);
  if (target) {
    const data = await localServerJson("/api/desktop/search", { query: target, mode: "windows" });
    return { ok: true, message: data.message || `Opened Windows search: ${target}` };
  }

  target = stripCommandPrefix(command, ["search"]);
  if (target) {
    await createTab(`https://www.google.com/search?q=${encodeURIComponent(target)}`, true);
    return { ok: true, message: `Opened Google search: ${target}` };
  }

  return { ok: false, message: `Unknown quick command: ${command}\n\n${quickCommandHelpText()}` };
}

async function siteProfileAction(type) {
  // ARIA v4.11.0 - Site Trainer Pro: popup controls for learned site selectors.
  try {
    const reply = await runAction(type);
    setStatus(reply && reply.ok ? (reply.message || "Site profile action complete.") : `Error: ${(reply && reply.error) || "Site profile action failed."}`);
  } catch (err) {
    setStatus(`Site trainer error: ${err.message}`);
  }
}

async function openFullPanel() {
  const tab = await activeTab();
  const url = chrome.runtime.getURL(`popup.html?panel=1&targetTabId=${encodeURIComponent(tab.id)}`);
  await createTab(url, true);
}

async function runSameSiteTabs() {
  const current = await activeTab();
  const targetHost = hostKey(current.url);
  const options = await saveOptions();
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => supportedUrl(tab.url) && hostKey(tab.url) === targetHost);
  let ok = 0;
  let failed = 0;
  for (const tab of targets) {
    const reply = await sendToTab(tab.id, { type: "ARIA_SUPER_START", options, activeTabId: tab.id, resetPromptFirst: true });
    if (reply && reply.ok) ok += 1;
    else failed += 1;
  }
  return { ok, failed, total: targets.length, host: targetHost };
}

async function runTabs(targets, label) {
  const options = await saveOptions();
  let ok = 0;
  let failed = 0;
  const errors = [];
  for (const tab of targets) {
    const reply = await sendToTab(tab.id, { type: "ARIA_SUPER_START", options, activeTabId: tab.id, resetPromptFirst: true });
    if (reply && reply.ok) ok += 1;
    else {
      failed += 1;
      errors.push(`${tab.title || tab.url}: ${(reply && reply.error) || "failed"}`);
    }
  }
  return { ok, failed, total: targets.length, label, errors: errors.slice(0, 5) };
}

async function runAiCodingTabs() {
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => supportedUrl(tab.url) && aiCodingHost(tab.url) && !blockedBulkHost(tab.url));
  return runTabs(targets, "AI/Coding tabs");
}

async function runCurrentWindowTabs() {
  const current = await activeTab();
  const tabs = await chrome.tabs.query({ windowId: current.windowId });
  const targets = tabs.filter((tab) => supportedUrl(tab.url) && !blockedBulkHost(tab.url));
  return runTabs(targets, "current window tabs");
}

async function runAllSafeTabs() {
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => supportedUrl(tab.url) && !blockedBulkHost(tab.url));
  return runTabs(targets, "all safe tabs");
}

function formatDiagnosis(tab, reply) {
  const title = (tab.title || tab.url || "tab").replace(/\s+/g, " ").slice(0, 52);
  if (!reply || !reply.ok) return `FAIL ${title} | ${(reply && reply.error) || "no reply"}`;
  const input = reply.inputFound ? "input" : "no-input";
  const action = reply.actionButtonFound ? `action:${reply.actionButtonLabel || "button"}` : "no-action";
  const busy = reply.busy ? `busy:${reply.busyReason}` : "ready";
  const running = reply.running ? "RUN" : "idle";
  return `${reply.ready ? "OK" : "WAIT"} ${title} | ${input} | ${action} | ${busy} | ${running}`;
}

async function diagnoseTabs(targets, label) {
  let ok = 0;
  let failed = 0;
  const lines = [];
  for (const tab of targets) {
    const reply = await sendToTab(tab.id, { type: "ARIA_SUPER_DIAGNOSE", activeTabId: tab.id });
    if (reply && reply.ok) ok += 1;
    else failed += 1;
    lines.push(formatDiagnosis(tab, reply));
  }
  return { label, ok, failed, total: targets.length, lines };
}

async function diagnoseAiCodingTabs() {
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => supportedUrl(tab.url) && aiCodingHost(tab.url) && !blockedBulkHost(tab.url));
  return diagnoseTabs(targets, "AI/Coding tabs");
}

async function diagnoseAllSafeTabs() {
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => supportedUrl(tab.url) && !blockedBulkHost(tab.url));
  return diagnoseTabs(targets, "all safe tabs");
}

function injectContentScript(tabId) {
  return new Promise((resolve) => {
    if (!chrome.scripting || !chrome.scripting.executeScript) {
      resolve({ ok: false, error: "chrome.scripting is not available." });
      return;
    }
    chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve({ ok: true });
    });
  });
}

function doctorAdvice(reply) {
  if (!reply || !reply.ok) return "Click Repair Current Tab. If it still fails, refresh the website tab and try again.";
  if (reply.busy) return `Wait. The page is still responding: ${reply.busyReason || "busy"}.`;
  if (reply.ready && reply.inputFound) return "Ready. Use Run This Tab, One-Click Start, or Basit Automate Word.";
  if (reply.ready && reply.actionButtonFound) return "Ready. ARIA found a safe action button and can continue.";
  if (!reply.inputFound && !reply.actionButtonFound) return "Open the real chat/composer/input area, then click Repair Current Tab.";
  return reply.message || "Use One-Click Start Current Site.";
}

async function automationDoctor() {
  const tab = await activeTab();
  await saveOptions();
  const [diagnosis, health] = await Promise.all([
    sendToTab(tab.id, { type: "ARIA_SUPER_DIAGNOSE", activeTabId: tab.id }),
    sendRuntime({ type: "ARIA_SUPER_HEALTH_CHECK" })
  ]);
  const lines = [
    "ARIA Automation Doctor",
    `Extension: ${health && health.version ? `v${health.version}` : "unknown"}`,
    `Tab: ${(tab.title || tab.url || "tab").replace(/\s+/g, " ").slice(0, 70)}`,
    `Site: ${diagnosis && diagnosis.site ? diagnosis.site : hostKey(tab.url)}`,
    `Mode: ${diagnosis && diagnosis.mode ? diagnosis.mode : $("mode").value}`,
    `Input: ${diagnosis && diagnosis.inputFound ? diagnosis.inputLabel || "found" : "not found"}`,
    `Action: ${diagnosis && diagnosis.actionButtonFound ? diagnosis.actionButtonLabel || "found" : "not found"}`,
    `Trained profile: ${diagnosis && diagnosis.siteProfileReady ? "YES" : "NO"}${diagnosis && diagnosis.siteProfileKey ? ` (${diagnosis.siteProfileKey})` : ""}`,
    `Response block: ${diagnosis && diagnosis.responseFound ? "found" : "not found"}${diagnosis && diagnosis.trainedResponseFound ? " | trained selector matched" : ""}`,
    `Busy: ${diagnosis && diagnosis.busy ? diagnosis.busyReason || "yes" : "no"}`,
    `Running this tab: ${diagnosis && diagnosis.running ? "YES" : "NO"}`,
    `Running tabs: ${health && health.runningTabs !== undefined ? health.runningTabs : "unknown"}`,
    `Groq: ${health && health.groqApiKeySet ? health.groqApiKeyMasked : "not saved"}`,
    `Advice: ${doctorAdvice(diagnosis)}`
  ];
  return lines.join("\n");
}

async function desktopBridgeDoctor() {
  const data = await localServerJson("/api/desktop/doctor", {});
  const apps = Array.isArray(data.apps) ? data.apps : [];
  const found = apps.filter((app) => app.found).length;
  const lines = [
    "ARIA Desktop Bridge Doctor",
    `Server: ${data.server || "http://127.0.0.1:5050"}`,
    `Desktop targets ready: ${found}/${apps.length}`,
    "",
    ...apps.map((app) => {
      const mark = app.found ? "OK" : "MISS";
      const path = app.path ? ` -> ${app.path}` : "";
      return `[${mark}] ${app.label || app.key}${path}`;
    }),
    "",
    "Use:",
    "1. Select Desktop target / Coding target.",
    "2. Click Open target if needed.",
    "3. Use Latest -> target, All -> target, Word Doc -> target, or desktop paste.",
    "",
    "If Android Studio is MISS: install it normally, or add studio64.exe to PATH, then restart ARIA."
  ];
  return lines.join("\n");
}

async function repairCurrentTab() {
  const tab = await activeTab();
  setStatus("Repairing current tab...");
  const injected = await injectContentScript(tab.id);
  if (!injected.ok) return `Repair failed: ${injected.error}`;
  await new Promise((resolve) => setTimeout(resolve, 350));
  const reply = await sendToTab(tab.id, { type: "ARIA_SUPER_DIAGNOSE", activeTabId: tab.id });
  if (!reply || !reply.ok) {
    return `Repair injected the helper, but diagnose failed: ${(reply && reply.error) || "no reply"}`;
  }
  return [
    "Repair complete.",
    `Site: ${reply.site}`,
    `Input: ${reply.inputFound ? reply.inputLabel || "found" : "not found"}`,
    `Action: ${reply.actionButtonFound ? reply.actionButtonLabel || "found" : "not found"}`,
    `Busy: ${reply.busy ? reply.busyReason : "no"}`,
    `Next: ${reply.nextText || ""}`,
    `Advice: ${doctorAdvice(reply)}`
  ].join("\n");
}

async function stopRunningTabs() {
  const status = await sendRuntime({ type: "ARIA_SUPER_GET_RUNNERS" });
  const ids = status && status.runners ? Object.keys(status.runners).map((id) => Number.parseInt(id, 10)).filter(Number.isFinite) : [];
  let stopped = 0;
  for (const tabId of ids) {
    const reply = await sendToTab(tabId, { type: "ARIA_SUPER_STOP", activeTabId: tabId });
    if (reply && reply.ok) stopped += 1;
  }
  return { stopped, total: ids.length };
}

async function emergencyStopAllTabs() {
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => supportedUrl(tab.url));
  let stopped = 0;
  let failed = 0;
  for (const tab of targets) {
    const reply = await sendToTab(tab.id, { type: "ARIA_SUPER_STOP", activeTabId: tab.id, emergencyStop: true });
    if (reply && reply.ok) stopped += 1;
    else failed += 1;
  }
  return { stopped, failed, total: targets.length };
}

async function systemSnapshot() {
  const [tabs, health, runners, vault, daily] = await Promise.all([
    chrome.tabs.query({}),
    sendRuntime({ type: "ARIA_SUPER_HEALTH_CHECK" }),
    sendRuntime({ type: "ARIA_SUPER_GET_RUNNERS" }),
    sendRuntime({ type: "ARIA_RESPONSE_VAULT_LIST" }),
    sendRuntime({ type: "ARIA_SUPER_DAILY_STATS" })
  ]);
  const active = await activeTab().catch(() => null);
  const supported = tabs.filter((tab) => supportedUrl(tab.url));
  const aiTabs = supported.filter((tab) => aiCodingHost(tab.url));
  const safeTabs = supported.filter((tab) => !blockedBulkHost(tab.url));
  const running = runners && runners.runners ? Object.values(runners.runners) : [];
  const rows = vault && Array.isArray(vault.responses) ? vault.responses : [];
  const selected = rows.filter((row) => row.selected !== false).length;
  const limitGuard = $("limitGuardEnabled").checked ? `ON (${Math.max(5, Number.parseInt($("limitCooldownMinutes").value || "10", 10) || 10)}m fallback)` : "OFF";
  const activeLine = active ? `${active.title || "Untitled"}\n${shortUrl(active.url)}` : "No supported active tab.";
  // ARIA v4.9.0 — Fix 4: Snapshot includes daily count and chain target tab
  const chainTarget = $("chainTargetTabId") ? $("chainTargetTabId").value || "0" : "0";
  return [
    "ARIA Nexus System Snapshot",
    `Version: ${chrome.runtime.getManifest().version}`,
    `Active tab: ${activeLine}`,
    `Tabs: ${supported.length} supported | ${aiTabs.length} AI/coding | ${safeTabs.length} safe bulk targets`,
    `Running tabs: ${running.length}`,
    `Response Vault: ${rows.length} saved | ${selected} selected`,
    `Daily sends: today ${daily && daily.today || 0} | lifetime ${daily && daily.lifetime || 0}`,
    `Chain target tab: ${chainTarget}`,
    `Limit Guard: ${limitGuard}`,
    `Downloads: ${health && health.downloadsSupported ? "available" : "unknown"}`,
    `AI key: ${health && health.groqApiKeySet ? health.groqApiKeyMasked : "not saved"}`,
    `Advice: Save a preset before heavy automation, then Export Settings as backup.`
  ].join("\n");
}

$("run").onclick = async () => {
  try {
    setStatus("Starting this tab...");
    const reply = await runAction("ARIA_SUPER_START", { resetPromptFirst: true });
    setStatus(reply.ok
      ? `Running this tab.\nSite: ${reply.site || ""}\nMode: ${reply.mode}\nNext: ${reply.nextText}\nSent: ${reply.runCount}\nPrompt first: ${reply.promptQueued ? "YES" : "NO"}`
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

// ARIA v4.28.0 - Manual Current Number Send Lock
// Sends the exact current number/prompt once and lets the content script advance
// only after the page proves the prompt was accepted.
if ($("sendCurrentNumberNow")) $("sendCurrentNumberNow").onclick = async () => {
  try {
    await saveOptions();
    setStatus("Sending current number now. Counter will stay locked until accepted...");
    const reply = await runAction("ARIA_SUPER_SEND_CURRENT_NUMBER_NOW");
    setStatus(reply && reply.ok
      ? (reply.message || `Accepted. Next: ${reply.nextText || ""}\nSent: ${reply.runCount || 0}`)
      : `Send # Now failed: ${(reply && (reply.error || reply.reason || reply.message)) || "not accepted"}`);
  } catch (err) {
    setStatus(`Send # Now error: ${err.message}`);
  }
};

$("openFullPanel").onclick = async () => {
  try {
    setStatus("Opening full-page ARIA panel...");
    await openFullPanel();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

if ($("siteTrainerStart")) $("siteTrainerStart").onclick = () => siteProfileAction("ARIA_SUPER_SITE_TRAINER_START");
if ($("siteProfileApply")) $("siteProfileApply").onclick = () => siteProfileAction("ARIA_SUPER_SITE_PROFILE_APPLY");
if ($("siteProfileStatus")) $("siteProfileStatus").onclick = () => siteProfileAction("ARIA_SUPER_SITE_PROFILE_STATUS");
if ($("siteProfileClear")) $("siteProfileClear").onclick = () => siteProfileAction("ARIA_SUPER_SITE_PROFILE_CLEAR");
if ($("siteProfilesExport")) $("siteProfilesExport").onclick = async () => {
  try {
    const reply = await exportSiteProfilesBundle();
    setStatus(reply.ok ? `Trained site profiles exported:\n${reply.filename || ""}` : `Export error: ${reply.error}`);
  } catch (err) {
    setStatus(`Profile export error: ${err.message}`);
  }
};
if ($("siteProfilesImportFile")) $("siteProfilesImportFile").addEventListener("change", async () => {
  const file = $("siteProfilesImportFile").files && $("siteProfilesImportFile").files[0];
  if (!file) return;
  try {
    const reply = await importSiteProfilesBundle(file);
    setStatus(reply.ok ? `Imported ${reply.imported} trained profiles.\nTotal trained profiles: ${reply.total}` : `Import error: ${reply.error}`);
  } catch (err) {
    setStatus(`Profile import error: ${err.message}`);
  } finally {
    $("siteProfilesImportFile").value = "";
  }
});

$("reloadExtensionNow").onclick = async () => {
  setStatus("Reloading ARIA Nexus One Hub...");
  await sendRuntime({ type: "ARIA_SUPER_RELOAD_EXTENSION" });
};

// ARIA v4.14.0 - Quick Command Launcher popup handlers.
if ($("quickCommandRun")) {
  $("quickCommandRun").onclick = async () => {
    try {
      await saveOptions();
      const command = $("quickCommandInput") ? $("quickCommandInput").value : "";
      const reply = await runQuickCommand(command);
      setStatus(reply.message || (reply.ok ? "Quick command complete." : "Quick command failed."));
    } catch (err) {
      setStatus(`Quick command error: ${err.message}`);
    }
  };
}

if ($("quickCommandInput")) {
  $("quickCommandInput").addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    try {
      await saveOptions();
      const reply = await runQuickCommand($("quickCommandInput").value);
      setStatus(reply.message || (reply.ok ? "Quick command complete." : "Quick command failed."));
    } catch (err) {
      setStatus(`Quick command error: ${err.message}`);
    }
  });
}

if ($("quickCommandHelp")) {
  $("quickCommandHelp").onclick = () => setStatus(quickCommandHelpText());
}

// ARIA v4.16.0 - AI Tool Radar popup handlers.
if ($("toolRadarPlan")) {
  $("toolRadarPlan").onclick = async () => {
    try {
      const reply = await runToolRadar();
      setStatus(reply.message || "Tool Radar complete.");
    } catch (err) {
      setStatus(`Tool Radar error: ${err.message}`);
    }
  };
}

if ($("toolRadarOpen")) {
  $("toolRadarOpen").onclick = async () => {
    try {
      const reply = await runToolRadar({ openTool: true });
      setStatus(reply.message || "Best tool opened.");
    } catch (err) {
      setStatus(`Open best tool error: ${err.message}`);
    }
  };
}

if ($("toolRadarFill")) {
  $("toolRadarFill").onclick = async () => {
    try {
      const reply = await runToolRadar({ fillPrompt: true });
      setStatus(reply.message || "Tool prompt filled.");
    } catch (err) {
      setStatus(`Fill tool prompt error: ${err.message}`);
    }
  };
}

// ARIA v4.17.0 - Prompt Recipe Builder popup handlers.
if ($("recipeBuild")) {
  $("recipeBuild").onclick = async () => {
    try {
      const reply = await runRecipeBuilder();
      setStatus(reply.message || "Recipe ready.");
    } catch (err) {
      setStatus(`Recipe error: ${err.message}`);
    }
  };
}

if ($("recipeCopy")) {
  $("recipeCopy").onclick = async () => {
    try {
      const reply = await runRecipeBuilder({ copy: true });
      setStatus(reply.message || "Recipe copied.");
    } catch (err) {
      setStatus(`Copy recipe error: ${err.message}`);
    }
  };
}

if ($("recipeFill")) {
  $("recipeFill").onclick = async () => {
    try {
      const reply = await runRecipeBuilder({ fill: true });
      setStatus(reply.message || "Recipe filled.");
    } catch (err) {
      setStatus(`Fill recipe error: ${err.message}`);
    }
  };
}

// ARIA v4.18.0 - Prompt Queue Wizard popup handlers.
if ($("queueWizardBuild")) {
  $("queueWizardBuild").onclick = async () => {
    try {
      const reply = await runQueueWizard();
      setStatus(reply.message || "Prompt queue ready.");
    } catch (err) {
      setStatus(`Queue wizard error: ${err.message}`);
    }
  };
}

if ($("queueWizardCopy")) {
  $("queueWizardCopy").onclick = async () => {
    try {
      const reply = await runQueueWizard({ copy: true });
      setStatus(reply.message || "Prompt queue copied.");
    } catch (err) {
      setStatus(`Copy queue error: ${err.message}`);
    }
  };
}

if ($("queueWizardLoad")) {
  $("queueWizardLoad").onclick = async () => {
    try {
      const reply = await runQueueWizard({ load: true });
      setStatus(reply.message || "Prompt queue loaded.");
    } catch (err) {
      setStatus(`Load queue error: ${err.message}`);
    }
  };
}

if ($("queueWizardStart")) {
  $("queueWizardStart").onclick = async () => {
    try {
      const reply = await runQueueWizard({ start: true });
      setStatus(reply.message || "Prompt queue loaded and started.");
    } catch (err) {
      setStatus(`Start queue error: ${err.message}`);
    }
  };
}

$("systemSnapshot").onclick = async () => {
  try {
    await saveOptions();
    setStatus("Building ARIA system snapshot...");
    setStatus(await systemSnapshot());
  } catch (err) {
    setStatus(`Snapshot error: ${err.message}`);
  }
};

$("emergencyStopAll").onclick = async () => {
  try {
    setStatus("Emergency stop sent to every supported tab...");
    const result = await emergencyStopAllTabs();
    setStatus(`Emergency Stop All complete.\nStopped: ${result.stopped}/${result.total}\nFailed/no script: ${result.failed}`);
  } catch (err) {
    setStatus(`Emergency stop error: ${err.message}`);
  }
};

$("advancedPresetSave").onclick = async () => {
  try {
    const name = await saveCurrentPreset();
    setStatus(`Preset saved: ${name}`);
  } catch (err) {
    setStatus(`Preset save error: ${err.message}`);
  }
};

$("advancedPresetLoad").onclick = async () => {
  try {
    const reply = await loadSelectedPreset();
    setStatus(reply.ok ? `Preset loaded: ${reply.name}` : `Preset error: ${reply.error}`);
  } catch (err) {
    setStatus(`Preset load error: ${err.message}`);
  }
};

$("advancedPresetDelete").onclick = async () => {
  try {
    const reply = await deleteSelectedPreset();
    setStatus(reply.ok ? `Preset deleted: ${reply.name}` : `Preset error: ${reply.error}`);
  } catch (err) {
    setStatus(`Preset delete error: ${err.message}`);
  }
};

$("exportSettings").onclick = async () => {
  try {
    await saveOptions();
    const reply = await exportSettingsBundle();
    setStatus(reply.ok ? `Settings backup downloaded:\n${reply.filename}` : `Export error: ${reply.error}`);
  } catch (err) {
    setStatus(`Export error: ${err.message}`);
  }
};

$("importSettingsFile").addEventListener("change", async () => {
  const file = $("importSettingsFile").files && $("importSettingsFile").files[0];
  if (!file) return;
  try {
    const reply = await importSettingsBundle(file);
    setStatus(reply.ok
      ? `Settings imported.\nOptions: ${reply.importedOptions ? "YES" : "NO"}\nPresets: ${reply.importedPresets ? "YES" : "NO"}`
      : `Import error: ${reply.error}`);
  } catch (err) {
    setStatus(`Import error: ${err.message}`);
  } finally {
    $("importSettingsFile").value = "";
  }
});

if ($("themeToggle")) {
  $("themeToggle").onclick = () => togglePopupTheme().catch((err) => setStatus(`Theme error: ${err.message}`));
}

if ($("exportState")) {
  $("exportState").onclick = async () => {
    try {
      await saveOptions();
      const reply = await exportFullStateBundle();
      setStatus(reply.ok ? `Full ARIA state downloaded:\n${reply.filename}` : `State export error: ${reply.error}`);
    } catch (err) {
      setStatus(`State export error: ${err.message}`);
    }
  };
}

if ($("importStateFile")) {
  $("importStateFile").addEventListener("change", async () => {
    const file = $("importStateFile").files && $("importStateFile").files[0];
    if (!file) return;
    try {
      const reply = await importFullStateBundle(file);
      setStatus(reply.ok ? `State imported.\nKeys: ${reply.keys}` : `State import error: ${reply.error}`);
    } catch (err) {
      setStatus(`State import error: ${err.message}`);
    } finally {
      $("importStateFile").value = "";
    }
  });
}

$("oneClick").onclick = async () => {
  try {
    setStatus("One-click automation starting on current site...");
    const reply = await runAction("ARIA_SUPER_ONE_CLICK", { resetPromptFirst: true, social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("manusStart").onclick = async () => {
  try {
    $("mode").value = "manus";
    $("sendMode").value = "manus";
    setStatus("Starting Manus AI runner...");
    const reply = await runAction("ARIA_SUPER_MANUS_START", { resetPromptFirst: false });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Manus start error: ${err.message}`);
  }
};

$("manusStop").onclick = async () => {
  try {
    setStatus("Stopping Manus AI runner...");
    const reply = await runAction("ARIA_SUPER_MANUS_STOP");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Manus stop error: ${err.message}`);
  }
};

$("manusStatus").onclick = async () => {
  try {
    setStatus("Checking Manus status...");
    const reply = await runAction("ARIA_SUPER_MANUS_STATUS");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Manus status error: ${err.message}`);
  }
};

$("manusRefresh").onclick = async () => {
  try {
    setStatus("Refreshing Manus AI tab...");
    const reply = await runAction("ARIA_SUPER_MANUS_REFRESH");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Manus refresh error: ${err.message}`);
  }
};

$("scholarshipAnalyze").onclick = async () => {
  try {
    await saveOptions();
    setStatus("Analyzing scholarship form fields...");
    const reply = await runAction("ARIA_SUPER_SCHOLARSHIP_ANALYZE");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Scholarship analyze error: ${err.message}`);
  }
};

$("scholarshipFill").onclick = async () => {
  try {
    await saveOptions();
    setStatus("Filling safe scholarship draft...");
    const reply = await runAction("ARIA_SUPER_SCHOLARSHIP_FILL");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Scholarship fill error: ${err.message}`);
  }
};

$("scholarshipHighlight").onclick = async () => {
  try {
    await saveOptions();
    const reply = await runAction("ARIA_SUPER_SCHOLARSHIP_HIGHLIGHT");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Scholarship highlight error: ${err.message}`);
  }
};

$("scholarshipClear").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SCHOLARSHIP_CLEAR");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Scholarship clear error: ${err.message}`);
  }
};

$("checkTab").onclick = async () => {
  try {
    setStatus("Checking this tab...");
    const reply = await runAction("ARIA_SUPER_DIAGNOSE");
    if (!reply.ok) {
      setStatus(`Error: ${reply.error}`);
      return;
    }
    setStatus([
      `Tab check: ${reply.ready ? "READY" : "WAIT"}`,
      `Site: ${reply.site}`,
      `Mode: ${reply.mode}`,
      `Input: ${reply.inputFound ? reply.inputLabel || "found" : "not found"}`,
      `Action: ${reply.actionButtonFound ? reply.actionButtonLabel || "found" : "not found"}`,
      `Busy: ${reply.busy ? reply.busyReason : "no"}`,
      `Message: ${reply.message}`
    ].join("\n"));
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("automationDoctor").onclick = async () => {
  try {
    setStatus("Running Automation Doctor...");
    setStatus(await automationDoctor());
  } catch (err) {
    setStatus(`Doctor error: ${err.message}`);
  }
};

$("desktopBridgeDoctor").onclick = async () => {
  try {
    setStatus("Checking desktop bridge targets...");
    setStatus(await desktopBridgeDoctor());
  } catch (err) {
    setStatus(`Desktop doctor error: ${err.message}`);
  }
};

$("repairCurrentTab").onclick = async () => {
  try {
    setStatus(await repairCurrentTab());
  } catch (err) {
    setStatus(`Repair error: ${err.message}`);
  }
};

$("sendPromptNow").onclick = async () => {
  try {
    const prompt = $("initialPrompt").value.trim();
    if (!prompt) {
      setStatus("Paste prompt text or choose a file first.");
      return;
    }
    setStatus("Sending full prompt now...");
    const reply = await runAction("ARIA_SUPER_SEND_PROMPT_NOW", { prompt });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("smartPromptFill").onclick = async () => {
  try {
    await saveOptions();
    setStatus("Generating smart prompt for this tab...");
    const reply = await runAction("ARIA_SUPER_SMART_PROMPT_FILL");
    setStatus(reply.ok ? (reply.message || "Smart prompt filled.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("smartPromptSend").onclick = async () => {
  try {
    await saveOptions();
    setStatus("Generating and sending smart prompt...");
    const reply = await runAction("ARIA_SUPER_SMART_PROMPT_SEND");
    setStatus(reply.ok ? (reply.message || "Smart prompt sent.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("resetPromptFlag").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_RESET_PROMPT_FLAG");
    setStatus(reply.ok ? "Prompt can be sent again on this tab." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("stop").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_STOP");
    setStatus(reply.ok ? "Stopped this tab." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("runSame").onclick = async () => {
  try {
    setStatus("Starting all same-site tabs...");
    const result = await runSameSiteTabs();
    setStatus(`Run Same Site done.\nHost: ${result.host}\nStarted: ${result.ok}/${result.total}\nFailed: ${result.failed}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("runAiTabs").onclick = async () => {
  try {
    setStatus("Starting all AI/coding tabs. Old tabs will be injected automatically...");
    const result = await runAiCodingTabs();
    const extra = result.errors.length ? "\nFirst errors:\n" + result.errors.join("\n") : "";
    setStatus(`Run AI/Coding Tabs done.\nStarted: ${result.ok}/${result.total}\nFailed: ${result.failed}${extra}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("runWindowTabs").onclick = async () => {
  try {
    setStatus("Starting current window tabs. Social/email/payment pages are skipped...");
    const result = await runCurrentWindowTabs();
    const extra = result.errors.length ? "\nFirst errors:\n" + result.errors.join("\n") : "";
    setStatus(`Run Window Tabs done.\nStarted: ${result.ok}/${result.total}\nFailed: ${result.failed}${extra}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("runSafeTabs").onclick = async () => {
  try {
    setStatus("Starting all safe normal tabs across all windows. Social/email/payment/dashboard pages are skipped...");
    const result = await runAllSafeTabs();
    const extra = result.errors.length ? "\nFirst errors:\n" + result.errors.join("\n") : "";
    setStatus(`Run All Safe Tabs done.\nStarted: ${result.ok}/${result.total}\nFailed: ${result.failed}${extra}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("stopRunning").onclick = async () => {
  try {
    setStatus("Stopping all running ARIA tabs...");
    const result = await stopRunningTabs();
    setStatus(`Stopped ${result.stopped}/${result.total} running tab(s).`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("showRunnersTop").onclick = async () => {
  try {
    const reply = await sendRuntime({ type: "ARIA_SUPER_GET_RUNNERS" });
    const runners = reply && reply.runners ? Object.values(reply.runners) : [];
    if (!runners.length) return setStatus("No running ARIA tabs.");
    const lines = runners.map((runner, index) => `${index + 1}. ${runner.title || runner.url || "tab"} | ${runner.mode || "auto"}`);
    setStatus(`Running tabs: ${runners.length}\n${lines.join("\n").slice(0, 900)}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("diagnoseAiTabs").onclick = async () => {
  try {
    setStatus("Diagnosing AI/coding tabs...");
    const result = await diagnoseAiCodingTabs();
    setStatus(`Diagnose AI Tabs\nChecked: ${result.total}\nReady: ${result.ok}\nFailed: ${result.failed}\n${result.lines.join("\n").slice(0, 1400) || "No tabs found."}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("diagnoseSafeTabs").onclick = async () => {
  try {
    setStatus("Diagnosing all safe tabs...");
    const result = await diagnoseAllSafeTabs();
    setStatus(`Diagnose Safe Tabs\nChecked: ${result.total}\nReady: ${result.ok}\nFailed: ${result.failed}\n${result.lines.join("\n").slice(0, 1400) || "No tabs found."}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("aiStudioForceSend").onclick = async () => {
  try {
    setStatus("Force-sending to Google AI Studio current tab...");
    const reply = await runAction("ARIA_SUPER_AISTUDIO_FORCE_SEND");
    setStatus(reply.ok ? (reply.message || "AI Studio force send complete.") : `Error: ${reply.error || reply.message || "AI Studio force send failed."}`);
  } catch (err) {
    setStatus(`AI Studio force-send error: ${err.message}`);
  }
};

$("aiStudioDiagnose").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_AISTUDIO_DIAGNOSE");
    setStatus(reply.ok ? (reply.message || "AI Studio diagnose complete.") : `Error: ${reply.error || reply.message || "AI Studio diagnose failed."}`);
  } catch (err) {
    setStatus(`AI Studio diagnose error: ${err.message}`);
  }
};

$("rescueStuckInput").onclick = async () => {
  try {
    setStatus("Trying stuck-input rescue on the current tab...");
    const reply = await runAction("ARIA_SUPER_RESCUE_STUCK_INPUT");
    setStatus(reply.ok ? (reply.message || "Stuck-input rescue complete.") : `Error: ${reply.error || reply.message || "Stuck-input rescue failed."}`);
  } catch (err) {
    setStatus(`Stuck-input rescue error: ${err.message}`);
  }
};

$("retryFailedSend").onclick = async () => {
  try {
    setStatus("Retrying the last failed prompt on the current tab...");
    const reply = await runAction("ARIA_SUPER_RETRY_FAILED_SEND");
    setStatus(reply.ok ? (reply.message || "Failed prompt retried.") : `Error: ${reply.error || reply.message || "Retry failed."}`);
  } catch (err) {
    setStatus(`Retry failed error: ${err.message}`);
  }
};

$("skipFailedSend").onclick = async () => {
  try {
    setStatus("Skipping the stored failed prompt on the current tab...");
    const reply = await runAction("ARIA_SUPER_SKIP_FAILED_SEND");
    setStatus(reply.ok ? (reply.message || "Failed prompt skipped.") : `Error: ${reply.error || reply.message || "Skip failed."}`);
  } catch (err) {
    setStatus(`Skip failed error: ${err.message}`);
  }
};

$("panel").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SHOW_PANEL");
    setStatus(reply.ok ? "Panel shown." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("reset").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_RESET", { nextNumber: Number.parseInt($("nextNumber").value || "1", 10) || 1 });
    setStatus(reply.ok ? `Counter reset. Next: ${reply.nextText}` : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("generateImage").onclick = async () => {
  try {
    const prompt = $("imagePrompt").value.trim();
    if (!prompt) return setStatus("Write an image prompt first.");
    const reply = await runAction("ARIA_SUPER_GENERATE_IMAGE", { prompt });
    setStatus(reply.ok ? "Image prompt sent. Images will auto-save when ready." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("saveImages").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SAVE_IMAGES");
    setStatus(reply.ok ? `Saved ${reply.saved || 0} new image(s). Found ${reply.found || 0}.` : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoGenerateTopics").onclick = async () => {
  try {
    const prompt = $("videoTopicPrompt").value.trim();
    if (!prompt) return setStatus("Write a video topic seed first.");
    const reply = await runAction("ARIA_SUPER_VIDEO_ASK_TOPICS", { prompt });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoCaptureTopics").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_VIDEO_CAPTURE_TOPICS");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoCopyCsv").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_VIDEO_COPY_SHEET_ROWS");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoOpenSheets").onclick = async () => {
  chrome.tabs.create({ url: "https://sheets.new" });
  setStatus("Opened Google Sheets. Click A1 and paste copied rows.");
};

$("videoHeyGenFill").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_VIDEO_FILL_HEYGEN");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoCaptureLink").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_VIDEO_CAPTURE_LINK");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoDownload").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_VIDEO_DOWNLOAD");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("videoStatus").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_VIDEO_STATUS");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("xSafe").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_X_SAFE_PREP");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("copyCode").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_CODE_BLOCKS");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultSave").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_SAVE_VISIBLE");
    setStatus(reply.ok ? (reply.message || "Saved visible code to Code Vault.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultZip").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_DOWNLOAD_ZIP");
    setStatus(reply.ok ? (reply.message || "Code ZIP download started.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultStatus").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_STATUS");
    setStatus(reply.ok ? (reply.message || "Code Vault ready.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultAutoScan").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_AUTO_SCAN");
    setStatus(reply.ok ? (reply.message || "Auto code scan toggled.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultPaste").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_PASTE_LATEST");
    setStatus(reply.ok ? (reply.message || "Latest Code Vault file pasted.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultSend").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_SEND_LATEST");
    setStatus(reply.ok ? (reply.message || "Latest Code Vault file sent.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("codeVaultCopy").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CODE_VAULT_COPY_LATEST");
    setStatus(reply.ok ? (reply.message || "Latest Code Vault file copied.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultSaveLatest").onclick = async () => {
  try {
    const reply = await runAction("ARIA_RESPONSE_VAULT_SAVE_LATEST");
    setStatus(reply.ok ? (reply.message || "Latest response saved to vault.") : `Error: ${reply.error}`);
    await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultSaveAll").onclick = async () => {
  try {
    const reply = await runAction("ARIA_RESPONSE_VAULT_SAVE_ALL");
    setStatus(reply.ok ? (reply.message || "Visible responses saved to vault.") : `Error: ${reply.error}`);
    await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultSelectAll").onclick = async () => {
  try {
    const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_SELECT_ALL", selected: true });
    setStatus(reply.ok ? "All saved responses selected." : `Error: ${reply.error}`);
    await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultClear").onclick = async () => {
  try {
    const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_CLEAR" });
    setStatus(reply.ok ? "Response vault cleared." : `Error: ${reply.error}`);
    await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultBuildZip").onclick = async () => {
  try {
    await saveOptions();
    await runAction("ARIA_RESPONSE_VAULT_SAVE_ALL");
    const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_DOWNLOAD_ZIP", ...responseVaultOptions(true) });
    setStatus(reply.ok ? `Response ZIP download started.\n${reply.filename || ""}` : `Error: ${reply.error}`);
    await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultSendAgents").onclick = async () => {
  try {
    await saveOptions();
    await runAction("ARIA_RESPONSE_VAULT_SAVE_ALL");
    const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_SEND_AGENTS", ...responseVaultOptions(true) });
    setStatus(reply.ok ? (reply.message || "Agent payload created.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("responseVaultStoreSend").onclick = async () => {
  try {
    await saveOptions();
    await runAction("ARIA_RESPONSE_VAULT_SAVE_ALL");
    const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_STORE_SEND", ...responseVaultOptions(true) });
    setStatus(reply.ok ? (reply.message || "ZIP + store + send completed.") : `Error: ${reply.error}`);
    await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("allowCopy").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_ALLOW_RESPONSE_COPY", { allowed: true });
    setStatus(reply.ok ? "Response copy allowed on this tab only." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("blockCopy").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_BLOCK_RESPONSE_COPY");
    setStatus(reply.ok ? "Response copy blocked on this tab." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("copyResponse").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_LATEST_RESPONSE");
    setStatus(reply.ok ? `${reply.message}\n${reply.preview || ""}` : `Error: ${reply.error}`);
    if (reply.ok) await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("allowAndCopy").onclick = async () => {
  try {
    await runAction("ARIA_SUPER_ALLOW_RESPONSE_COPY", { allowed: true });
    const reply = await runAction("ARIA_SUPER_COPY_LATEST_RESPONSE");
    setStatus(reply.ok ? `${reply.message}\n${reply.preview || ""}` : `Error: ${reply.error}`);
    if (reply.ok) await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("sendWord").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_TO_WORD");
    setStatus(reply.ok ? (reply.message || "Saved to Word.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("newWord").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_NEW_WORD_DOC");
    setStatus(reply.ok ? (reply.message || "New Word document ready.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("openWord").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_OPEN_WORD_DOC");
    setStatus(reply.ok ? (reply.message || "Opening Word document.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("openWordFolder").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_OPEN_WORD_FOLDER");
    setStatus(reply.ok ? (reply.message || "Opening Word folder.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("copyAndWord").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_AND_WORD");
    setStatus(reply.ok ? (reply.message || "Copied and saved to Word.") : `Error: ${reply.error}`);
    if (reply.ok) await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("allowCopyAndWord").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_ALLOW_COPY_AND_WORD");
    setStatus(reply.ok ? (reply.message || "Allowed, copied, and saved to Word.") : `Error: ${reply.error}`);
    if (reply.ok) await refreshResponseVault();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("copyAllResponses").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_ALL_RESPONSES", { allowOnce: true });
    setStatus(reply.ok ? (reply.message || "Copied all responses.") : `Error: ${reply.error}`);
    if (reply.ok) await refreshResponseVault();
  } catch (err) {
    setStatus(err.message);
  }
};

$("copyLatestPrompt").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_LATEST_PROMPT", { allowOnce: true });
    setStatus(reply.ok ? `${reply.message || "Copied latest prompt."}\n${reply.preview || ""}` : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("copyAllPrompts").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_ALL_PROMPTS", { allowOnce: true });
    setStatus(reply.ok ? `${reply.message || "Copied all prompts."}\n${reply.preview || ""}` : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allResponsesWord").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_ALL_TO_WORD");
    setStatus(reply.ok ? (reply.message || "Saved all responses to Word.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteLatestDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_LATEST_DESKTOP", {
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus Notepad, Word, VS Code, Android Studio, Codex, or any editor now; ARIA will paste.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteAllDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_ALL_DESKTOP", {
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus Notepad, Word, VS Code, Android Studio, Codex, or any editor now; ARIA will paste.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteLatestPromptDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_LATEST_PROMPT_DESKTOP", {
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus any target editor now; ARIA will paste the latest prompt.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteAllPromptsDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_ALL_PROMPTS_DESKTOP", {
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus any target editor now; ARIA will paste all prompts.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteFullChatDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_FULL_CHAT_DESKTOP", {
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus any target editor now; ARIA will paste the full prompt/response archive.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

// ARIA v4.13.0 - Desktop app/search bridge from popup.
if ($("openDesktopApp")) {
  $("openDesktopApp").onclick = async () => {
    try {
      const options = await saveOptions();
      const app = (options.desktopOpenAppName || $("desktopOpenAppName").value || "").trim();
      if (!app) {
        setStatus("Type an app name first, e.g. notepad, word, excel, vscode, android studio, chrome, explorer.");
        return;
      }
      const data = await localServerJson("/api/desktop/open-app", { app });
      setStatus(data.message || `Opened ${app}.`);
    } catch (err) {
      setStatus(`Open app failed: ${err.message}`);
    }
  };
}

if ($("openAppSearchHelp")) {
  $("openAppSearchHelp").onclick = () => {
    setStatus("Allowed apps: notepad, word, excel, powerpoint, vscode, cursor, android studio, chrome, edge, explorer, calculator, paint, cmd, powershell, whatsapp, chatgpt, codex.");
  };
}

if ($("openWebSearch")) {
  $("openWebSearch").onclick = async () => {
    try {
      const options = await saveOptions();
      const query = (options.desktopSearchQuery || $("desktopSearchQuery").value || "").trim();
      if (!query) {
        setStatus("Type a search query first.");
        return;
      }
      await createTab(`https://www.google.com/search?q=${encodeURIComponent(query)}`, true);
      setStatus(`Opened Google search: ${query}`);
    } catch (err) {
      setStatus(`Google search failed: ${err.message}`);
    }
  };
}

if ($("openWindowsSearch")) {
  $("openWindowsSearch").onclick = async () => {
    try {
      const options = await saveOptions();
      const query = (options.desktopSearchQuery || $("desktopSearchQuery").value || "").trim();
      if (!query) {
        setStatus("Type a Windows search query first.");
        return;
      }
      const data = await localServerJson("/api/desktop/search", { query, mode: "windows" });
      setStatus(data.message || `Opened Windows search: ${query}`);
    } catch (err) {
      setStatus(`Windows search failed: ${err.message}`);
    }
  };
}

$("copyTransferBundle").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_COPY_TRANSFER_BUNDLE");
    setStatus(reply.ok
      ? (reply.message || "App transfer bundle copied.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteTransferInput").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PASTE_TRANSFER_CURRENT_INPUT");
    setStatus(reply.ok
      ? (reply.message || "Transfer bundle pasted into current input.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteTransferDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_TRANSFER_DESKTOP", {
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus any target app now; ARIA will paste the transfer bundle.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("downloadTransferBundle").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_DOWNLOAD_TRANSFER_BUNDLE");
    setStatus(reply.ok
      ? (reply.message || "Transfer Markdown downloaded.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("appRouterStatus").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_APP_ROUTER_STATUS", { task: options.appRouterTask });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("copyAppRoutePlan").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_COPY_APP_ROUTE_PLAN", { task: options.appRouterTask });
    setStatus(reply.ok
      ? (reply.message || "Credits-aware route plan copied.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteAppRouteInput").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_APP_ROUTE_CURRENT_INPUT", { task: options.appRouterTask });
    setStatus(reply.ok
      ? (reply.message || "Route plan pasted into current input.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pasteAppRouteDesktop").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_PASTE_APP_ROUTE_DESKTOP", {
      task: options.appRouterTask,
      target_app: options.desktopTarget,
      open_app: options.desktopOpenTarget,
      delay_seconds: options.desktopPasteDelay
    });
    setStatus(reply.ok
      ? (reply.message || "Focus any target app now; ARIA will paste the route plan.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("downloadAppRoutePlan").onclick = async () => {
  try {
    const options = await saveOptions();
    const reply = await runAction("ARIA_SUPER_DOWNLOAD_APP_ROUTE_PLAN", { task: options.appRouterTask });
    setStatus(reply.ok
      ? (reply.message || "Route Markdown downloaded.")
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("latestNotepad").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PASTE_LATEST_NOTEPAD");
    setStatus(reply.ok ? (reply.message || "Opening Notepad and pasting latest response.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allNotepad").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PASTE_ALL_NOTEPAD");
    setStatus(reply.ok ? (reply.message || "Opening Notepad and pasting all responses.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("latestGoogleDocs").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_LATEST_GOOGLE_DOCS");
    setStatus(reply.ok ? (reply.message || "Google Docs opened with latest response copied.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allGoogleDocs").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_ALL_GOOGLE_DOCS");
    setStatus(reply.ok ? (reply.message || "Google Docs opened with all responses copied.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("latestDrive").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SAVE_LATEST_DRIVE");
    setStatus(reply.ok ? (reply.message || "Saved latest response to Google Drive backup.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allResponsesDrive").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SAVE_ALL_DRIVE");
    setStatus(reply.ok ? (reply.message || "Saved all responses to Google Drive backup.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("driveStatus").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_DRIVE_STATUS");
    setStatus(reply.ok ? (reply.message || "Google Drive backup ready.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("openDriveFolder").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_OPEN_DRIVE_FOLDER");
    setStatus(reply.ok ? (reply.message || "Opening Google Drive backup folder.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("latestCodex").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_LATEST_TO_CODEX");
    setStatus(reply.ok ? (reply.message || "Latest response sent to Codex bridge.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allResponsesCodex").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_ALL_TO_CODEX");
    setStatus(reply.ok ? (reply.message || "All responses sent to Codex bridge.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("latestVSCode").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_LATEST_TO_VSCODE");
    setStatus(reply.ok ? (reply.message || "Latest response sent to VS Code.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allResponsesVSCode").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_ALL_TO_VSCODE");
    setStatus(reply.ok ? (reply.message || "All responses sent to VS Code.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("latestCodingTarget").onclick = async () => {
  try {
    const target = $("codingTarget").value || "codex";
    const reply = await runAction("ARIA_SUPER_SEND_LATEST_TO_TARGET", { target });
    setStatus(reply.ok ? (reply.message || `Latest response sent to ${codingTargetName(target)}.`) : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("allCodingTarget").onclick = async () => {
  try {
    const target = $("codingTarget").value || "codex";
    const reply = await runAction("ARIA_SUPER_SEND_ALL_TO_TARGET", { target });
    setStatus(reply.ok ? (reply.message || `All responses sent to ${codingTargetName(target)}.`) : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("wordDocCodingTarget").onclick = async () => {
  try {
    const target = $("codingTarget").value || "codex";
    const reply = await runAction("ARIA_SUPER_SEND_WORD_TO_TARGET", { target });
    setStatus(reply.ok ? (reply.message || `Word document sent to ${codingTargetName(target)}.`) : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("openCodingTarget").onclick = async () => {
  try {
    const target = $("codingTarget").value || "codex";
    const reply = await runAction("ARIA_SUPER_OPEN_CODING_TARGET", { target });
    setStatus(reply.ok ? (reply.message || `${codingTargetName(target)} opened.`) : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("clickupAllToChatGpt").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CLICKUP_ALL_TO_CHATGPT", {
      sendNow: false
    });
    setStatus(reply.ok ? (reply.message || "ClickUp responses pasted to ChatGPT. Review and send manually.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("clickupLiveToChatGpt").onclick = async () => {
  try {
    const seconds = Math.max(1, Number.parseInt($("seconds").value || "5", 10) || 5);
    const reply = await runAction("ARIA_SUPER_CLICKUP_LIVE_TO_CHATGPT_START", {
      sendNow: $("clickupChatgptSendNow").checked,
      intervalMs: seconds * 1000
    });
    setStatus(reply.ok ? (reply.message || "Live ClickUp -> ChatGPT bridge started.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("clickupStopLiveToChatGpt").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CLICKUP_LIVE_TO_CHATGPT_STOP");
    setStatus(reply.ok ? (reply.message || "Live ClickUp -> ChatGPT bridge stopped.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("clickupBridgeStatus").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_CLICKUP_LIVE_TO_CHATGPT_STATUS");
    setStatus(reply.ok ? (reply.message || "Bridge status ready.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("codexOutboxInput").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PULL_CODEX_OUTBOX_INPUT");
    setStatus(reply.ok ? (reply.message || "Codex outbox prompt filled.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("codexOutboxSend").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PULL_CODEX_OUTBOX_SEND");
    setStatus(reply.ok ? (reply.message || "Codex outbox prompt sent.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("wordDocCodex").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_WORD_TO_CODEX");
    setStatus(reply.ok ? (reply.message || "Word document sent to Codex bridge.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("wordDocVSCode").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SEND_WORD_TO_VSCODE");
    setStatus(reply.ok ? (reply.message || "Word document opened in VS Code.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("basitWordAuto").onclick = async () => {
  try {
    $("autoWordSave").checked = true;
    $("driveAutoSave").checked = true;
    $("wordOpenAfterSave").checked = true;
    $("sendMode").value = "numbers";
    const reply = await runAction("ARIA_SUPER_BASIT_WORD_AUTOPILOT", { allowOnce: true });
    setStatus(reply.ok ? (reply.message || "Basit Word automation started.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("basitWordCodexAuto").onclick = async () => {
  try {
    $("autoWordSave").checked = true;
    $("autoCodexSave").checked = true;
    $("driveAutoSave").checked = true;
    $("wordOpenAfterSave").checked = true;
    $("sendMode").value = "numbers";
    const reply = await runAction("ARIA_SUPER_BASIT_WORD_CODEX_AUTOPILOT", { allowOnce: true });
    setStatus(reply.ok ? (reply.message || "Basit Word + Codex automation started.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("basitWordFullRun").onclick = async () => {
  try {
    $("autoWordSave").checked = true;
    $("driveAutoSave").checked = true;
    $("wordOpenAfterSave").checked = true;
    $("sendMode").value = "numbers";
    const reply = await runAction("ARIA_SUPER_BASIT_WORD_FULL_RUN", { allowOnce: true });
    setStatus(reply.ok ? (reply.message || "Saved old responses and sent next number.") : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("pipelineStart").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PIPELINE_START", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pipelineNext").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PIPELINE_NEXT", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pipelineStatus").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PIPELINE_STATUS", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("pipelineReset").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PIPELINE_RESET", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(err.message);
  }
};

$("saveGroq").onclick = async () => {
  const provider = $("llmProvider").value || "groq";
  const key = $("groqKey").value.trim();
  const textModel = $("llmModel").value.trim();
  const apiBaseUrl = $("llmBaseUrl").value.trim();
  const localCustom = provider === "custom" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(apiBaseUrl);
  if (!key && !localCustom) {
    setStatus("Paste AI API key first. Local custom endpoint http://127.0.0.1/localhost key ke bina bhi save ho sakta hai.");
    return;
  }
  const reply = await sendRuntime({
    type: "ARIA_SUPER_SAVE_GROQ_SETTINGS",
    payload: { provider, apiKey: key, groqApiKey: key, textModel, apiBaseUrl }
  });
  setStatus(reply.ok
    ? `AI key saved locally.\nProvider: ${reply.provider}\nKey: ${reply.apiKeyMasked || reply.groqApiKeyMasked}\nModel: ${reply.textModel}\nEndpoint: ${reply.apiBaseUrl || "default"}`
    : `Error: ${reply.error}`);
};

$("groqStatus").onclick = async () => {
  const reply = await sendRuntime({ type: "ARIA_SUPER_GET_GROQ_SETTINGS" });
  setStatus(reply.ok
    ? `AI provider: ${reply.provider || "groq"}\nKey: ${reply.apiKeySet ? (reply.apiKeyMasked || reply.groqApiKeyMasked) : "not saved"}\nModel: ${reply.textModel}\nEndpoint: ${reply.apiBaseUrl || "default"}`
    : `Error: ${reply.error}`);
};

function pulseText() {
  return $("pulseComment") ? $("pulseComment").value || "" : "";
}

// ARIA v4.28.1 - Pulse Post Suite: safe active-tab analysis and draft-only helpers.
if ($("pulseAnalyze")) $("pulseAnalyze").onclick = async () => {
  try {
    setStatus("Pulse analyzing current page...");
    const reply = await runAction("ARIA_SUPER_PULSE_ANALYZE", { text: pulseText() });
    setStatus(reply && reply.ok ? reply.message : `Pulse error: ${reply && reply.error ? reply.error : "unknown"}`);
  } catch (err) {
    setStatus(`Pulse analyze error: ${err.message}`);
  }
};

if ($("pulseDraft")) $("pulseDraft").onclick = async () => {
  try {
    setStatus("Pulse filling safe draft...");
    const reply = await runAction("ARIA_SUPER_PULSE_DRAFT", { text: pulseText() });
    setStatus(reply && reply.ok ? reply.message : `Pulse error: ${reply && reply.error ? reply.error : "unknown"}`);
  } catch (err) {
    setStatus(`Pulse draft error: ${err.message}`);
  }
};

if ($("pulseCopy")) $("pulseCopy").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_PULSE_COPY", { text: pulseText() });
    setStatus(reply && reply.ok ? reply.message : `Pulse error: ${reply && reply.error ? reply.error : "unknown"}`);
  } catch (err) {
    setStatus(`Pulse copy error: ${err.message}`);
  }
};

if ($("pulseYouTube")) $("pulseYouTube").onclick = async () => {
  try {
    setStatus("Pulse preparing YouTube comment draft...");
    const reply = await runAction("ARIA_SUPER_PULSE_YOUTUBE_DRAFT", { text: pulseText() });
    setStatus(reply && reply.ok ? reply.message : `Pulse error: ${reply && reply.error ? reply.error : "unknown"}`);
  } catch (err) {
    setStatus(`Pulse YouTube error: ${err.message}`);
  }
};

$("socialCaption").onclick = async () => {
  try {
    setStatus("Generating social caption...");
    const reply = await runAction("ARIA_SUPER_SOCIAL_GENERATE_CAPTION", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("socialFill").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SOCIAL_FILL_POST", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("socialComment").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SOCIAL_FILL_COMMENT", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("socialHighlight").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_SOCIAL_HIGHLIGHT", { social: socialPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

if ($("revenueBrief")) {
  $("revenueBrief").onclick = async () => {
    try {
      setStatus("Building Money Brief from current page...");
      const reply = await runAction("ARIA_SUPER_REVENUE_BRIEF", { social: socialPayload() });
      setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };
}

if ($("revenueFill")) {
  $("revenueFill").onclick = async () => {
    try {
      setStatus("Preparing and filling Money Draft...");
      const reply = await runAction("ARIA_SUPER_REVENUE_FILL_DRAFT", { social: socialPayload() });
      setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };
}

$("waCopyPost").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_COPY_POST");
    setStatus(reply.ok
      ? `${reply.message}\n\nPreview:\n${reply.preview || ""}`
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waFillDraft").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_FILL_DRAFT", { whatsapp: whatsappPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waCurrentSource").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_SET_CURRENT_ROLE", { role: "source" });
    if (reply.ok) {
      $("whatsappSourceName").value = reply.name || "";
      await saveOptions();
    }
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waCurrentReceiver").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_SET_CURRENT_ROLE", { role: "receiver" });
    if (reply.ok) {
      $("whatsappReceiverName").value = reply.name || "";
      await saveOptions();
    }
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waCurrentSourceCopy").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_SET_SOURCE_AND_COPY");
    if (reply.ok) {
      $("whatsappSourceName").value = reply.name || "";
      await saveOptions();
    }
    setStatus(reply.ok
      ? `${reply.message}\n\nPreview:\n${reply.preview || ""}`
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waCurrentReceiverFill").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_SET_RECEIVER_AND_FILL");
    if (reply.ok) {
      $("whatsappReceiverName").value = reply.name || "";
      await saveOptions();
    }
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waOneClickDraft").onclick = async () => {
  try {
    setStatus("WhatsApp source -> receiver draft running. Final Send stays manual.");
    const reply = await runAction("ARIA_SUPER_WHATSAPP_ONE_CLICK_DRAFT", { whatsapp: whatsappPayload() });
    setStatus(reply.ok
      ? `${reply.message}\n\nPreview:\n${reply.preview || ""}`
      : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waOpen").onclick = async () => {
  try {
    await chrome.tabs.create({ url: "https://web.whatsapp.com/" });
    setStatus("WhatsApp Web opened. Select chat, then click Fill WhatsApp draft.");
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waStatus").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_STATUS", { whatsapp: whatsappPayload() });
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waCopyDraft").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_COPY_DRAFT");
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waSwap").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_SWAP", { whatsapp: whatsappPayload() });
    if (reply.ok) {
      $("whatsappSourceName").value = reply.sourceName || "";
      $("whatsappReceiverName").value = reply.receiverName || "";
      await saveOptions();
    }
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("waClear").onclick = async () => {
  try {
    const reply = await runAction("ARIA_SUPER_WHATSAPP_CLEAR");
    if (reply.ok) {
      $("whatsappSourceName").value = "";
      $("whatsappReceiverName").value = "";
      await saveOptions();
    }
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("socialPublish").onclick = async () => {
  try {
    if (!$("publishConfirm").checked) {
      setStatus("Tick confirm box first. This only publishes the current visible draft.");
      return;
    }
    const reply = await runAction("ARIA_SUPER_SOCIAL_PUBLISH_DRAFT", { social: socialPayload(), confirmPublish: true });
    $("publishConfirm").checked = false;
    setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
};

$("socialOpen").onclick = () => {
  chrome.tabs.create({ url: platformUrl($("socialPlatform").value) });
  setStatus("Opened selected social platform.");
};

$("downloads").onclick = async () => {
  const reply = await sendRuntime({ type: "ARIA_SUPER_SHOW_DOWNLOADS" });
  setStatus(reply.ok ? "Downloads opened." : `Error: ${reply.error}`);
};

$("showRunners").onclick = async () => {
  const reply = await sendRuntime({ type: "ARIA_SUPER_GET_RUNNERS" });
  if (!reply.ok) {
    setStatus(`Error: ${reply.error || "Could not read running tabs."}`);
    return;
  }
  const runners = Object.values(reply.runners || {});
  if (!runners.length) {
    setStatus("No running ARIA tabs.");
    return;
  }
  setStatus(runners.map((r) => `Tab ${r.tabId}: ${r.mode} | ${Math.round((r.intervalMs || 0) / 1000)}s | ${r.title || r.url}`).join("\n"));
};

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "ARIA_SUPER_TOAST") setStatus(message.message || "Done.");
});

document.querySelectorAll("[data-sec]").forEach((btn) => {
  btn.onclick = () => {
    $("seconds").value = btn.dataset.sec;
    saveOptions().catch(() => {});
  };
});

if ($("clearStopAfterN")) {
  $("clearStopAfterN").onclick = async () => {
    $("stopAfterN").value = "0";
    await saveOptions();
    setStatus("Stop-after limit cleared. Current tab can run until manually stopped or limit guard pauses.");
  };
}

$("limitCooldown5").onclick = async () => {
  $("limitCooldownMinutes").value = "5";
  $("limitGuardEnabled").checked = true;
  await saveOptions();
  const reply = await runAction("ARIA_SUPER_LIMIT_PAUSE", { minutes: 5, reason: "Manual 5 minute pause from popup" });
  setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
};

$("limitCooldown10").onclick = async () => {
  $("limitCooldownMinutes").value = "10";
  $("limitGuardEnabled").checked = true;
  await saveOptions();
  const reply = await runAction("ARIA_SUPER_LIMIT_PAUSE", { minutes: 10, reason: "Manual 10 minute pause from popup" });
  setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
};

$("limitGuardToggle").onclick = async () => {
  const enabled = !$("limitGuardEnabled").checked;
  $("limitGuardEnabled").checked = enabled;
  await saveOptions();
  const reply = await runAction("ARIA_SUPER_LIMIT_TOGGLE", { enabled });
  setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
};

$("limitClearWait").onclick = async () => {
  const reply = await runAction("ARIA_SUPER_LIMIT_CLEAR");
  setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
};

$("limitPauseNow").onclick = async () => {
  $("limitGuardEnabled").checked = true;
  await saveOptions();
  const minutes = Math.max(1, Math.min(1440, Number.parseInt($("limitCooldownMinutes").value || "10", 10) || 10));
  const reply = await runAction("ARIA_SUPER_LIMIT_PAUSE", { minutes, reason: `Manual ${minutes} minute pause from popup` });
  setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
};

$("limitGuardStatus").onclick = async () => {
  const reply = await runAction("ARIA_SUPER_LIMIT_STATUS");
  setStatus(reply.ok ? reply.message : `Error: ${reply.error}`);
};

if ($("responseHistory")) {
  $("responseHistory").onclick = async () => {
    try {
      const reply = await runAction("ARIA_SUPER_GET_RESPONSE_HISTORY");
      if (!reply.ok) {
        setStatus(`Response history error: ${reply.error}`);
        return;
      }
      const rows = Array.isArray(reply.history) ? reply.history.slice(-20).reverse() : [];
      setStatus(rows.length
        ? rows.map((row, index) => `${index + 1}. ${row.timestamp || ""} | sent ${row.sendCount || 0}\n${String(row.text || "").slice(0, 350)}`).join("\n\n")
        : "No response history captured yet. Run a tab until a response becomes stable.");
    } catch (err) {
      setStatus(`Response history error: ${err.message}`);
    }
  };
}

if ($("dailyStats")) {
  $("dailyStats").onclick = async () => {
    const reply = await sendRuntime({ type: "ARIA_SUPER_DAILY_STATS" });
    setStatus(reply.ok
      ? `Daily Stats\nDate: ${reply.date}\nToday sent: ${reply.today}\nLifetime sent: ${reply.lifetime}`
      : `Daily stats error: ${reply.error}`);
  };
}

// ARIA v4.9.0 — Feature 2: Prompt Template Library
if ($("saveTemplate")) {
  $("saveTemplate").onclick = async () => {
    try {
      const item = await saveCurrentTemplate();
      setStatus(`Template saved: ${item.name}`);
    } catch (err) {
      setStatus(`Template save error: ${err.message}`);
    }
  };
}

if ($("exportTemplates")) {
  $("exportTemplates").onclick = async () => {
    try {
      await exportTemplates();
      setStatus("Templates exported.");
    } catch (err) {
      setStatus(`Template export error: ${err.message}`);
    }
  };
}

if ($("importTemplatesFile")) {
  $("importTemplatesFile").addEventListener("change", () => {
    importTemplatesFile().catch((err) => setStatus(`Template import error: ${err.message}`));
  });
}

// ARIA v4.9.0 — Feature 8: Conditional Next Prompt
if ($("addCondRule")) {
  $("addCondRule").onclick = async () => {
    try {
      const count = await addConditionalRule();
      setStatus(`Conditional rule added. Total rules: ${count}`);
    } catch (err) {
      setStatus(`Conditional rule error: ${err.message}`);
    }
  };
}

// ARIA v4.9.0 — Feature 9: Tab Group Automation
if ($("runTabGroup")) $("runTabGroup").onclick = () => runTabGroup(true).catch((err) => setStatus(`Tab group error: ${err.message}`));
if ($("stopTabGroup")) $("stopTabGroup").onclick = () => runTabGroup(false).catch((err) => setStatus(`Tab group error: ${err.message}`));

// ARIA v4.9.0 — Feature 11: Response Diff Viewer
if ($("diffResponses")) $("diffResponses").onclick = () => diffLastResponses().catch((err) => setStatus(`Diff error: ${err.message}`));

// ARIA v4.9.0 — Feature 15: One-Click Full Automation Profile
if ($("profileMaxSpeed")) {
  $("profileMaxSpeed").onclick = () => applyQuickProfile("Max Speed", {
    seconds: "3",
    sendMode: "numbers",
    stopAfterN: "0",
    limitGuardEnabled: true,
    autoWordSave: false,
    driveAutoSave: false
  });
}

if ($("profileSafeCapture")) {
  $("profileSafeCapture").onclick = () => applyQuickProfile("Safe Capture", {
    seconds: "8",
    sendMode: "numbers",
    stopAfterN: "50",
    limitGuardEnabled: true,
    autoWordSave: true,
    driveAutoSave: true,
    minResponseChars: "150"
  });
}

if ($("profileSmartLoop")) {
  $("profileSmartLoop").onclick = () => applyQuickProfile("Smart Loop", {
    seconds: "10",
    sendMode: "smart",
    stopAfterN: "0",
    limitGuardEnabled: true,
    autoRegen: true,
    skipShortReplies: true,
    minReplyWords: "20"
  });
}

if ($("profileOvernight")) {
  $("profileOvernight").onclick = () => applyQuickProfile("Overnight Run", {
    seconds: "15",
    sendMode: "numbers",
    sleepFrom: "02:00",
    sleepUntil: "07:00",
    stopAfterN: "0",
    limitGuardEnabled: true,
    webhookOnStop: true,
    screenshotOnStop: true
  });
}

[
  "mode", "seconds", "sendMode", "customText", "nextNumber", "smartPromptInstruction", "initialPrompt", "sendPromptFirst", "promptQueue", "usePromptQueue",
  "imageFolder", "videoTopicPrompt", "videoFolder", "socialPlatform", "socialTopic", "socialTone", "socialExtra", "whatsappSourceName", "whatsappReceiverName",
  "wordTopic", "autoWordSave", "autoCodexSave", "driveAutoSave", "driveTitle", "wordSaveMode", "wordOpenAfterSave", "desktopTarget", "desktopPasteDelay",
  "desktopOpenTarget", "desktopOpenAppName", "desktopSearchQuery", "quickCommandInput", "toolRadarGoal", "toolRadarType", "recipeGoal", "recipeType", "recipeConstraints", "queueWizardSource", "queueWizardCount", "queueWizardStyle", "limitGuardEnabled", "limitCooldownMinutes", "stopAfterN", "autoScroll", "minResponseChars", "selfHealFailedSends", "selfHealRetrySeconds", "scheduledStartTime", "sleepFrom",
  "sleepUntil", "pauseOnHidden", "stopKeywords", "customInputSelector", "customSendSelector", "customResponseSelector", "webhookUrl", "webhookOnStop",
  "syncMode", "tokenBudget", "skipShortReplies", "minReplyWords", "autoRegen", "regenKeywords", "imageSaveFilter", "chainTargetTabId", "screenshotOnStop", "clipboardWatch",
  "manusMaxSends", "manusMorningRefresh", "manusMorningRefreshHour", "manusFallbackText", "scholarshipProfile", "scholarshipExtra", "appRouterTask",
  "pipelineTopic", "responseVaultZipName", "responseVaultWebhookUrl"
].forEach((id) => {
  const el = $(id);
  if (!el) return;
  const eventName = id === "smartPromptInstruction" || id === "initialPrompt" || id === "promptQueue" || id === "videoTopicPrompt" || id === "socialTopic" || id === "socialExtra" || id === "whatsappSourceName" || id === "whatsappReceiverName" || id === "wordTopic" || id === "driveTitle" || id === "appRouterTask" || id === "pipelineTopic" || id === "responseVaultZipName" || id === "responseVaultWebhookUrl" || id === "desktopOpenAppName" || id === "desktopSearchQuery" || id === "quickCommandInput" || id === "toolRadarGoal" || id === "recipeGoal" || id === "recipeConstraints" || id === "queueWizardSource" || id === "queueWizardCount" || id === "limitCooldownMinutes" || id === "stopAfterN" || id === "minResponseChars" || id === "selfHealRetrySeconds" || id === "stopKeywords" || id === "customInputSelector" || id === "customSendSelector" || id === "customResponseSelector" || id === "webhookUrl" || id === "manusMaxSends" || id === "manusMorningRefreshHour" || id === "manusFallbackText" || id === "scholarshipProfile" || id === "scholarshipExtra" || id === "tokenBudget" || id === "minReplyWords" || id === "regenKeywords" || id === "imageSaveFilter" ? "input" : "change";
  el.addEventListener(eventName, () => saveOptions().catch(() => {}));
});

$("promptFile").addEventListener("change", async () => {
  const file = $("promptFile").files && $("promptFile").files[0];
  if (!file) return;
  try {
    const text = await file.text();
    $("initialPrompt").value = text;
    $("sendPromptFirst").checked = true;
    await saveOptions();
    setStatus(`Loaded file into prompt box: ${file.name}\nChars: ${text.length}`);
  } catch (err) {
    setStatus(`Could not read file: ${err.message}`);
  }
});

loadPopupTheme().then(() => loadOptions()).then(async () => {
  await renderPresetList();
  // ARIA v4.9.0 — Feature 2/8/12: hydrate template, conditional rule, and chain-tab controls on popup open.
  await renderTemplates();
  await renderConditionalRules();
  await refreshChainTabs();
  if (isFullPanel()) {
    document.body.classList.add("full-panel");
    $("openFullPanel").textContent = "Full Page Panel Open";
    $("openFullPanel").disabled = true;
    refreshTargetInfo();
  }
  refreshResponseVault().catch(() => {});
  try {
    const groq = await sendRuntime({ type: "ARIA_SUPER_GET_GROQ_SETTINGS" });
    if (groq && groq.ok) {
      $("llmProvider").value = groq.provider || "groq";
      $("llmModel").value = groq.textModel || "";
      $("llmBaseUrl").value = groq.apiBaseUrl || "";
    }
    const tab = await activeTab();
    const reply = await sendToTab(tab.id, { type: "ARIA_SUPER_STATUS" });
    const cooldown = reply.limitCooldownActive
      ? `ACTIVE (${Math.ceil((reply.limitCooldownRemainingMs || 0) / 60000)}m left)`
      : "none";
    setStatus(reply.ok
      ? `Ready on ${reply.site || "website"}.\nRunning: ${reply.running ? "YES" : "NO"}\nSent: ${reply.runCount || 0}${reply.stopAfterN ? `/${reply.stopAfterN}` : ""}\nNext: ${reply.nextText || ""}\nSend failures: ${reply.consecutiveSendFails || 0}\nLimit guard: ${reply.limitGuardEnabled === false ? "OFF" : "ON"} | cooldown: ${cooldown}\nCopy allowed: ${reply.responseCopyAllowed ? "YES, this tab" : "NO"}\nDrive auto-save: ${reply.driveAutoSave ? "ON" : "OFF"}\nScholarship profile: ${reply.scholarshipProfileReady ? "READY" : "empty"}\nAI: ${groq && groq.apiKeySet ? `${groq.provider} ${groq.apiKeyMasked}` : "not saved"}`
      : "Ready. Refresh the target tab if page script is not loaded yet.");
  } catch (err) {
    setStatus(err.message);
  }
});

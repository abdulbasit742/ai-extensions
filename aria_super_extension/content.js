(function () {
  "use strict";

  const STATE_KEY = "__ARIA_SUPER_EXTENSION__";
  const PANEL_ID = "aria-super-extension-panel";
  const PANEL_POS_KEY = "ariaSuperPanelPosition";
  const PANEL_MIN_KEY = "ariaSuperPanelMinimized";
  const COPY_ALLOWED_KEY = "ariaSuperResponseCopyAllowed";
  const WHATSAPP_DRAFT_KEY = "ariaSuperWhatsAppDraft";
  const COUNT_PREFIX = "ariaSuperCount:";
  const QUEUE_PREFIX = "ariaSuperQueueIndex:";
  const LIMIT_COOLDOWN_PREFIX = "ariaSuperLimitCooldown:";
  const MANUS_REFRESH_PREFIX = "ariaSuperManusRefresh:";
  const MANUS_RESUME_PREFIX = "ariaSuperManusResume:";
  const OPTIONS_KEY = "ariaSuperOptions";
  const TEMPLATES_KEY = "ariaSuperTemplates";
  const CONDITIONAL_RULES_KEY = "ariaSuperCondRules";
  const VIDEO_STATE_KEY = "ariaSuperVideoPipeline";
  const CODE_VAULT_SCAN_KEY = "ariaSuperCodeVaultAutoScan";
  const CODE_VAULT_HASH_PREFIX = "ariaSuperCodeVaultHash:";
  const PAGE_SCOPE_ID = `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const RESPONSE_STABLE_MS = 4500;
  const SOCIAL_KINDS = ["x", "tiktok", "facebook", "instagram", "linkedin"];
  const ARIA_SERVER_URLS = ["http://127.0.0.1:5050", "http://localhost:5050"];
  const PIPELINE_STEPS = [
    "Save latest response to Word",
    "Copy latest response/code",
    "Save visible ChatGPT images",
    "Generate/copy social caption",
    "Fill current social draft",
    "Highlight final review actions"
  ];
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
    limitGuardEnabled: true,
    limitCooldownMinutes: "10",
    stopAfterN: "0",
    // ARIA v4.8.0 — Feature 1: Auto-scroll to bottom before send
    autoScroll: true,
    // ARIA v4.8.0 — Feature 2: Response length guard
    minResponseChars: "0",
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
    // ARIA v4.8.0 — Feature 14: Auto-pause on tab visibility change
    pauseOnHidden: false,
    // ARIA v4.8.0 — Feature 15: Webhook notification on stop/limit
    webhookUrl: "",
    webhookOnStop: false,
    // ARIA v4.9.0 - Feature 1: Multi-Tab Sync Mode
    syncMode: "off",
    // ARIA v4.9.0 - Feature 3: Token / Credit Budget Tracker
    tokenBudget: "0",
    tokenSpent: 0,
    // ARIA v4.9.0 - Feature 4: Response Quality Filter
    skipShortReplies: false,
    minReplyWords: "10",
    // ARIA v4.9.0 - Feature 5: Auto-Regenerate on Error Response
    autoRegen: false,
    regenKeywords: "error,failed,sorry,I cannot,I'm unable,try again",
    // ARIA v4.9.0 - Feature 6: Image Auto-Save Filter by Keyword
    imageSaveFilter: "",
    // ARIA v4.9.0 - Feature 10: Auto Screenshot on Stop
    screenshotOnStop: false,
    // ARIA v4.9.0 - Feature 12: Prompt Chaining Across Tabs
    chainTargetTabId: "0",
    // ARIA v4.9.0 - Feature 13: Clipboard Watch Mode
    clipboardWatch: false,
    pipelineTopic: "",
    codingTarget: "codex",
    appRouterTask: "",
    clickupChatgptSendNow: true,
    manusMaxSends: "300",
    manusMorningRefresh: true,
    manusMorningRefreshHour: "7",
    manusFallbackText: "do what is best",
    scholarshipProfile: "",
    scholarshipExtra: "",
    antigravityModelOrder: "Gemini 2.5 Pro, Gemini 2.5 Flash, Claude, GPT OSS",
    antigravityAutoSwitchModel: false,
    antigravityConfirmPermissions: false
  };

  if (window[STATE_KEY]) return;
  window[STATE_KEY] = true;

  let tabScopeToken = "";
  let imageScanTimer = null;
  let responseCopyTimer = null;
  let wordAutoSaveTimer = null;
  let driveAutoSaveTimer = null;
  let codeVaultAutoScanTimer = null;
  let clickupChatgptBridgeTimer = null;
  let clickupChatgptBridgeTicking = false;

  const state = {
    running: false,
    timer: null,
    ticking: false,
    intervalMs: 5000,
    mode: "auto",
    sendMode: "numbers",
    customText: "continue",
    nextNumber: 1,
    smartPromptInstruction: "",
    lastSmartPrompt: "",
    initialPrompt: "",
    sendPromptFirst: false,
    promptSent: false,
    promptQueue: "",
    usePromptQueue: false,
    queueIndex: 0,
    videoTopicPrompt: "",
    videoFolder: "Basit Social Media/HeyGen Videos",
    socialPlatform: "auto",
    socialTopic: "",
    socialTone: "friendly",
    socialExtra: "",
    whatsappSourceName: "",
    whatsappReceiverName: "",
    runCount: 0,
    lastSendAt: 0,
    // ARIA v4.23.0 - Response Ack Gate: a send is not counted until
    // the page produces a new stable response. This prevents 1 -> 2 -> 3
    // jumps when a site accepts input slowly or while it is still streaming.
    awaitingResponseAck: false,
    awaitingResponseSince: 0,
    awaitingResponseSignature: "",
    awaitingResponseTextSignature: "",
    awaitingResponseTextLength: 0,
    awaitingResponseBaselineText: "",
    awaitingResponsePayloadKind: "",
    awaitingResponseText: "",
    awaitingQueueIndex: -1,
    awaitingRunCount: 0,
    // ARIA v4.24.0 - No-response retry guard: if the page never produces a
    // fresh response, retry the exact same prompt without advancing numbers.
    awaitingResponseRetryCount: 0,
    awaitingResponseLastRetryAt: 0,
    responseAckTimeoutMs: 180000,
    responseAckRetryLimit: 2,
    // ARIA v4.25.0 - Send Acceptance Verification: do not enter response
    // wait mode until the site visibly accepts the prompt.
    lastSendAcceptedAt: 0,
    lastSendAcceptedText: "",
    sendAcceptVerifyMs: 2600,
    counterScope: "",
    lastMessage: "ARIA Nexus loaded.",
    lastSignature: "",
    lastChangeAt: Date.now(),
    busySince: 0,
    backgroundScheduler: false,
    minimized: localStorage.getItem(PANEL_MIN_KEY) === "1",
    seenImages: new Set(),
    savedImages: 0,
    lastSocialCaption: "",
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
    limitGuardEnabled: true,
    limitCooldownMinutes: "10",
    limitCooldownUntil: 0,
    limitCooldownReason: "",
    stopAfterN: "0",
    autoScroll: true,
    minResponseChars: "0",
    scheduledStartTime: "",
    sleepFrom: "",
    sleepUntil: "",
    stopKeywords: "",
    customInputSelector: "",
    customSendSelector: "",
    pauseOnHidden: false,
    webhookUrl: "",
    webhookOnStop: false,
    lastLimitWebhookUntil: 0,
    lastAttemptedText: "",
    // ARIA v4.26.5 - Failed Send Memory: when a site leaves a prompt in the
    // input instead of accepting it, keep the exact text/payload for one-click
    // Retry Failed / Skip Failed instead of drifting to the next number.
    failedSendText: "",
    failedSendReason: "",
    failedSendAt: 0,
    failedSendPayload: null,
    // ARIA v4.26.7 - Self-Healing Failed Send Retry: after repeated send
    // rejection, keep the same failed payload alive and retry slowly instead
    // of advancing the counter or hard-stopping the run.
    selfHealFailedSends: true,
    selfHealRetryMs: "60000",
    responseHistory: [],
    lastHistorySignature: "",
    syncMode: "off",
    promptTemplates: [],
    conditionalRules: [],
    conditionalNextPrompt: "",
    lastConditionalSignature: "",
    tokenBudget: "0",
    tokenSpent: 0,
    skipShortReplies: false,
    minReplyWords: "10",
    autoRegen: false,
    regenKeywords: "error,failed,sorry,I cannot,I'm unable,try again",
    regenAttempts: 0,
    lastRegenSignature: "",
    imageSaveFilter: "",
    lastResponseWordCount: 0,
    screenshotOnStop: false,
    chainTargetTabId: "0",
    clipboardWatch: false,
    clipboardWatchTimer: null,
    lastClipboardText: "",
    pausedByHidden: false,
    dailySentToday: 0,
    dailySentLifetime: 0,
    consecutiveSendFails: 0,
    pipelineTopic: "",
    codingTarget: "codex",
    appRouterTask: "",
    pipelineStep: 0,
    pipelineLastResult: "",
    lastWordPath: "",
    lastWordSignature: "",
    wordSavedResponseHashes: [],
    lastCodexSignature: "",
    codexSavedResponseHashes: [],
    driveSavedResponseHashes: [],
    responseCopyAllowed: sessionStorage.getItem(COPY_ALLOWED_KEY) === "1",
    lastCopiedResponseSignature: "",
    clickupChatgptBridgeRunning: false,
    clickupChatgptLastSignature: "",
    clickupChatgptSentCount: 0,
    clickupChatgptSendNow: true,
    manusMaxSends: 300,
    manusMorningRefresh: true,
    manusMorningRefreshHour: "7",
    manusFallbackText: "do what is best",
    manusLastQuestionHash: "",
    manusRepeatCount: 0,
    manusLastReply: "next",
    manusLastReason: "ready",
    manusLastStopReason: "",
    scholarshipProfile: "",
    scholarshipExtra: "",
    scholarshipLastSummary: "",
    antigravityModelOrder: "Gemini 2.5 Pro, Gemini 2.5 Flash, Claude, GPT OSS",
    antigravityAutoSwitchModel: false,
    antigravityConfirmPermissions: false
  };
  const codeVaultSessionHashes = new Set();

  function siteKind() {
    const host = location.hostname.toLowerCase();
    const href = location.href.toLowerCase();
    if (
      host.includes("codex.openai.com") ||
      ((host.includes("openai.com") || host.includes("chatgpt.com")) && href.includes("codex")) ||
      href.includes("/codex")
    ) return "codex";
    if (host.includes("antigravity") || href.includes("antigravity")) return "antigravity";
    if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
    if (host === "app.clickup.com") return "clickup";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("gemini.google.com")) return "gemini";
    if (host.includes("aistudio.google.com") || host.includes("makersuite.google.com") || (host.includes("ai.google.dev") && href.includes("aistudio"))) return "aistudio";
    if (host.includes("grok.com")) return "grok";
    if (host.includes("poe.com")) return "poe";
    if (host.includes("perplexity.ai")) return "perplexity";
    if (host.includes("deepseek.com")) return "deepseek";
    if (host.includes("chat.mistral.ai")) return "mistral";
    if (host.includes("phind.com")) return "phind";
    if (host.includes("you.com")) return "you";
    if (host.includes("character.ai")) return "character";
    if (host.includes("coze.com") || host.includes("coze.cn")) return "coze";
    if (host.includes("huggingface.co")) return "huggingface";
    if (host.includes("together.ai")) return "together";
    if (host.includes("openrouter.ai")) return "openrouter";
    if (host.includes("cerebras.ai")) return "cerebras";
    if (host.includes("ideogram.ai")) return "ideogram";
    if (host.includes("suno.com") || host.includes("suno.ai")) return "suno";
    if (host.includes("runwayml.com") || host.includes("runway.com")) return "runway";
    if (host.includes("lumalabs.ai") || host.includes("luma.ai")) return "luma";
    if (host.includes("krea.ai")) return "krea";
    if (host.includes("replicate.com")) return "replicate";
    if (host.includes("dify.ai")) return "dify";
    if (host.includes("devin.ai")) return "devin";
    if (host.includes("copilot.microsoft.com")) return "mscopilot";
    if (host.includes("github.com") && href.includes("copilot")) return "copilot";
    if (host.includes("windsurf") || href.includes("windsurf")) return "windsurf";
    if (host.includes("fireworks.ai")) return "fireworks";
    if (host.includes("smith.langchain.com") || host.includes("langchain.com")) return "langchain";
    if (host.includes("cursor.sh") || host.includes("cursor.com")) return "cursor";
    if (host.includes("v0.dev")) return "v0";
    if (host.includes("bolt.new")) return "bolt";
    if (host.includes("lovable.dev")) return "lovable";
    if (host.includes("manus.im") || host.includes("manus.ai") || host.includes("manus.chat")) return "manus";
    if (host.includes("same.new")) return "same";
    if (host.includes("replit.com")) return "replit";
    if (host.includes("stackblitz.com")) return "stackblitz";
    if (host.includes("codesandbox.io")) return "codesandbox";
    if (host.includes("github.dev")) return "githubdev";
    if (host.includes("kling.ai")) return "kling";
    if (host.includes("heygen.com")) return "heygen";
    if (host === "x.com" || host === "twitter.com") return "x";
    if (host === "www.facebook.com" || host === "facebook.com" || host.endsWith(".facebook.com")) return "facebook";
    if (host === "www.instagram.com" || host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "www.linkedin.com" || host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (host === "www.youtube.com" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host === "web.whatsapp.com") return "whatsapp";
    if (host.includes("notebooklm.google.com")) return "notebooklm";
    if (location.protocol === "file:") return "file";
    return "website";
  }

  function resolvedMode() {
    if (state.mode && state.mode !== "auto") return state.mode;
    const kind = siteKind();
    // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
    // Also prevents next-send while Claude is still streaming.
    if (kind === "claude") {
      const claudeStreaming = qAll("[data-is-streaming='true']").find((el) => visible(el) && !inPanel(el));
      if (claudeStreaming) return { busy: true, reason: "Claude is streaming" };
    }
    const knownAiKinds = new Set([
      "chatgpt", "clickup", "antigravity", "manus", "claude", "gemini", "aistudio", "grok",
      "poe", "perplexity", "deepseek", "mistral", "phind", "you", "character", "coze",
      "huggingface", "together", "openrouter", "cerebras", "ideogram", "suno", "runway",
      "luma", "krea", "replicate", "dify", "devin", "mscopilot", "copilot", "windsurf",
      "langchain", "cursor", "v0", "bolt", "lovable", "same", "replit", "stackblitz",
      "codesandbox", "githubdev", "kling", "heygen", "notebooklm"
    ]);
    if (knownAiKinds.has(kind)) return kind;
    return "universal";
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (data) => resolve(data || {}));
      } catch (err) {
        resolve({});
      }
    });
  }

  function storageSet(data) {
    try {
      chrome.storage.local.set(data);
    } catch (err) {}
  }

  function sendRuntime(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (reply) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(reply || { ok: false });
        });
      } catch (err) {
        resolve({ ok: false, error: String(err && err.message || err) });
      }
    });
  }

  async function loadOptions() {
    const data = await storageGet([OPTIONS_KEY, TEMPLATES_KEY, CONDITIONAL_RULES_KEY]);
    state.promptTemplates = Array.isArray(data[TEMPLATES_KEY]) ? data[TEMPLATES_KEY] : [];
    state.conditionalRules = Array.isArray(data[CONDITIONAL_RULES_KEY]) ? data[CONDITIONAL_RULES_KEY] : [];
    applyOptions({ ...DEFAULTS, ...(data[OPTIONS_KEY] || {}) });
  }

  function applyOptions(options) {
    const oldClipboardWatch = state.clipboardWatch;
    state.mode = options.mode || "auto";
    state.intervalMs = Math.max(1000, Number.parseInt(options.seconds || "5", 10) * 1000 || 5000);
    state.sendMode = options.sendMode || "numbers";
    state.customText = options.customText || "continue";
    state.nextNumber = Math.max(1, Number.parseInt(options.nextNumber || "1", 10) || 1);
    state.smartPromptInstruction = String(options.smartPromptInstruction || "");
    state.initialPrompt = String(options.initialPrompt || "");
    state.sendPromptFirst = Boolean(options.sendPromptFirst);
    state.promptQueue = String(options.promptQueue || "");
    state.usePromptQueue = Boolean(options.usePromptQueue);
    state.videoTopicPrompt = String(options.videoTopicPrompt || "");
    state.videoFolder = String(options.videoFolder || "Basit Social Media/HeyGen Videos");
    state.socialPlatform = String(options.socialPlatform || "auto");
    state.socialTopic = String(options.socialTopic || "");
    state.socialTone = String(options.socialTone || "friendly");
    state.socialExtra = String(options.socialExtra || "");
    state.whatsappSourceName = String(options.whatsappSourceName || "");
    state.whatsappReceiverName = String(options.whatsappReceiverName || "");
    state.wordTopic = String(options.wordTopic || "");
    state.autoWordSave = Boolean(options.autoWordSave);
    state.autoCodexSave = Boolean(options.autoCodexSave);
    state.driveAutoSave = Boolean(options.driveAutoSave);
    state.driveTitle = String(options.driveTitle || "");
    state.wordSaveMode = String(options.wordSaveMode || "full");
    state.wordOpenAfterSave = Boolean(options.wordOpenAfterSave);
    state.desktopTarget = String(options.desktopTarget || "focused");
    state.desktopPasteDelay = String(options.desktopPasteDelay || "3");
    state.desktopOpenTarget = Boolean(options.desktopOpenTarget);
    state.limitGuardEnabled = options.limitGuardEnabled !== false;
    state.limitCooldownMinutes = String(options.limitCooldownMinutes || "10");
    state.stopAfterN = String(Math.max(0, Number.parseInt(options.stopAfterN || "0", 10) || 0));
    state.autoScroll = options.autoScroll !== false;
    state.minResponseChars = String(Math.max(0, Number.parseInt(options.minResponseChars || "0", 10) || 0));
    state.scheduledStartTime = String(options.scheduledStartTime || "");
    state.sleepFrom = String(options.sleepFrom || "");
    state.sleepUntil = String(options.sleepUntil || "");
    state.stopKeywords = String(options.stopKeywords || "");
    state.customInputSelector = String(options.customInputSelector || "");
    state.customSendSelector = String(options.customSendSelector || "");
    state.pauseOnHidden = Boolean(options.pauseOnHidden);
    state.webhookUrl = String(options.webhookUrl || "");
    state.webhookOnStop = Boolean(options.webhookOnStop);
    // ARIA v4.9.0 - Feature 1: Multi-Tab Sync Mode
    state.syncMode = ["off", "leader", "follower"].includes(String(options.syncMode || "off")) ? String(options.syncMode || "off") : "off";
    // ARIA v4.9.0 - Feature 3: Token / Credit Budget Tracker
    state.tokenBudget = String(Math.max(0, Number.parseInt(options.tokenBudget || "0", 10) || 0));
    state.tokenSpent = Math.max(0, Number.parseInt(options.tokenSpent || state.tokenSpent || "0", 10) || 0);
    // ARIA v4.9.0 - Feature 4: Response Quality Filter
    state.skipShortReplies = Boolean(options.skipShortReplies);
    state.minReplyWords = String(Math.max(1, Number.parseInt(options.minReplyWords || "10", 10) || 10));
    // ARIA v4.9.0 - Feature 5: Auto-Regenerate on Error Response
    state.autoRegen = Boolean(options.autoRegen);
    state.regenKeywords = String(options.regenKeywords || DEFAULTS.regenKeywords);
    // ARIA v4.9.0 - Feature 6: Image Auto-Save Filter by Keyword
    state.imageSaveFilter = String(options.imageSaveFilter || "");
    // ARIA v4.9.0 - Feature 10: Auto Screenshot on Stop
    state.screenshotOnStop = Boolean(options.screenshotOnStop);
    // ARIA v4.9.0 - Feature 12: Prompt Chaining Across Tabs
    state.chainTargetTabId = String(Math.max(0, Number.parseInt(options.chainTargetTabId || "0", 10) || 0));
    // ARIA v4.9.0 - Feature 13: Clipboard Watch Mode
    state.clipboardWatch = Boolean(options.clipboardWatch);
    state.pipelineTopic = String(options.pipelineTopic || "");
    state.codingTarget = String(options.codingTarget || "codex");
    state.appRouterTask = String(options.appRouterTask || "");
    state.clickupChatgptSendNow = options.clickupChatgptSendNow !== false;
    state.manusMaxSends = Math.max(1, Number.parseInt(options.manusMaxSends || DEFAULTS.manusMaxSends, 10) || 300);
    state.manusMorningRefresh = options.manusMorningRefresh !== false;
    state.manusMorningRefreshHour = String(options.manusMorningRefreshHour || DEFAULTS.manusMorningRefreshHour);
    state.manusFallbackText = String(options.manusFallbackText || DEFAULTS.manusFallbackText);
    state.scholarshipProfile = String(options.scholarshipProfile || DEFAULTS.scholarshipProfile);
    state.scholarshipExtra = String(options.scholarshipExtra || DEFAULTS.scholarshipExtra);
    state.antigravityModelOrder = String(options.antigravityModelOrder || DEFAULTS.antigravityModelOrder);
    state.antigravityAutoSwitchModel = Boolean(options.antigravityAutoSwitchModel);
    state.antigravityConfirmPermissions = Boolean(options.antigravityConfirmPermissions);
    if (oldClipboardWatch !== state.clipboardWatch) {
      if (state.clipboardWatch && state.running) startClipboardWatch();
      else stopClipboardWatch();
    }
    syncPanelInputs();
  }

  async function saveOptionsFromState() {
    const options = {
      mode: state.mode,
      seconds: String(Math.max(1, Math.round(state.intervalMs / 1000))),
      sendMode: state.sendMode,
      customText: state.customText,
      nextNumber: String(state.nextNumber),
      smartPromptInstruction: state.smartPromptInstruction,
      initialPrompt: state.initialPrompt,
      sendPromptFirst: state.sendPromptFirst,
      promptQueue: state.promptQueue,
      usePromptQueue: state.usePromptQueue,
      imageFolder: getImageFolder(),
      videoTopicPrompt: state.videoTopicPrompt,
      videoFolder: getVideoFolder(),
      socialPlatform: state.socialPlatform,
      socialTopic: state.socialTopic,
      socialTone: state.socialTone,
      socialExtra: state.socialExtra,
      whatsappSourceName: state.whatsappSourceName,
      whatsappReceiverName: state.whatsappReceiverName,
      wordTopic: state.wordTopic,
      autoWordSave: state.autoWordSave,
      autoCodexSave: state.autoCodexSave,
      driveAutoSave: state.driveAutoSave,
      driveTitle: state.driveTitle,
      wordSaveMode: state.wordSaveMode,
      wordOpenAfterSave: state.wordOpenAfterSave,
      desktopTarget: state.desktopTarget || "focused",
      desktopPasteDelay: state.desktopPasteDelay || "3",
      desktopOpenTarget: Boolean(state.desktopOpenTarget),
      limitGuardEnabled: state.limitGuardEnabled !== false,
      limitCooldownMinutes: state.limitCooldownMinutes || "10",
      stopAfterN: state.stopAfterN || "0",
      autoScroll: state.autoScroll !== false,
      minResponseChars: state.minResponseChars || "0",
      // ARIA v4.26.7 - Self-Healing Failed Send Retry
      selfHealFailedSends: state.selfHealFailedSends !== false,
      selfHealRetryMs: String(Math.max(30000, Number.parseInt(state.selfHealRetryMs || "60000", 10) || 60000)),
      scheduledStartTime: state.scheduledStartTime || "",
      sleepFrom: state.sleepFrom || "",
      sleepUntil: state.sleepUntil || "",
      stopKeywords: state.stopKeywords || "",
      customInputSelector: state.customInputSelector || "",
      customSendSelector: state.customSendSelector || "",
      pauseOnHidden: Boolean(state.pauseOnHidden),
      webhookUrl: state.webhookUrl || "",
      webhookOnStop: Boolean(state.webhookOnStop),
      syncMode: state.syncMode || "off",
      tokenBudget: state.tokenBudget || "0",
      tokenSpent: Math.max(0, Number.parseInt(state.tokenSpent || "0", 10) || 0),
      skipShortReplies: Boolean(state.skipShortReplies),
      minReplyWords: state.minReplyWords || "10",
      autoRegen: Boolean(state.autoRegen),
      regenKeywords: state.regenKeywords || DEFAULTS.regenKeywords,
      imageSaveFilter: state.imageSaveFilter || "",
      screenshotOnStop: Boolean(state.screenshotOnStop),
      chainTargetTabId: state.chainTargetTabId || "0",
      clipboardWatch: Boolean(state.clipboardWatch),
      pipelineTopic: state.pipelineTopic,
      codingTarget: state.codingTarget || "codex",
      appRouterTask: state.appRouterTask || "",
      clickupChatgptSendNow: state.clickupChatgptSendNow !== false,
      manusMaxSends: String(state.manusMaxSends || 300),
      manusMorningRefresh: state.manusMorningRefresh !== false,
      manusMorningRefreshHour: String(state.manusMorningRefreshHour || "7"),
      manusFallbackText: state.manusFallbackText || "do what is best",
      scholarshipProfile: state.scholarshipProfile || "",
      scholarshipExtra: state.scholarshipExtra || "",
      antigravityModelOrder: state.antigravityModelOrder || DEFAULTS.antigravityModelOrder,
      antigravityAutoSwitchModel: Boolean(state.antigravityAutoSwitchModel),
      antigravityConfirmPermissions: Boolean(state.antigravityConfirmPermissions)
    };
    storageSet({ [OPTIONS_KEY]: options });
  }

  function requestTabScope() {
    sendRuntime({ type: "ARIA_SUPER_GET_TAB_ID" }).then((reply) => {
      if (!reply || reply.tabId === undefined || reply.tabId === null) return;
      const token = `tab-${reply.tabId}`;
      if (tabScopeToken === token) return;
      tabScopeToken = token;
      ensureCounterScope(true);
    });
  }

  function acceptKnownTabId(tabId) {
    if (tabId === undefined || tabId === null) return;
    const n = Number.parseInt(tabId, 10);
    if (!Number.isFinite(n)) return;
    const token = `tab-${n}`;
    if (tabScopeToken === token) return;
    tabScopeToken = token;
    ensureCounterScope(true);
  }

  function scopeBase() {
    try {
      const url = new URL(location.href);
      const conversationId = url.searchParams.get("conversationId") || url.searchParams.get("chatId") || url.searchParams.get("threadId");
      if (conversationId) return `${url.host}:conversation:${conversationId}`;
      const chat = url.pathname.match(/\/c\/([^/?#]+)/i);
      if (chat && chat[1]) return `${url.host}:conversation:${chat[1]}`;
      return `${url.host}:${url.pathname.replace(/\/+$/, "") || "/"}:${url.search || ""}`;
    } catch (err) {
      return `${location.href}`;
    }
  }

  function counterScope() {
    return `${scopeBase()}:${tabScopeToken || PAGE_SCOPE_ID}`;
  }

  function readRunCount(scope) {
    try {
      const saved = Number.parseInt(sessionStorage.getItem(COUNT_PREFIX + scope) || "0", 10);
      return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveRunCount() {
    try {
      sessionStorage.setItem(COUNT_PREFIX + state.counterScope, String(state.runCount));
    } catch (err) {}
  }

  function parsePromptQueue(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    const blocks = raw.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
    if (blocks.length > 1) return blocks;
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^\s*(?:[-*]|\d{1,4}[.)\]:-])\s*/, "").trim())
      .filter(Boolean);
  }

  function queueItems() {
    return parsePromptQueue(state.promptQueue);
  }

  function readQueueIndex(scope) {
    try {
      const saved = Number.parseInt(sessionStorage.getItem(QUEUE_PREFIX + scope) || "0", 10);
      return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveQueueIndex() {
    try {
      sessionStorage.setItem(QUEUE_PREFIX + state.counterScope, String(state.queueIndex));
    } catch (err) {}
  }

  function cooldownStorageKey(scope) {
    return LIMIT_COOLDOWN_PREFIX + (scope || state.counterScope || counterScope());
  }

  function readLimitCooldown(scope) {
    try {
      const key = cooldownStorageKey(scope);
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!raw) return { until: 0, reason: "" };
      const data = JSON.parse(raw);
      return {
        until: Math.max(0, Number(data.until) || 0),
        reason: String(data.reason || "")
      };
    } catch (err) {
      return { until: 0, reason: "" };
    }
  }

  function saveLimitCooldown() {
    try {
      const key = cooldownStorageKey();
      if (state.limitCooldownUntil > Date.now()) {
        const value = JSON.stringify({
          until: state.limitCooldownUntil,
          reason: state.limitCooldownReason || "AI limit detected"
        });
        localStorage.setItem(key, value);
        sessionStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    } catch (err) {}
  }

  function clearLimitCooldown() {
    state.limitCooldownUntil = 0;
    state.limitCooldownReason = "";
    saveLimitCooldown();
  }

  // ARIA v4.26.1 - Limit Guard hard OFF repair
  // Older versions saved cooldowns per URL scope. When the user turns the guard
  // off or clears the wait, remove every ARIA cooldown key so a stale scope
  // cannot silently block the next prompt.
  function clearAllLimitCooldowns() {
    [localStorage, sessionStorage].forEach((store) => {
      try {
        for (let i = store.length - 1; i >= 0; i -= 1) {
          const key = store.key(i);
          if (key && key.startsWith(LIMIT_COOLDOWN_PREFIX)) store.removeItem(key);
        }
      } catch (err) {}
    });
    state.limitCooldownUntil = 0;
    state.limitCooldownReason = "";
  }

  function limitGuardStatusText() {
    const cooldown = currentLimitCooldown();
    return [
      "Limit Guard Pro",
      `Guard: ${state.limitGuardEnabled === false ? "OFF" : "ON"}`,
      `Fallback cooldown: ${state.limitCooldownMinutes || "10"}m`,
      `Current wait: ${cooldown.active ? formatDuration(cooldown.remainingMs) : "none"}`,
      `Reason: ${cooldown.active ? cooldown.reason : "--"}`
    ].join("\n");
  }

  async function toggleLimitGuard(force) {
    state.limitGuardEnabled = typeof force === "boolean" ? force : state.limitGuardEnabled === false;
    if (state.limitGuardEnabled === false) clearAllLimitCooldowns();
    await saveOptionsFromState();
    const msg = state.limitGuardEnabled === false
      ? "Limit Guard OFF. ARIA will not auto-wait on visible limit/rate messages."
      : "Limit Guard ON. ARIA will pause when limit/rate messages are visible.";
    setStatus(`${msg}\n${limitGuardStatusText()}`);
    return { ok: true, message: msg, ...currentStatus() };
  }

  async function pauseLimitGuard(minutes, reason) {
    const safeMinutes = Math.max(1, Math.min(1440, Number.parseInt(minutes || state.limitCooldownMinutes || "10", 10) || 10));
    state.limitGuardEnabled = true;
    state.limitCooldownMinutes = String(Math.max(5, Number.parseInt(state.limitCooldownMinutes || "10", 10) || 10));
    state.limitCooldownUntil = Date.now() + safeMinutes * 60 * 1000;
    state.limitCooldownReason = reason || `Manual pause for ${safeMinutes} minutes`;
    saveLimitCooldown();
    await saveOptionsFromState();
    const msg = `Manual limit wait set for ${safeMinutes} minute(s).`;
    setStatus(`${msg}\n${limitGuardStatusText()}`);
    return { ok: true, message: msg, ...currentStatus() };
  }

  async function clearLimitGuardWait() {
    clearAllLimitCooldowns();
    await saveOptionsFromState();
    const msg = "Limit wait cleared. ARIA can send again when the page is ready.";
    setStatus(`${msg}\n${limitGuardStatusText()}`);
    return { ok: true, message: msg, ...currentStatus() };
  }

  function ensureCounterScope(force) {
    const next = counterScope();
    if (!force && state.counterScope === next) return;
    if (state.counterScope && state.counterScope !== next) clearResponseAckWait();
    state.counterScope = next;
    state.runCount = readRunCount(next);
    state.queueIndex = readQueueIndex(next);
    const cooldown = readLimitCooldown(next);
    state.limitCooldownUntil = cooldown.until;
    state.limitCooldownReason = cooldown.reason;
    updatePanelMeta();
  }

  function setRunCount(nextCount) {
    state.runCount = Math.max(0, Number.parseInt(nextCount, 10) || 0);
    saveRunCount();
    updatePanelMeta();
  }

  function nextText() {
    if (state.sendMode === "dot") return ".";
    if (state.sendMode === "custom") return state.customText || "continue";
    if (state.sendMode === "smart") return state.lastSmartPrompt || "Smart AI prompt";
    if (state.sendMode === "manus") return state.manusLastReply || "next";
    return String(state.nextNumber + state.runCount);
  }

  function promptQueued() {
    return Boolean(state.sendPromptFirst && !state.promptSent && state.initialPrompt.trim());
  }

  function queueQueued() {
    return Boolean(state.usePromptQueue && state.queueIndex < queueItems().length);
  }

  function nextQueueText() {
    return queueItems()[state.queueIndex] || "";
  }

  function nextSendPayload() {
    if (promptQueued()) return { kind: "prompt", text: state.initialPrompt.trim() };
    if (queueQueued()) return { kind: "queue", text: nextQueueText() };
    return { kind: "sequence", text: nextText() };
  }

  function localSmartPromptFallback() {
    const latest = latestResponseText({ ignoreSelection: true }).replace(/\s+/g, " ").trim();
    const lower = latest.toLowerCase();
    if (lower.match(/error|failed|traceback|exception|not working|bug/)) {
      return "Please diagnose this error from the last response, give the exact root cause, then provide the corrected files or commands only.";
    }
    if (lower.match(/missing|paste|send me|provide|screenshot|first 20 lines|log/)) {
      return "Please tell me the exact smallest file, log, screenshot, or command output you need next, and why it is required.";
    }
    if (lower.match(/zip|complete|all files complete|download link|final package/)) {
      return "Please prepare the final ZIP/package checklist, verification steps, and any remaining files needed to finish cleanly.";
    }
    return "Continue from the last response with the next best implementation step. Include complete filenames and full code blocks where code is needed, and do not repeat previous files.";
  }

  async function generateSmartPrompt() {
    const rows = allResponseTexts().slice(-4).map((row) => row.text || "").filter(Boolean);
    const payload = {
      site: siteKind(),
      title: document.title || "",
      url: location.href,
      instruction: state.smartPromptInstruction || "",
      latestResponse: latestResponseText({ ignoreSelection: true }),
      recentResponses: rows,
      nextNumber: String(state.nextNumber + state.runCount),
      sendCount: state.runCount
    };
    const reply = await sendRuntime({ type: "ARIA_SUPER_SMART_PROMPT", payload });
    const text = String((reply && reply.text) || "").trim() || localSmartPromptFallback();
    state.lastSmartPrompt = text;
    updatePanelMeta();
    if (reply && reply.warning) setStatus(`Smart prompt fallback/notice: ${reply.warning}\n\n${previewText(text)}`);
    return text;
  }

  async function nextSendPayloadAsync() {
    // ARIA v4.9.0 - Feature 8: Conditional Next Prompt
    if (state.conditionalNextPrompt) {
      const text = state.conditionalNextPrompt;
      state.conditionalNextPrompt = "";
      return finalizeSendPayload({ kind: "conditional", text });
    }
    if (promptQueued()) return finalizeSendPayload({ kind: "prompt", text: state.initialPrompt.trim() });
    if (queueQueued()) return finalizeSendPayload({ kind: "queue", text: nextQueueText() });
    if (state.sendMode === "smart") return finalizeSendPayload({ kind: "smart", text: await generateSmartPrompt() });
    if (resolvedMode() === "manus" || state.sendMode === "manus") return finalizeSendPayload(manusNextPayload());
    return finalizeSendPayload(nextSendPayload());
  }

  function previewText(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length > 80 ? clean.slice(0, 77) + "..." : clean;
  }

  function nextPreviewText() {
    if (promptQueued()) return "[full prompt first]";
    if (queueQueued()) {
      const total = queueItems().length;
      return `[queue ${state.queueIndex + 1}/${total}] ${previewText(nextQueueText())}`;
    }
    if (state.sendMode === "smart") return `[smart] ${previewText(state.lastSmartPrompt || "AI will generate next prompt")}`;
    if (resolvedMode() === "manus" || state.sendMode === "manus") return `[manus] ${previewText(state.manusLastReply || "next")}`;
    return previewText(nextText());
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 4 && rect.height > 4 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function inPanel(el) {
    return Boolean(el && el.closest && el.closest("#" + PANEL_ID));
  }

  function textOf(el) {
    return String(
      (el && (el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || el.placeholder || el.value)) || ""
    ).trim();
  }

  // ARIA v4.26.0 - Google AI Studio prompt sender repair
  // Google AI Studio and a few coding-agent sites hide their prompt editors
  // inside open web-component shadow roots. A plain document.querySelectorAll
  // misses those nodes, which made "Run this tab" look alive while no prompt
  // was actually being sent. Keep the same qAll() API but scan open shadows too.
  function qAll(selector, root = document) {
    const results = [];
    const seen = new Set();
    const add = (el) => {
      if (el && !seen.has(el)) {
        seen.add(el);
        results.push(el);
      }
    };
    const scan = (node) => {
      if (!node || !node.querySelectorAll) return;
      try {
        node.querySelectorAll(selector).forEach(add);
      } catch (err) {}
      let children = [];
      try {
        children = Array.from(node.querySelectorAll("*"));
      } catch (err) {}
      children.forEach((child) => {
        if (child.shadowRoot) scan(child.shadowRoot);
      });
    };
    scan(root);
    return results;
  }

  function inputScore(el) {
    const rect = el.getBoundingClientRect();
    const label = `${textOf(el)} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("data-placeholder") || ""}`.toLowerCase();
    let score = 0;
    if (label.match(/\b(message|prompt|ask|reply|comment|queue|what do|send|chat|input|tell ai|continue|type @|write your message|describe what to build|follow-up changes|task|agent|enter a prompt|type a prompt|type something|ask anything)\b/)) score += 140;
    if (label.match(/\b(search|filter|find|email|password|username|phone)\b/)) score -= 140;
    if (el.matches("[contenteditable='true'], textarea, [role='textbox'], .ProseMirror, #prompt-textarea, [data-testid*='prompt' i]")) score += 80;
    if (rect.width > 260) score += 40;
    if (rect.height > 28) score += 20;
    score += Math.min(80, Math.max(0, rect.top / Math.max(1, innerHeight)) * 80);
    if (document.activeElement === el || (el.contains && el.contains(document.activeElement))) score += 60;
    return score;
  }

  function findInput() {
    const kind = siteKind();
    // ARIA v4.26.0 - Google AI Studio prompt sender repair
    // AI Studio often uses Angular Material textareas or editor wrappers where
    // the generic input ranking can accidentally choose a search box. Prefer
    // prompt/editor-like controls before falling back to the universal scanner.
    if (kind === "aistudio") {
      const studioInput = findAiStudioInput();
      if (studioInput) return studioInput;
    }
    const selectors = [];
    // ARIA v4.8.0 — Feature 7: Per-site custom selectors
    const customInputSelector = String(state.customInputSelector || "").trim();
    if (customInputSelector) {
      try {
        const custom = qAll(customInputSelector).find((el) => visible(el) && !inPanel(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
        if (custom) return custom;
      } catch (err) {
        setStatus(`Custom input selector error: ${err.message || err}`);
      }
    }
    if (kind === "chatgpt") {
      selectors.push("#prompt-textarea", "[data-testid='prompt-textarea']", "div[contenteditable='true'][role='textbox']", "[data-testid*='composer' i] textarea");
    }
    if (kind === "clickup") {
      selectors.push("[contenteditable='true']", "textarea", "[role='textbox']");
    }
    if (kind === "gemini" || kind === "aistudio") {
      // ARIA v4.8.0 — Feature 7: Per-site custom selectors, plus built-in Google AI Studio support
      selectors.push(
        "textarea[aria-label*='prompt' i]",
        "textarea[placeholder*='prompt' i]",
        "textarea[placeholder*='Enter a prompt' i]",
        "textarea[placeholder*='Start typing' i]",
        "textarea[placeholder*='Ask' i]",
        "textarea[aria-label*='Ask' i]",
        "[role='textbox'][contenteditable='true']",
        "div[contenteditable='true'][role='textbox']",
        "[contenteditable='true'][aria-label*='prompt' i]",
        "[contenteditable='true'][aria-label*='Ask' i]",
        "textarea[aria-label*='type something' i]",
        "textarea[placeholder*='type something' i]",
        "textarea[aria-label*='message' i]",
        "textarea[placeholder*='message' i]",
        "textarea[aria-label*='input' i]",
        "textarea[placeholder*='input' i]",
        "ms-prompt-input",
        "ms-prompt-input [contenteditable='true']",
        "ms-prompt-input textarea",
        "ms-prompt-input .cm-content",
        ".cm-content[contenteditable='true']",
        "div.cm-line",
        "ms-text-chunk textarea",
        "bard-text-input textarea"
      );
    }
    selectors.push(
      "textarea",
      "input[type='text']",
      "input[type='search']",
      "textarea[placeholder*='message' i]",
      "input[placeholder*='message' i]",
      "div[contenteditable='true']",
      "[role='textbox']",
      "[aria-label*='message' i]",
      "[aria-label*='prompt' i]",
      "[data-placeholder*='message' i]",
      "[data-placeholder*='prompt' i]",
      ".ProseMirror",
      "[data-lexical-editor='true']",
      "[data-slate-editor='true']",
      "[data-testid*='input' i]",
      "[data-testid*='prompt' i]"
    );
    const allCandidates = [];
    for (const selector of selectors) {
      const candidates = qAll(selector).filter((el) => visible(el) && !inPanel(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
      candidates.forEach((el) => allCandidates.push(el));
    }
    const unique = [];
    const seen = new Set();
    for (const el of allCandidates) {
      if (seen.has(el)) continue;
      seen.add(el);
      unique.push(el);
    }
    unique.sort((a, b) => inputScore(b) - inputScore(a));
    return unique.length ? unique[0] : null;
  }

  // ARIA v4.26.0 - Google AI Studio prompt sender repair
  function findAiStudioInput() {
    const selectors = [
      "textarea[aria-label*='prompt' i]",
      "textarea[placeholder*='prompt' i]",
      "textarea[aria-label*='type something' i]",
      "textarea[placeholder*='type something' i]",
      "textarea[aria-label*='message' i]",
      "textarea[placeholder*='message' i]",
      "textarea[aria-label*='input' i]",
      "textarea[placeholder*='input' i]",
      "ms-prompt-input textarea",
      "ms-prompt-input [contenteditable='true']",
      "ms-prompt-input .cm-content",
      "[data-testid*='prompt' i] textarea",
      "[data-testid*='input' i] textarea",
      ".cm-content[contenteditable='true']",
      "[role='textbox'][contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
      "textarea"
    ];
    const candidates = [];
    const seen = new Set();
    selectors.forEach((selector) => {
      try {
        qAll(selector).forEach((el) => {
          if (!el || seen.has(el) || !visible(el) || inPanel(el)) return;
          if (el.disabled || el.readOnly || el.getAttribute("aria-disabled") === "true") return;
          const label = `${textOf(el)} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("data-placeholder") || ""}`.toLowerCase();
          if (label.match(/\b(search|filter|api key|model|temperature|top p|token|safety|schema)\b/)) return;
          let score = inputScore(el);
          if (label.match(/\b(prompt|type something|message|input|ask)\b/)) score += 180;
          if (selector.includes("ms-prompt-input") || selector.includes("cm-content")) score += 120;
          const rect = el.getBoundingClientRect();
          if (rect.top > innerHeight * 0.35) score += 80;
          seen.add(el);
          candidates.push({ el, score });
        });
      } catch (err) {}
    });
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length ? candidates[0].el : null;
  }

  function inputTextValue(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return String(el.value || "");
    return String(el.innerText || el.textContent || "");
  }

  function dispatchTextEvents(el, text) {
    try {
      el.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: "insertText",
        data: text
      }));
    } catch (err) {}
    try {
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: "insertText",
        data: text
      }));
    } catch (err) {
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    try {
      el.dispatchEvent(new KeyboardEvent("keyup", {
        key: text ? text.slice(-1) : " ",
        code: text ? "KeyA" : "Space",
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    } catch (err) {}
  }

  // ARIA v4.26.9 - Native Input Commit Bridge
  function nativeSetValue(el, text) {
    if (!el || !(el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return false;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = descriptor && descriptor.set;
    if (setter) setter.call(el, String(text || ""));
    else el.value = String(text || "");
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch (err) {}
    return true;
  }

  // ARIA v4.26.9 - Native Input Commit Bridge
  function selectEditableContents(el) {
    if (!el) return false;
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (err) {
      return false;
    }
  }

  // ARIA v4.26.9 - Native Input Commit Bridge
  function commitTextToEditable(el, text) {
    if (!el) return false;
    const clean = String(text || "");
    try { el.focus(); } catch (err) {}
    try { el.click(); } catch (err) {}
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      nativeSetValue(el, "");
      dispatchTextEvents(el, "");
      nativeSetValue(el, clean);
      dispatchTextEvents(el, clean);
      return inputTextValue(el).includes(clean.slice(0, Math.min(20, clean.length)));
    }
    selectEditableContents(el);
    try {
      document.execCommand("delete", false, null);
    } catch (err) {}
    dispatchTextEvents(el, "");
    try {
      document.execCommand("insertText", false, clean);
    } catch (err) {}
    dispatchTextEvents(el, clean);
    if (!inputTextValue(el).includes(clean.slice(0, Math.min(20, clean.length)))) {
      try {
        el.textContent = clean;
        dispatchTextEvents(el, clean);
      } catch (err) {}
    }
    return inputTextValue(el).includes(clean.slice(0, Math.min(20, clean.length)));
  }

  // ARIA v4.26.0 - Google AI Studio prompt sender repair
  function setAiStudioInputText(el, value) {
    if (!el) return false;
    const text = String(value || "");
    const target = el.matches && el.matches("textarea,input,[contenteditable='true'],.cm-content")
      ? el
      : (el.querySelector && (el.querySelector("textarea") || el.querySelector("[contenteditable='true']") || el.querySelector(".cm-content")));
    if (!target) return false;
    return commitTextToEditable(target, text);
  }

  function setInputText(el, value) {
    // ARIA v4.26.0 - Google AI Studio prompt sender repair
    if (siteKind() === "aistudio" && setAiStudioInputText(el, value)) {
      state.lastAttemptedText = String(value || "");
      return;
    }
    const text = String(value);
    // ARIA v4.8.0 — Feature 5: Auto-clear input before send
    const currentText = inputTextValue(el).trim();
    const staleText = String(state.lastAttemptedText || "").trim();
    if (currentText && staleText && (currentText === staleText || currentText.includes(staleText))) {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        el.value = "";
        dispatchTextEvents(el, "");
      } else {
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand("delete", false, null);
          dispatchTextEvents(el, "");
        } catch (err) {
          el.textContent = "";
          dispatchTextEvents(el, "");
        }
      }
    }
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      commitTextToEditable(el, text);
      return;
    }
    commitTextToEditable(el, text);
  }

  function dispatchEnter(el, ctrlKey) {
    ["keydown", "keypress", "keyup"].forEach((type) => {
      el.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        ctrlKey: Boolean(ctrlKey),
        metaKey: false,
        bubbles: true,
        cancelable: true
      }));
    });
  }

  function pressEnter(el) {
    dispatchEnter(el, false);
    dispatchEnter(el, true);
  }

  function buttonMatchesSend(btn) {
    const label = textOf(btn).toLowerCase();
    const aria = String(btn.getAttribute("aria-label") || "").toLowerCase();
    const title = String(btn.getAttribute("title") || btn.getAttribute("mattooltip") || btn.getAttribute("data-tooltip") || "").toLowerCase();
    const test = `${label} ${aria} ${title}`;
    if (test.match(/\b(send|submit|continue|run|run prompt|enter|ask|go|next)\b/)) return true;
    if (test.match(/\b(play_arrow|play_circle|arrow_upward|send_message)\b/)) return true;
    if (btn.matches("[data-testid*='send' i], [aria-label*='send' i], button[type='submit']")) return true;
    return false;
  }

  function riskyButtonLabel(label) {
    return String(label || "").toLowerCase().match(
      /\b(stop|cancel|delete|remove|close|logout|sign out|pay|buy|subscribe|checkout|publish|post|share|repost|retweet|like|follow|unfollow|connect|message|dm|block|report)\b/
    );
  }

  function inputCenters(input, btn) {
    const inputRect = input.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      inputX: inputRect.left + inputRect.width / 2,
      inputY: inputRect.top + inputRect.height / 2,
      btnX: btnRect.left + btnRect.width / 2,
      btnY: btnRect.top + btnRect.height / 2
    };
  }

  function sendButtonDistance(input, btn) {
    const p = inputCenters(input, btn);
    return Math.hypot(p.inputX - p.btnX, p.inputY - p.btnY);
  }

  function candidateContainers(input) {
    const containers = [];
    let node = input;
    for (let i = 0; node && i < 8; i += 1) {
      if (node.querySelectorAll) containers.push(node);
      if (node.matches && node.matches("form, [role='form'], main, article")) break;
      node = node.parentElement;
    }
    containers.push(document);
    return containers;
  }

  function findSendButtonNearInput(input) {
    // ARIA v4.8.0 — Feature 7: Per-site custom selectors
    const customSendSelector = String(state.customSendSelector || "").trim();
    if (customSendSelector) {
      try {
        const custom = qAll(customSendSelector).find((btn) => visible(btn) && !inPanel(btn) && !btn.disabled && btn.getAttribute("aria-disabled") !== "true");
        if (custom) return custom;
      } catch (err) {
        setStatus(`Custom send selector error: ${err.message || err}`);
      }
    }
    const seen = new Set();
    const candidates = [];
    for (const container of candidateContainers(input)) {
      const buttons = Array.from(container.querySelectorAll("button,[role='button'],input[type='submit']"));
      for (const btn of buttons) {
        if (seen.has(btn) || !visible(btn) || inPanel(btn) || btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
        seen.add(btn);
        if (!buttonMatchesSend(btn)) continue;
        candidates.push({ btn, distance: sendButtonDistance(input, btn) });
      }
      if (candidates.length) break;
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.length ? candidates[0].btn : null;
  }

  function findIconSendButtonNearInput(input) {
    const candidates = [];
    const inputRect = input.getBoundingClientRect();
    for (const container of candidateContainers(input)) {
      const buttons = Array.from(container.querySelectorAll("button,[role='button'],input[type='submit']"));
      for (const btn of buttons) {
        if (!visible(btn) || inPanel(btn) || btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
        const rect = btn.getBoundingClientRect();
        const nearBottomRight = rect.left >= inputRect.left - 24 &&
          rect.top >= inputRect.top - 70 &&
          rect.left <= inputRect.right + 180 &&
          rect.top <= inputRect.bottom + 90;
        if (!nearBottomRight) continue;
        const label = textOf(btn).toLowerCase();
        let score = 120 - sendButtonDistance(input, btn);
        if (label.match(/\b(stop|cancel|attach|upload|plus|tools|source|voice|mic|menu)\b/)) score -= 220;
        if (btn.querySelector("svg")) score += 35;
        if (rect.width <= 72 && rect.height <= 72) score += 25;
        candidates.push({ btn, score });
      }
      if (candidates.length) break;
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length && candidates[0].score > -70 ? candidates[0].btn : null;
  }

  // ARIA v4.26.3 - ClickUp send rescue
  // ClickUp's AI composer uses a compact icon button at the far right of the
  // composer. The generic scorer can accidentally hit "All sources" or other
  // nearby controls, so keep a site-specific scorer that prefers the final
  // small button on the right edge of the input.
  function clickUpSendButtonScore(input, btn) {
    if (!input || !btn || !visible(btn) || inPanel(btn) || btn.disabled || btn.getAttribute("aria-disabled") === "true") return -9999;
    const label = `${textOf(btn)} ${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""} ${btn.getAttribute("data-testid") || ""}`.toLowerCase();
    if (label.match(/\b(all sources|source|attach|attachment|upload|file|plus|add|menu|more|copy|thumb|like|dislike|retry|regenerate|enable|remind|notification|close|stop|cancel)\b/)) return -9999;
    const inputRect = input.getBoundingClientRect();
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const verticallyAligned = cy >= inputRect.top - 36 && cy <= inputRect.bottom + 42;
    const rightEdge = cx >= inputRect.right - 95 && cx <= inputRect.right + 95;
    const insideOrNearInput = rect.left >= inputRect.left && rect.left <= inputRect.right + 120;
    if (!verticallyAligned || !insideOrNearInput) return -9999;
    let score = 1000 - Math.abs(cx - (inputRect.right - 30)) - Math.abs(cy - (inputRect.top + inputRect.height / 2));
    if (rightEdge) score += 220;
    if (btn.querySelector("svg")) score += 120;
    if (label.match(/\b(send|submit|arrow_upward|send_message|go|enter)\b/)) score += 260;
    if (rect.width <= 70 && rect.height <= 70) score += 90;
    if (rect.left < inputRect.left + inputRect.width * 0.72) score -= 220;
    return score;
  }

  // ARIA v4.26.3 - ClickUp send rescue
  function findClickUpSendButton(input) {
    const seen = new Set();
    const candidates = [];
    for (const container of candidateContainers(input)) {
      const buttons = Array.from(container.querySelectorAll("button,[role='button'],input[type='submit']"));
      for (const btn of buttons) {
        if (seen.has(btn)) continue;
        seen.add(btn);
        const score = clickUpSendButtonScore(input, btn);
        if (score > -500) candidates.push({ btn, score });
      }
      if (candidates.length) break;
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length ? candidates[0].btn : null;
  }

  // ARIA v4.26.3 - ClickUp send rescue
  async function sendClickUpInput(input) {
    const beforeSignature = pageSignature();
    const original = inputTextValue(input);
    const sample = normalizedPromptSample(original, 35);
    const attempts = [];
    const direct = findClickUpSendButton(input);
    if (direct) attempts.push(() => clickElementHard(direct));
    // ARIA v4.27.0 - Native Browser Input Fallback
    if (direct) attempts.push(() => backgroundNativeClick(direct, "ClickUp send arrow"));
    attempts.push(() => clickComposerHotspot(input));
    attempts.push(() => submitClosestForm(input));
    attempts.push(() => {
      pressEnter(input);
      return true;
    });
    attempts.push(() => {
      dispatchEnter(input, true);
      try {
        input.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          metaKey: true,
          bubbles: true,
          cancelable: true
        }));
      } catch (err) {}
      return true;
    });
    for (const attempt of attempts) {
      try {
        const clicked = await attempt();
        if (!clicked) continue;
      } catch (err) {
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 420));
      const fresh = findInput() || input;
      const inputNow = normalizedPromptSample(inputTextValue(fresh), 80);
      const userText = normalizedPromptSample(latestUserPromptText(), 140);
      const prefix = sample.slice(0, Math.min(25, sample.length));
      const promptLeftInput = !sample || !inputNow || !inputNow.includes(prefix);
      if (!sample || (userText && userText.includes(prefix)) || promptLeftInput) {
        return true;
      }
    }
    return false;
  }

  // ARIA v4.26.0 - Google AI Studio prompt sender repair
  function aiStudioRunButtonScore(input, btn) {
    if (!btn || !visible(btn) || inPanel(btn) || btn.disabled || btn.getAttribute("aria-disabled") === "true") return -9999;
    const label = `${textOf(btn)} ${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""} ${btn.getAttribute("mattooltip") || ""} ${btn.getAttribute("data-tooltip") || ""}`.toLowerCase();
    if (label.match(/\b(stop|cancel|settings|safety|api key|model|clear|delete|share|copy|get code|view code|history|examples|preview|restore|dismiss|learn more|mic|microphone|voice|record|audio|attach|attachment|upload|add|plus|image|photo|file|source|tools|menu)\b/)) return -9999;
    let score = 0;
    if (label.match(/\brun\b|\brun prompt\b|\bsend\b|\bsubmit\b|\bgenerate\b|\bask\b/)) score += 260;
    if (label.match(/play_arrow|play_circle|arrow_upward|send_message/)) score += 220;
    if (btn.matches("[aria-label*='run' i],[aria-label*='send' i],[title*='run' i],[data-testid*='run' i],[data-testid*='send' i],button[type='submit']")) score += 160;
    const rect = btn.getBoundingClientRect();
    if (rect.width <= 96 && rect.height <= 96) score += 40;
    if (input) {
      const inputRect = input.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nearVertical = cy >= inputRect.top - 90 && cy <= inputRect.bottom + 90;
      const rightSide = cx >= inputRect.left + inputRect.width * 0.55;
      if (nearVertical && rightSide) score += 140;
      if (nearVertical && cx >= inputRect.right - 150 && cx <= inputRect.right + 130) score += 120;
      if (nearVertical && cx < inputRect.left + inputRect.width * 0.35) score -= 90;
      score -= Math.min(180, sendButtonDistance(input, btn) / 12);
    }
    return score;
  }

  // ARIA v4.26.0 - Google AI Studio prompt sender repair
  function findAiStudioRunButton(input) {
    const selectors = [
      "[aria-label*='run' i]",
      "[aria-label*='send' i]",
      "[title*='run' i]",
      "[role='button'][aria-label*='run' i]",
      "[role='button'][aria-label*='send' i]",
      "ms-run-button",
      "run-button",
      "button[aria-label*='run' i]",
      "button[aria-label*='send' i]",
      "button[title*='run' i]",
      "button[mattooltip*='run' i]",
      "button[data-testid*='run' i]",
      "button[data-testid*='send' i]",
      "button[type='submit']",
      ".mat-mdc-icon-button",
      "mat-icon",
      ".mat-icon",
      "button"
    ];
    const seen = new Set();
    const candidates = [];
    selectors.forEach((selector) => {
      try {
        qAll(selector).forEach((raw) => {
          if (!raw) return;
          const btn = raw.matches && raw.matches("button,[role='button'],input[type='submit']")
            ? raw
            : (raw.closest && raw.closest("button,[role='button'],input[type='submit']"));
          if (!btn || seen.has(btn)) return;
          seen.add(btn);
          const score = aiStudioRunButtonScore(input, btn);
          if (score > 20) candidates.push({ btn, score });
        });
      } catch (err) {}
    });
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length ? candidates[0].btn : null;
  }

  function clickableFromPoint(x, y) {
    const el = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), Math.max(0, Math.min(innerHeight - 1, y)));
    if (!el || inPanel(el)) return null;
    const btn = el.closest && el.closest("button,[role='button'],input[type='submit']");
    if (!btn || !visible(btn) || inPanel(btn) || btn.disabled || btn.getAttribute("aria-disabled") === "true") return null;
    const label = `${textOf(btn)} ${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""}`;
    if (riskyButtonLabel(label)) return null;
    return btn;
  }

  function clickComposerHotspot(input) {
    if (SOCIAL_KINDS.includes(siteKind())) return false;
    const rect = input.getBoundingClientRect();
    const points = [
      [rect.right - 24, rect.bottom - 22],
      [rect.right - 42, rect.bottom - 28],
      [rect.right - 24, rect.top + rect.height / 2],
      [Math.min(innerWidth - 28, rect.right + 28), rect.top + rect.height / 2],
      [rect.left + rect.width - 55, rect.top + rect.height - 28]
    ];
    for (const [x, y] of points) {
      const btn = clickableFromPoint(x, y);
      if (btn) {
        clickElementHard(btn);
        return true;
      }
    }
    return false;
  }

  function standaloneActionScore(btn) {
    const rect = btn.getBoundingClientRect();
    const label = `${textOf(btn)} ${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""}`.toLowerCase();
    if (!label || riskyButtonLabel(label)) return -9999;
    let score = 0;
    if (label.match(/\b(next|continue|resume|run|generate|create|ask|send|submit|go|start|queue)\b/)) score += 220;
    if (label.match(/\b(new thread|new chat|new project|open|upload|download|copy|settings|files|menu|more)\b/)) score -= 180;
    if (btn.matches("[data-testid*='send' i], [aria-label*='send' i], button[type='submit']")) score += 80;
    if (rect.width > 30 && rect.height > 24) score += 20;
    score += Math.min(70, Math.max(0, rect.top / Math.max(1, innerHeight)) * 70);
    return score;
  }

  function findStandaloneActionButton() {
    if (SOCIAL_KINDS.includes(siteKind())) return null;
    const candidates = qAll("button,[role='button'],input[type='submit'],a")
      .filter((btn) => visible(btn) && !inPanel(btn) && !btn.disabled && btn.getAttribute("aria-disabled") !== "true")
      .map((btn) => ({ btn, score: standaloneActionScore(btn) }))
      .filter((item) => item.score > 40);
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length ? candidates[0].btn : null;
  }

  // ARIA v4.26.0 - Google AI Studio prompt sender repair
  function clickElementHard(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" }); } catch (err) {}
    try { el.focus(); } catch (err) {}
    let x = 0;
    let y = 0;
    try {
      const rect = el.getBoundingClientRect();
      x = Math.max(1, Math.min(innerWidth - 2, rect.left + rect.width / 2));
      y = Math.max(1, Math.min(innerHeight - 2, rect.top + rect.height / 2));
    } catch (err) {}
    // ARIA v4.26.9 - Native Input Commit Bridge
    // Modern React/Angular controls often ignore a plain .click(). Dispatch a
    // full pointer/mouse sequence with coordinates so Run/Send behaves like a
    // real user press on ClickUp, Google AI Studio, and similar sites.
    ["pointerover", "pointerenter", "mouseover", "mousemove", "pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      try {
        const isDown = type === "pointerdown" || type === "mousedown";
        const event = type.startsWith("pointer")
          ? new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              pointerId: 1,
              pointerType: "mouse",
              isPrimary: true,
              button: 0,
              buttons: isDown ? 1 : 0,
              clientX: x,
              clientY: y,
              screenX: x,
              screenY: y,
              view: window
            })
          : new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              button: 0,
              buttons: isDown ? 1 : 0,
              clientX: x,
              clientY: y,
              screenX: x,
              screenY: y,
              view: window
            });
        el.dispatchEvent(event);
      } catch (err) {}
    });
    try { el.click(); } catch (err) {}
    return true;
  }

  // ARIA v4.27.0 - Native Browser Input Fallback
  // Chrome's debugger API can dispatch a real browser-level click/key event.
  // Use this only as a last-resort after synthetic DOM clicks leave a prompt
  // visibly stuck in ClickUp, Google AI Studio, or another AI input.
  function nativeElementPoint(el) {
    if (!el || !visible(el) || inPanel(el)) return null;
    try { el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" }); } catch (err) {}
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(1, Math.min(innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(innerHeight - 2, rect.top + rect.height / 2))
    };
  }

  // ARIA v4.27.0 - Native Browser Input Fallback
  function sendRuntimeMessage(payload) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
          resolve({ ok: false, error: "Runtime messaging unavailable." });
          return;
        }
        chrome.runtime.sendMessage(payload, (reply) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(reply || { ok: false, error: "No background reply." });
          }
        });
      } catch (err) {
        resolve({ ok: false, error: String(err && err.message || err) });
      }
    });
  }

  // ARIA v4.27.0 - Native Browser Input Fallback
  async function backgroundNativeClick(el, label) {
    const point = nativeElementPoint(el);
    if (!point) return false;
    try { el.focus(); } catch (err) {}
    const reply = await sendRuntimeMessage({
      type: "ARIA_SUPER_NATIVE_CLICK",
      x: point.x,
      y: point.y,
      label: label || "native click",
      site: siteKind()
    });
    return Boolean(reply && reply.ok);
  }

  // ARIA v4.27.0 - Native Browser Input Fallback
  async function backgroundNativeEnter(input, options = {}) {
    if (!input || inPanel(input)) return false;
    try { input.focus(); } catch (err) {}
    try { input.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" }); } catch (err) {}
    const reply = await sendRuntimeMessage({
      type: "ARIA_SUPER_NATIVE_ENTER",
      ctrlKey: Boolean(options.ctrlKey),
      metaKey: Boolean(options.metaKey),
      shiftKey: Boolean(options.shiftKey),
      altKey: Boolean(options.altKey),
      label: options.label || "native Enter",
      site: siteKind()
    });
    return Boolean(reply && reply.ok);
  }

  // ARIA v4.26.9 - Native Input Commit Bridge
  function submitClosestForm(input) {
    const form = input && input.closest && input.closest("form");
    if (!form || inPanel(form)) return false;
    try {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
        return true;
      }
    } catch (err) {}
    try {
      form.dispatchEvent(new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      return true;
    } catch (err) {}
    try {
      form.dispatchEvent(new Event("submit", {
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      return true;
    } catch (err) {}
    return false;
  }

  function diagnosePage() {
    ensureCounterScope();
    const input = findInput();
    const actionButton = input ? null : findStandaloneActionButton();
    const busy = isBusy(input);
    return {
      ok: true,
      site: siteKind(),
      mode: resolvedMode(),
      running: state.running,
      inputFound: Boolean(input),
      inputLabel: input ? previewText(textOf(input) || input.getAttribute("placeholder") || input.getAttribute("aria-label") || input.tagName) : "",
      actionButtonFound: Boolean(actionButton),
      actionButtonLabel: actionButton ? previewText(textOf(actionButton) || actionButton.getAttribute("aria-label") || actionButton.tagName) : "",
      busy: Boolean(busy.busy),
      busyReason: busy.reason,
      nextText: nextPreviewText(),
      runCount: state.runCount,
      url: location.href,
      title: document.title,
      ready: Boolean(!busy.busy && (input || actionButton)),
      message: !busy.busy && (input || actionButton)
        ? "Ready for automation."
        : (busy.busy ? `Waiting: ${busy.reason}` : "No usable input or safe action button found.")
    };
  }

  // ARIA v4.26.2 - Google AI Studio force-send diagnostics
  function aiStudioDiagnoseText() {
    const studioInput = findAiStudioInput();
    const input = studioInput || findInput();
    const runBtn = findAiStudioRunButton(input);
    const busy = isBusy(input);
    const inputText = input ? inputTextValue(input) : "";
    const runLabel = runBtn ? previewText(textOf(runBtn) || runBtn.getAttribute("aria-label") || runBtn.getAttribute("title") || runBtn.tagName, 80) : "";
    return [
      `Site: ${siteKind()}`,
      `Input found: ${input ? "YES" : "NO"}${studioInput ? " (AI Studio prompt)" : ""}`,
      `Input text: ${inputText ? previewText(inputText, 90) : "(empty)"}`,
      `Run button found: ${runBtn ? "YES" : "NO"}${runLabel ? ` (${runLabel})` : ""}`,
      `Busy: ${busy.busy ? `YES - ${busy.reason}` : "NO"}`,
      `Limit guard: ${state.limitGuardEnabled === false ? "OFF" : "ON"}`,
      `Next text: ${nextPreviewText() || "(empty)"}`
    ].join("\n");
  }

  // ARIA v4.26.2 - Google AI Studio force-send fallback
  async function forceAiStudioSend(options) {
    const opts = options || {};
    readPanelInputs();
    await saveOptionsFromState();
    const kind = siteKind();
    const input = findAiStudioInput() || findInput();
    if (!input) {
      const message = `AI Studio force-send failed: no prompt input found.\n${aiStudioDiagnoseText()}`;
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    const payload = opts.text
      ? { kind: "manual", text: String(opts.text) }
      : await nextSendPayloadAsync();
    if (!payload || payload.kind === "stop") {
      const message = (payload && payload.message) || "AI Studio force-send stopped by safety guard.";
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    const text = String(payload.text || "").trim();
    if (!text) {
      const message = "AI Studio force-send failed: next prompt text is empty.";
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    scrollToBottomBeforeSend();
    state.lastAttemptedText = text;
    const injected = kind === "aistudio" ? setAiStudioInputText(input, text) : false;
    if (!injected) setInputText(input, text);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const freshInput = findAiStudioInput() || input;
    const afterText = inputTextValue(freshInput);
    if (!normalizedPromptSample(afterText, 120).includes(normalizedPromptSample(text, 35))) {
      const message = `AI Studio force-send failed: prompt did not stay in input.\n${aiStudioDiagnoseText()}`;
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    // ARIA v4.27.0 - Native Browser Input Fallback
    // Force-send must prove the site accepted the prompt; a clicked Run button
    // alone is not enough on AI Studio because the prompt can remain stuck.
    const accepted = await sendInputAndVerify(freshInput, text);
    if (!accepted.ok) {
      const message = `AI Studio force-send failed: ${accepted.error || accepted.reason || "prompt was not accepted"}.\n${aiStudioDiagnoseText()}`;
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    await addTokenSpend(text);
    scrollInputIntoView(freshInput);
    markSendSuccess();
    state.lastSendAt = Date.now();
    beginResponseAckWait(payload, text);
    resetResponseWatch();
    const message = `${kind === "aistudio" ? "AI Studio" : "Current site"} force-sent ${JSON.stringify(text)}. Waiting for response before next prompt.`;
    setStatus(message);
    schedule(Math.min(state.intervalMs, 5000));
    return { ok: true, message, injected: true, sent: true, ...currentStatus() };
  }

  async function sendInput(input) {
    if (SOCIAL_KINDS.includes(siteKind())) {
      setStatus("Social public actions stay manual. Use social/X helper buttons.");
      return false;
    }
    // ARIA v4.26.3 - ClickUp send rescue
    // Run ClickUp through its own sender before the generic button scanner so
    // the automation does not press the nearby sources/menu controls.
    if (siteKind() === "clickup") {
      return sendClickUpInput(input);
    }
    // ARIA v4.26.0 - Google AI Studio prompt sender repair
    // Google AI Studio usually does not submit with plain Enter. It needs the
    // real Run/play button (or Ctrl/Cmd+Enter as a secondary shortcut).
    if (siteKind() === "aistudio") {
      const studioInput = findAiStudioInput() || input;
      const runBtn = findAiStudioRunButton(studioInput);
      if (runBtn) {
        state.aiStudioLastRunClickAt = Date.now();
        clickElementHard(runBtn);
        return true;
      }
      if (studioInput) {
        state.aiStudioLastRunClickAt = Date.now();
        if (submitClosestForm(studioInput)) return true;
        dispatchEnter(studioInput, true);
        try {
          ["keydown", "keypress", "keyup"].forEach((type) => {
            studioInput.dispatchEvent(new KeyboardEvent(type, {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              ctrlKey: false,
              metaKey: true,
              bubbles: true,
              cancelable: true
            }));
          });
        } catch (err) {}
        return true;
      }
      return false;
    }
    const sendBtn = findSendButtonNearInput(input) || findIconSendButtonNearInput(input);
    if (sendBtn) {
      // ARIA v4.26.6 - Strict Send Acceptance Guard
      // Use the harder event path for modern web apps; a plain .click() can be
      // ignored by React/Angular handlers on some AI chat composers.
      clickElementHard(sendBtn);
      return true;
    }
    if (clickComposerHotspot(input)) return true;
    if (submitClosestForm(input)) return true;
    pressEnter(input);
    return true;
  }

  // ARIA v4.25.0 - Send Acceptance Verification
  function normalizedPromptSample(text, size = 80) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, size).toLowerCase();
  }

  // ARIA v4.25.0 - Send Acceptance Verification
  function latestUserPromptText() {
    const selectorsByKind = {
      chatgpt: [
        "[data-message-author-role='user']",
        "[data-testid*='conversation-turn' i] [data-message-author-role='user']"
      ],
      claude: [
        "[data-testid*='user-message' i]",
        "[class*='user'] [class*='message']"
      ],
      gemini: [
        "user-query",
        "[data-test-id*='user' i]",
        "[class*='user-query' i]"
      ],
      aistudio: [
        "ms-prompt-chunk",
        "user-query",
        "[class*='prompt' i][class*='user' i]"
      ],
      clickup: [
        "[class*='user' i][class*='message' i]",
        "[data-testid*='user' i]"
      ]
    };
    const selectors = selectorsByKind[siteKind()] || [
      "[data-message-author-role='user']",
      "[data-testid*='user' i]",
      "[class*='user' i][class*='message' i]",
      ".user"
    ];
    const nodes = [];
    const seen = new Set();
    selectors.forEach((selector) => {
      try {
        qAll(selector).forEach((el) => {
          if (!el || seen.has(el) || !visible(el) || inPanel(el)) return;
          const text = textOf(el);
          if (text && text.length > 0) {
            seen.add(el);
            nodes.push({ el, text });
          }
        });
      } catch (err) {}
    });
    if (!nodes.length) return "";
    nodes.sort((a, b) => {
      const ar = a.el.getBoundingClientRect();
      const br = b.el.getBoundingClientRect();
      return (ar.top + ar.left / 10000) - (br.top + br.left / 10000);
    });
    return nodes[nodes.length - 1].text || "";
  }

  // ARIA v4.25.0 - Send Acceptance Verification
  function sendAcceptVerifyMs() {
    const value = Number.parseInt(state.sendAcceptVerifyMs || "0", 10);
    // ARIA v4.26.0 - Google AI Studio prompt sender repair
    // AI Studio often keeps the prompt text in place after Run and may take a
    // little longer before a visible response/spinner appears.
    if (siteKind() === "aistudio") return Number.isFinite(value) && value > 0 ? Math.max(3500, value) : 7000;
    // ARIA v4.26.3 - ClickUp send rescue
    // ClickUp sometimes animates before the sent user bubble is discoverable.
    if (siteKind() === "clickup") return Number.isFinite(value) && value > 0 ? Math.max(2500, value) : 5500;
    return Number.isFinite(value) && value > 0 ? Math.max(900, value) : 2600;
  }

  // ARIA v4.26.6 - Strict Send Acceptance Guard
  function promptStillVisibleInInput(input, text) {
    const sample = normalizedPromptSample(text, 55);
    if (!sample) return false;
    const freshInput = findInput() || input;
    const inputText = normalizedPromptSample(inputTextValue(freshInput), 160);
    return Boolean(inputText && inputText.includes(sample.slice(0, Math.min(25, sample.length))));
  }

  // ARIA v4.26.6 - Strict Send Acceptance Guard
  function busyCanVerifySend(input, text, beforeSignature, busyReason) {
    const kind = siteKind();
    const sample = normalizedPromptSample(text, 60);
    const userText = normalizedPromptSample(latestUserPromptText(), 140);
    const stillInInput = promptStillVisibleInInput(input, text);
    const pageChanged = pageSignature() !== beforeSignature;
    if (userText && sample && userText.includes(sample.slice(0, Math.min(35, sample.length)))) {
      return { ok: true, reason: `busy after send: user prompt appeared (${busyReason || "busy"})` };
    }
    if (!stillInInput) {
      return { ok: true, reason: `busy after send: prompt left input (${busyReason || "busy"})` };
    }
    if (kind === "aistudio") {
      const recentRunClick = Date.now() - (state.aiStudioLastRunClickAt || 0) < sendAcceptVerifyMs() + 1600;
      if (recentRunClick && pageChanged) {
        return { ok: true, reason: `AI Studio busy after Run (${busyReason || "busy"})` };
      }
    }
    return { ok: false, reason: `${busyReason || "busy signal"}, but prompt still remains in input` };
  }

  // ARIA v4.25.0 - Send Acceptance Verification
  function promptAccepted(input, text, beforeSignature) {
    const kind = siteKind();
    const sample = normalizedPromptSample(text, 60);
    const freshInput = findInput() || input;
    const inputText = normalizedPromptSample(inputTextValue(freshInput), 120);
    const userText = normalizedPromptSample(latestUserPromptText(), 120);
    const pageChanged = pageSignature() !== beforeSignature;
    // ARIA v4.26.0 - Google AI Studio prompt sender repair
    // AI Studio keeps the editor content after clicking Run, so "input cleared"
    // is not a valid success signal there. A page mutation or response/busy
    // signal after our Run click is the safe acceptance signal.
    if (kind === "aistudio") {
      const latest = extractLatestResponse();
      const recentRunClick = Date.now() - (state.aiStudioLastRunClickAt || 0) < sendAcceptVerifyMs() + 1200;
      if (userText && sample && userText.includes(sample.slice(0, Math.min(35, sample.length)))) {
        return { ok: true, reason: "AI Studio user prompt appeared" };
      }
      if (recentRunClick && pageChanged) return { ok: true, reason: "AI Studio Run changed page" };
      if (recentRunClick && latest && latest.length > 40 && pageChanged) return { ok: true, reason: "AI Studio response area changed" };
      return { ok: false, reason: "AI Studio Run did not change page yet" };
    }
    // ARIA v4.26.3 - ClickUp send rescue
    // ClickUp can briefly keep the typed text in the composer after the send
    // button is clicked. If the conversation surface changed or the user bubble
    // appeared, treat it as accepted instead of stopping the run.
    if (kind === "clickup") {
      if (userText && sample && userText.includes(sample.slice(0, Math.min(25, sample.length)))) {
        return { ok: true, reason: "ClickUp user message appeared" };
      }
      const clickupPrefix = sample.slice(0, Math.min(25, sample.length));
      if (pageChanged && (!inputText || !inputText.includes(clickupPrefix))) {
        return { ok: true, reason: "ClickUp page changed and input cleared" };
      }
      return { ok: false, reason: inputText ? "ClickUp prompt still appears in input" : "ClickUp has no acceptance signal" };
    }
    if (userText && sample && userText.includes(sample.slice(0, Math.min(35, sample.length)))) {
      return { ok: true, reason: "user message appeared" };
    }
    if (pageChanged && (!inputText || !inputText.includes(sample.slice(0, Math.min(25, sample.length))))) {
      return { ok: true, reason: "page changed and input cleared" };
    }
    if (!inputText || (sample && !inputText.includes(sample.slice(0, Math.min(25, sample.length))) && inputText.length < 10)) {
      return { ok: true, reason: "input cleared" };
    }
    return { ok: false, reason: inputText ? "prompt still appears in input" : "no acceptance signal" };
  }

  // ARIA v4.25.0 - Send Acceptance Verification
  async function sendInputAndVerify(input, text) {
    const before = pageSignature();
    const sent = await sendInput(input);
    if (!sent) return { ok: false, sent: false, error: "send control not found" };
    const deadline = Date.now() + sendAcceptVerifyMs();
    let last = { ok: false, reason: "waiting for acceptance" };
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      last = promptAccepted(input, text, before);
      if (last.ok) {
        state.lastSendAcceptedAt = Date.now();
        state.lastSendAcceptedText = String(text || "");
        return { ok: true, sent: true, accepted: true, reason: last.reason };
      }
      const busy = isBusy(findInput() || input);
      if (busy.busy) {
        // ARIA v4.26.6 - Strict Send Acceptance Guard
        // Do not move from 1 -> 2 -> 3 just because the page has a loader. If
        // the exact prompt is still sitting in the input, the send did not land.
        const busyAccepted = busyCanVerifySend(input, text, before, busy.reason);
        if (busyAccepted.ok) {
          state.lastSendAcceptedAt = Date.now();
          state.lastSendAcceptedText = String(text || "");
          return { ok: true, sent: true, accepted: true, reason: busyAccepted.reason };
        }
        last = { ok: false, reason: busyAccepted.reason };
      }
    }
    // ARIA v4.26.4 - Stuck Input Auto-Rescue
    // If the text is still sitting in the composer after the first click, do
    // not immediately count this number as failed. Try the site-specific send
    // controls and safe keyboard shortcuts once more, then verify acceptance.
    const rescued = await rescueStuckInput(input, text, before, last.reason);
    if (rescued.ok) {
      state.lastSendAcceptedAt = Date.now();
      state.lastSendAcceptedText = String(text || "");
      return { ok: true, sent: true, accepted: true, rescued: true, reason: rescued.reason };
    }
    // ARIA v4.26.8 - Held Prompt Multi-Tap Send Guard
    // If the same prompt is still visibly held in the composer, do not advance
    // or fail immediately. Some sites render the text but ignore the first few
    // synthetic send events, so pulse only the safe send controls for that exact
    // prompt until the page confirms acceptance.
    const pulsed = await pulseHeldPromptSend(input, text, before, rescued.reason || last.reason);
    if (pulsed.ok) {
      state.lastSendAcceptedAt = Date.now();
      state.lastSendAcceptedText = String(text || "");
      return { ok: true, sent: true, accepted: true, rescued: true, reason: pulsed.reason };
    }
    return { ok: false, sent: true, accepted: false, error: `send not accepted: ${pulsed.reason || rescued.reason || last.reason}` };
  }

  // ARIA v4.26.4 - Stuck Input Auto-Rescue
  async function rescueStuckInput(input, text, beforeSignature, reason) {
    const clean = String(text || inputTextValue(input) || state.lastAttemptedText || "").trim();
    if (!clean) return { ok: false, reason: "no prompt text available for rescue" };
    const sample = normalizedPromptSample(clean, 45);
    const attempts = [];
    const kind = siteKind();
    const addAttempt = (label, fn) => attempts.push({ label, fn });

    if (kind === "clickup") {
      addAttempt("ClickUp send arrow", async (fresh) => sendClickUpInput(fresh));
      // ARIA v4.27.0 - Native Browser Input Fallback
      addAttempt("ClickUp native send arrow", async (fresh) => {
        const btn = findClickUpSendButton(fresh);
        return btn ? backgroundNativeClick(btn, "ClickUp send arrow") : false;
      });
    }
    if (kind === "aistudio") {
      addAttempt("AI Studio Run button", async (fresh) => {
        const studioInput = findAiStudioInput() || fresh;
        const runBtn = findAiStudioRunButton(studioInput);
        if (runBtn) {
          state.aiStudioLastRunClickAt = Date.now();
          return clickElementHard(runBtn);
        }
        if (studioInput) {
          state.aiStudioLastRunClickAt = Date.now();
          if (submitClosestForm(studioInput)) return true;
          dispatchEnter(studioInput, true);
          try {
            studioInput.dispatchEvent(new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              metaKey: true,
              bubbles: true,
              cancelable: true
            }));
          } catch (err) {}
          return true;
        }
        return false;
      });
      // ARIA v4.27.0 - Native Browser Input Fallback
      addAttempt("AI Studio native Run button", async (fresh) => {
        const studioInput = findAiStudioInput() || fresh;
        const runBtn = findAiStudioRunButton(studioInput);
        if (!runBtn) return false;
        state.aiStudioLastRunClickAt = Date.now();
        return backgroundNativeClick(runBtn, "AI Studio Run");
      });
      // ARIA v4.27.0 - Native Browser Input Fallback
      addAttempt("AI Studio native Ctrl/Cmd Enter", async (fresh) => {
        const studioInput = findAiStudioInput() || fresh;
        if (!studioInput) return false;
        state.aiStudioLastRunClickAt = Date.now();
        return backgroundNativeEnter(studioInput, {
          ctrlKey: true,
          metaKey: true,
          label: "AI Studio Ctrl/Cmd Enter"
        });
      });
    }
    addAttempt("custom/near send button", async (fresh) => {
      let btn = null;
      const customSendSelector = String(state.customSendSelector || "").trim();
      if (customSendSelector) {
        try {
          btn = qAll(customSendSelector).find((el) => visible(el) && !inPanel(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
        } catch (err) {}
      }
      btn = btn || findSendButtonNearInput(fresh) || findIconSendButtonNearInput(fresh);
      return btn ? clickElementHard(btn) : false;
    });
    // ARIA v4.27.0 - Native Browser Input Fallback
    addAttempt("native custom/near send button", async (fresh) => {
      let btn = null;
      const customSendSelector = String(state.customSendSelector || "").trim();
      if (customSendSelector) {
        try {
          btn = qAll(customSendSelector).find((el) => visible(el) && !inPanel(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
        } catch (err) {}
      }
      btn = btn || findSendButtonNearInput(fresh) || findIconSendButtonNearInput(fresh);
      return btn ? backgroundNativeClick(btn, "native send button") : false;
    });
    addAttempt("composer hotspot", async (fresh) => clickComposerHotspot(fresh));
    addAttempt("form submit", async (fresh) => submitClosestForm(fresh));
    addAttempt("Enter shortcut", async (fresh) => {
      pressEnter(fresh);
      return true;
    });
    addAttempt("Ctrl/Cmd Enter shortcut", async (fresh) => {
      dispatchEnter(fresh, true);
      try {
        fresh.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          ctrlKey: true,
          metaKey: true,
          bubbles: true,
          cancelable: true
        }));
      } catch (err) {}
      return true;
    });

    setStatus(`Send stuck (${reason || "no acceptance"}). Running stuck-input rescue...`);
    for (const attempt of attempts) {
      const fresh = findInput() || input;
      if (!fresh) return { ok: false, reason: "input disappeared during rescue" };
      const current = normalizedPromptSample(inputTextValue(fresh), 120);
      if (sample && !current.includes(sample.slice(0, Math.min(25, sample.length)))) {
        if (kind === "aistudio" && setAiStudioInputText(fresh, clean)) {
          // injected by AI Studio setter
        } else {
          setInputText(fresh, clean);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      let clicked = false;
      try {
        clicked = Boolean(await attempt.fn(findInput() || fresh));
      } catch (err) {
        clicked = false;
      }
      if (!clicked) continue;
      const deadline = Date.now() + Math.max(1600, Math.min(4200, sendAcceptVerifyMs()));
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const checkInput = findInput() || fresh;
        const accepted = promptAccepted(checkInput, clean, beforeSignature);
        if (accepted.ok) return { ok: true, reason: `${attempt.label}: ${accepted.reason}` };
        const busy = isBusy(checkInput);
        if (busy.busy) {
          // ARIA v4.26.6 - Strict Send Acceptance Guard
          const busyAccepted = busyCanVerifySend(checkInput, clean, beforeSignature, busy.reason);
          if (busyAccepted.ok) return { ok: true, reason: `${attempt.label}: ${busyAccepted.reason}` };
        }
      }
    }
    return { ok: false, reason: `rescue exhausted after stuck input (${reason || "unknown"})` };
  }

  // ARIA v4.26.8 - Held Prompt Multi-Tap Send Guard
  function heldPromptFreshInput(input) {
    return siteKind() === "aistudio" ? (findAiStudioInput() || findInput() || input) : (findInput() || input);
  }

  // ARIA v4.26.8 - Held Prompt Multi-Tap Send Guard
  function promptStillHeldInInput(input, text) {
    const clean = String(text || "").trim();
    const sample = normalizedPromptSample(clean, 55);
    if (!sample) return false;
    const fresh = heldPromptFreshInput(input);
    const current = normalizedPromptSample(inputTextValue(fresh), 180);
    const prefix = sample.slice(0, Math.min(28, sample.length));
    return Boolean(current && prefix && current.includes(prefix));
  }

  // ARIA v4.26.8 - Held Prompt Multi-Tap Send Guard
  async function pulseHeldPromptSend(input, text, beforeSignature, reason) {
    const clean = String(text || inputTextValue(input) || state.lastAttemptedText || "").trim();
    if (!clean) return { ok: false, reason: "held-prompt guard skipped: no prompt text" };
    const kind = siteKind();
    const sample = normalizedPromptSample(clean, 55);
    if (!sample) return { ok: false, reason: "held-prompt guard skipped: empty sample" };
    if (!promptStillHeldInInput(input, clean)) {
      return { ok: false, reason: reason || "prompt is no longer held in input" };
    }

    const pulseCount = kind === "clickup" || kind === "aistudio" ? 5 : 3;
    const prefix = sample.slice(0, Math.min(28, sample.length));
    setStatus(`Prompt is still in input. Holding same prompt and pulsing send ${pulseCount}x...`);

    for (let round = 1; round <= pulseCount; round += 1) {
      let fresh = heldPromptFreshInput(input);
      if (!fresh) return { ok: false, reason: "held-prompt guard failed: input disappeared" };
      const current = normalizedPromptSample(inputTextValue(fresh), 180);
      if (!current.includes(prefix)) {
        if (kind === "aistudio" && setAiStudioInputText(fresh, clean)) {
          // AI Studio setter handled the editor.
        } else {
          setInputText(fresh, clean);
        }
        await new Promise((resolve) => setTimeout(resolve, 260));
        fresh = heldPromptFreshInput(fresh);
      }

      try { fresh.focus(); } catch (err) {}
      try { fresh.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" }); } catch (err) {}

      const attempts = [];
      if (kind === "clickup") {
        attempts.push(["ClickUp send arrow", async () => sendClickUpInput(fresh)]);
        // ARIA v4.27.0 - Native Browser Input Fallback
        attempts.push(["ClickUp native send arrow", async () => {
          const btn = findClickUpSendButton(fresh);
          return btn ? backgroundNativeClick(btn, "ClickUp send arrow") : false;
        }]);
      } else if (kind === "aistudio") {
        attempts.push(["AI Studio Run button", async () => {
          const studioInput = findAiStudioInput() || fresh;
          const runBtn = findAiStudioRunButton(studioInput);
          if (runBtn) {
            state.aiStudioLastRunClickAt = Date.now();
            return clickElementHard(runBtn);
          }
          return false;
        }]);
        // ARIA v4.27.0 - Native Browser Input Fallback
        attempts.push(["AI Studio native Run button", async () => {
          const studioInput = findAiStudioInput() || fresh;
          const runBtn = findAiStudioRunButton(studioInput);
          if (!runBtn) return false;
          state.aiStudioLastRunClickAt = Date.now();
          return backgroundNativeClick(runBtn, "AI Studio Run");
        }]);
        attempts.push(["AI Studio Ctrl/Cmd Enter", async () => {
          const studioInput = findAiStudioInput() || fresh;
          if (!studioInput) return false;
          state.aiStudioLastRunClickAt = Date.now();
          dispatchEnter(studioInput, true);
          try {
            ["keydown", "keypress", "keyup"].forEach((type) => {
              studioInput.dispatchEvent(new KeyboardEvent(type, {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                ctrlKey: true,
                metaKey: true,
                bubbles: true,
                cancelable: true
              }));
            });
          } catch (err) {}
          return true;
        }]);
        // ARIA v4.27.0 - Native Browser Input Fallback
        attempts.push(["AI Studio native Ctrl/Cmd Enter", async () => {
          const studioInput = findAiStudioInput() || fresh;
          if (!studioInput) return false;
          state.aiStudioLastRunClickAt = Date.now();
          return backgroundNativeEnter(studioInput, {
            ctrlKey: true,
            metaKey: true,
            label: "AI Studio Ctrl/Cmd Enter"
          });
        }]);
      } else {
        attempts.push(["near send button", async () => {
          const btn = findSendButtonNearInput(fresh) || findIconSendButtonNearInput(fresh);
          return btn ? clickElementHard(btn) : false;
        }]);
        // ARIA v4.27.0 - Native Browser Input Fallback
        attempts.push(["native near send button", async () => {
          const btn = findSendButtonNearInput(fresh) || findIconSendButtonNearInput(fresh);
          return btn ? backgroundNativeClick(btn, "native send button") : false;
        }]);
      }

      attempts.push(["composer hotspot", async () => clickComposerHotspot(fresh)]);
      attempts.push(["form submit", async () => submitClosestForm(fresh)]);
      attempts.push(["Enter shortcut", async () => {
        pressEnter(fresh);
        return true;
      }]);
      attempts.push(["Ctrl/Cmd Enter shortcut", async () => {
        dispatchEnter(fresh, true);
        try {
          fresh.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            ctrlKey: true,
            metaKey: true,
            bubbles: true,
            cancelable: true
          }));
        } catch (err) {}
        return true;
      }]);

      for (const [label, fn] of attempts) {
        let fired = false;
        try {
          fired = Boolean(await fn());
        } catch (err) {
          fired = false;
        }
        if (!fired) continue;
        const deadline = Date.now() + Math.max(2200, Math.min(5200, sendAcceptVerifyMs() + 1200));
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 420));
          const checkInput = heldPromptFreshInput(fresh);
          const accepted = promptAccepted(checkInput || fresh, clean, beforeSignature);
          if (accepted.ok) return { ok: true, reason: `held-prompt ${round}/${pulseCount} ${label}: ${accepted.reason}` };
          const busy = isBusy(checkInput || fresh);
          if (busy.busy) {
            const busyAccepted = busyCanVerifySend(checkInput || fresh, clean, beforeSignature, busy.reason);
            if (busyAccepted.ok) return { ok: true, reason: `held-prompt ${round}/${pulseCount} ${label}: ${busyAccepted.reason}` };
          }
          if (!promptStillHeldInInput(checkInput || fresh, clean)) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            const postClearAccepted = promptAccepted(checkInput || fresh, clean, beforeSignature);
            if (postClearAccepted.ok) return { ok: true, reason: `held-prompt ${round}/${pulseCount} ${label}: ${postClearAccepted.reason}` };
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 450 + round * 120));
    }
    return { ok: false, reason: `held prompt still not accepted after ${pulseCount} send pulses (${reason || "no acceptance signal"})` };
  }

  // ARIA v4.26.4 - Stuck Input Auto-Rescue
  async function manualRescueStuckInput() {
    readPanelInputs();
    await saveOptionsFromState();
    const input = findInput();
    if (!input) {
      const message = "Rescue failed: no visible chat input found.";
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    const text = String(inputTextValue(input) || state.lastAttemptedText || "").trim();
    if (!text) {
      const message = "Rescue failed: no stuck text found in the input.";
      setStatus(message);
      return { ok: false, error: message, ...currentStatus() };
    }
    const before = pageSignature();
    const result = await rescueStuckInput(input, text, before, "manual rescue");
    const message = result.ok ? `Rescue sent: ${result.reason}` : `Rescue failed: ${result.reason}`;
    setStatus(message);
    return { ok: result.ok, message, error: result.ok ? "" : message, ...currentStatus() };
  }

  function pageSignature() {
    const main = document.querySelector("main") || document.body;
    return String(main ? main.innerText : document.body.innerText).slice(-3500);
  }

  // ARIA v4.8.0 — Feature 11: Smart response extractor per site
  function extractLatestResponse(options) {
    const opts = options || {};
    const kind = siteKind();
    const selectorGroups = {
      chatgpt: [
        "[data-message-author-role='assistant']",
        "[data-testid*='conversation-turn' i] [data-message-author-role='assistant']",
        ".markdown"
      ],
      claude: [
        "[data-is-streaming='false']",
        ".font-claude-message",
        "[data-testid*='message' i]"
      ],
      gemini: [
        "model-response",
        "[data-chunk-index]",
        "[data-turn-index]"
      ],
      aistudio: [
        "model-response",
        "[data-chunk-index]",
        "[data-turn-index]",
        "ms-chat-turn",
        "ms-response",
        "[class*='model-response']",
        "[class*='assistant']",
        "[class*='response']"
      ],
      deepseek: [
        ".ds-message-container",
        "[class*='assistant']",
        "[class*='message']"
      ],
      mistral: [
        ".message-row",
        "[class*='assistant']",
        "[class*='message']"
      ],
      clickup: [
        "[data-testid*='message' i]",
        "[class*='message']",
        "[class*='answer']"
      ]
    };
    const selectors = selectorGroups[kind] || [];
    for (const selector of selectors) {
      const blocks = qAll(selector).filter((el) => visible(el) && !inPanel(el));
      for (let i = blocks.length - 1; i >= 0; i -= 1) {
        const text = textOf(blocks[i]).trim();
        if (text.length >= 20) return text;
      }
    }
    if (opts.allowPageFallback === false) return "";
    const fallbackBlocks = qAll("main article, main section, main [role='article'], main [class*='message'], main [class*='response'], article, section, [data-testid*='message' i]")
      .filter((el) => visible(el) && !inPanel(el))
      .map((el) => textOf(el).trim())
      .filter((text) => text.length > 100);
    if (fallbackBlocks.length) return fallbackBlocks[fallbackBlocks.length - 1];
    return pageSignature().trim();
  }

  // ARIA v4.8.0 — Feature 8: Response snapshot history
  function updateResponseHistoryIfChanged() {
    const text = extractLatestResponse();
    const signature = `${text.length}:${shortHash(text.slice(-1800))}`;
    if (!text || signature === state.lastHistorySignature) return;
    state.lastHistorySignature = signature;
    state.responseHistory.push({
      text,
      timestamp: new Date().toISOString(),
      sendCount: state.runCount,
      site: siteKind(),
      url: location.href,
      title: document.title
    });
    state.responseHistory = state.responseHistory.slice(-50);
  }

  function resetResponseWatch() {
    state.lastSignature = responseStabilitySignature();
    state.lastChangeAt = Date.now();
    state.busySince = 0;
  }

  // ARIA v4.26.1 - Google AI Studio prompt gate repair
  // AI Studio can keep a phone preview spinner moving while the chat response is
  // already idle. Use the actual chat/user response surface for stability so the
  // preview device loader does not block prompt 1 forever.
  function responseStabilitySignature() {
    if (siteKind() === "aistudio") {
      const latest = extractLatestResponse();
      const user = latestUserPromptText();
      return `aistudio|user:${responseTextSignature(user).slice(0, 32)}|response:${responseTextSignature(latest).slice(0, 32)}`;
    }
    return pageSignature();
  }

  function shouldSkipPreSendStabilityGate() {
    return !state.awaitingResponseAck && !state.lastSendAt && state.runCount === 0 && !state.promptSent;
  }

  function responseStable() {
    if (shouldSkipPreSendStabilityGate()) {
      return { stable: true, waitedMs: 0, reason: "initial send skips stability gate" };
    }
    const signature = responseStabilitySignature();
    if (signature !== state.lastSignature) {
      state.lastSignature = signature;
      state.lastChangeAt = Date.now();
      return { stable: false, waitedMs: 0 };
    }
    const waitedMs = Date.now() - state.lastChangeAt;
    const stable = waitedMs >= RESPONSE_STABLE_MS;
    if (!stable) return { stable: false, waitedMs };
    // ARIA v4.8.0 — Feature 2: Response length guard
    const minChars = Math.max(0, Number.parseInt(state.minResponseChars || "0", 10) || 0);
    if (minChars > 0) {
      const latest = extractLatestResponse();
      if (latest.length < minChars) {
        return { stable: false, waitedMs, reason: `response length ${latest.length}/${minChars}` };
      }
    }
    updateResponseHistoryIfChanged();
    return { stable: true, waitedMs };
  }

  // ARIA v4.9.0 — Feature 2: Response Quality Filter helper
  // ARIA v4.23.0 - Response Ack Gate
  function responseTextSignature(text) {
    const value = String(text || "");
    return `${value.length}:${shortHash(value.slice(-1800))}`;
  }

  // ARIA v4.23.0 - Response Ack Gate
  function currentResponseAckSnapshot() {
    // ARIA v4.28.0 - Send Number Lock: response ack must compare
    // against a real assistant response candidate. Page-wide fallback text can
    // change because the panel, counter, or user input changed, which used to
    // advance 1 -> 2 -> 3 without an accepted assistant response.
    const responseText = extractLatestResponse({ allowPageFallback: false }) || "";
    return {
      pageSignature: responseStabilitySignature(),
      responseText,
      responseSignature: responseTextSignature(responseText),
      responseLength: responseText.length
    };
  }

  // ARIA v4.23.0 - Response Ack Gate
  function clearResponseAckWait() {
    state.awaitingResponseAck = false;
    state.awaitingResponseSince = 0;
    state.awaitingResponseSignature = "";
    state.awaitingResponseTextSignature = "";
    state.awaitingResponseTextLength = 0;
    state.awaitingResponseBaselineText = "";
    state.awaitingResponsePayloadKind = "";
    state.awaitingResponseText = "";
    state.awaitingQueueIndex = -1;
    state.awaitingRunCount = 0;
    state.awaitingResponseRetryCount = 0;
    state.awaitingResponseLastRetryAt = 0;
  }

  // ARIA v4.23.0 - Response Ack Gate
  function beginResponseAckWait(payload, sentText) {
    const snap = currentResponseAckSnapshot();
    state.awaitingResponseAck = true;
    state.awaitingResponseSince = Date.now();
    state.awaitingResponseSignature = snap.pageSignature;
    state.awaitingResponseTextSignature = snap.responseSignature;
    state.awaitingResponseTextLength = snap.responseLength;
    state.awaitingResponseBaselineText = snap.responseText;
    state.awaitingResponsePayloadKind = payload && payload.kind ? payload.kind : "sequence";
    state.awaitingResponseText = String(sentText || "");
    state.awaitingQueueIndex = state.queueIndex;
    state.awaitingRunCount = state.runCount;
    state.awaitingResponseRetryCount = 0;
    state.awaitingResponseLastRetryAt = 0;
    updatePanelMeta();
  }

  // ARIA v4.24.0 - No-response retry guard
  function responseAckTimeoutMs() {
    const value = Number.parseInt(state.responseAckTimeoutMs || "0", 10);
    return Number.isFinite(value) && value > 0 ? Math.max(30000, value) : 180000;
  }

  // ARIA v4.24.0 - No-response retry guard
  function responseAckRetryLimit() {
    const value = Number.parseInt(state.responseAckRetryLimit || "0", 10);
    return Number.isFinite(value) && value >= 0 ? Math.min(5, value) : 2;
  }

  // ARIA v4.23.0 - Response Ack Gate
  async function completePendingSendAfterResponse() {
    if (!state.awaitingResponseAck) return;
    const kind = state.awaitingResponsePayloadKind || "sequence";
    if (kind === "prompt") {
      state.promptSent = true;
    } else if (kind === "queue") {
      state.queueIndex = Math.max(state.queueIndex, (state.awaitingQueueIndex || 0) + 1);
      saveQueueIndex();
      state.runCount = Math.max(state.runCount, (state.awaitingRunCount || 0) + 1);
      saveRunCount();
    } else {
      state.runCount = Math.max(state.runCount, (state.awaitingRunCount || 0) + 1);
      saveRunCount();
    }
    incrementDailyCounter();
    clearResponseAckWait();
    updatePanelMeta();
  }

  // ARIA v4.23.0 - Response Ack Gate
  function responseAckStatus() {
    if (!state.awaitingResponseAck) return { ready: true };
    const stable = responseStable();
    if (!stable.stable) {
      return {
        ready: false,
        message: stable.reason
          ? `Waiting: previous prompt response guard (${stable.reason}). Next number is locked.`
          : `Waiting: previous prompt response still settling (${Math.round((stable.waitedMs || 0) / 1000)}s). Next number is locked.`
      };
    }
    const snap = currentResponseAckSnapshot();
    const baselineText = String(state.awaitingResponseBaselineText || "");
    const sentText = String(state.awaitingResponseText || "");
    const responseChanged = snap.responseSignature !== state.awaitingResponseTextSignature;
    const responseGrew = snap.responseLength > (state.awaitingResponseTextLength || 0) + Math.max(25, Math.min(120, sentText.length + 20));
    const tinyAppendToOldResponse = Boolean(
      baselineText &&
      snap.responseText &&
      snap.responseText.includes(baselineText) &&
      snap.responseLength <= baselineText.length + Math.max(40, sentText.length + 20)
    );
    const meaningfulReplacement = responseChanged && snap.responseLength >= 20 && !tinyAppendToOldResponse;
    if (!responseGrew && !meaningfulReplacement) {
      const elapsed = Math.round((Date.now() - (state.awaitingResponseSince || Date.now())) / 1000);
      return {
        ready: false,
        message: `Waiting: prompt was sent, but no new assistant response detected yet (${elapsed}s). Next number is locked.`
      };
    }
    if (state.skipShortReplies) {
      const quality = responseQualityCheck();
      if (!quality.ok) return { ready: false, message: `${quality.message} Next number is locked.` };
    }
    return { ready: true };
  }

  // ARIA v4.24.0 - No-response retry guard
  async function retryPendingResponseSend() {
    const kind = state.awaitingResponsePayloadKind || "sequence";
    const text = String(state.awaitingResponseText || "").trim();
    if (!text || kind === "action") return { ok: false, error: "Pending item cannot be retried automatically." };
    const input = findInput();
    if (!input) return { ok: false, error: "Input not found for retry." };
    const busy = isBusy(input);
    if (busy.busy) return { ok: false, busy: true, error: `Still busy: ${busy.reason}` };
    scrollToBottomBeforeSend();
    state.lastAttemptedText = text;
    setInputText(input, text);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const accepted = await sendInputAndVerify(input, text);
    if (!accepted.ok) return { ok: false, error: `Retry send not accepted: ${accepted.error || "prompt stayed in input"}` };
    const snap = currentResponseAckSnapshot();
    state.awaitingResponseRetryCount = (state.awaitingResponseRetryCount || 0) + 1;
    state.awaitingResponseLastRetryAt = Date.now();
    state.awaitingResponseSince = Date.now();
    state.awaitingResponseSignature = snap.pageSignature;
    state.awaitingResponseTextSignature = snap.responseSignature;
    state.awaitingResponseTextLength = snap.responseLength;
    state.awaitingResponseBaselineText = snap.responseText;
    state.lastSendAt = Date.now();
    markSendSuccess();
    resetResponseWatch();
    updatePanelMeta();
    return { ok: true, retryCount: state.awaitingResponseRetryCount, reason: accepted.reason };
  }

  // ARIA v4.24.0 - No-response retry guard
  async function handlePendingResponseAck() {
    if (!state.awaitingResponseAck) return { ready: true };
    const ack = responseAckStatus();
    if (ack.ready) {
      await completePendingSendAfterResponse();
      return { ready: true };
    }
    const elapsedMs = Date.now() - (state.awaitingResponseSince || Date.now());
    const retryLimit = responseAckRetryLimit();
    if (elapsedMs >= responseAckTimeoutMs() && (state.awaitingResponseRetryCount || 0) < retryLimit) {
      const retry = await retryPendingResponseSend();
      if (retry.ok) {
        return {
          ready: false,
          scheduleMs: Math.min(state.intervalMs, 5000),
          message: `No new response detected, so ARIA resent the same prompt (${retry.retryCount}/${retryLimit}). Next number is still locked.`
        };
      }
      return {
        ready: false,
        scheduleMs: 5000,
        message: `${ack.message} Retry waiting: ${retry.error || "not ready"}.`
      };
    }
    if (elapsedMs >= responseAckTimeoutMs() && retryLimit >= 0) {
      const seconds = Math.round(elapsedMs / 1000);
      stop(`No new response detected after ${seconds}s and ${state.awaitingResponseRetryCount || 0} retry attempt(s). Same number stayed locked; check the tab manually.`, "response_timeout");
      return { ready: false, stopped: true, message: "Stopped: response timeout." };
    }
    return { ready: false, scheduleMs: 2500, message: ack.message };
  }

  function wordCount(text) {
    const words = String(text || "").trim().match(/\S+/g);
    return words ? words.length : 0;
  }

  // ARIA v4.9.0 — Feature 2: Prompt Template variables
  function renderPromptVariables(text) {
    const now = new Date();
    const vars = {
      topic: state.wordTopic || state.socialTopic || state.pipelineTopic || document.title || "",
      language: "auto",
      site: siteKind(),
      title: document.title || "",
      url: location.href,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      count: String(state.runCount || 0),
      next: String((state.nextNumber || 1) + (state.runCount || 0)),
      clipboard: state.lastClipboardText || ""
    };
    return String(text || "").replace(/\{\{\s*([a-zA-Z0-9_ -]+)\s*\}\}/g, (_match, key) => {
      const name = String(key || "").trim();
      return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : "";
    });
  }

  // ARIA v4.9.0 — Feature 2: Prompt Template Library
  function finalizeSendPayload(payload) {
    if (!payload || payload.kind === "stop") return payload;
    return { ...payload, text: renderPromptVariables(payload.text) };
  }

  // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
  function estimateTokensFromText(text) {
    return Math.ceil(wordCount(text) * 1.3);
  }

  // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
  async function addTokenSpend(sentText) {
    const budget = Math.max(0, Number.parseInt(state.tokenBudget || "0", 10) || 0);
    if (!budget) return;
    const delta = estimateTokensFromText(sentText) + estimateTokensFromText(extractLatestResponse());
    state.tokenSpent = Math.max(0, (Number(state.tokenSpent) || 0) + delta);
    await saveOptionsFromState();
    updatePanelMeta();
  }

  // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
  function tokenBudgetExceeded() {
    const budget = Math.max(0, Number.parseInt(state.tokenBudget || "0", 10) || 0);
    return budget > 0 && (Number(state.tokenSpent) || 0) >= budget;
  }

  // ARIA v4.9.0 — Feature 4: Response Quality Filter
  function responseQualityCheck() {
    if (!state.skipShortReplies || !state.lastSendAt) return { ok: true, words: 0 };
    const words = wordCount(extractLatestResponse());
    const min = Math.max(1, Number.parseInt(state.minReplyWords || "10", 10) || 10);
    if (words < min) {
      return { ok: false, words, message: `Skipping: reply too short (${words} words). Waiting for full response.` };
    }
    return { ok: true, words };
  }

  // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
  function findRegenerateButton() {
    const re = /\b(regenerate|retry|try again|redo)\b/i;
    const buttons = qAll("button,[role='button']").filter((el) => visible(el) && !inPanel(el));
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const label = `${textOf(buttons[i])} ${buttons[i].getAttribute("aria-label") || ""} ${buttons[i].getAttribute("title") || ""}`;
      if (re.test(label)) return buttons[i];
    }
    return null;
  }

  // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
  async function maybeAutoRegenerate() {
    if (!state.autoRegen || !state.lastSendAt) return { ok: false };
    const text = extractLatestResponse();
    if (!text) return { ok: false };
    const keywords = String(state.regenKeywords || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const lower = text.toLowerCase();
    const hit = keywords.find((keyword) => lower.includes(keyword.toLowerCase()));
    if (!hit) return { ok: false };
    const signature = `${text.length}:${shortHash(text.slice(-1800))}`;
    if (signature !== state.lastRegenSignature) {
      state.lastRegenSignature = signature;
      state.regenAttempts = 0;
    }
    if (state.regenAttempts >= 3) return { ok: false, message: "Auto-regenerate max reached." };
    const button = findRegenerateButton();
    if (!button) return { ok: false, message: "Auto-regenerate keyword found, but retry button was not visible." };
    state.regenAttempts += 1;
    button.click();
    resetResponseWatch();
    return { ok: true, message: `Auto-regenerate clicked for '${hit}' (${state.regenAttempts}/3).` };
  }

  // ARIA v4.9.0 — Feature 8: Conditional Next Prompt
  async function saveConditionalRules() {
    await storageSet({ [CONDITIONAL_RULES_KEY]: state.conditionalRules || [] });
  }

  // ARIA v4.9.0 — Feature 8: Conditional Next Prompt
  async function applyConditionalRulesAfterResponse() {
    if (state.conditionalNextPrompt) return;
    const text = extractLatestResponse();
    if (!text) return;
    const signature = `${text.length}:${shortHash(text.slice(-1800))}`;
    if (signature === state.lastConditionalSignature) return;
    state.lastConditionalSignature = signature;
    const lower = text.toLowerCase();
    const rules = Array.isArray(state.conditionalRules) ? state.conditionalRules : [];
    for (const rule of rules) {
      const keyword = String(rule && rule.keyword || "").trim();
      const prompt = String(rule && rule.prompt || "").trim();
      if (!keyword || !prompt || !lower.includes(keyword.toLowerCase())) continue;
      state.conditionalNextPrompt = prompt;
      const uses = Number.parseInt(rule.maxUses || "0", 10) || 0;
      if (uses > 0) rule.maxUses = uses - 1;
      state.conditionalRules = rules.filter((item) => (Number.parseInt(item.maxUses || "0", 10) || 0) !== 0);
      await saveConditionalRules();
      setStatus(`Conditional prompt queued for keyword '${keyword}'.`);
      return;
    }
  }

  // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
  async function readClipboardText() {
    const reply = await sendRuntime({ type: "ARIA_SUPER_READ_CLIPBOARD" });
    if (reply && reply.ok) return String(reply.text || "");
    try {
      if (navigator.clipboard && navigator.clipboard.readText) return await navigator.clipboard.readText();
    } catch (err) {}
    return "";
  }

  // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
  function appendPromptQueueItem(text) {
    const value = String(text || "").trim();
    if (!value) return;
    const current = String(state.promptQueue || "").trim();
    state.promptQueue = current ? `${current}\n\n${value}` : value;
    state.usePromptQueue = true;
    syncPanelInputs();
    saveOptionsFromState();
  }

  // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
  function startClipboardWatch() {
    if (state.clipboardWatchTimer || !state.clipboardWatch) return;
    state.clipboardWatchTimer = setInterval(async () => {
      if (!state.clipboardWatch || !state.running) return;
      const text = String(await readClipboardText()).trim();
      if (text.length <= 20 || text === state.lastClipboardText) return;
      state.lastClipboardText = text;
      appendPromptQueueItem(text);
      setStatus(`Clipboard watch: new item added to queue (${text.length} chars).`);
    }, 4000);
  }

  // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
  function stopClipboardWatch() {
    if (!state.clipboardWatchTimer) return;
    clearInterval(state.clipboardWatchTimer);
    state.clipboardWatchTimer = null;
  }

  // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
  function imageFilterMatches(img) {
    const filters = String(state.imageSaveFilter || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (!filters.length) return true;
    const context = [
      img && img.alt,
      img && img.title,
      img && img.getAttribute && img.getAttribute("aria-label"),
      img && img.closest && img.closest("figure,article,[data-message-author-role],main") ? textOf(img.closest("figure,article,[data-message-author-role],main")) : "",
      state.socialTopic,
      state.imagePrompt,
      state.lastSmartPrompt,
      extractLatestResponse()
    ].join(" ").toLowerCase();
    return filters.some((keyword) => context.includes(keyword));
  }

  // ARIA v4.9.0 — Fix: keep the sent input visible to the user
  function scrollInputIntoView(el) {
    try {
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    } catch (err) {}
  }

  // ARIA v4.9.0 — Feature 14: ARIA Command Bar
  async function handleAriaCommand(raw) {
    const command = String(raw || "").trim();
    const lower = command.toLowerCase();
    if (!command) return;
    if (lower === "stop" || lower === "pause") {
      stop("Stopped from ARIA command bar.", "command_stop");
      return;
    }
    if (lower === "run" || lower === "start") {
      start();
      return;
    }
    if (lower === "reset") {
      resetCounter(state.nextNumber);
      return;
    }
    if (lower === "status") {
      setStatus(statusText());
      return;
    }
    const pauseMatch = lower.match(/^pause\s+(\d{1,4})/);
    if (pauseMatch) {
      const minutes = Math.max(1, Number.parseInt(pauseMatch[1], 10) || 1);
      const reply = await pauseLimitGuard(minutes, `Command bar pause ${minutes}m`);
      setStatus(reply.message || `Paused ${minutes}m.`);
      return;
    }
    if (lower.startsWith("send ")) {
      const text = command.slice(5).trim();
      const input = findInput();
      if (!input) {
        setStatus("Command send failed: input not found.");
        return;
      }
      setInputText(input, text);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const accepted = await sendInputAndVerify(input, text);
      setStatus(accepted.ok ? `Command sent (${accepted.reason}): ${previewText(text)}` : `Command send failed: ${accepted.error || "send not accepted"}.`);
      return;
    }
    if (lower === "next") {
      await sendCurrentNumberNow();
      return;
    }
    if (lower === "save word") {
      await sendLatestToWord();
      return;
    }
    if (lower === "save drive") {
      await saveLatestToDrive();
      return;
    }
    setStatus("Unknown command. Try: run, stop, reset, pause N, send [text], next, save word, save drive");
  }

  function parseTimeOfDayMinutes(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function currentMinutesOfDay() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function msUntilTimeOfDay(value) {
    const targetMinutes = parseTimeOfDayMinutes(value);
    if (targetMinutes === null) return 0;
    const nowDate = new Date();
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    let deltaMinutes = targetMinutes - nowMinutes;
    if (deltaMinutes < 0 || (deltaMinutes === 0 && nowDate.getSeconds() > 0)) deltaMinutes += 24 * 60;
    return Math.max(0, (deltaMinutes * 60 - nowDate.getSeconds()) * 1000);
  }

  // ARIA v4.8.0 — Feature 3: Scheduled start / time-based trigger
  function scheduledStartCheck() {
    const startAt = String(state.scheduledStartTime || "").trim();
    if (!startAt) return { waiting: false, ms: 0, message: "" };
    const ms = msUntilTimeOfDay(startAt);
    if (ms > 60000) {
      return { waiting: true, ms: Math.min(ms, 60000), message: `Scheduled: starts in ${formatDuration(ms)} at ${startAt}.` };
    }
    return { waiting: false, ms: 0, message: "" };
  }

  // ARIA v4.8.0 — Feature 4: Tab sleep / wake schedule
  function sleepWindowCheck() {
    const from = parseTimeOfDayMinutes(state.sleepFrom);
    const until = parseTimeOfDayMinutes(state.sleepUntil);
    if (from === null || until === null || from === until) return { sleeping: false, ms: 0, message: "" };
    const nowMin = currentMinutesOfDay();
    const wraps = from > until;
    const sleeping = wraps ? (nowMin >= from || nowMin < until) : (nowMin >= from && nowMin < until);
    if (!sleeping) return { sleeping: false, ms: 0, message: "" };
    const ms = msUntilTimeOfDay(state.sleepUntil);
    return { sleeping: true, ms: Math.min(ms || 60000, 60000), message: `Sleep window: resumes at ${state.sleepUntil} (${formatDuration(ms)}).` };
  }

  // ARIA v4.8.0 — Feature 1: Auto-scroll to bottom before send
  function scrollToBottomBeforeSend() {
    if (state.autoScroll === false) return;
    try {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    } catch (err) {
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
    const candidates = qAll("main, [role='main'], [class*='scroll'], [class*='conversation'], [class*='chat'], [data-testid*='conversation' i]");
    candidates.forEach((el) => {
      try {
        if (!inPanel(el) && el.scrollHeight > el.clientHeight + 80) el.scrollTop = el.scrollHeight;
      } catch (err) {}
    });
  }

  // ARIA v4.8.0 — Feature 6: Keyword-based auto-stop
  function matchedStopKeyword(text) {
    const keywords = String(state.stopKeywords || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!keywords.length) return "";
    const lower = String(text || "").toLowerCase();
    return keywords.find((keyword) => lower.includes(keyword.toLowerCase())) || "";
  }

  // ARIA v4.8.0 — Feature 9: Daily run counter + reset
  async function refreshDailyStats() {
    const reply = await sendRuntime({ type: "ARIA_SUPER_DAILY_STATS" });
    if (reply && reply.ok) {
      state.dailySentToday = Number(reply.today) || 0;
      state.dailySentLifetime = Number(reply.lifetime) || 0;
    }
    return reply;
  }

  async function incrementDailyCounter() {
    const reply = await sendRuntime({ type: "ARIA_SUPER_DAILY_INCREMENT" });
    if (reply && reply.ok) {
      state.dailySentToday = Number(reply.today) || 0;
      state.dailySentLifetime = Number(reply.lifetime) || 0;
    }
    updatePanelMeta();
    return reply;
  }

  // ARIA v4.8.0 — Feature 15: Webhook notification on stop/limit
  async function notifyWebhook(event, reason) {
    if (!state.webhookOnStop || !String(state.webhookUrl || "").trim()) return;
    await sendRuntime({
      type: "ARIA_SUPER_WEBHOOK_NOTIFY",
      payload: {
        webhookUrl: state.webhookUrl,
        event: event || "stop",
        reason: reason || state.lastMessage || "ARIA stopped",
        runCount: state.runCount,
        url: location.href,
        title: document.title,
        timestamp: new Date().toISOString()
      }
    });
  }

  function visiblePageTextForLimit() {
    const parts = [];
    const selectors = [
      "main",
      "[role='alert']",
      "[role='status']",
      "[aria-live]",
      "[data-testid*='toast' i]",
      "[data-testid*='error' i]"
    ];
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (visible(el) && !inPanel(el)) parts.push(textOf(el));
      });
    });
    if (!parts.length) parts.push(pageSignature());
    return parts.join("\n").replace(/\s+/g, " ").slice(-9000);
  }

  function formatDuration(ms) {
    const seconds = Math.max(0, Math.ceil(Number(ms) / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function parseLimitCooldownMs(text) {
    const clean = String(text || "").toLowerCase();
    const defaultMinutes = Math.max(5, Number.parseInt(state.limitCooldownMinutes || "10", 10) || 10);
    const defaultMs = defaultMinutes * 60 * 1000;
    if (/\btomorrow\b|\bnext day\b/.test(clean)) return 24 * 60 * 60 * 1000;
    if (/\ba few minutes\b/.test(clean)) return Math.max(defaultMs, 10 * 60 * 1000);
    if (/\ban hour\b|\b1 hour\b/.test(clean)) return 60 * 60 * 1000;

    const durationPatterns = [
      /\b(?:try again|retry|available|reset|resets|wait|come back|use again|send again)\s*(?:in|after)?\s*(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)\b/i,
      /\b(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)\s*(?:left|remaining|from now|before trying again|before retrying)\b/i,
      /\bretry-after\s*:?\s*(\d{1,5})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)?\b/i
    ];
    for (const pattern of durationPatterns) {
      const match = String(text || "").match(pattern);
      if (!match) continue;
      const amount = Number.parseInt(match[1], 10);
      const unit = String(match[2] || "seconds").toLowerCase();
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (unit.startsWith("day")) return amount * 24 * 60 * 60 * 1000;
      if (unit.startsWith("hour") || unit.startsWith("hr")) return amount * 60 * 60 * 1000;
      if (unit.startsWith("minute") || unit.startsWith("min")) return amount * 60 * 1000;
      return amount * 1000;
    }

    const timeMatch = String(text || "").match(/\b(?:try again|retry|available|reset|resets|come back)\s+(?:at|after)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (timeMatch) {
      const now = new Date();
      let hour = Number.parseInt(timeMatch[1], 10);
      const minute = Number.parseInt(timeMatch[2] || "0", 10);
      const meridian = timeMatch[3].toLowerCase();
      if (meridian === "pm" && hour < 12) hour += 12;
      if (meridian === "am" && hour === 12) hour = 0;
      const target = new Date(now);
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      return target.getTime() - now.getTime();
    }

    return defaultMs;
  }

  function detectLimitCooldown() {
    if (state.limitGuardEnabled === false) return null;
    const text = visiblePageTextForLimit();
    const lower = text.toLowerCase();
    const strongLimit = [
      /\b(you('| a)?ve|you have)\s+(reached|hit)\s+(your\s+|the\s+|our\s+)?(?:current\s+)?(?:usage|message|chat|gpt|free plan|plan|rate)?\s*(cap|limit)\b/i,
      /\b(?:message|usage|rate|daily|hourly|free plan|plan)\s+(?:cap|limit)\s+(?:reached|exceeded)\b/i,
      /\b(?:limit|quota)\s+(?:reached|exceeded)\b/i,
      /\btoo many requests\b/i,
      /\brate limit(?:ed| exceeded| reached)?\b/i
    ].some((pattern) => pattern.test(text));
    const retryContext = /\b(try again|retry|come back|available|reset|resets|wait|later|rate limited)\b/i.test(text);
    const tightLimitContext = /\b(limit|cap|quota|too many requests|rate limit|usage limit|message limit|request limit|daily limit|hourly limit|temporarily unavailable|high demand)\b/i.test(text);
    const normalTechContext = /\b(example|tutorial|documentation|code sample|function|variable|messages array|api requests?|request payload|http requests?|user messages?)\b/i.test(text);
    const softLimit = retryContext && tightLimitContext && !normalTechContext;
    const highDemand = /\btemporarily unavailable\b.*\b(high demand|try again|later)\b/i.test(text);
    if (!strongLimit && !softLimit && !highDemand) return null;
    const cooldownMs = Math.max(5 * 60 * 1000, Math.min(parseLimitCooldownMs(text), 24 * 60 * 60 * 1000));
    const reasonMatch = text.match(/(?:you[^.?!]{0,140}(?:limit|cap|quota)[^.?!]*[.?!]?|too many requests[^.?!]*[.?!]?|rate limit[^.?!]*[.?!]?|try again[^.?!]{0,120}[.?!]?)/i);
    return {
      reason: previewText(reasonMatch ? reasonMatch[0] : "AI usage limit detected", 180),
      cooldownMs
    };
  }

  function currentLimitCooldown() {
    // ARIA v4.26.1 - Limit Guard hard OFF repair
    // If the user turns Limit Guard off, an older persisted cooldown must not
    // keep blocking sends. Clear it immediately and report no active cooldown.
    if (state.limitGuardEnabled === false) {
      if (state.limitCooldownUntil || state.limitCooldownReason) clearAllLimitCooldowns();
      return { active: false, remainingMs: 0, reason: "" };
    }
    if (state.limitCooldownUntil > Date.now()) {
      return {
        active: true,
        remainingMs: state.limitCooldownUntil - Date.now(),
        reason: state.limitCooldownReason || "AI limit cooldown"
      };
    }
    if (state.limitCooldownUntil) clearLimitCooldown();
    return { active: false, remainingMs: 0, reason: "" };
  }

  function beginLimitCooldown(detected) {
    const cooldownMs = Math.max(5 * 60 * 1000, Number(detected && detected.cooldownMs) || 10 * 60 * 1000);
    state.limitCooldownUntil = Date.now() + cooldownMs;
    state.limitCooldownReason = detected && detected.reason ? detected.reason : "AI limit detected";
    saveLimitCooldown();
    if (state.lastLimitWebhookUntil !== state.limitCooldownUntil) {
      state.lastLimitWebhookUntil = state.limitCooldownUntil;
      notifyWebhook("limit", state.limitCooldownReason);
    }
    return currentLimitCooldown();
  }

  function limitGuardCheck() {
    if (state.limitGuardEnabled === false) {
      clearAllLimitCooldowns();
      return { active: false, remainingMs: 0, reason: "" };
    }
    const active = currentLimitCooldown();
    if (active.active) return active;
    const detected = detectLimitCooldown();
    if (!detected) return { active: false, remainingMs: 0, reason: "" };
    return beginLimitCooldown(detected);
  }

  function limitCooldownMessage(cooldown) {
    return `Paused: AI limit/rate cap detected.\n${cooldown.reason}\nARIA will wait ${formatDuration(cooldown.remainingMs)} before next send.`;
  }

  function scheduleLimitCooldown(cooldown) {
    const ms = Math.max(1000, Math.min(cooldown.remainingMs || 60000, 60000));
    schedule(ms);
  }

  function isBusy(input) {
    const kind = siteKind();
    // ARIA v4.23.0 - Response Ack Gate hardening: Claude can still stream
    // after the generic buttons disappear, so keep the next prompt locked.
    if (kind === "claude") {
      const claudeStreaming = qAll("[data-is-streaming='true']").find((el) => visible(el) && !inPanel(el));
      if (claudeStreaming) return { busy: true, reason: "Claude is streaming" };
    }
    // ARIA v4.8.0 — Feature 10: Improved isBusy() for DeepSeek + Gemini
    if (kind === "deepseek") {
      const deepSeekBusy = qAll("[class*='loading'],[class*='generating'],button[aria-label*='Stop' i]").find((el) => visible(el) && !inPanel(el));
      if (deepSeekBusy) return { busy: true, reason: "DeepSeek is generating" };
    }
    if (kind === "gemini" || kind === "aistudio") {
      const turns = qAll("[data-turn-index]");
      const lastTurn = turns.length ? turns[turns.length - 1] : null;
      if (lastTurn && String(lastTurn.getAttribute("aria-busy") || "").toLowerCase() === "true") {
        return { busy: true, reason: `${kind === "aistudio" ? "Google AI Studio" : "Gemini"} turn is busy` };
      }
      if (kind === "gemini") {
        const geminiBusy = qAll(".loading-indicator,[class*='loading-indicator'],[class*='generating'],button[aria-label*='Stop' i],[aria-busy='true']").find((el) => visible(el) && !inPanel(el));
        if (geminiBusy) return { busy: true, reason: "Gemini is loading" };
      }
      // ARIA v4.26.0 - Google AI Studio prompt sender repair
      if (kind === "aistudio") {
        // ARIA v4.26.1 - Ignore AI Studio app-preview/mobile-device loaders.
        // Those spinners can run for minutes and are unrelated to prompt input.
        const studioBusy = qAll("button,[role='button'],[role='status'],[aria-live],mat-progress-spinner,.mat-mdc-progress-spinner,[class*='spinner'],[class*='running'],[class*='generating']").find((el) => {
          if (!visible(el) || inPanel(el)) return false;
          const label = `${textOf(el)} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.toLowerCase();
          if (!label.match(/\bstop\b|stop generating|running|generating|working|cancel run|response is being generated/)) return false;
          const rect = el.getBoundingClientRect();
          const likelyPreviewPane = rect.left > innerWidth * 0.32 && rect.top > 120;
          return !likelyPreviewPane;
        });
        if (studioBusy) return { busy: true, reason: "Google AI Studio is running" };
      }
    }
    if (kind === "mistral") {
      const mistralBusy = qAll(".message-row.pending,[class*='pending'],button").find((el) => {
        if (!visible(el) || inPanel(el)) return false;
        return el.matches(".message-row.pending,[class*='pending']") || textOf(el).toLowerCase().match(/\bstop\b/);
      });
      if (mistralBusy) return { busy: true, reason: "Mistral is responding" };
    }
    const stopControl = qAll("button,[role='button']").find((btn) => {
      if (!visible(btn) || inPanel(btn)) return false;
      const label = `${textOf(btn)} ${btn.getAttribute("aria-label") || ""}`.toLowerCase();
      if (kind === "chatgpt") return label.match(/\b(stop|stop streaming|cancel)\b/) || btn.matches("[data-testid*='stop' i]");
      return label.match(/\b(stop|cancel|pause|generating|responding)\b/);
    });
    if (stopControl) return { busy: true, reason: "response control visible" };
    const progress = kind === "aistudio"
      ? null
      : qAll("[role='progressbar'],[aria-busy='true'],.spinner,.loading").find((el) => visible(el) && !inPanel(el));
    if (progress) return { busy: true, reason: "page loading" };
    const liveBusy = qAll("[role='status'],[aria-live], [data-testid*='status' i], [data-testid*='toast' i]").find((el) => {
      if (!visible(el) || inPanel(el)) return false;
      const label = textOf(el).toLowerCase();
      return label.length < 160 && label.match(/working on it|generating|responding|loading|please wait|creating|uploading|running/);
    });
    if (liveBusy) return { busy: true, reason: "page is responding" };
    if (input && (input.disabled || input.readOnly || String(input.getAttribute("aria-disabled") || "").toLowerCase() === "true")) {
      return { busy: true, reason: "input disabled" };
    }
    return { busy: false, reason: "ready" };
  }

  function stopAfterLimitReached() {
    const stopAfterN = Math.max(0, Number.parseInt(state.stopAfterN || "0", 10) || 0);
    return stopAfterN > 0 && state.runCount >= stopAfterN ? stopAfterN : 0;
  }

  // ARIA v4.26.5 - Failed Send Memory
  function compactFailedPayload(payload, text) {
    const kind = payload && payload.kind ? String(payload.kind) : "sequence";
    return {
      kind,
      text: String((payload && payload.text) || text || state.lastAttemptedText || ""),
      queueIndex: Number.isFinite(Number(payload && payload.queueIndex)) ? Number(payload.queueIndex) : state.queueIndex,
      runCount: Number.isFinite(Number(payload && payload.runCount)) ? Number(payload.runCount) : state.runCount,
      promptSent: Boolean(state.promptSent)
    };
  }

  // ARIA v4.26.5 - Failed Send Memory
  function rememberFailedSend(reason, payload, text) {
    const safeText = String(text || (payload && payload.text) || state.lastAttemptedText || "");
    state.failedSendText = safeText;
    state.failedSendReason = String(reason || "Send failed");
    state.failedSendAt = Date.now();
    state.failedSendPayload = compactFailedPayload(payload, safeText);
    updatePanelMeta();
  }

  // ARIA v4.26.5 - Failed Send Memory
  function clearFailedSendMemory() {
    state.failedSendText = "";
    state.failedSendReason = "";
    state.failedSendAt = 0;
    state.failedSendPayload = null;
    updatePanelMeta();
  }

  function markSendSuccess() {
    state.consecutiveSendFails = 0;
    clearFailedSendMemory();
  }

  function handleSendFailure(reason, payload, text) {
    rememberFailedSend(reason, payload, text);
    state.consecutiveSendFails = (state.consecutiveSendFails || 0) + 1;
    const failCount = state.consecutiveSendFails;
    // ARIA v4.26.7 - Self-Healing Failed Send Retry
    if (failCount >= 5) {
      if (state.selfHealFailedSends !== false) {
        const retryMs = Math.max(30000, Number.parseInt(state.selfHealRetryMs || "60000", 10) || 60000);
        setStatus(`${reason || "Send failed"} ${failCount} times in a row.\nSelf-heal is ON: keeping the same failed prompt and retrying in ${Math.round(retryMs / 1000)}s. Counter will not advance. Use Skip Failed to move on.`);
        schedule(retryMs);
        return;
      }
      stop(`${reason || "Send failed"} ${failCount} times in a row. Stopping to avoid spam. Fix the page/input, then use Retry Failed or Skip Failed.`, "send_failed");
      return;
    }
    const backoffMs = Math.min(30000, 2000 * Math.pow(2, failCount - 1));
    setStatus(`${reason || "Send failed"} (attempt ${failCount}). Retrying in ${Math.round(backoffMs / 1000)}s.\nSaved failed prompt for Retry Failed / Skip Failed.`);
    schedule(backoffMs);
  }

  // ARIA v4.26.5 - Failed Send Memory
  async function retryFailedSend() {
    readPanelInputs();
    const text = String(state.failedSendText || state.lastAttemptedText || "").trim();
    if (!text) {
      const msg = "No failed prompt is stored yet.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const input = findInput();
    if (!input) {
      const msg = "Input not found for Retry Failed.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const busy = isBusy(input);
    if (busy.busy) {
      const msg = `Retry Failed blocked: ${busy.reason}.`;
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const payload = state.failedSendPayload || compactFailedPayload({ kind: "sequence", text }, text);
    scrollToBottomBeforeSend();
    state.lastAttemptedText = text;
    setInputText(input, text);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const accepted = await sendInputAndVerify(input, text);
    if (!accepted.ok) {
      const msg = `Retry not accepted: ${accepted.error || "prompt stayed in input"}.`;
      handleSendFailure(msg, payload, text);
      return { ok: false, error: msg, ...currentStatus() };
    }
    await addTokenSpend(text);
    scrollInputIntoView(input);
    markSendSuccess();
    if (!state.running) {
      state.running = true;
      try {
        await registerBackground();
      } catch (err) {}
    }
    state.lastSendAt = Date.now();
    beginResponseAckWait(payload, text);
    resetResponseWatch();
    const msg = `Retried failed prompt (${accepted.reason}). Waiting for response before moving on.`;
    setStatus(msg);
    schedule(Math.min(state.intervalMs, 5000));
    return { ok: true, message: msg, ...currentStatus() };
  }

  // ARIA v4.28.0 - Manual Current Number Send Lock
  // This is the "bhai, just send the current number now" path. It bypasses the
  // interval timer, but it still keeps every safety gate that prevents counter
  // drift: no advance until the page proves the prompt was accepted and a new
  // response is stable.
  async function sendCurrentNumberNow() {
    if (state.ticking) {
      const msg = "A send/check is already running. Wait one moment, then click Send # Now again.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    state.ticking = true;
    try {
      readPanelInputs();
      await saveOptionsFromState();
      ensureCounterScope();
      const cooldown = limitGuardCheck();
      if (cooldown.active) {
        const msg = limitCooldownMessage(cooldown);
        setStatus(msg);
        return { ok: false, cooldown: true, error: msg, ...currentStatus() };
      }
      const input = findInput();
      if (!input) {
        const msg = "Send # Now failed: input not found on this tab.";
        setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      if (state.awaitingResponseAck) {
        const ack = await handlePendingResponseAck();
        if (!ack.ready) {
          const msg = ack.message || "Previous prompt is still waiting for a real response. Counter is locked.";
          setStatus(msg);
          if (!ack.stopped && state.running) schedule(ack.scheduleMs || 2500);
          return { ok: false, waiting: true, error: msg, ...currentStatus() };
        }
      }
      const busy = isBusy(input);
      if (busy.busy) {
        const msg = `Send # Now blocked: ${busy.reason}. Counter not advanced.`;
        setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      const stable = responseStable();
      if (!stable.stable) {
        const msg = stable.reason ? `Send # Now waiting: ${stable.reason}` : `Send # Now waiting: page settling (${Math.round(stable.waitedMs / 1000)}s).`;
        setStatus(msg);
        return { ok: false, waiting: true, error: msg, ...currentStatus() };
      }
      const payload = await nextSendPayloadAsync();
      if (!payload || payload.kind === "stop") {
        const msg = (payload && payload.message) || "Nothing safe to send.";
        setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      const text = String(payload.text || "").trim();
      if (!text) {
        const msg = "Send # Now failed: next prompt is empty.";
        setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      scrollToBottomBeforeSend();
      state.lastAttemptedText = text;
      setInputText(input, text);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const accepted = await sendInputAndVerify(findInput() || input, text);
      if (!accepted.ok) {
        const msg = `Send # Now not accepted: ${accepted.error || "prompt stayed in input"}. Counter stayed at ${state.runCount + 1}.`;
        handleSendFailure(msg, payload, text);
        return { ok: false, error: msg, ...currentStatus() };
      }
      await addTokenSpend(text);
      scrollInputIntoView(findInput() || input);
      markSendSuccess();
      if (!state.running) {
        state.running = true;
        try {
          await registerBackground();
        } catch (err) {}
      }
      state.lastSendAt = Date.now();
      beginResponseAckWait(payload, text);
      resetResponseWatch();
      const msg = `Send # Now accepted (${accepted.reason}). Counter locked until the new response finishes.`;
      setStatus(msg);
      schedule(Math.min(state.intervalMs, 5000));
      return { ok: true, message: msg, ...currentStatus() };
    } finally {
      state.ticking = false;
    }
  }

  // ARIA v4.26.5 - Failed Send Memory
  async function skipFailedSend() {
    readPanelInputs();
    const payload = state.failedSendPayload || compactFailedPayload({ kind: "sequence", text: state.failedSendText }, state.failedSendText);
    if (!state.failedSendText && !state.failedSendReason) {
      const msg = "No failed prompt is stored to skip.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    if (payload.kind === "prompt") {
      state.promptSent = true;
    } else if (payload.kind === "queue") {
      state.queueIndex = Math.max(state.queueIndex, (Number.parseInt(payload.queueIndex, 10) || 0) + 1);
      saveQueueIndex();
      setRunCount(Math.max(state.runCount, (Number.parseInt(payload.runCount, 10) || 0) + 1));
    } else {
      setRunCount(Math.max(state.runCount, (Number.parseInt(payload.runCount, 10) || state.runCount || 0) + 1));
    }
    state.consecutiveSendFails = 0;
    clearFailedSendMemory();
    clearResponseAckWait();
    await saveOptionsFromState();
    syncPanelInputs();
    if (!state.running) {
      state.running = true;
      try {
        await registerBackground();
      } catch (err) {}
    }
    const msg = `Skipped failed ${payload.kind || "prompt"} manually. Next: ${nextPreviewText()}`;
    setStatus(msg);
    schedule(800);
    return { ok: true, message: msg, ...currentStatus() };
  }

  async function tick() {
    if (!state.running || state.ticking) return;
    state.ticking = true;
    try {
      ensureCounterScope();
      readPanelInputs();
      const scheduled = scheduledStartCheck();
      if (scheduled.waiting) {
        setStatus(scheduled.message);
        schedule(scheduled.ms);
        return;
      }
      const sleep = sleepWindowCheck();
      if (sleep.sleeping) {
        setStatus(sleep.message);
        schedule(sleep.ms);
        return;
      }
      const cooldown = limitGuardCheck();
      if (cooldown.active) {
        if (siteKind() === "antigravity" && state.antigravityAutoSwitchModel) {
          const switched = await antigravitySwitchModel({ silent: true });
          if (switched && switched.ok) {
            clearLimitCooldown();
            setStatus(`${switched.message}\nLimit guard cleared; ARIA will retry after the page settles.`);
            schedule(3500);
            return;
          }
        }
        setStatus(limitCooldownMessage(cooldown));
        scheduleLimitCooldown(cooldown);
        return;
      }
      const input = findInput();
      if (!input) {
        const actionButton = findStandaloneActionButton();
        if (actionButton) {
          const busy = isBusy(null);
          if (busy.busy) {
            if (!state.busySince) state.busySince = Date.now();
            setStatus(`Waiting: ${busy.reason} (${Math.round((Date.now() - state.busySince) / 1000)}s)`);
            schedule(2500);
            return;
          }
          state.busySince = 0;
          // ARIA v4.23.0 - Response Ack Gate
          if (state.awaitingResponseAck) {
            const ack = await handlePendingResponseAck();
            if (!ack.ready) {
              setStatus(ack.message || "Waiting for response before next action.");
              if (!ack.stopped) schedule(ack.scheduleMs || 2500);
              return;
            }
          }
          const stable = responseStable();
          if (!stable.stable) {
            setStatus(stable.reason ? `Waiting: ${stable.reason}` : `Waiting: page settling (${Math.round(stable.waitedMs / 1000)}s)`);
            schedule(2500);
            return;
          }
          // ARIA v4.9.0 — Feature 4: Response Quality Filter
          const qualityAction = responseQualityCheck();
          if (!qualityAction.ok) {
            setStatus(qualityAction.message);
            schedule(2500);
            return;
          }
          // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
          const regenAction = await maybeAutoRegenerate();
          if (regenAction && regenAction.ok) {
            setStatus(regenAction.message);
            schedule(3500);
            return;
          }
          // ARIA v4.9.0 — Feature 8: Conditional Next Prompt
          await applyConditionalRulesAfterResponse();
          // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
          if (tokenBudgetExceeded()) {
            stop("Token budget exhausted", "budget_stop");
            return;
          }
          const stopKeywordAction = matchedStopKeyword(extractLatestResponse());
          if (stopKeywordAction) {
            stop(`Auto-stopped: keyword '${stopKeywordAction}' found in response.`, "keyword_stop");
            return;
          }
          const elapsedSinceSend = state.lastSendAt ? Date.now() - state.lastSendAt : Infinity;
          if (elapsedSinceSend < state.intervalMs) {
            const remaining = Math.ceil((state.intervalMs - elapsedSinceSend) / 1000);
            setStatus(`Waiting: interval guard (${remaining}s left).`);
            schedule(state.intervalMs - elapsedSinceSend);
            return;
          }
          const stopAfterAction = stopAfterLimitReached();
          if (stopAfterAction) {
            stop(`Stop-after-${stopAfterAction} reached. Total sent: ${state.runCount}.`, "stop_after");
            return;
          }
          scrollToBottomBeforeSend();
          actionButton.click();
          // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
          await addTokenSpend(textOf(actionButton) || "action button");
          // ARIA v4.9.0 — Fix: keep the just-used input/action visible.
          scrollInputIntoView(actionButton);
          markSendSuccess();
          state.lastSendAt = Date.now();
          beginResponseAckWait({ kind: "action" }, textOf(actionButton) || "action button");
          resetResponseWatch();
          setStatus(`Clicked action button: ${previewText(textOf(actionButton)) || "button"}. Waiting for new response before next action.`);
          schedule(Math.min(state.intervalMs, 5000));
          return;
        }
        setStatus("Waiting: input not found.");
        schedule(2000);
        return;
      }
      const busy = isBusy(input);
      if (busy.busy) {
        if (!state.busySince) state.busySince = Date.now();
        setStatus(`Waiting: ${busy.reason} (${Math.round((Date.now() - state.busySince) / 1000)}s)`);
        schedule(2500);
        return;
      }
      state.busySince = 0;
      // ARIA v4.23.0 - Response Ack Gate
      if (state.awaitingResponseAck) {
        const ack = await handlePendingResponseAck();
        if (!ack.ready) {
          setStatus(ack.message || "Waiting for response before next number.");
          if (!ack.stopped) schedule(ack.scheduleMs || 2500);
          return;
        }
      }
      const stable = responseStable();
      if (!stable.stable) {
        setStatus(stable.reason ? `Waiting: ${stable.reason}` : `Waiting: page settling (${Math.round(stable.waitedMs / 1000)}s)`);
        schedule(2500);
        return;
      }
      // ARIA v4.9.0 — Feature 4: Response Quality Filter
      const qualityAction = responseQualityCheck();
      if (!qualityAction.ok) {
        setStatus(qualityAction.message);
        schedule(2500);
        return;
      }
      // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
      const regenAction = await maybeAutoRegenerate();
      if (regenAction && regenAction.ok) {
        setStatus(regenAction.message);
        schedule(3500);
        return;
      }
      // ARIA v4.9.0 — Feature 8: Conditional Next Prompt
      await applyConditionalRulesAfterResponse();
      // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
      if (tokenBudgetExceeded()) {
        stop("Token budget exhausted", "budget_stop");
        return;
      }
      const stopKeyword = matchedStopKeyword(extractLatestResponse());
      if (stopKeyword) {
        stop(`Auto-stopped: keyword '${stopKeyword}' found in response.`, "keyword_stop");
        return;
      }
      const elapsedSinceSend = state.lastSendAt ? Date.now() - state.lastSendAt : Infinity;
      if (elapsedSinceSend < state.intervalMs) {
        const remaining = Math.ceil((state.intervalMs - elapsedSinceSend) / 1000);
        setStatus(`Waiting: interval guard (${remaining}s left).`);
        schedule(state.intervalMs - elapsedSinceSend);
        return;
      }
      if (state.autoWordSave && (state.runCount > 0 || state.promptSent)) {
        const saved = await sendLatestToWord({ avoidDuplicate: true, silent: true, onlyUnsavedResponse: true });
        if (saved && saved.ok && !saved.skipped) {
          setStatus(`Auto-saved response to Word. Next send: ${nextPreviewText()}`);
          await new Promise((resolve) => setTimeout(resolve, 350));
        } else if (saved && !saved.ok) {
          setStatus(`${saved.error || "Word auto-save failed"}\nContinuing automation.`);
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
      if (state.driveAutoSave && (state.runCount > 0 || state.promptSent)) {
        const saved = await saveLatestToDrive({ silent: true, onlyUnsavedResponse: true, ignoreSelection: true });
        if (saved && saved.ok && !saved.skipped) {
          setStatus(`Auto-saved response to Google Drive backup. Next send: ${nextPreviewText()}`);
          await new Promise((resolve) => setTimeout(resolve, 350));
        } else if (saved && !saved.ok) {
          setStatus(`${saved.error || "Google Drive auto-save failed"}\nContinuing automation.`);
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
      if (state.autoCodexSave && (state.runCount > 0 || state.promptSent)) {
        const saved = await saveLatestToCodexBridge({ avoidDuplicate: true, silent: true, onlyUnsavedResponse: true });
        if (saved && saved.ok && !saved.skipped) {
          setStatus(`Auto-saved response to Codex bridge. Next send: ${nextPreviewText()}`);
          await new Promise((resolve) => setTimeout(resolve, 350));
        } else if (saved && !saved.ok) {
          setStatus(`${saved.error || "Codex bridge auto-save failed"}\nContinuing automation.`);
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
      if (siteKind() === "antigravity") {
        const guarded = await antigravityPermissionGuard({ auto: true, silentNoop: true });
        if (guarded && guarded.clicked) {
          setStatus(`${guarded.message}\nWaiting for Antigravity to settle before next prompt.`);
          schedule(2500);
          return;
        }
      }
      const stopAfterN = stopAfterLimitReached();
      if (stopAfterN) {
        stop(`Stop-after-${stopAfterN} reached. Total sent: ${state.runCount}.`, "stop_after");
        return;
      }
      const payload = await nextSendPayloadAsync();
      if (payload && payload.kind === "stop") {
        stop(payload.message || "Stopped by ARIA safety guard.", "safety_stop");
        return;
      }
      const text = payload.text;
      scrollToBottomBeforeSend();
      state.lastAttemptedText = text;
      setInputText(input, text);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const accepted = await sendInputAndVerify(input, text);
      if (!accepted.ok) {
        handleSendFailure(`Send not accepted: ${accepted.error || "prompt stayed in input"}.`, payload, text);
        return;
      }
      // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
      await addTokenSpend(text);
      // ARIA v4.9.0 — Fix: scroll the input container into view after successful send.
      scrollInputIntoView(input);
      markSendSuccess();
      state.lastSendAt = Date.now();
      beginResponseAckWait(payload, text);
      resetResponseWatch();
      setStatus(payload.kind === "prompt" ? `Sent full prompt (${accepted.reason}). Waiting for new stable response before sequence.` : `Sent ${JSON.stringify(text)} (${accepted.reason}). Waiting for response before next number.`);
      schedule(Math.min(state.intervalMs, 5000));
    } finally {
      state.ticking = false;
    }
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    if (state.running) state.timer = setTimeout(tick, Math.max(1000, Number(ms) || state.intervalMs));
  }

  async function registerBackground() {
    const reply = await sendRuntime({
      type: "ARIA_SUPER_REGISTER_TAB",
      intervalMs: state.intervalMs,
      mode: resolvedMode(),
      url: location.href,
      title: document.title,
      // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
      syncMode: state.syncMode || "off",
      scopeId: state.counterScope
    });
    state.backgroundScheduler = Boolean(reply && reply.ok);
    updatePanelMeta();
  }

  async function unregisterBackground() {
    await sendRuntime({ type: "ARIA_SUPER_UNREGISTER_TAB" });
    state.backgroundScheduler = false;
    updatePanelMeta();
  }

  function start(options, resetPromptFirst) {
    if (options) applyOptions(options);
    if (resetPromptFirst) state.promptSent = false;
    ensureCounterScope();
    state.running = true;
    makePanel();
    clearResponseAckWait();
    resetResponseWatch();
    setStatus(`Running ${resolvedMode()} on this tab.`);
    // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
    if (state.syncMode === "leader") sendRuntime({ type: "ARIA_SUPER_CLAIM_LEADER" });
    // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
    if (state.clipboardWatch) startClipboardWatch();
    registerBackground();
    refreshDailyStats();
    schedule(500);
    updatePanelMeta();
  }

  function stop(reason = "Stopped this tab.", event = "stop") {
    const chainTargetId = Math.max(0, Number.parseInt(state.chainTargetTabId || "0", 10) || 0);
    const shouldChain = event === "stop_after" && chainTargetId > 0;
    state.running = false;
    clearTimeout(state.timer);
    clearResponseAckWait();
    state.scheduledStartTime = "";
    // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
    stopClipboardWatch();
    unregisterBackground();
    saveOptionsFromState();
    notifyWebhook(event, reason);
    // ARIA v4.9.0 — Feature 10: Auto Screenshot on Stop
    if (state.screenshotOnStop) {
      sendRuntime({ type: "ARIA_SUPER_SCREENSHOT", payload: { reason, event } });
    }
    // ARIA v4.9.0 — Feature 12: Prompt Chaining Across Tabs
    if (shouldChain) {
      sendRuntime({ type: "ARIA_SUPER_CHAIN_START", targetTabId: chainTargetId, reason });
    }
    setStatus(reason || "Stopped this tab.");
    updatePanelMeta();
  }

  function resetCounter(nextNumber) {
    state.nextNumber = Math.max(1, Number.parseInt(nextNumber || state.nextNumber || 1, 10) || 1);
    clearResponseAckWait();
    setRunCount(0);
    syncPanelInputs();
    saveOptionsFromState();
    setStatus(`Counter reset. Next: ${nextText()}`);
  }

  function injectStyles() {
    if (document.getElementById("aria-super-style")) return;
    const style = document.createElement("style");
    style.id = "aria-super-style";
    style.textContent = `
      #${PANEL_ID} { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; width: 340px; max-width: calc(100vw - 24px); background:#101423; color:#f8fafc; border:2px solid #10b981; border-radius:12px; box-shadow:0 12px 38px rgba(0,0,0,.35); font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif; overflow:hidden; }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID}.min .body { display:none; }
      #${PANEL_ID} .head { cursor: move; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.12); background:#111827; }
      #${PANEL_ID} .title { color:#86efac; font-weight:900; font-size:15px; }
      #${PANEL_ID} button { border:0; border-radius:8px; padding:8px 9px; font-weight:800; cursor:pointer; background:#16a34a; color:#fff; }
      #${PANEL_ID} button.secondary { background:#4f46e5; }
      #${PANEL_ID} button.warn { background:#ef4444; }
      #${PANEL_ID} button.orange { background:#f97316; color:#111827; }
      #${PANEL_ID} .body { padding:10px 12px; max-height: calc(100vh - 84px); overflow:auto; }
      #${PANEL_ID} textarea, #${PANEL_ID} input, #${PANEL_ID} select { width:100%; margin-top:7px; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,.22); background:#090d1a; color:#f8fafc; outline:none; font:inherit; }
      #${PANEL_ID} input[type="checkbox"] { width:auto; margin:0; }
      #${PANEL_ID} textarea { min-height:56px; resize:vertical; }
      #${PANEL_ID} .row { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:8px; }
      #${PANEL_ID} .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }
      #${PANEL_ID} .chips button { padding:6px 8px; background:#273244; }
      #${PANEL_ID} .checkline { display:flex; align-items:center; gap:8px; margin-top:8px; font-weight:800; }
      #${PANEL_ID} .section-title { margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.12); color:#86efac; font-weight:900; letter-spacing:.02em; }
      #${PANEL_ID} .status { margin-top:9px; padding:9px; min-height:42px; white-space:pre-wrap; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); }
      #${PANEL_ID} .meta { color:#93c5fd; font-size:11px; margin-top:5px; }
      .aria-super-highlight { outline:3px solid #10b981 !important; outline-offset:5px !important; box-shadow:0 0 0 7px rgba(16,185,129,.20) !important; }
      .aria-scholarship-filled { outline:3px solid #22c55e !important; outline-offset:4px !important; box-shadow:0 0 0 6px rgba(34,197,94,.18) !important; }
      .aria-scholarship-missing { outline:3px solid #f97316 !important; outline-offset:4px !important; box-shadow:0 0 0 6px rgba(249,115,22,.18) !important; }
    `;
    document.documentElement.appendChild(style);
  }

  function makePanel() {
    injectStyles();
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.classList.toggle("min", state.minimized);
      return panel;
    }
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = state.minimized ? "min" : "";
    panel.innerHTML = `
      <div class="head">
        <div>
          <div class="title">ARIA Nexus</div>
          <div class="meta" data-meta></div>
        </div>
        <div>
          <button data-act="min" class="secondary">_</button>
          <button data-act="close" class="warn">x</button>
        </div>
      </div>
      <div class="body">
        <input data-field="ariaCommand" placeholder="ARIA command: run, stop, reset, pause 30, send text, next, save word..." />
        <select data-field="mode">
          <option value="auto">Auto detect</option>
          <option value="universal">Universal</option>
          <option value="chatgpt">ChatGPT</option>
          <option value="clickup">ClickUp</option>
          <option value="antigravity">Antigravity</option>
          <option value="manus">Manus AI</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
          <option value="deepseek">DeepSeek</option>
          <option value="grok">Grok</option>
          <option value="mscopilot">MS Copilot</option>
          <option value="windsurf">Windsurf</option>
        </select>
        <div class="row">
          <input data-field="seconds" type="number" min="1" />
          <select data-field="sendMode"><option value="numbers">Numbers</option><option value="dot">Dot</option><option value="custom">Custom</option><option value="smart">Smart AI prompt</option><option value="manus">Manus next/all/best</option></select>
        </div>
        <div class="chips"><button data-sec="4">4s</button><button data-sec="5">5s</button><button data-sec="15">15s</button><button data-sec="30">30s</button><button data-sec="60">60s</button><button data-sec="90">90s</button></div>
        <div class="row"><input data-field="stopAfterN" type="number" min="0" placeholder="Stop after N sends (0=run forever)" /><button data-act="resetStopAfterN" class="secondary">Clear N</button></div>
        <label class="checkline"><input data-field="limitGuardEnabled" type="checkbox" /> Auto pause on AI limit/rate messages</label>
        <div class="row"><input data-field="limitCooldownMinutes" type="number" min="5" max="1440" placeholder="fallback cooldown minutes" /><button data-act="limitClear" class="warn">Clear wait</button></div>
        <div class="row"><button data-act="limitToggle" class="secondary">Limit ON/OFF</button><button data-act="limitStatus" class="secondary">Limit status</button></div>
        <div class="row"><button data-act="limitPause5" class="orange">Pause 5m</button><button data-act="limitPause10" class="orange">Pause 10m</button></div>
        <div class="section-title">Response-aware automation</div>
        <label class="checkline"><input data-field="autoScroll" type="checkbox" /> Auto-scroll to bottom before send</label>
        <div class="row"><input data-field="minResponseChars" type="number" min="0" placeholder="Min response chars (0=off)" /><button data-act="responseHistory" class="secondary">Response history</button></div>
        <div class="row"><input data-field="scheduledStartTime" type="time" title="Scheduled start" /><button data-act="clearSchedule" class="warn">Clear schedule</button></div>
        <div class="row"><input data-field="sleepFrom" type="time" title="Sleep from" /><input data-field="sleepUntil" type="time" title="Sleep until" /></div>
        <textarea data-field="stopKeywords" placeholder="Auto-stop keywords, comma-separated. Example: done, complete, all files complete"></textarea>
        <label class="checkline"><input data-field="pauseOnHidden" type="checkbox" /> Pause when this tab is hidden</label>
        <div class="section-title">Site overrides</div>
        <input data-field="customInputSelector" placeholder="Custom input selector for this site" />
        <input data-field="customSendSelector" placeholder="Custom send button selector for this site" />
        <div class="section-title">Stop notification webhook</div>
        <input data-field="webhookUrl" placeholder="https:// webhook URL for stop/limit events" />
        <label class="checkline"><input data-field="webhookOnStop" type="checkbox" /> Notify webhook on stop/limit</label>
        <div class="section-title">v4.9 Pro automation</div>
        <select data-field="syncMode"><option value="off">Sync off</option><option value="leader">Sync leader</option><option value="follower">Sync follower</option></select>
        <div class="row"><input data-field="tokenBudget" type="number" min="0" placeholder="Token budget 0=off" /><input data-field="minReplyWords" type="number" min="1" placeholder="Min reply words" /></div>
        <label class="checkline"><input data-field="skipShortReplies" type="checkbox" /> Wait if reply is too short</label>
        <label class="checkline"><input data-field="autoRegen" type="checkbox" /> Auto-regenerate error replies</label>
        <textarea data-field="regenKeywords" placeholder="error, failed, sorry, I cannot, retry"></textarea>
        <input data-field="imageSaveFilter" placeholder="Image save filter keywords, comma-separated" />
        <div class="row"><input data-field="chainTargetTabId" type="number" min="0" placeholder="Chain target tab id" /><label class="checkline"><input data-field="screenshotOnStop" type="checkbox" /> Screenshot on stop</label></div>
        <label class="checkline"><input data-field="clipboardWatch" type="checkbox" /> Clipboard watch -> queue</label>
        <input data-field="customText" placeholder="custom send text" />
        <input data-field="nextNumber" type="number" min="1" />
        <textarea data-field="smartPromptInstruction" placeholder="Smart prompt goal: continue coding, ask next file, fix bugs, prepare ZIP, etc."></textarea>
        <div class="row"><button data-act="smartPromptFill" class="secondary">Smart prompt</button><button data-act="smartPromptSend" class="orange">Smart send</button></div>
        <div class="section-title">Antigravity Pro</div>
        <textarea data-field="antigravityModelOrder" placeholder="Model fallback order: Gemini 2.5 Pro, Gemini 2.5 Flash, Claude, GPT OSS"></textarea>
        <label class="checkline"><input data-field="antigravityAutoSwitchModel" type="checkbox" /> On limit, try next configured model</label>
        <label class="checkline"><input data-field="antigravityConfirmPermissions" type="checkbox" /> Allow guarded safe permission clicks only</label>
        <div class="row"><button data-act="antigravityPrompt" class="secondary">AG smart prompt</button><button data-act="antigravitySend" class="orange">AG smart send</button></div>
        <div class="row"><button data-act="antigravityModelSwitch" class="secondary">Switch model</button><button data-act="antigravityPermissions" class="orange">Permission guard</button></div>
        <div class="section-title">Manus AI Runner</div>
        <div class="row"><input data-field="manusMaxSends" type="number" min="1" max="300" placeholder="max sends/credits" /><input data-field="manusMorningRefreshHour" type="number" min="0" max="23" placeholder="refresh hour" /></div>
        <input data-field="manusFallbackText" placeholder="repeated question reply" />
        <label class="checkline"><input data-field="manusMorningRefresh" type="checkbox" /> Morning refresh once per day when runner starts</label>
        <div class="row"><button data-act="manusStart" class="secondary">Manus Start 300</button><button data-act="manusStop" class="warn">Manus Stop</button></div>
        <div class="row"><button data-act="manusStatus" class="secondary">Manus Status</button><button data-act="manusRefresh" class="orange">Refresh Manus</button></div>
        <div class="section-title">Scholarship Form Assistant</div>
        <textarea data-field="scholarshipProfile" placeholder="Paste applicant profile as JSON or lines: full name=..., email=..., phone=..., city=..., education=..., income=..., statement=..."></textarea>
        <textarea data-field="scholarshipExtra" placeholder="Extra form notes: target scholarship, preferred program, essay angle, missing fields to leave blank, etc."></textarea>
        <div class="row"><button data-act="scholarshipAnalyze" class="secondary">Analyze form</button><button data-act="scholarshipFill" class="orange">Fill safe draft</button></div>
        <div class="row"><button data-act="scholarshipHighlight" class="secondary">Highlight missing</button><button data-act="scholarshipClear" class="warn">Clear marks</button></div>
        <div class="status">Safe mode: ARIA fills only confident matches from your profile. Review manually; submit stays your click.</div>
        <textarea data-field="initialPrompt" placeholder="Full prompt/file text first"></textarea>
        <label class="checkline"><input data-field="sendPromptFirst" type="checkbox" /> Send prompt first</label>
        <textarea data-field="promptQueue" placeholder="Prompt queue: one prompt per line, or blank-line separated blocks"></textarea>
        <label class="checkline"><input data-field="usePromptQueue" type="checkbox" /> Use prompt queue before number/dot sequence</label>
        <div class="row"><button data-act="sendPromptNow" class="secondary">Send prompt</button><button data-act="resetPromptFlag" class="orange">Allow again</button></div>
        <div class="row"><button data-act="run">Run</button><button data-act="stop" class="warn">Stop</button></div>
        <div class="row"><button data-act="sendCurrentNumberNow" class="orange">Send # Now</button><button data-act="status" class="secondary">Status</button></div>
        <div class="row"><button data-act="aiStudioForceSend" class="orange">AI Studio force send</button><button data-act="aiStudioDiagnose" class="secondary">AI Studio diagnose</button></div>
        <div class="row"><button data-act="rescueStuckInput" class="orange">Rescue stuck send</button><button data-act="status" class="secondary">Status</button></div>
        <div class="row"><button data-act="retryFailedSend" class="secondary">Retry failed</button><button data-act="skipFailedSend" class="warn">Skip failed</button></div>
        <label class="checkline"><input data-field="selfHealFailedSends" type="checkbox" /> Self-heal failed sends</label>
        <input data-field="selfHealRetryMs" type="number" min="30000" step="1000" placeholder="self-heal retry ms" />
        <div class="row"><button data-act="oneClick" class="secondary">One-click</button><button data-act="status" class="secondary">Status</button></div>
        <div class="row"><button data-act="doctor" class="secondary">Doctor</button><button data-act="repairTab" class="orange">Repair tab</button></div>
        <div class="row"><button data-act="reset" class="orange">Reset #</button><button data-act="copyCode" class="secondary">Copy code</button></div>
        <div class="row"><button data-act="codeVaultSave" class="secondary">Save visible code</button><button data-act="codeVaultZip" class="orange">Code ZIP</button></div>
        <div class="row"><button data-act="codeVaultStatus" class="secondary">Code vault status</button><button data-act="codeVaultAutoScan" class="orange">Auto code scan</button></div>
        <div class="row"><button data-act="codeVaultPasteLatest" class="secondary">Vault -> input</button><button data-act="codeVaultSendLatest" class="orange">Vault -> send</button></div>
        <div class="row"><button data-act="codeVaultCopyLatest" class="secondary">Copy latest code</button><button data-act="codeVaultDownloadAll" class="orange">All ZIP</button></div>
        <div class="row"><button data-act="allowCopy" class="secondary">Allow copy tab</button><button data-act="copyResponse" class="secondary">Copy response</button></div>
        <div class="row"><button data-act="allowAndCopy" class="orange">Allow + copy</button><button data-act="blockCopy" class="warn">Block copy tab</button></div>
        <input data-field="wordTopic" placeholder="Word doc name/topic (optional)" />
        <select data-field="wordSaveMode"><option value="full">Word: full response + code</option><option value="code">Word: code blocks first</option></select>
        <label class="checkline"><input data-field="autoWordSave" type="checkbox" /> Auto save response to Word before next send</label>
        <label class="checkline"><input data-field="autoCodexSave" type="checkbox" /> Auto save response to Codex bridge before next send</label>
        <label class="checkline"><input data-field="wordOpenAfterSave" type="checkbox" /> Open Word after manual save</label>
        <div class="row"><button data-act="sendWord" class="secondary">Send to Word</button><button data-act="newWord" class="orange">New Word</button></div>
        <div class="row"><button data-act="copyAndWord" class="secondary">Copy + Word</button><button data-act="allowCopyAndWord" class="orange">Allow + Copy + Word</button></div>
        <div class="row"><button data-act="copyAllResponses" class="secondary">Copy all responses</button><button data-act="allResponsesWord" class="orange">All responses -> Word</button></div>
        <div class="row"><button data-act="copyLatestPrompt" class="secondary">Copy latest prompt</button><button data-act="copyAllPrompts" class="orange">Copy all prompts</button></div>
        <select data-field="desktopTarget"><option value="focused">Desktop: any focused app</option><option value="notepad">Desktop: open Notepad</option><option value="word">Desktop: open Word</option><option value="vscode">Desktop: open VS Code</option><option value="cursor">Desktop: open Cursor</option><option value="codex">Desktop: open Codex/ChatGPT</option></select>
        <div class="row"><input data-field="desktopPasteDelay" type="number" min="1" max="15" placeholder="paste delay seconds" /><label class="checkline"><input data-field="desktopOpenTarget" type="checkbox" /> Open app</label></div>
        <div class="row"><button data-act="pasteLatestDesktop" class="secondary">Paste latest -> app</button><button data-act="pasteAllDesktop" class="orange">Paste all -> app</button></div>
        <div class="row"><button data-act="pasteLatestPromptDesktop" class="secondary">Latest prompt -> app</button><button data-act="pasteAllPromptsDesktop" class="orange">All prompts -> app</button></div>
        <button data-act="pasteFullChatDesktop" class="secondary" style="width:100%;margin-top:8px">Full chat -> app</button>
        <div class="row"><button data-act="copyTransferBundle" class="secondary">Copy transfer</button><button data-act="pasteTransferInput" class="orange">Transfer -> input</button></div>
        <div class="row"><button data-act="pasteTransferDesktop" class="secondary">Transfer -> app</button><button data-act="downloadTransferBundle" class="orange">Transfer MD</button></div>
        <textarea data-field="appRouterTask" placeholder="Credits-aware app router task: e.g. choose best app with credits for video, then send result to social draft"></textarea>
        <div class="row"><button data-act="appRouterStatus" class="secondary">App status</button><button data-act="copyAppRoutePlan" class="orange">Copy route plan</button></div>
        <div class="row"><button data-act="pasteAppRouteInput" class="secondary">Route -> input</button><button data-act="pasteAppRouteDesktop" class="orange">Route -> app</button></div>
        <button data-act="downloadAppRoutePlan" class="secondary" style="width:100%;margin-top:8px">Download route MD</button>
        <div class="row"><button data-act="latestNotepad" class="secondary">Latest -> Notepad</button><button data-act="allNotepad" class="orange">All -> Notepad</button></div>
        <div class="row"><button data-act="latestGoogleDocs" class="secondary">Latest -> GDocs</button><button data-act="allGoogleDocs" class="orange">All -> GDocs</button></div>
        <input data-field="driveTitle" placeholder="Google Drive save title (optional)" />
        <label class="checkline"><input data-field="driveAutoSave" type="checkbox" /> Auto save each finished response to Google Drive backup</label>
        <div class="row"><button data-act="latestDrive" class="secondary">Latest -> Drive</button><button data-act="allResponsesDrive" class="orange">All -> Drive</button></div>
        <div class="row"><button data-act="driveStatus" class="secondary">Drive status</button><button data-act="openDriveFolder" class="orange">Drive folder</button></div>
        <div class="row"><button data-act="latestCodex" class="secondary">Latest -> Codex</button><button data-act="allResponsesCodex" class="orange">All -> Codex</button></div>
        <div class="row"><button data-act="latestVSCode" class="secondary">Latest -> VS Code</button><button data-act="allResponsesVSCode" class="orange">All -> VS Code</button></div>
        <select data-field="codingTarget"><option value="codex">Target: Codex web</option><option value="vscode">Target: VS Code</option><option value="cursor">Target: Cursor</option><option value="claude">Target: Claude</option><option value="chatgpt">Target: ChatGPT</option><option value="gemini">Target: Gemini</option><option value="clickup">Target: ClickUp</option></select>
        <div class="row"><button data-act="latestCodingTarget" class="secondary">Latest -> target</button><button data-act="allCodingTarget" class="orange">All -> target</button></div>
        <div class="row"><button data-act="wordDocCodingTarget" class="secondary">Word -> target</button><button data-act="openCodingTarget" class="orange">Open target</button></div>
        <label class="checkline"><input data-field="clickupChatgptSendNow" type="checkbox" /> ClickUp -> ChatGPT auto-send after paste</label>
        <div class="row"><button data-act="clickupAllToChatGpt" class="secondary">ClickUp all -> ChatGPT</button><button data-act="clickupLiveToChatGpt" class="orange">Live CU -> GPT</button></div>
        <div class="row"><button data-act="clickupStopLiveToChatGpt" class="warn">Stop CU -> GPT</button><button data-act="clickupBridgeStatus" class="secondary">CU -> GPT status</button></div>
        <div class="row"><button data-act="codexOutboxInput" class="secondary">Codex -> Input</button><button data-act="codexOutboxSend" class="orange">Codex -> Send</button></div>
        <button data-act="wordDocCodex" class="secondary">Word Doc -> Codex</button>
        <button data-act="wordDocVSCode" class="secondary">Word Doc -> VS Code</button>
        <button data-act="basitWordAuto">Basit Automate Word</button>
        <button data-act="basitWordCodexAuto" class="secondary">Basit Word + Codex Auto</button>
        <button data-act="basitWordFullRun" class="secondary">Save Old + Send Next</button>
        <div class="row"><button data-act="openWord" class="secondary">Open Word</button><button data-act="openWordFolder" class="orange">Word folder</button></div>
        <textarea data-field="pipelineTopic" placeholder="Guided pipeline topic/campaign. Each click runs one safe stage only."></textarea>
        <div class="row"><button data-act="pipelineStart" class="secondary">Start pipeline</button><button data-act="pipelineNext" class="orange">Next step</button></div>
        <div class="row"><button data-act="pipelineStatus" class="secondary">Pipeline status</button><button data-act="pipelineReset" class="warn">Reset pipeline</button></div>
        <textarea data-field="imagePrompt" placeholder="ChatGPT image prompt"></textarea>
        <input data-field="imageFolder" placeholder="Downloads folder" />
        <div class="row"><button data-act="generateImage" class="secondary">Generate image</button><button data-act="saveImages" class="orange">Save images</button></div>
        <textarea data-field="socialTopic" placeholder="Social topic/caption/comment instruction"></textarea>
        <input data-field="socialTone" placeholder="tone" />
        <textarea data-field="socialExtra" placeholder="Extra social instruction"></textarea>
        <textarea data-field="pulseComment" placeholder="Pulse Post comment/draft text. Leave blank to auto-build from current page."></textarea>
        <div class="row"><button data-act="pulseAnalyze" class="secondary">Pulse analyze</button><button data-act="pulseDraft" class="orange">Pulse fill draft</button></div>
        <div class="row"><button data-act="pulseCopy" class="secondary">Pulse copy</button><button data-act="pulseYouTubeDraft" class="orange">YouTube draft</button></div>
        <div class="row"><button data-act="socialFillPost" class="secondary">Fill post</button><button data-act="socialComment" class="orange">Fill comment</button></div>
        <div class="row"><button data-act="linkedinPro" class="secondary">LinkedIn Pro</button><button data-act="linkedinComment" class="orange">LinkedIn Comment</button></div>
        <div class="row"><button data-act="linkedinCompany" class="secondary">LinkedIn Company</button><button data-act="linkedinHighlight" class="orange">LinkedIn buttons</button></div>
        <div class="row"><button data-act="socialHighlight" class="secondary">Highlight social</button><button data-act="videoFill" class="orange">Fill video topic</button></div>
        <input data-field="whatsappSourceName" placeholder="WhatsApp source chat/channel name (optional)" />
        <input data-field="whatsappReceiverName" placeholder="WhatsApp receiver chat/channel name" />
        <div class="row"><button data-act="waCurrentSource" class="secondary">Current WA -> Source</button><button data-act="waCurrentReceiver" class="orange">Current WA -> Receiver</button></div>
        <button data-act="waCurrentSourceCopy" class="secondary">Current WA -> Source + Copy</button>
        <button data-act="waCurrentReceiverFill" class="orange">Current WA -> Receiver + Fill</button>
        <button data-act="waOneClickDraft" class="secondary">WA source -> receiver draft</button>
        <div class="row"><button data-act="waCopyPost" class="secondary">Copy post for WhatsApp</button><button data-act="waFillDraft" class="orange">Fill WhatsApp draft</button></div>
        <div class="row"><button data-act="waOpen" class="secondary">Open WhatsApp</button><button data-act="waCopyDraft" class="orange">Copy WA draft</button></div>
        <div class="row"><button data-act="waSwap" class="secondary">Swap WA bridge</button><button data-act="waClear" class="warn">Clear WA bridge</button></div>
        <button data-act="waStatus" class="secondary">WhatsApp bridge status</button>
        <div class="row"><button data-act="videoCapture" class="secondary">Capture video</button><button data-act="videoDownload" class="orange">Download video</button></div>
        <div class="row"><button data-act="xPrep" class="secondary">X safe prep</button><button data-act="downloads" class="orange">Downloads</button></div>
        <button data-act="reloadExtension" class="orange">Reload Extension Now</button>
        <div class="status" data-status>Ready.</div>
      </div>
    `;
    document.body.appendChild(panel);
    restorePanel(panel);
    wirePanel(panel);
    syncPanelInputs();
    updatePanelMeta();
    setStatus(state.lastMessage);
    return panel;
  }

  function restorePanel(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || "null");
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        panel.style.left = pos.left + "px";
        panel.style.top = pos.top + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }
    } catch (err) {}
  }

  function wirePanel(panel) {
    const head = panel.querySelector(".head");
    let drag = null;
    head.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      event.preventDefault();
    });
    window.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const left = Math.max(6, Math.min(innerWidth - panel.offsetWidth - 6, event.clientX - drag.dx));
      const top = Math.max(6, Math.min(innerHeight - panel.offsetHeight - 6, event.clientY - drag.dy));
      panel.style.left = left + "px";
      panel.style.top = top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      const rect = panel.getBoundingClientRect();
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    });

    // ARIA v4.9.0 — Feature 14: ARIA Command Bar
    panel.addEventListener("keydown", async (event) => {
      const commandInput = event.target && event.target.closest ? event.target.closest("[data-field='ariaCommand']") : null;
      if (!commandInput || event.key !== "Enter") return;
      event.preventDefault();
      const command = commandInput.value || "";
      commandInput.value = "";
      readPanelInputs();
      await saveOptionsFromState();
      await handleAriaCommand(command);
    });

    panel.addEventListener("click", async (event) => {
      const sec = event.target && event.target.dataset ? event.target.dataset.sec : "";
      if (sec) {
        const secondsInput = panel.querySelector("[data-field='seconds']");
        if (secondsInput) secondsInput.value = sec;
        readPanelInputs();
        await saveOptionsFromState();
        setStatus(`Wait time set to ${sec}s.`);
        return;
      }
      const action = event.target && event.target.dataset ? event.target.dataset.act : "";
      if (!action) return;
      if (action === "close") return panel.remove();
      if (action === "min") {
        state.minimized = !state.minimized;
        localStorage.setItem(PANEL_MIN_KEY, state.minimized ? "1" : "0");
        panel.classList.toggle("min", state.minimized);
        return;
      }
      readPanelInputs();
      await saveOptionsFromState();
      if (action === "run") start();
      else if (action === "oneClick") {
        const reply = await oneClickCurrentSite({ social: panelSocialPayload() });
        setStatus(reply.message || reply.error || "One-click complete.");
      }
      else if (action === "stop") stop();
      else if (action === "reset") resetCounter(state.nextNumber);
      else if (action === "limitClear") await clearLimitGuardWait();
      else if (action === "limitToggle") await toggleLimitGuard();
      else if (action === "limitStatus") setStatus(limitGuardStatusText());
      else if (action === "limitPause5") await pauseLimitGuard(5, "Manual 5 minute pause");
      else if (action === "limitPause10") await pauseLimitGuard(10, "Manual 10 minute pause");
      else if (action === "responseHistory") {
        // ARIA v4.8.0 — Feature 8: Response Snapshot History
        updateResponseHistoryIfChanged();
        const rows = (state.responseHistory || []).slice(-10).reverse();
        setStatus(rows.length
          ? rows.map((row, index) => `${index + 1}. ${new Date(row.timestamp).toLocaleTimeString()} | sent:${row.sendCount}\n${previewText(row.text, 220)}`).join("\n\n")
          : "No stable response history captured yet.");
      }
      else if (action === "clearSchedule") {
        state.scheduledStartTime = "";
        await saveOptionsFromState();
        syncPanelInputs();
        setStatus("Scheduled start cleared.");
      }
      else if (action === "resetStopAfterN") {
        state.stopAfterN = "0";
        await saveOptionsFromState();
        syncPanelInputs();
        setStatus("Stop-after limit cleared. Runner will continue until manually stopped or limit guard pauses.");
      }
      else if (action === "sendPromptNow") sendPromptNow(state.initialPrompt);
      else if (action === "sendCurrentNumberNow") {
        const reply = await sendCurrentNumberNow();
        setStatus(reply.message || reply.error || "Send # Now finished.");
      }
      else if (action === "aiStudioForceSend") {
        const reply = await forceAiStudioSend();
        setStatus(reply.message || reply.error || "AI Studio force send finished.");
      }
      else if (action === "aiStudioDiagnose") setStatus(aiStudioDiagnoseText());
      else if (action === "rescueStuckInput") {
        const reply = await manualRescueStuckInput();
        setStatus(reply.message || reply.error || "Stuck-input rescue finished.");
      }
      else if (action === "retryFailedSend") {
        const reply = await retryFailedSend();
        setStatus(reply.message || reply.error || "Retry failed finished.");
      }
      else if (action === "skipFailedSend") {
        const reply = await skipFailedSend();
        setStatus(reply.message || reply.error || "Skip failed finished.");
      }
      else if (action === "resetPromptFlag") {
        state.promptSent = false;
        setStatus("Prompt can be sent again on this tab.");
      }
      else if (action === "smartPromptFill") await smartPromptToInput({ sendNow: false });
      else if (action === "smartPromptSend") await smartPromptToInput({ sendNow: true });
      else if (action === "antigravityPrompt") await antigravitySmartPrompt({ sendNow: false });
      else if (action === "antigravitySend") await antigravitySmartPrompt({ sendNow: true });
      else if (action === "antigravityModelSwitch") await antigravitySwitchModel();
      else if (action === "antigravityPermissions") await antigravityPermissionGuard();
      else if (action === "manusStart") await startManusRunner({ resetPromptFirst: false });
      else if (action === "manusStop") stopManusRunner();
      else if (action === "manusStatus") setStatus(manusStatusText());
      else if (action === "manusRefresh") manusManualRefresh();
      else if (action === "scholarshipAnalyze") setStatus(scholarshipAnalyzeText());
      else if (action === "scholarshipFill") {
        const reply = await fillScholarshipDraft();
        setStatus(reply.message || reply.error || "Scholarship fill finished.");
      }
      else if (action === "scholarshipHighlight") {
        const reply = highlightScholarshipFields();
        setStatus(reply.message || reply.error || "Scholarship fields highlighted.");
      }
      else if (action === "scholarshipClear") {
        const reply = clearScholarshipHighlights();
        setStatus(reply.message || reply.error || "Scholarship marks cleared.");
      }
      else if (action === "status") setStatus(statusText());
      else if (action === "doctor") {
        const health = await sendRuntime({ type: "ARIA_SUPER_HEALTH_CHECK" });
        const diagnosis = diagnosePage();
        const advice = diagnosis.busy
          ? `Wait until response ends: ${diagnosis.busyReason}`
          : diagnosis.ready
            ? "Ready. Use Run / One-click / Basit Automate Word."
            : "No safe input/button detected. Open the real chat/composer, then click Repair tab.";
        setStatus([
          "ARIA Automation Doctor",
          `Extension: v${health && health.version ? health.version : "unknown"}`,
          `Site: ${diagnosis.site}`,
          `Mode: ${diagnosis.mode}`,
          `Input: ${diagnosis.inputFound ? diagnosis.inputLabel || "found" : "not found"}`,
          `Action: ${diagnosis.actionButtonFound ? diagnosis.actionButtonLabel || "found" : "not found"}`,
          `Busy: ${diagnosis.busy ? diagnosis.busyReason : "no"}`,
          `Running this tab: ${diagnosis.running ? "YES" : "NO"}`,
          `Running tabs: ${health && health.runningTabs !== undefined ? health.runningTabs : "unknown"}`,
          `Groq: ${health && health.groqApiKeySet ? health.groqApiKeyMasked : "not saved"}`,
          `Advice: ${advice}`
        ].join("\n"));
      }
      else if (action === "repairTab") {
        ensurePanel();
        await saveOptionsFromState();
        const reply = await sendRuntime({
          type: "ARIA_SUPER_REGISTER_TAB",
          intervalMs: state.intervalMs,
          mode: resolvedMode(),
          url: location.href,
          title: document.title
        });
        setStatus(reply && reply.ok
          ? `Repair done. Background watcher refreshed.\n${statusText()}`
          : `Repair note: page helper is alive, but background watcher refresh failed.\n${statusText()}`);
      }
      else if (action === "generateImage") generateImage(panel.querySelector("[data-field='imagePrompt']").value);
      else if (action === "saveImages") scanImages("manual");
      else if (action === "socialFillPost") fillSocialDraft(panelSocialPayload(), "post");
      else if (action === "socialComment") fillSocialDraft(panelSocialPayload(), "comment");
      else if (action === "linkedinPro") await linkedinProAssist("profile");
      else if (action === "linkedinComment") await linkedinCommentAssist();
      else if (action === "linkedinCompany") await linkedinProAssist("company");
      else if (action === "linkedinHighlight") highlightLinkedInActions();
      else if (action === "socialHighlight") highlightSocialActions();
      else if (action === "pulseAnalyze") pulseAnalyzeCurrentPage();
      else if (action === "pulseDraft") await pulsePrepareCurrentDraft();
      else if (action === "pulseCopy") await pulseCopyDraft();
      else if (action === "pulseYouTubeDraft") await pulsePrepareYouTubeCommentDraft();
      else if (action === "waCopyPost") await copyPostForWhatsApp();
      else if (action === "waFillDraft") await fillWhatsAppDraft();
      else if (action === "waCurrentSource") await setCurrentWhatsAppChatRole("source");
      else if (action === "waCurrentReceiver") await setCurrentWhatsAppChatRole("receiver");
      else if (action === "waCurrentSourceCopy") await setCurrentSourceAndCopyWhatsApp();
      else if (action === "waCurrentReceiverFill") await setCurrentReceiverAndFillWhatsApp();
      else if (action === "waOneClickDraft") await whatsappOneClickDraft();
      else if (action === "waOpen") await openWhatsAppWeb();
      else if (action === "waCopyDraft") await copyWhatsAppDraftToClipboard();
      else if (action === "waSwap") await swapWhatsAppBridge();
      else if (action === "waClear") await clearWhatsAppBridge();
      else if (action === "waStatus") await whatsappBridgeStatus();
      else if (action === "videoFill") fillHeyGenTopic();
      else if (action === "videoCapture") captureVideoLink();
      else if (action === "videoDownload") downloadOfficialVideo();
      else if (action === "copyCode") copyCodeBlocks();
      else if (action === "codeVaultSave") await saveVisibleCodeToVault({ manual: true });
      else if (action === "codeVaultZip") await downloadCodeVaultZip();
      else if (action === "codeVaultDownloadAll") await downloadCodeVaultZip();
      else if (action === "codeVaultStatus") await codeVaultStatus();
      else if (action === "codeVaultAutoScan") await toggleCodeVaultAutoScan();
      else if (action === "codeVaultPasteLatest") await pasteLatestCodeVaultFile();
      else if (action === "codeVaultSendLatest") await pasteLatestCodeVaultFile({ sendNow: true });
      else if (action === "codeVaultCopyLatest") await copyLatestCodeVaultFile();
      else if (action === "allowCopy") setResponseCopyAllowed(true);
      else if (action === "blockCopy") setResponseCopyAllowed(false);
      else if (action === "copyResponse") copyLatestResponse();
      else if (action === "allowAndCopy") {
        setResponseCopyAllowed(true);
        copyLatestResponse();
      }
      else if (action === "copyAndWord") copyAndSendWord();
      else if (action === "allowCopyAndWord") {
        setResponseCopyAllowed(true);
        copyAndSendWord({ allowOnce: true });
      }
      else if (action === "copyAllResponses") await copyAllResponses({ allowOnce: true });
      else if (action === "copyLatestPrompt") await copyLatestPrompt({ allowOnce: true });
      else if (action === "copyAllPrompts") await copyAllPrompts({ allowOnce: true });
      else if (action === "allResponsesWord") await sendAllResponsesToWord({ forceOpen: true });
      else if (action === "pasteLatestDesktop") await pasteLatestToDesktop();
      else if (action === "pasteAllDesktop") await pasteAllResponsesToDesktop();
      else if (action === "pasteLatestPromptDesktop") await pasteLatestPromptToDesktop();
      else if (action === "pasteAllPromptsDesktop") await pasteAllPromptsToDesktop();
      else if (action === "pasteFullChatDesktop") await pasteFullChatToDesktop();
      else if (action === "copyTransferBundle") await copyTransferBundle();
      else if (action === "pasteTransferInput") await pasteTransferToCurrentInput();
      else if (action === "pasteTransferDesktop") await pasteTransferToDesktop();
      else if (action === "downloadTransferBundle") await downloadTransferBundle();
      else if (action === "appRouterStatus") await appRouterStatus();
      else if (action === "copyAppRoutePlan") await copyAppRoutePlan();
      else if (action === "pasteAppRouteInput") await pasteAppRouteToCurrentInput();
      else if (action === "pasteAppRouteDesktop") await pasteAppRouteToDesktop();
      else if (action === "downloadAppRoutePlan") await downloadAppRoutePlan();
      else if (action === "latestNotepad") await pasteLatestToNotepad();
      else if (action === "allNotepad") await pasteAllResponsesToNotepad();
      else if (action === "latestGoogleDocs") await openLatestInGoogleDocs();
      else if (action === "allGoogleDocs") await openAllInGoogleDocs();
      else if (action === "latestDrive") await saveLatestToDrive();
      else if (action === "allResponsesDrive") await saveAllResponsesToDrive();
      else if (action === "driveStatus") await driveStatus();
      else if (action === "openDriveFolder") await openDriveFolder();
      else if (action === "latestCodex") await sendLatestToCodex();
      else if (action === "allResponsesCodex") await sendAllResponsesToCodex();
      else if (action === "latestVSCode") await sendLatestToVSCode();
      else if (action === "allResponsesVSCode") await sendAllResponsesToVSCode();
      else if (action === "latestCodingTarget") await sendLatestToCodingTarget();
      else if (action === "allCodingTarget") await sendAllResponsesToCodingTarget();
      else if (action === "wordDocCodingTarget") await sendWordDocToCodingTarget();
      else if (action === "openCodingTarget") await openSelectedCodingTarget();
      else if (action === "clickupAllToChatGpt") await sendClickUpAllToChatGpt({ sendNow: false });
      else if (action === "clickupLiveToChatGpt") await startClickUpChatGptBridge();
      else if (action === "clickupStopLiveToChatGpt") stopClickUpChatGptBridge();
      else if (action === "clickupBridgeStatus") setStatus(clickupChatGptBridgeStatusText());
      else if (action === "codexOutboxInput") await pullCodexOutboxToInput({ sendNow: false });
      else if (action === "codexOutboxSend") await pullCodexOutboxToInput({ sendNow: true });
      else if (action === "wordDocCodex") await sendWordDocToCodex();
      else if (action === "wordDocVSCode") await sendWordDocToVSCode();
      else if (action === "basitWordAuto") await basitWordAutopilot();
      else if (action === "basitWordCodexAuto") await basitWordAutopilot({ codex: true });
      else if (action === "basitWordFullRun") await basitWordAutopilot({ sendNow: true });
      else if (action === "sendWord") await sendLatestToWord();
      else if (action === "newWord") newWordDocument();
      else if (action === "openWord") openWordDocument();
      else if (action === "openWordFolder") openWordFolder();
      else if (action === "pipelineStart") startGuidedPipeline(panelSocialPayload());
      else if (action === "pipelineNext") nextGuidedPipeline(panelSocialPayload());
      else if (action === "pipelineStatus") setStatus(pipelineStatusText());
      else if (action === "pipelineReset") resetGuidedPipeline();
      else if (action === "xPrep") xSafePrep();
      else if (action === "downloads") sendRuntime({ type: "ARIA_SUPER_SHOW_DOWNLOADS" });
      else if (action === "reloadExtension") {
        setStatus("Reloading ARIA Nexus One Hub...");
        await sendRuntime({ type: "ARIA_SUPER_RELOAD_EXTENSION" });
      }
    });
    panel.addEventListener("change", () => {
      readPanelInputs();
      saveOptionsFromState();
    });
  }

  function syncPanelInputs() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const values = {
      mode: state.mode,
      seconds: String(Math.max(1, Math.round(state.intervalMs / 1000))),
      sendMode: state.sendMode,
      customText: state.customText,
      nextNumber: String(state.nextNumber),
      initialPrompt: state.initialPrompt,
      sendPromptFirst: state.sendPromptFirst,
      promptQueue: state.promptQueue,
      usePromptQueue: state.usePromptQueue,
      imageFolder: getImageFolder(),
      videoTopicPrompt: state.videoTopicPrompt,
      videoFolder: getVideoFolder(),
      socialPlatform: state.socialPlatform,
      socialTopic: state.socialTopic,
      socialTone: state.socialTone,
      socialExtra: state.socialExtra,
      whatsappSourceName: state.whatsappSourceName,
      whatsappReceiverName: state.whatsappReceiverName,
      wordTopic: state.wordTopic,
      autoWordSave: state.autoWordSave,
      autoCodexSave: state.autoCodexSave,
      driveAutoSave: state.driveAutoSave,
      driveTitle: state.driveTitle,
      wordSaveMode: state.wordSaveMode,
      wordOpenAfterSave: state.wordOpenAfterSave,
      desktopTarget: state.desktopTarget || "focused",
      desktopPasteDelay: state.desktopPasteDelay || "3",
      desktopOpenTarget: state.desktopOpenTarget,
      limitGuardEnabled: state.limitGuardEnabled !== false,
      limitCooldownMinutes: state.limitCooldownMinutes || "10",
      stopAfterN: state.stopAfterN || "0",
      autoScroll: state.autoScroll !== false,
      minResponseChars: state.minResponseChars || "0",
      scheduledStartTime: state.scheduledStartTime || "",
      sleepFrom: state.sleepFrom || "",
      sleepUntil: state.sleepUntil || "",
      stopKeywords: state.stopKeywords || "",
      customInputSelector: state.customInputSelector || "",
      customSendSelector: state.customSendSelector || "",
      pauseOnHidden: Boolean(state.pauseOnHidden),
      webhookUrl: state.webhookUrl || "",
      webhookOnStop: Boolean(state.webhookOnStop),
      // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
      syncMode: state.syncMode || "off",
      // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
      tokenBudget: String(state.tokenBudget || "0"),
      // ARIA v4.9.0 — Feature 4: Response Quality Filter
      skipShortReplies: Boolean(state.skipShortReplies),
      minReplyWords: String(state.minReplyWords || "10"),
      // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
      autoRegen: Boolean(state.autoRegen),
      regenKeywords: state.regenKeywords || DEFAULTS.regenKeywords,
      // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
      imageSaveFilter: state.imageSaveFilter || "",
      // ARIA v4.9.0 — Feature 10/12/13
      screenshotOnStop: Boolean(state.screenshotOnStop),
      chainTargetTabId: String(state.chainTargetTabId || "0"),
      clipboardWatch: Boolean(state.clipboardWatch),
      pipelineTopic: state.pipelineTopic,
      codingTarget: state.codingTarget || "codex",
      appRouterTask: state.appRouterTask || "",
      clickupChatgptSendNow: state.clickupChatgptSendNow !== false,
      manusMaxSends: String(state.manusMaxSends || 300),
      manusMorningRefresh: state.manusMorningRefresh !== false,
      manusMorningRefreshHour: String(state.manusMorningRefreshHour || "7"),
      manusFallbackText: state.manusFallbackText || "do what is best",
      scholarshipProfile: state.scholarshipProfile || "",
      scholarshipExtra: state.scholarshipExtra || "",
      antigravityModelOrder: state.antigravityModelOrder || DEFAULTS.antigravityModelOrder,
      antigravityAutoSwitchModel: Boolean(state.antigravityAutoSwitchModel),
      antigravityConfirmPermissions: Boolean(state.antigravityConfirmPermissions)
    };
    Object.keys(values).forEach((key) => {
      const el = panel.querySelector(`[data-field='${key}']`);
      if (!el || document.activeElement === el) return;
      if (el.type === "checkbox") el.checked = Boolean(values[key]);
      else el.value = values[key];
    });
  }

  function readPanelInputs() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const get = (name) => panel.querySelector(`[data-field='${name}']`);
    const value = (name, fallback) => {
      const el = get(name);
      if (!el) return fallback;
      return el.type === "checkbox" ? Boolean(el.checked) : (el.value || fallback);
    };
    const rawValue = (name, fallback = "") => {
      const el = get(name);
      if (!el) return fallback;
      return el.type === "checkbox" ? Boolean(el.checked) : String(el.value || "");
    };
    state.mode = value("mode", "auto");
    state.intervalMs = Math.max(1000, Number.parseInt(value("seconds", "5"), 10) * 1000 || 5000);
    state.sendMode = value("sendMode", "numbers");
    state.customText = value("customText", "continue");
    state.nextNumber = Math.max(1, Number.parseInt(value("nextNumber", "1"), 10) || 1);
    state.smartPromptInstruction = value("smartPromptInstruction", state.smartPromptInstruction || "");
    state.initialPrompt = value("initialPrompt", "");
    state.sendPromptFirst = Boolean(value("sendPromptFirst", false));
    state.promptQueue = value("promptQueue", "");
    state.usePromptQueue = Boolean(value("usePromptQueue", false));
    state.videoTopicPrompt = value("videoTopicPrompt", state.videoTopicPrompt);
    state.videoFolder = value("videoFolder", state.videoFolder);
    state.socialPlatform = value("socialPlatform", state.socialPlatform || "auto");
    state.socialTopic = value("socialTopic", state.socialTopic);
    state.socialTone = value("socialTone", state.socialTone || "friendly");
    state.socialExtra = value("socialExtra", state.socialExtra);
    state.whatsappSourceName = value("whatsappSourceName", state.whatsappSourceName);
    state.whatsappReceiverName = value("whatsappReceiverName", state.whatsappReceiverName);
    state.wordTopic = value("wordTopic", state.wordTopic);
    state.autoWordSave = Boolean(value("autoWordSave", false));
    state.autoCodexSave = Boolean(value("autoCodexSave", false));
    state.driveAutoSave = Boolean(value("driveAutoSave", false));
    state.driveTitle = value("driveTitle", state.driveTitle);
    state.wordSaveMode = value("wordSaveMode", state.wordSaveMode || "full") || "full";
    state.wordOpenAfterSave = Boolean(value("wordOpenAfterSave", false));
    state.desktopTarget = value("desktopTarget", state.desktopTarget || "focused") || "focused";
    state.desktopPasteDelay = value("desktopPasteDelay", state.desktopPasteDelay || "3") || "3";
    state.desktopOpenTarget = Boolean(value("desktopOpenTarget", false));
    state.limitGuardEnabled = Boolean(value("limitGuardEnabled", true));
    state.limitCooldownMinutes = String(Math.max(5, Number.parseInt(value("limitCooldownMinutes", state.limitCooldownMinutes || "10"), 10) || 10));
    state.stopAfterN = String(Math.max(0, Number.parseInt(value("stopAfterN", state.stopAfterN || "0"), 10) || 0));
    // ARIA v4.8.0 — Feature 1: Auto-Scroll to Bottom Before Send
    state.autoScroll = Boolean(value("autoScroll", true));
    // ARIA v4.8.0 — Feature 2: Response Length Guard
    state.minResponseChars = String(Math.max(0, Number.parseInt(value("minResponseChars", state.minResponseChars || "0"), 10) || 0));
    // ARIA v4.26.7 - Self-Healing Failed Send Retry
    state.selfHealFailedSends = Boolean(value("selfHealFailedSends", true));
    state.selfHealRetryMs = String(Math.max(30000, Number.parseInt(value("selfHealRetryMs", state.selfHealRetryMs || "60000"), 10) || 60000));
    // ARIA v4.8.0 — Feature 3: Scheduled Start / Time-Based Trigger
    state.scheduledStartTime = rawValue("scheduledStartTime", state.scheduledStartTime || "");
    // ARIA v4.8.0 — Feature 4: Tab Sleep / Wake Schedule
    state.sleepFrom = rawValue("sleepFrom", state.sleepFrom || "");
    state.sleepUntil = rawValue("sleepUntil", state.sleepUntil || "");
    // ARIA v4.8.0 — Feature 6: Keyword-Based Auto-Stop
    state.stopKeywords = rawValue("stopKeywords", state.stopKeywords || "");
    // ARIA v4.8.0 — Feature 7: Per-Site Custom Selectors
    state.customInputSelector = rawValue("customInputSelector", state.customInputSelector || "");
    state.customSendSelector = rawValue("customSendSelector", state.customSendSelector || "");
    // ARIA v4.8.0 — Feature 14: Auto-Pause on Tab Visibility Change
    state.pauseOnHidden = Boolean(value("pauseOnHidden", false));
    // ARIA v4.8.0 — Feature 15: Webhook Notification on Stop/Limit
    state.webhookUrl = rawValue("webhookUrl", state.webhookUrl || "");
    state.webhookOnStop = Boolean(value("webhookOnStop", false));
    // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
    state.syncMode = value("syncMode", state.syncMode || "off") || "off";
    // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
    state.tokenBudget = String(Math.max(0, Number.parseInt(value("tokenBudget", state.tokenBudget || "0"), 10) || 0));
    // ARIA v4.9.0 — Feature 4: Response Quality Filter
    state.skipShortReplies = Boolean(value("skipShortReplies", false));
    state.minReplyWords = String(Math.max(1, Number.parseInt(value("minReplyWords", state.minReplyWords || "10"), 10) || 10));
    // ARIA v4.9.0 — Feature 5: Auto-Regenerate on Error Response
    state.autoRegen = Boolean(value("autoRegen", false));
    state.regenKeywords = rawValue("regenKeywords", state.regenKeywords || DEFAULTS.regenKeywords);
    // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
    state.imageSaveFilter = rawValue("imageSaveFilter", state.imageSaveFilter || "");
    // ARIA v4.9.0 — Feature 10: Auto Screenshot on Stop
    state.screenshotOnStop = Boolean(value("screenshotOnStop", false));
    // ARIA v4.9.0 — Feature 12: Prompt Chaining Across Tabs
    state.chainTargetTabId = String(Math.max(0, Number.parseInt(value("chainTargetTabId", state.chainTargetTabId || "0"), 10) || 0));
    // ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
    const nextClipboardWatch = Boolean(value("clipboardWatch", false));
    if (nextClipboardWatch !== Boolean(state.clipboardWatch)) {
      state.clipboardWatch = nextClipboardWatch;
      if (state.clipboardWatch) startClipboardWatch();
      else stopClipboardWatch();
    }
    state.pipelineTopic = value("pipelineTopic", state.pipelineTopic);
    state.codingTarget = value("codingTarget", state.codingTarget || "codex") || "codex";
    state.appRouterTask = value("appRouterTask", state.appRouterTask || "");
    state.clickupChatgptSendNow = Boolean(value("clickupChatgptSendNow", true));
    state.manusMaxSends = Math.max(1, Math.min(300, Number.parseInt(value("manusMaxSends", state.manusMaxSends || "300"), 10) || 300));
    state.manusMorningRefresh = Boolean(value("manusMorningRefresh", true));
    state.manusMorningRefreshHour = String(Math.max(0, Math.min(23, Number.parseInt(value("manusMorningRefreshHour", state.manusMorningRefreshHour || "7"), 10) || 7)));
    state.manusFallbackText = value("manusFallbackText", state.manusFallbackText || "do what is best") || "do what is best";
    state.scholarshipProfile = value("scholarshipProfile", state.scholarshipProfile || "") || "";
    state.scholarshipExtra = value("scholarshipExtra", state.scholarshipExtra || "") || "";
    state.antigravityModelOrder = value("antigravityModelOrder", state.antigravityModelOrder || DEFAULTS.antigravityModelOrder) || DEFAULTS.antigravityModelOrder;
    state.antigravityAutoSwitchModel = Boolean(value("antigravityAutoSwitchModel", false));
    state.antigravityConfirmPermissions = Boolean(value("antigravityConfirmPermissions", false));
  }

  function panelSocialPayload() {
    readPanelInputs();
    return {
      platform: state.socialPlatform || "auto",
      topic: state.socialTopic || "",
      tone: state.socialTone || "friendly",
      extra: state.socialExtra || ""
    };
  }

  // ARIA v4.28.1 - Pulse Post Suite: safe sentiment/context analyzer and draft-only social helper.
  function pulseDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ARIA v4.28.1 - Pulse Post Suite: lightweight sentiment model adapted from imported Pulse suite.
  function pulseSentimentScore(text) {
    const lower = String(text || "").toLowerCase();
    const positive = ["great", "love", "amazing", "good", "best", "helpful", "excellent", "wow", "useful", "nice", "thanks", "awesome"];
    const negative = ["bad", "hate", "terrible", "worst", "spam", "scam", "fake", "broken", "issue", "problem", "poor"];
    let score = 0;
    positive.forEach((word) => { if (lower.includes(word)) score += 1; });
    negative.forEach((word) => { if (lower.includes(word)) score -= 1; });
    return score;
  }

  // ARIA v4.28.1 - Pulse Post Suite: collect nearby content without depending on one website's DOM forever.
  function pulseContextText() {
    const selection = String(window.getSelection && window.getSelection().toString() || "").trim();
    if (selection.length > 20) return selection.slice(0, 4000);
    const site = siteKind();
    const selectorsBySite = {
      youtube: ["h1", "#description", "ytd-watch-metadata", "#contents ytd-comment-thread-renderer"],
      x: ["article", "[data-testid='tweetText']"],
      facebook: ["[role='article']", "[data-ad-preview='message']"],
      instagram: ["article", "main"],
      linkedin: [".feed-shared-update-v2", "main"],
      tiktok: ["[data-e2e='browse-video-desc']", "main"]
    };
    const selectors = selectorsBySite[site] || ["article", "main", "[role='main']", "body"];
    const parts = [];
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (parts.length >= 8 || !visible(el) || inPanel(el)) return;
        const text = String(el.innerText || el.textContent || "").trim();
        if (text.length > 25) parts.push(text);
      });
    });
    return (parts.join("\n\n") || String(document.body.innerText || "")).slice(0, 5000);
  }

  // ARIA v4.28.1 - Pulse Post Suite: build a safe draft; final public action remains the user's click.
  function pulseBuildDraft(inputText) {
    readPanelInputs();
    const custom = String(inputText || state.pulseComment || "").trim();
    if (custom) return custom;
    const context = pulseContextText();
    const score = pulseSentimentScore(context);
    const site = siteKind();
    if (site === "youtube") {
      if (score < 0) return "Thanks for sharing. Interesting points here.";
      return "Great video. Thanks for sharing this.";
    }
    if (site === "x") return score < 0 ? "Interesting point. Worth thinking about." : "Great insight. Thanks for sharing.";
    if (site === "linkedin") return "Useful insight. This is worth saving and applying.";
    if (site === "facebook" || site === "instagram") return "Nice post. Thanks for sharing.";
    return "Thanks for sharing. This is helpful.";
  }

  // ARIA v4.28.1 - Pulse Post Suite: show analysis without clicking public action buttons.
  function pulseAnalyzeCurrentPage() {
    const text = pulseContextText();
    const score = pulseSentimentScore(text);
    const tone = score > 0 ? "positive" : score < 0 ? "negative/risky" : "neutral";
    const draft = pulseBuildDraft();
    const msg = [
      "Pulse analysis ready.",
      `Site: ${siteKind()}`,
      `Tone: ${tone} (${score})`,
      `Context chars: ${text.length}`,
      "",
      "Draft:",
      draft
    ].join("\n");
    setStatus(msg);
    return { ok: true, message: msg, score, tone, draft };
  }

  // ARIA v4.28.1 - Pulse Post Suite: fill any visible composer/input only; never submit automatically.
  async function pulsePrepareCurrentDraft(inputText) {
    const text = pulseBuildDraft(inputText);
    if (siteKind() === "youtube") return pulsePrepareYouTubeCommentDraft(text);
    const target = await ensureSocialComposer(socialPlatformFromPayload({}), "comment") || findInput();
    if (!target) {
      const msg = "Pulse draft blocked: no visible composer/input found. Open the reply/post box first.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    setInputText(target, text);
    target.classList.add("aria-super-highlight");
    await writeClipboard(text);
    const msg = "Pulse draft filled and copied. Review it, then click the public post/reply button yourself.";
    setStatus(`${msg}\n\n${text}`);
    return { ok: true, message: msg, text };
  }

  // ARIA v4.28.1 - Pulse Post Suite: YouTube comment composer helper, draft-only and manual-submit.
  async function pulsePrepareYouTubeCommentDraft(inputText) {
    const text = pulseBuildDraft(inputText);
    if (siteKind() !== "youtube") {
      const msg = "Open a YouTube video page first, then use YouTube draft.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    window.scrollTo({ top: Math.max(document.body.scrollHeight * 0.45, 800), behavior: "smooth" });
    await pulseDelay(800);
    const placeholders = qAll("#placeholder-area, #simplebox-placeholder, ytd-comment-simplebox-renderer, [aria-label*='comment' i], [placeholder*='comment' i]");
    const placeholder = placeholders.find((el) => visible(el) && !inPanel(el));
    if (placeholder) {
      try { placeholder.click(); } catch (err) {}
      await pulseDelay(700);
    }
    const inputs = qAll("ytd-commentbox #contenteditable-root, #contenteditable-root[contenteditable='true'], div[contenteditable='true'], textarea");
    const input = inputs.find((el) => visible(el) && !inPanel(el));
    if (!input) {
      await writeClipboard(text);
      const msg = "YouTube comment box not found. Draft copied to clipboard; open the comment box and paste.";
      setStatus(`${msg}\n\n${text}`);
      return { ok: false, error: msg, text };
    }
    setInputText(input, text);
    input.classList.add("aria-super-highlight");
    await writeClipboard(text);
    const msg = "YouTube comment draft filled and copied. Review it, then click Comment yourself.";
    setStatus(`${msg}\n\n${text}`);
    return { ok: true, message: msg, text };
  }

  // ARIA v4.28.1 - Pulse Post Suite: copy generated draft for external posting workflows.
  async function pulseCopyDraft(inputText) {
    const text = pulseBuildDraft(inputText);
    const ok = await writeClipboard(text);
    const msg = ok ? "Pulse draft copied to clipboard." : "Pulse draft copy failed.";
    setStatus(`${msg}\n\n${text}`);
    return { ok, message: msg, text };
  }

  function updatePanelMeta() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const meta = panel.querySelector("[data-meta]");
    if (meta) {
        const cooldown = currentLimitCooldown();
        const ag = siteKind() === "antigravity" ? ` | AG model ${state.antigravityAutoSwitchModel ? "auto" : "--"} perm ${state.antigravityConfirmPermissions ? "guard" : "manual"}` : "";
        const manus = siteKind() === "manus" ? ` | Manus ${state.runCount}/${state.manusMaxSends || 300} ${state.manusLastReason || "--"}` : "";
        const stopN = Math.max(0, Number.parseInt(state.stopAfterN || "0", 10) || 0);
        const stopLabel = stopN > 0 ? `/${stopN}` : "";
        const failLabel = state.consecutiveSendFails > 0 ? ` | fails ${state.consecutiveSendFails}` : "";
        // ARIA v4.26.5 - Failed Send Memory
        const failedStoredLabel = state.failedSendText ? ` | failed:${(state.failedSendPayload && state.failedSendPayload.kind) || "prompt"}` : "";
        // ARIA v4.26.7 - Self-Healing Failed Send Retry
        const selfHealLabel = state.selfHealFailedSends === false ? " | heal:OFF" : "";
        // ARIA v4.8.0 — Feature 9: Daily Run Counter + Reset
        const daily = ` | today:${state.dailySentToday || 0}`;
        // ARIA v4.9.0 — Feature 7: Live Response Word Count in Status
        const responseWords = wordCount(extractLatestResponse());
        const responseLabel = ` | resp:~${responseWords}w`;
        // ARIA v4.9.0 — Feature 3: Token / Credit Budget Tracker
        const budgetLimit = Math.max(0, Number.parseInt(state.tokenBudget || "0", 10) || 0);
        const budgetLabel = budgetLimit > 0 ? ` | budget:${state.tokenSpent || 0}/${budgetLimit}` : "";
        // ARIA v4.9.0 — Feature 1/12/13: Sync, chain, and clipboard meta
        const syncLabel = state.syncMode && state.syncMode !== "off" ? ` | sync:${state.syncMode}` : "";
        const chainLabel = Math.max(0, Number.parseInt(state.chainTargetTabId || "0", 10) || 0) > 0 ? ` | chain:${state.chainTargetTabId}` : "";
        const clipLabel = state.clipboardWatch ? " | clip:on" : "";
        const ackLabel = state.awaitingResponseAck ? ` | ack:waiting retry:${state.awaitingResponseRetryCount || 0}/${responseAckRetryLimit()}` : "";
        // ARIA v4.25.0 - Send Acceptance Verification
        const acceptedLabel = state.lastSendAcceptedAt ? ` | accepted:${new Date(state.lastSendAcceptedAt).toLocaleTimeString()}` : "";
        const schedule = state.scheduledStartTime ? ` | start ${state.scheduledStartTime}` : "";
        const sleep = state.sleepFrom && state.sleepUntil ? ` | sleep ${state.sleepFrom}-${state.sleepUntil}` : "";
        meta.textContent = `${siteKind()} | ${state.running ? "RUN" : "idle"} | next ${nextPreviewText()} | sent ${state.runCount}${stopLabel}${failLabel}${failedStoredLabel}${selfHealLabel}${daily}${responseLabel}${budgetLabel}${syncLabel}${chainLabel}${clipLabel}${ackLabel}${acceptedLabel} | limit ${cooldown.active ? formatDuration(cooldown.remainingMs) : state.limitGuardEnabled === false ? "OFF" : "ON"} | prompt ${promptQueued() ? "queued" : state.promptSent ? "sent" : "--"} | copy ${state.responseCopyAllowed ? "ON" : "--"} | Word ${state.autoWordSave ? `auto:${state.wordSaveMode}` : state.wordSaveMode}${state.wordOpenAfterSave ? "+open" : ""} | Drive ${state.driveAutoSave ? "auto" : "--"} | Codex ${state.autoCodexSave ? "auto" : "--"} | pipeline ${state.pipelineStep}/${PIPELINE_STEPS.length} | bg ${state.backgroundScheduler ? "ON" : "--"}${schedule}${sleep}${ag}${manus}`;
    }
  }

  function setStatus(message) {
    state.lastMessage = message;
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      const status = panel.querySelector("[data-status]");
      if (status) status.textContent = message;
    }
    updatePanelMeta();
  }

  function statusText() {
    const cooldown = currentLimitCooldown();
    const refreshText = state.manusMorningRefresh === false ? "OFF" : `${state.manusMorningRefreshHour || "7"}:00`;
    const promptQueueText = state.usePromptQueue ? `${state.queueIndex}/${queueItems().length}` : "OFF";
    return [
      `Site: ${siteKind()}`,
      `Mode: ${resolvedMode()}`,
      `Running: ${state.running ? "YES" : "NO"}`,
      `Next: ${nextPreviewText()}`,
      `Sent: ${state.runCount}`,
      // ARIA v4.25.0 - Send Acceptance Verification
      `Last accepted send: ${state.lastSendAcceptedAt ? `${new Date(state.lastSendAcceptedAt).toLocaleTimeString()} | ${previewText(state.lastSendAcceptedText || "", 80)}` : "--"}`,
      `Send accept verify window: ${Math.round(sendAcceptVerifyMs() / 1000)}s`,
      `Response ack gate: ${state.awaitingResponseAck ? `WAITING (${Math.round((Date.now() - (state.awaitingResponseSince || Date.now())) / 1000)}s, retry ${state.awaitingResponseRetryCount || 0}/${responseAckRetryLimit()}, timeout ${Math.round(responseAckTimeoutMs() / 1000)}s)` : "ready"}`,
      `Stop after N: ${Math.max(0, Number.parseInt(state.stopAfterN || "0", 10) || 0) || "OFF"}`,
      `Consecutive send failures: ${state.consecutiveSendFails || 0}`,
      `Self-heal failed sends: ${state.selfHealFailedSends === false ? "OFF" : `ON (${Math.round((Number.parseInt(state.selfHealRetryMs || "60000", 10) || 60000) / 1000)}s)`}`,
      `Limit guard: ${state.limitGuardEnabled === false ? "OFF" : "ON"} | fallback ${state.limitCooldownMinutes || "10"}m | cooldown ${cooldown.active ? formatDuration(cooldown.remainingMs) : "none"}`,
      `Limit reason: ${cooldown.active ? cooldown.reason : "--"}`,
      `Auto-scroll before send: ${state.autoScroll === false ? "OFF" : "ON"}`,
      `Min response chars: ${Math.max(0, Number.parseInt(state.minResponseChars || "0", 10) || 0) || "OFF"}`,
      `Scheduled start: ${state.scheduledStartTime || "OFF"}`,
      `Sleep window: ${state.sleepFrom && state.sleepUntil ? `${state.sleepFrom}-${state.sleepUntil}` : "OFF"}`,
      `Stop keywords: ${state.stopKeywords || "OFF"}`,
      `Custom selectors: input ${state.customInputSelector ? "YES" : "NO"} | send ${state.customSendSelector ? "YES" : "NO"}`,
      `Daily sends: today ${state.dailySentToday || 0} | lifetime ${state.dailySentLifetime || 0}`,
      `Pause when hidden: ${state.pauseOnHidden ? "ON" : "OFF"}`,
      `Webhook on stop/limit: ${state.webhookOnStop && state.webhookUrl ? "ON" : "OFF"}`,
      // ARIA v4.9.0 — Feature 1/3/4/5/6/7/8/10/12/13: Status summary for new automation controls
      `Sync mode: ${state.syncMode || "off"}`,
      `Response words: ~${wordCount(extractLatestResponse())}`,
      `Token budget: ${Math.max(0, Number.parseInt(state.tokenBudget || "0", 10) || 0) ? `${state.tokenSpent || 0}/${state.tokenBudget}` : "OFF"}`,
      `Skip short replies: ${state.skipShortReplies ? `ON (${state.minReplyWords || 10} words)` : "OFF"}`,
      `Auto regenerate: ${state.autoRegen ? "ON" : "OFF"}`,
      `Image save filter: ${state.imageSaveFilter || "OFF"}`,
      `Screenshot on stop: ${state.screenshotOnStop ? "ON" : "OFF"}`,
      `Chain target tab: ${state.chainTargetTabId || "0"}`,
      `Clipboard watch: ${state.clipboardWatch ? "ON" : "OFF"}`,
      `Conditional rules: ${(state.conditionalRules || []).length}`,
      `Prompt templates: ${(state.promptTemplates || []).length}`,
      `Antigravity models: ${state.antigravityModelOrder || "--"}`,
      `Antigravity auto model switch: ${state.antigravityAutoSwitchModel ? "ON" : "OFF"}`,
      `Antigravity guarded permission clicks: ${state.antigravityConfirmPermissions ? "ON" : "OFF"}`,
      `Manus: max ${state.manusMaxSends || 300} | reply ${state.manusLastReply || "next"} | reason ${state.manusLastReason || "--"} | refresh ${refreshText}`,
      `Prompt first: ${state.sendPromptFirst ? "ON" : "OFF"}`,
      `Prompt status: ${promptQueued() ? "queued" : state.promptSent ? "sent" : "empty/off"}`,
      `Prompt queue: ${promptQueueText}`,
      `Response copy allowed: ${state.responseCopyAllowed ? "YES, this tab only" : "NO"}`,
      `Desktop app bridge: ${state.desktopTarget || "focused"} | delay ${state.desktopPasteDelay || "3"}s | open ${state.desktopOpenTarget ? "YES" : "NO"}`,
      `Word mode: ${state.wordSaveMode}`,
      `Open Word after save: ${state.wordOpenAfterSave ? "ON" : "OFF"}`,
      `Auto Word save: ${state.autoWordSave ? "ON" : "OFF"}`,
      `Auto Google Drive backup: ${state.driveAutoSave ? "ON" : "OFF"}`,
      `Auto Codex bridge: ${state.autoCodexSave ? "ON" : "OFF"}`,
      `Word saved response hashes: ${(state.wordSavedResponseHashes || []).length}`,
      `Drive saved response hashes: ${(state.driveSavedResponseHashes || []).length}`,
      `Codex saved response hashes: ${(state.codexSavedResponseHashes || []).length}`,
      `Scholarship profile: ${String(state.scholarshipProfile || "").trim() ? "READY" : "empty"}`,
      `Scholarship last: ${state.scholarshipLastSummary || "--"}`,
      `Pipeline: ${state.pipelineStep}/${PIPELINE_STEPS.length} ${nextPipelineLabel()}`,
      `Wait: ${Math.round(state.intervalMs / 1000)}s`,
      `Scope: ${state.counterScope}`
    ].join("\n");
  }

  function getImageFolder() {
    const panel = document.getElementById(PANEL_ID);
    const fromPanel = panel && panel.querySelector("[data-field='imageFolder']") ? panel.querySelector("[data-field='imageFolder']").value : "";
    return fromPanel || "Basit Social Media";
  }

  function getVideoFolder() {
    const panel = document.getElementById(PANEL_ID);
    const fromPanel = panel && panel.querySelector("[data-field='videoFolder']") ? panel.querySelector("[data-field='videoFolder']").value : "";
    return fromPanel || state.videoFolder || "Basit Social Media/HeyGen Videos";
  }

  function sanitizePathPart(value, fallback) {
    const cleaned = String(value || "").replace(/[<>:"\\|?*\x00-\x1f]/g, "").replace(/\s+/g, " ").trim();
    return cleaned || fallback;
  }

  function slug(value, fallback) {
    const cleaned = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
    return cleaned || fallback;
  }

  function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function shortHash(text) {
    let h = 2166136261;
    const s = String(text || "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).slice(0, 6);
  }

  async function sendPromptNow(prompt) {
    const clean = String(prompt || "").trim();
    if (!clean) {
      setStatus("Paste prompt text first.");
      return { ok: false, error: "Prompt required." };
    }
    ensureCounterScope();
    const cooldown = limitGuardCheck();
    if (cooldown.active) {
      const msg = limitCooldownMessage(cooldown);
      setStatus(msg);
      return { ok: false, cooldown: true, error: msg, ...currentStatus() };
    }
    const input = findInput();
    if (!input) {
      setStatus("Input not found for full prompt.");
      return { ok: false, error: "Input not found." };
    }
    const busy = isBusy(input);
    if (busy.busy) {
      const msg = `Waiting: ${busy.reason}. Try again after response completes.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    setInputText(input, clean);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const accepted = await sendInputAndVerify(input, clean);
    if (!accepted.ok) {
      const msg = `Send not accepted: ${accepted.error || "prompt stayed in input"}.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    state.promptSent = true;
    resetResponseWatch();
    const msg = `Full prompt sent (${accepted.reason}). Chars: ${clean.length}.`;
    setStatus(msg);
    return { ok: true, message: msg };
  }

  async function smartPromptToInput(options) {
    readPanelInputs();
    ensureCounterScope();
    const cooldown = limitGuardCheck();
    if (cooldown.active) {
      const msg = limitCooldownMessage(cooldown);
      setStatus(msg);
      return { ok: false, cooldown: true, error: msg, ...currentStatus() };
    }
    const input = findInput();
    if (!input) {
      const msg = "Input not found for smart prompt.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const busy = isBusy(input);
    if (busy.busy) {
      const msg = `Waiting: ${busy.reason}. Smart prompt will work after the response completes.`;
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const stable = responseStable();
    if (!stable.stable) {
      const msg = `Waiting: page settling (${Math.round(stable.waitedMs / 1000)}s).`;
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const text = await generateSmartPrompt();
    setInputText(input, text);
    await new Promise((resolve) => setTimeout(resolve, 350));
    let sent = false;
    let accepted = null;
    if (options && options.sendNow) {
      accepted = await sendInputAndVerify(input, text);
      sent = Boolean(accepted.ok);
      if (!accepted.ok) {
        const msg = `Smart prompt filled, but send was not accepted: ${accepted.error || "prompt stayed in input"}.`;
        setStatus(msg);
        return { ok: false, error: msg, text, ...currentStatus() };
      }
      state.lastSendAt = Date.now();
      beginResponseAckWait({ kind: "smart" }, text);
      resetResponseWatch();
    }
    const msg = sent ? `Smart prompt sent (${accepted && accepted.reason ? accepted.reason : "accepted"}). Waiting for new stable response before the next send:\n${text}` : `Smart prompt filled:\n${text}`;
    setStatus(msg);
    return { ok: true, message: msg, text, sent, ...currentStatus() };
  }

  async function generateImage(prompt) {
    const clean = String(prompt || "").trim();
    if (!clean) {
      setStatus("Write image prompt first.");
      return { ok: false, error: "Prompt required." };
    }
    if (siteKind() !== "chatgpt") {
      setStatus("Open ChatGPT tab for image generation.");
      return { ok: false, error: "Open ChatGPT first." };
    }
    const input = findInput();
    if (!input) {
      setStatus("ChatGPT input not found.");
      return { ok: false, error: "Input not found." };
    }
    const finalPrompt = `Create a high quality social media image for: ${clean}. Make it polished, clear, and ready for social media. Do not add text unless I explicitly ask for text.`;
    setInputText(input, finalPrompt);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await sendInput(input);
    setStatus("Image prompt sent. Auto-save is watching.");
    scheduleImageScan(4000);
    return { ok: true };
  }

  function imageLooksGenerated(img) {
    if (!img || !img.src || !visible(img)) return false;
    const src = img.currentSrc || img.src;
    if (/\.svg($|\?)/i.test(src) || src.startsWith("data:image/svg")) return false;
    if (/avatar|profile|favicon|logo|emoji|sprite|icon/i.test(src)) return false;
    const rect = img.getBoundingClientRect();
    const naturalW = Number(img.naturalWidth) || 0;
    const naturalH = Number(img.naturalHeight) || 0;
    const bigEnough = naturalW >= 256 || naturalH >= 256 || rect.width >= 180 || rect.height >= 180;
    const known = /backend-api\/estuary\/content|oaiusercontent|oaidalleapiprodscus|sdmntpr|images\.openai/i.test(src);
    const inMain = Boolean(img.closest("main, article, [data-message-author-role], [data-testid]"));
    return known || (bigEnough && inMain);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function payloadForImage(src) {
    if (src.startsWith("data:image/")) return { dataUrl: src, sourceUrl: src.slice(0, 120) };
    if (src.startsWith("blob:") || /chatgpt\.com\/backend-api\/estuary\/content/i.test(src)) {
      try {
        const response = await fetch(src, { credentials: "omit" });
        if (response.ok) return { dataUrl: await blobToDataUrl(await response.blob()), sourceUrl: src };
      } catch (err) {}
    }
    return { url: src, sourceUrl: src };
  }

  function imageFilename(src) {
    const folder = sanitizePathPart(getImageFolder(), "Basit Social Media");
    return `${folder}/${timestamp()}_chatgpt_image_${shortHash(src)}.png`;
  }

  async function saveImage(img) {
    const src = img.currentSrc || img.src;
    const key = `${src}|${img.naturalWidth || 0}|${img.naturalHeight || 0}`;
    if (state.seenImages.has(key)) return { ok: true, skipped: true };
    // ARIA v4.9.0 — Feature 6: Image Auto-Save Filter by Keyword
    if (!imageFilterMatches(img)) {
      setStatus("Image skipped by filter keywords.");
      return { ok: true, skipped: true, filtered: true };
    }
    state.seenImages.add(key);
    const payload = await payloadForImage(src);
    const reply = await sendRuntime({
      type: "ARIA_SUPER_DOWNLOAD_IMAGE",
      payload: { ...payload, filename: imageFilename(src) }
    });
    if (reply.ok) {
      state.savedImages += 1;
      setStatus(`Saved image: ${reply.filename}`);
    } else {
      setStatus(`Image save failed: ${reply.error}`);
    }
    return reply;
  }

  async function scanImages(reason) {
    const images = Array.from(document.images).filter(imageLooksGenerated);
    let saved = 0;
    for (const img of images) {
      const reply = await saveImage(img);
      if (reply && reply.ok && !reply.skipped) saved += 1;
    }
    if (reason === "manual" && saved === 0) setStatus(`Checked ${images.length} image(s). No new image.`);
    return { ok: true, found: images.length, saved };
  }

  function scheduleImageScan(ms) {
    clearTimeout(imageScanTimer);
    imageScanTimer = setTimeout(() => {
      if (siteKind() === "chatgpt") scanImages("auto").catch(() => {});
    }, ms);
  }

  function videoStateDefault() {
    return {
      topics: [],
      nextIndex: 0,
      links: [],
      sourceUrl: "",
      currentTopic: "",
      updatedAt: "",
      capturedAt: ""
    };
  }

  async function getVideoState() {
    const data = await storageGet([VIDEO_STATE_KEY]);
    const saved = data && data[VIDEO_STATE_KEY] && typeof data[VIDEO_STATE_KEY] === "object" ? data[VIDEO_STATE_KEY] : {};
    const merged = { ...videoStateDefault(), ...saved };
    merged.topics = Array.isArray(merged.topics) ? merged.topics : [];
    merged.links = Array.isArray(merged.links) ? merged.links : [];
    merged.nextIndex = Math.max(0, Number.parseInt(merged.nextIndex || "0", 10) || 0);
    return merged;
  }

  async function saveVideoState(patch) {
    const current = await getVideoState();
    const next = {
      ...current,
      ...(patch || {}),
      updatedAt: new Date().toISOString()
    };
    next.topics = Array.isArray(next.topics) ? next.topics : [];
    next.links = Array.isArray(next.links) ? next.links : [];
    next.nextIndex = Math.max(0, Number.parseInt(next.nextIndex || "0", 10) || 0);
    storageSet({ [VIDEO_STATE_KEY]: next });
    return next;
  }

  async function writeClipboard(text) {
    const value = String(text || "");
    const backgroundReply = await sendRuntime({
      type: "ARIA_SUPER_COPY_TEXT_TO_CLIPBOARD",
      payload: { text: value }
    });
    if (backgroundReply && backgroundReply.ok) return true;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      area.style.top = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    }
  }

  function latestUsefulText() {
    const selected = String(window.getSelection && window.getSelection().toString() || "").trim();
    if (selected.length > 20 && looksLikeResponseText(selected)) return selected;
    const selectors = [
      "[data-message-author-role='assistant']",
      "[data-testid*='assistant' i]",
      "[data-testid*='response' i]",
      "[data-testid*='agent' i]",
      "[data-testid*='message' i]",
      "[class*='assistant' i]",
      "[class*='response' i]",
      "[class*='agent' i]",
      "[class*='prose' i]",
      "[class*='markdown' i]",
      "[class*='message' i]",
      "[class*='chat' i]",
      "main article",
      "main .markdown",
      "article",
      "main"
    ];
    const candidates = [];
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el)) return;
        const text = cleanCopiedResponse(el.innerText || el.textContent || "");
        if (looksLikeResponseText(text)) candidates.push(text);
      });
    });
    if (candidates.length) return candidates[candidates.length - 1];
    const bodyText = cleanCopiedResponse(document.body.innerText || "");
    return looksLikeResponseText(bodyText) ? bodyText : "";
  }

  function cleanCopiedResponse(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, 200000);
  }

  function isNoiseResponseText(text) {
    const clean = cleanCopiedResponse(text);
    const lower = clean.toLowerCase();
    if (!clean) return true;
    const hardNoise = [
      "clickup needs your permission to send notifications",
      "tell ai what to do next",
      "working on it",
      "ask anything",
      "all sources",
      "aria nexus",
      "aria super",
      "aria chatgpt sender",
      "aria clickup sender",
      "run this tab",
      "basit automate word",
      "server live on",
      "agent control center"
    ];
    if (hardNoise.some((needle) => lower.includes(needle)) && clean.length < 900) return true;
    if (/^(enable|remind me|copy|run|stop|status|download|reload|settings|share|like|reply|send|post)$/i.test(clean)) return true;
    if (lower.includes("clickup needs your permission") && !lower.match(/\b(import|export|function|const|let|class|file #|```|src\/|server\/|client\/)\b/)) return true;
    const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 3 && lower.match(/^(home|planner|ai|teams|docs|dashboard|whiteboard|forms|clips|goals|invite)\b/)) return true;
    return false;
  }

  function looksLikeResponseText(text) {
    const clean = cleanCopiedResponse(text);
    if (clean.length < 20) return false;
    if (isNoiseResponseText(clean)) return false;
    const lower = clean.toLowerCase();
    if (lower.match(/^(run|stop|copy|allow|status|download|reload|settings)$/)) return false;
    if ((lower.includes("aria super") || lower.includes("aria nexus")) && clean.length < 500) return false;
    return true;
  }

  function latestResponseText(options) {
    const opts = options || {};
    const selected = String(window.getSelection && window.getSelection().toString() || "").trim();
    if (!opts.ignoreSelection && selected.length > 20) return cleanCopiedResponse(selected);
    const rows = allResponseTexts();
    if (rows.length) return rows[rows.length - 1];
    return cleanCopiedResponse(latestUsefulText());
  }

  function responseCopySignature(text) {
    return `${location.href}\n${shortHash(text)}\n${String(text || "").length}`;
  }

  function setResponseCopyAllowed(allowed) {
    state.responseCopyAllowed = Boolean(allowed);
    if (state.responseCopyAllowed) sessionStorage.setItem(COPY_ALLOWED_KEY, "1");
    else sessionStorage.removeItem(COPY_ALLOWED_KEY);
    if (state.responseCopyAllowed) {
      const current = latestResponseText({ ignoreSelection: true });
      if (looksLikeResponseText(current)) state.lastCopiedResponseSignature = responseCopySignature(current);
      scheduleAutoResponseCopy(2500);
    } else {
      clearTimeout(responseCopyTimer);
    }
    const msg = state.responseCopyAllowed
      ? "Response copy allowed on this tab only."
      : "Response copy blocked on this tab.";
    setStatus(msg);
    return { ok: true, message: msg, copyAllowed: state.responseCopyAllowed, ...currentStatus() };
  }

  function responseVaultSourceName() {
    const kind = siteKind();
    const map = {
      chatgpt: "ChatGPT",
      codex: "OpenAI Codex",
      antigravity: "Antigravity",
      clickup: "ClickUp",
      claude: "Claude",
      gemini: "Gemini",
      aistudio: "Google AI Studio",
      grok: "Grok",
      poe: "Poe",
      perplexity: "Perplexity",
      fireworks: "Fireworks",
      langchain: "LangChain",
      cursor: "Cursor",
      v0: "V0",
      bolt: "Bolt",
      lovable: "Lovable",
      manus: "Manus",
      same: "Same",
      replit: "Replit",
      stackblitz: "StackBlitz",
      codesandbox: "CodeSandbox",
      githubdev: "GitHub Dev",
      notebooklm: "NotebookLM",
      x: "X",
      facebook: "Facebook",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      whatsapp: "WhatsApp"
    };
    return map[kind] || kind || "Website";
  }

  function responseVaultTopicName() {
    try {
      return chatTopic({ ignorePanel: true }) || document.title || siteKind();
    } catch (err) {
      return document.title || siteKind() || "response";
    }
  }

  async function saveRowsToResponseVault(rows, label) {
    const list = (Array.isArray(rows) ? rows : [rows])
      .map((text, index) => String(text || "").trim())
      .filter((text) => looksLikeResponseText(text))
      .map((text, index) => ({
        text,
        source: responseVaultSourceName(),
        topic: responseVaultTopicName(),
        title: document.title || "",
        sourceUrl: location.href,
        label: label || "copy",
        ordinal: index + 1,
        createdAt: Date.now()
      }));
    if (!list.length) return { ok: false, saved: 0, duplicates: 0, message: "No response rows to save." };
    try {
      const reply = await sendRuntime({ type: "ARIA_RESPONSE_VAULT_SAVE_MANY", responses: list });
      return reply || { ok: false, saved: 0, duplicates: 0, error: "No response from response vault." };
    } catch (err) {
      return { ok: false, saved: 0, duplicates: 0, error: String(err && err.message || err) };
    }
  }

  async function copyLatestResponse(options) {
    const opts = options || {};
    if (!state.responseCopyAllowed && !opts.allowOnce) {
      const msg = "Copy blocked. First click Allow Copy This Tab.";
      setStatus(msg);
      return { ok: false, error: msg, copyAllowed: false, ...currentStatus() };
    }
    const text = latestResponseText();
    if (!looksLikeResponseText(text)) {
      const msg = "No clear latest response found to copy.";
      setStatus(msg);
      return { ok: false, error: msg, copyAllowed: state.responseCopyAllowed, ...currentStatus() };
    }
    const signature = responseCopySignature(text);
    await writeClipboard(text);
    const vault = await saveRowsToResponseVault([text], opts.auto ? "auto-latest" : "latest-copy");
    state.lastCopiedResponseSignature = signature;
    const vaultNote = vault && vault.ok ? ` Vault saved: ${vault.saved || 0}, duplicate: ${vault.duplicates || 0}.` : "";
    const msg = `Copied latest response from this allowed tab. Chars: ${text.length}.${vaultNote}`;
    setStatus(msg);
    return {
      ok: true,
      message: msg,
      textLength: text.length,
      preview: previewText(text, 180),
      vault,
      copyAllowed: state.responseCopyAllowed,
      ...currentStatus()
    };
  }

  function responseSelectorsForKind(kind) {
    if (kind === "chatgpt") {
      return [
          "[data-message-author-role='assistant']",
          "[data-testid*='conversation-turn'] .markdown",
          "main article .markdown",
          "main article"
        ];
    }
    const codingKinds = new Set([
      "clickup",
      "codex",
      "antigravity",
      "langchain",
      "cursor",
      "v0",
      "bolt",
      "lovable",
      "manus",
      "same",
      "replit",
      "stackblitz",
      "codesandbox",
      "githubdev",
      "fireworks",
      "aistudio"
    ]);
    if (codingKinds.has(kind)) {
      return [
        "[data-testid*='assistant' i]",
        "[data-testid*='answer' i]",
        "[data-testid*='response' i]",
        "[data-testid*='message' i]",
        "[data-testid*='chat' i]",
        "[data-testid*='agent' i]",
        "[data-testid*='task' i]",
        "[class*='assistant' i]",
        "[class*='answer' i]",
        "[class*='response' i]",
        "[class*='message' i]",
        "[class*='Message']",
        "[class*='conversation' i]",
        "[class*='chat' i]",
        "[class*='agent' i]",
        "[class*='task' i]",
        "[class*='markdown' i]",
        "[class*='prose' i]",
        "[role='article']",
        "main article",
        "article",
        "main .markdown",
        "main .prose",
        "pre",
        "code"
      ];
    }
    return [
      "[data-message-author-role='assistant']",
      "[data-testid*='message']",
      "[data-testid*='response' i]",
      "[class*='response' i]",
      "[class*='assistant' i]",
      "[class*='markdown' i]",
      "[class*='prose' i]",
      "[role='article']",
      "main article",
      "article",
      "main .markdown",
      "main .prose"
    ];
  }

  function responseCandidateElements() {
    const kind = siteKind();
    const selectors = responseSelectorsForKind(kind);
    const nodes = [];
    const seenNodes = new Set();
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!el || seenNodes.has(el)) return;
        if (!visible(el) || inPanel(el)) return;
        if (el.matches && el.matches("textarea,input,button,select")) return;
        const text = cleanCopiedResponse(el.innerText || el.textContent || "");
        if (!looksLikeResponseText(text)) return;
        seenNodes.add(el);
        nodes.push(el);
      });
    });
    return nodes.filter((el) => {
      return !nodes.some((other) => {
        if (other === el) return false;
        if (!el.contains(other)) return false;
        const otherText = cleanCopiedResponse(other.innerText || other.textContent || "");
        return looksLikeResponseText(otherText) && otherText.length >= 40;
      });
    });
  }

  function allResponseTexts() {
    const nodes = responseCandidateElements();
    const rows = [];
    const seen = new Set();
    nodes.forEach((el) => {
      const text = cleanCopiedResponse(el.innerText || el.textContent || "");
      if (!looksLikeResponseText(text)) return;
      const key = `${shortHash(text)}:${text.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(text);
    });
    if (!rows.length) {
      const latest = cleanCopiedResponse(latestUsefulText());
      if (looksLikeResponseText(latest)) rows.push(latest);
    }
    return rows.slice(-80);
  }

  function codeBlockSelector() {
    return [
      "pre code",
      "pre",
      "code",
      ".hljs",
      "[class*='code' i]",
      "[class*='Code' i]",
      "[data-testid*='code' i]"
    ].join(",");
  }

  function looksLikeCodeText(raw) {
    const text = String(raw || "").trim();
    if (text.length < 8) return false;
    if (isNoiseResponseText(text)) return false;
    if (text.length >= 180 && text.match(/[{}();=<>\[\]]|^\s*(import|export|const|let|var|function|class|def|from|return|if|for|while|npm|pip|cd|python|node)\b/m)) return true;
    if (text.match(/\b(src\/|server\/|client\/|app\/|components\/|\.tsx|\.ts|\.js|\.py|\.json|package\.json|Dockerfile)\b/)) return true;
    if (text.match(/```|^\s*#{1,6}\s|^\s*[-*]\s/m) && text.length >= 80) return true;
    return false;
  }

  function allCodeBlocks() {
    const blocks = [];
    const seen = new Set();
    qAll(codeBlockSelector()).forEach((node) => {
      if (!visible(node) || inPanel(node)) return;
      const raw = String(node.innerText || node.textContent || "").trim();
      if (!looksLikeCodeText(raw)) return;
      const key = `${shortHash(raw)}:${raw.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      blocks.push({ language: codeLanguage(node), code: raw });
    });
    return blocks.slice(-120);
  }

  async function copyAllResponses(options) {
    const opts = options || {};
    if (!state.responseCopyAllowed && !opts.allowOnce) {
      const msg = "Copy all blocked. First click Allow Copy This Tab.";
      setStatus(msg);
      return { ok: false, error: msg, copyAllowed: false, ...currentStatus() };
    }
    const rows = allResponseTexts();
    if (!rows.length) {
      const msg = "No visible responses found to copy.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const text = rows.map((row, index) => `===== Response ${index + 1} =====\n${row}`).join("\n\n");
    await writeClipboard(text);
    const vault = await saveRowsToResponseVault(rows, "all-copy");
    const vaultNote = vault && vault.ok ? ` Vault saved: ${vault.saved || 0}, duplicate: ${vault.duplicates || 0}.` : "";
    const msg = `Copied all visible responses. Responses: ${rows.length}. Chars: ${text.length}.${vaultNote}`;
    setStatus(msg);
    return { ok: true, message: msg, responseCount: rows.length, textLength: text.length, preview: previewText(text, 180), vault, ...currentStatus() };
  }

  async function copyLatestPrompt(options) {
    const opts = options || {};
    if (!state.responseCopyAllowed && !opts.allowOnce) {
      const msg = "Prompt copy blocked. First click Allow Copy This Tab.";
      setStatus(msg);
      return { ok: false, error: msg, copyAllowed: false, ...currentStatus() };
    }
    const text = latestPromptText();
    if (!looksLikePromptText(text)) {
      const msg = "No visible prompt found to copy.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    await writeClipboard(text);
    const msg = `Copied latest prompt. Chars: ${text.length}.`;
    setStatus(msg);
    return { ok: true, message: msg, textLength: text.length, preview: previewText(text, 180), ...currentStatus() };
  }

  async function copyAllPrompts(options) {
    const opts = options || {};
    if (!state.responseCopyAllowed && !opts.allowOnce) {
      const msg = "Prompt copy blocked. First click Allow Copy This Tab.";
      setStatus(msg);
      return { ok: false, error: msg, copyAllowed: false, ...currentStatus() };
    }
    const rows = allPromptTexts({ includeFallback: true });
    if (!rows.length) {
      const msg = "No visible prompts found to copy.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const text = formatPromptRows(rows, "Prompt");
    await writeClipboard(text);
    const msg = `Copied all visible prompts. Prompts: ${rows.length}. Chars: ${text.length}.`;
    setStatus(msg);
    return { ok: true, message: msg, promptCount: rows.length, textLength: text.length, preview: previewText(text, 180), ...currentStatus() };
  }

  function clickupBridgeSourceReady() {
    if (siteKind() !== "clickup") {
      const msg = "ClickUp -> ChatGPT bridge ko ClickUp tab se start karein.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  }

  function formatClickUpRowsForChatGpt(rows, mode) {
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const heading = mode === "live"
      ? "New ClickUp response captured. Please continue the coding analysis and tell the exact next step."
      : "ClickUp se all visible responses copied hain. Please analyze, merge context, identify missing files/bugs, and give the exact next coding step.";
    const body = list.map((row, index) => {
      const label = mode === "live" ? "Latest ClickUp response" : `ClickUp Response ${index + 1}`;
      return `===== ${label} =====\n${row}`;
    }).join("\n\n");
    return [
      heading,
      `Source title: ${document.title || "ClickUp"}`,
      `Source URL: ${location.href}`,
      "",
      body
    ].join("\n");
  }

  async function relayClickUpRowsToChatGpt(rows, mode, options) {
    const opts = options || {};
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) {
      const msg = "ClickUp response nahi mila.";
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
    const text = formatClickUpRowsForChatGpt(list, mode || "all");
    const reply = await sendRuntime({
      type: "ARIA_SUPER_RELAY_CLICKUP_TO_CHATGPT",
      text,
      rowCount: list.length,
      mode: mode || "all",
      sendNow: opts.sendNow !== false,
      sourceUrl: location.href,
      sourceTitle: document.title || "ClickUp"
    });
    const msg = reply && reply.ok
      ? `ClickUp -> ChatGPT sent. Rows: ${list.length}. Target: ${reply.targetTitle || "ChatGPT"}.`
      : `ClickUp -> ChatGPT failed: ${reply && reply.error ? reply.error : "unknown error"}`;
    setStatus(msg);
    return { ...(reply || { ok: false }), message: msg, responseCount: list.length, ...currentStatus() };
  }

  async function sendClickUpAllToChatGpt(options) {
    const ready = clickupBridgeSourceReady();
    if (!ready.ok) return { ...ready, ...currentStatus() };
    const rows = allResponseTexts();
    const result = await relayClickUpRowsToChatGpt(rows, "all", {
      sendNow: options && options.sendNow !== undefined ? options.sendNow : state.clickupChatgptSendNow
    });
    return result;
  }

  function scheduleClickUpChatGptBridge(ms) {
    clearTimeout(clickupChatgptBridgeTimer);
    if (!state.clickupChatgptBridgeRunning) return;
    clickupChatgptBridgeTimer = setTimeout(() => {
      tickClickUpChatGptBridge().catch((err) => {
        setStatus(`ClickUp -> ChatGPT bridge error: ${String(err && err.message || err)}`);
        scheduleClickUpChatGptBridge(state.intervalMs || 5000);
      });
    }, Math.max(1500, Number(ms) || 5000));
  }

  async function tickClickUpChatGptBridge() {
    if (clickupChatgptBridgeTicking) return { ok: true, skipped: true, reason: "already ticking" };
    clickupChatgptBridgeTicking = true;
    try {
      return await tickClickUpChatGptBridgeInner();
    } finally {
      clickupChatgptBridgeTicking = false;
    }
  }

  async function tickClickUpChatGptBridgeInner() {
    if (!state.clickupChatgptBridgeRunning) return { ok: false, skipped: true };
    const ready = clickupBridgeSourceReady();
    if (!ready.ok) {
      stopClickUpChatGptBridge();
      return ready;
    }
    const input = findInput();
    const busy = isBusy(input);
    if (busy.busy) {
      setStatus(`Live ClickUp -> GPT waiting: ${busy.reason}. Sent: ${state.clickupChatgptSentCount}.`);
      scheduleClickUpChatGptBridge(2500);
      return { ok: true, skipped: true, reason: busy.reason };
    }
    const stable = responseStable();
    if (!stable.stable) {
      setStatus(`Live ClickUp -> GPT waiting: response still settling (${Math.round(stable.waitedMs / 1000)}s). Sent: ${state.clickupChatgptSentCount}.`);
      scheduleClickUpChatGptBridge(Math.max(1800, RESPONSE_STABLE_MS - stable.waitedMs));
      return { ok: true, skipped: true, reason: "settling" };
    }
    const text = latestResponseText({ ignoreSelection: true });
    if (!looksLikeResponseText(text)) {
      setStatus(`Live ClickUp -> GPT waiting: no completed ClickUp response yet. Sent: ${state.clickupChatgptSentCount}.`);
      scheduleClickUpChatGptBridge(state.intervalMs || 5000);
      return { ok: true, skipped: true, reason: "no response" };
    }
    const signature = responseCopySignature(text);
    if (signature === state.clickupChatgptLastSignature) {
      setStatus(`Live ClickUp -> GPT watching. No new response. Sent: ${state.clickupChatgptSentCount}.`);
      scheduleClickUpChatGptBridge(state.intervalMs || 5000);
      return { ok: true, skipped: true, reason: "duplicate" };
    }
    const relay = await relayClickUpRowsToChatGpt([text], "live", { sendNow: state.clickupChatgptSendNow });
    if (relay && relay.ok) {
      state.clickupChatgptLastSignature = signature;
      state.clickupChatgptSentCount += 1;
      setStatus(`Live ClickUp -> GPT sent new response #${state.clickupChatgptSentCount}.`);
    } else {
      setStatus(`Live ClickUp -> GPT retrying: ${relay && relay.error ? relay.error : "ChatGPT target not ready"}.`);
    }
    scheduleClickUpChatGptBridge(state.intervalMs || 5000);
    return relay;
  }

  async function startClickUpChatGptBridge(options) {
    const ready = clickupBridgeSourceReady();
    if (!ready.ok) return { ...ready, ...currentStatus() };
    if (options && options.intervalMs) state.intervalMs = Math.max(1000, Number(options.intervalMs) || state.intervalMs);
    if (options && options.sendNow !== undefined) state.clickupChatgptSendNow = options.sendNow !== false;
    state.clickupChatgptBridgeRunning = true;
    state.clickupChatgptLastSignature = "";
    resetResponseWatch();
    sendRuntime({
      type: "ARIA_SUPER_REGISTER_TAB",
      intervalMs: state.intervalMs || 5000,
      mode: "clickup-chatgpt-bridge",
      url: location.href,
      title: document.title
    }).then(() => {});
    scheduleClickUpChatGptBridge(1000);
    const msg = `Live ClickUp -> ChatGPT bridge ON. Wait: ${Math.round(state.intervalMs / 1000)}s. Auto-send: ${state.clickupChatgptSendNow ? "YES" : "NO"}.`;
    setStatus(msg);
    return { ok: true, message: msg, ...currentStatus() };
  }

  function stopClickUpChatGptBridge() {
    state.clickupChatgptBridgeRunning = false;
    clearTimeout(clickupChatgptBridgeTimer);
    if (!state.running) sendRuntime({ type: "ARIA_SUPER_UNREGISTER_TAB" }).then(() => {});
    const msg = `Live ClickUp -> ChatGPT bridge stopped. Sent: ${state.clickupChatgptSentCount}.`;
    setStatus(msg);
    return { ok: true, message: msg, ...currentStatus() };
  }

  function clickupChatGptBridgeStatusText() {
    return [
      `ClickUp -> ChatGPT live: ${state.clickupChatgptBridgeRunning ? "ON" : "OFF"}`,
      `Sent: ${state.clickupChatgptSentCount}`,
      `Wait: ${Math.round((state.intervalMs || 5000) / 1000)}s`,
      `Auto-send after paste: ${state.clickupChatgptSendNow ? "YES" : "NO"}`,
      `This tab: ${siteKind()}`
    ].join("\n");
  }

  async function receiveExternalTextForInput(message) {
    const text = String(message && message.text || "").trim();
    if (!text) return { ok: false, error: "No text received." };
    ensureCounterScope();
    const cooldown = limitGuardCheck();
    if (cooldown.active) {
      const msg = limitCooldownMessage(cooldown);
      setStatus(msg);
      return { ok: false, cooldown: true, error: msg, site: siteKind(), title: document.title, url: location.href };
    }
    const input = findInput();
    if (!input) return { ok: false, error: "No input box found on this target tab." };
    const busy = isBusy(input);
    if (busy.busy) return { ok: false, busy: true, error: `Target busy: ${busy.reason}` };
    setInputText(input, text);
    await waitMs(350);
    let sent = false;
    if (message.sendNow !== false) {
      sent = await sendInput(input);
      resetResponseWatch();
    }
    const msg = `${message.source || "External"} text ${sent ? "sent" : "pasted"} into ${siteKind()}.`;
    setStatus(msg);
    return { ok: true, message: msg, sent, site: siteKind(), title: document.title, url: location.href };
  }

  function scheduleAutoResponseCopy(ms) {
    clearTimeout(responseCopyTimer);
    if (!state.responseCopyAllowed) return;
    responseCopyTimer = setTimeout(() => {
      autoCopyStableResponse().catch(() => {});
    }, Math.max(1500, Number(ms) || 4500));
  }

  async function autoCopyStableResponse() {
    if (!state.responseCopyAllowed) return { ok: false, skipped: true };
    const input = findInput();
    const busy = isBusy(input);
    if (busy.busy) {
      scheduleAutoResponseCopy(2500);
      return { ok: false, skipped: true, reason: busy.reason };
    }
    const stable = responseStable();
    if (!stable.stable) {
      scheduleAutoResponseCopy(Math.max(2000, RESPONSE_STABLE_MS - stable.waitedMs));
      return { ok: false, skipped: true, reason: "page settling" };
    }
    const text = latestResponseText({ ignoreSelection: true });
    if (!looksLikeResponseText(text)) return { ok: false, skipped: true, reason: "no response" };
    const signature = responseCopySignature(text);
    if (signature === state.lastCopiedResponseSignature) return { ok: true, skipped: true, reason: "already copied" };
    return copyLatestResponse({ allowOnce: true, auto: true });
  }

  function scheduleAutoWordSave(ms) {
    clearTimeout(wordAutoSaveTimer);
    if (!state.autoWordSave) return;
    wordAutoSaveTimer = setTimeout(() => {
      autoSaveStableWordResponse().catch(() => {});
    }, Math.max(1800, Number(ms) || 5000));
  }

  async function autoSaveStableWordResponse() {
    if (!state.autoWordSave) return { ok: false, skipped: true };
    const input = findInput();
    const busy = isBusy(input);
    if (busy.busy) {
      scheduleAutoWordSave(2500);
      return { ok: false, skipped: true, reason: busy.reason };
    }
    const stable = responseStable();
    if (!stable.stable) {
      scheduleAutoWordSave(Math.max(2200, RESPONSE_STABLE_MS - stable.waitedMs));
      return { ok: false, skipped: true, reason: "page settling" };
    }
    const saved = await sendLatestToWord({
      avoidDuplicate: true,
      silent: true,
      onlyUnsavedResponse: true,
      ignoreSelection: true
    });
    if (saved && saved.ok && !saved.skipped) {
      setStatus(`Auto-saved completed response to Word.\nNext send: ${nextPreviewText()}`);
      return saved;
    }
    return saved || { ok: true, skipped: true };
  }

  function scheduleAutoDriveSave(ms) {
    clearTimeout(driveAutoSaveTimer);
    if (!state.driveAutoSave) return;
    driveAutoSaveTimer = setTimeout(() => {
      autoSaveStableDriveResponse().catch(() => {});
    }, Math.max(1800, Number(ms) || 5000));
  }

  async function autoSaveStableDriveResponse() {
    if (!state.driveAutoSave) return { ok: false, skipped: true };
    const input = findInput();
    const busy = isBusy(input);
    if (busy.busy) {
      scheduleAutoDriveSave(2500);
      return { ok: false, skipped: true, reason: busy.reason };
    }
    const stable = responseStable();
    if (!stable.stable) {
      scheduleAutoDriveSave(Math.max(2200, RESPONSE_STABLE_MS - stable.waitedMs));
      return { ok: false, skipped: true, reason: "page settling" };
    }
    const saved = await saveLatestToDrive({
      silent: true,
      onlyUnsavedResponse: true,
      ignoreSelection: true
    });
    if (saved && saved.ok && !saved.skipped) {
      setStatus(`Auto-saved completed response to Google Drive backup.\nNext send: ${nextPreviewText()}`);
      return saved;
    }
    return saved || { ok: true, skipped: true };
  }

  function cleanTopicLine(line) {
    return String(line || "")
      .replace(/\*\*/g, "")
      .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
      .replace(/^\s*(?:[-*]|(?:\d{1,4}|[A-Za-z])[\).\]:-])\s*/u, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseVideoTopics(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map(cleanTopicLine)
      .filter(Boolean);
    const topics = [];
    const seen = new Set();
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (line.length < 8 || line.length > 180) continue;
      if (lower.match(/^(here are|sure|below are|video topics|topics:|title:|note:|status:|copy|download|prompt)/)) continue;
      if (line.match(/[{};]/) && line.match(/\b(import|export|const|let|var|function|class|return)\b/)) continue;
      if (line.match(/^```|```$/)) continue;
      const key = lower.replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      topics.push(line);
      if (topics.length >= 100) break;
    }
    return topics;
  }

  async function askChatGptVideoTopics(prompt) {
    const clean = String(prompt || state.videoTopicPrompt || "").trim();
    if (!clean) {
      const msg = "Write a video topic seed first.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    if (siteKind() !== "chatgpt") {
      const msg = "Open the target ChatGPT project chat first, then click Ask ChatGPT Topics.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const input = findInput();
    if (!input) {
      const msg = "ChatGPT input not found.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const busy = isBusy(input);
    if (busy.busy) {
      const msg = `ChatGPT is still responding: ${busy.reason}. Try after it completes.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    state.videoTopicPrompt = clean;
    await saveOptionsFromState();
    const finalPrompt = [
      `Create short HeyGen video topics for this seed: ${clean}`,
      "",
      "Return only a numbered list.",
      "Each item must be one clear LinkedIn/social-media video topic or title.",
      "Keep each item 8-16 words.",
      "No explanation, no table, no code."
    ].join("\n");
    setInputText(input, finalPrompt);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await sendInput(input);
    resetResponseWatch();
    const msg = "Sent topic request to ChatGPT. After the response completes, click Capture Topics.";
    setStatus(msg);
    return { ok: true, message: msg };
  }

  async function captureVideoTopics() {
    const text = latestUsefulText();
    const topics = parseVideoTopics(text);
    if (!topics.length) {
      const msg = "No video topics found. Select the topic list text, then click Capture Topics again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const saved = await saveVideoState({
      topics,
      nextIndex: 0,
      links: [],
      sourceUrl: location.href,
      currentTopic: "",
      capturedAt: new Date().toISOString()
    });
    const msg = `Captured ${saved.topics.length} topic(s). Next step: Copy Sheet Rows or open HeyGen and Fill HeyGen Topic.`;
    setStatus(msg);
    return { ok: true, message: msg, count: saved.topics.length };
  }

  function tsvCell(value) {
    return String(value || "").replace(/[\t\r\n]+/g, " ").trim();
  }

  function sheetRowsForTopics(videoState) {
    const linkByTopic = new Map();
    (videoState.links || []).forEach((item) => {
      if (item && item.topic) linkByTopic.set(item.topic, item.url || "");
    });
    const rows = [["Status", "Topic", "HeyGen Link", "Downloaded", "Notes"]];
    (videoState.topics || []).forEach((topic, index) => {
      const link = linkByTopic.get(topic) || "";
      const status = link ? "link captured" : index < videoState.nextIndex ? "sent to HeyGen" : "new";
      rows.push([status, topic, link, "", ""]);
    });
    return rows.map((row) => row.map(tsvCell).join("\t")).join("\n");
  }

  async function copyVideoSheetRows() {
    let videoState = await getVideoState();
    if (!videoState.topics.length && siteKind() === "chatgpt") {
      const captured = await captureVideoTopics();
      if (!captured.ok) return captured;
      videoState = await getVideoState();
    }
    if (!videoState.topics.length) {
      const msg = "No saved topics yet. Capture topics from ChatGPT first.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const output = sheetRowsForTopics(videoState);
    await writeClipboard(output);
    const msg = `Copied ${videoState.topics.length} Google Sheets row(s). Open Sheets, click A1, then paste.`;
    setStatus(msg);
    return { ok: true, message: msg, count: videoState.topics.length };
  }

  function findVideoPromptInput() {
    const selectors = [
      "textarea",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "[role='textbox']",
      "input[type='text']",
      "input:not([type])"
    ];
    const candidates = [];
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el) || el.disabled || el.getAttribute("aria-disabled") === "true") return;
        const label = [
          el.placeholder,
          el.getAttribute("aria-label"),
          el.getAttribute("name"),
          el.getAttribute("data-testid"),
          textOf(el.closest("label") || null)
        ].join(" ").toLowerCase();
        const rect = el.getBoundingClientRect();
        let score = 0;
        if (label.match(/script|topic|prompt|idea|video|describe|text|avatar|message/)) score += 30;
        if (el.tagName === "TEXTAREA") score += 12;
        if (el.isContentEditable) score += 8;
        if (rect.width > 250) score += 5;
        if (rect.top > innerHeight * 0.25) score += 3;
        candidates.push({ el, score });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length ? candidates[0].el : null;
  }

  function highlightVideoGenerateControls() {
    let count = 0;
    qAll("button,[role='button'],a").forEach((el) => {
      if (!visible(el) || inPanel(el)) return;
      const label = `${textOf(el)} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
      if (!label.match(/\b(generate|create|submit|continue|next|render|export|download|video)\b/)) return;
      el.classList.add("aria-super-highlight");
      count += 1;
    });
    return count;
  }

  async function fillHeyGenTopic() {
    const host = location.hostname.toLowerCase();
    if (!host.includes("heygen")) {
      const msg = "Open HeyGen video agent/editor tab first. This will not paste into random sites.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const videoState = await getVideoState();
    if (!videoState.topics.length) {
      const msg = "No saved topics. Capture topics from ChatGPT first.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    if (videoState.nextIndex >= videoState.topics.length) {
      const msg = `All ${videoState.topics.length} topic(s) have already been sent to HeyGen.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const topic = videoState.topics[videoState.nextIndex];
    const input = findVideoPromptInput();
    if (!input) {
      const msg = "HeyGen prompt/input box not found. Click the prompt box once, then try again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    setInputText(input, topic);
    input.classList.add("aria-super-highlight");
    const highlighted = highlightVideoGenerateControls();
    const saved = await saveVideoState({
      nextIndex: videoState.nextIndex + 1,
      currentTopic: topic
    });
    const msg = `Filled HeyGen topic ${saved.nextIndex}/${saved.topics.length}: ${topic}\nGenerate/export remains under your HeyGen account controls. Highlighted ${highlighted} possible action button(s).`;
    setStatus(msg);
    return { ok: true, message: msg, topic, nextIndex: saved.nextIndex };
  }

  function absolutizeUrl(value) {
    try {
      if (!value) return "";
      if (String(value).startsWith("blob:") || String(value).startsWith("data:")) return String(value);
      return new URL(String(value), location.href).href;
    } catch (err) {
      return "";
    }
  }

  function isDirectVideoUrl(url) {
    const value = String(url || "");
    return value.startsWith("blob:") ||
      value.startsWith("data:video/") ||
      /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(value);
  }

  function findOfficialVideoLink() {
    const candidates = [];
    qAll("video").forEach((video) => {
      const src = absolutizeUrl(video.currentSrc || video.src);
      if (src) candidates.push({ url: src, direct: isDirectVideoUrl(src), source: "video element" });
    });
    qAll("source").forEach((source) => {
      const src = absolutizeUrl(source.src || source.getAttribute("src"));
      if (src) candidates.push({ url: src, direct: isDirectVideoUrl(src), source: "source element" });
    });
    qAll("a[href]").forEach((link) => {
      const href = absolutizeUrl(link.getAttribute("href"));
      if (!href || href.startsWith("javascript:")) return;
      const label = `${textOf(link)} ${link.getAttribute("download") || ""} ${href}`.toLowerCase();
      if (isDirectVideoUrl(href) || label.match(/\b(download|export|share|video|mp4|webm|render)\b/)) {
        candidates.push({ url: href, direct: isDirectVideoUrl(href) || Boolean(link.getAttribute("download")), source: "link" });
      }
    });
    const unique = [];
    const seen = new Set();
    candidates.forEach((candidate) => {
      if (!candidate.url || seen.has(candidate.url)) return;
      seen.add(candidate.url);
      unique.push(candidate);
    });
    return unique.find((item) => item.direct) || unique[0] || null;
  }

  async function captureVideoLink() {
    const found = findOfficialVideoLink();
    if (!found) {
      const highlighted = highlightVideoGenerateControls();
      const msg = `No official video link found yet. Generate/export in HeyGen first. Highlighted ${highlighted} possible button(s).`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const videoState = await getVideoState();
    const topic = videoState.currentTopic || videoState.topics[Math.max(0, videoState.nextIndex - 1)] || "";
    const links = [{ ...found, topic, capturedAt: new Date().toISOString(), pageUrl: location.href }, ...videoState.links].slice(0, 200);
    await saveVideoState({ links });
    await writeClipboard(found.url);
    const msg = `${found.direct ? "Direct video link" : "Official/share link"} captured and copied.\n${found.url}\n${found.direct ? "You can now click Download Official Video." : "If this is not a direct video file, use HeyGen official Download/Export first."}`;
    setStatus(msg);
    return { ok: true, message: msg, url: found.url, direct: found.direct };
  }

  function videoExtensionFromUrl(url) {
    const value = String(url || "");
    const dataMatch = value.match(/^data:video\/([a-z0-9.+-]+)/i);
    if (dataMatch) return dataMatch[1].replace("quicktime", "mov").replace("x-m4v", "m4v");
    const fileMatch = value.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/i);
    if (fileMatch && ["mp4", "webm", "mov", "m4v"].includes(fileMatch[1].toLowerCase())) return fileMatch[1].toLowerCase();
    return "mp4";
  }

  async function payloadForVideo(url) {
    const value = String(url || "");
    if (value.startsWith("data:video/")) return { dataUrl: value, sourceUrl: value.slice(0, 120) };
    if (value.startsWith("blob:")) {
      const response = await fetch(value, { credentials: "omit" });
      if (!response.ok) throw new Error("Could not read this blob video from the page.");
      return { dataUrl: await blobToDataUrl(await response.blob()), sourceUrl: value };
    }
    return { url: value, sourceUrl: value };
  }

  async function downloadOfficialVideo() {
    let videoState = await getVideoState();
    let found = (videoState.links || []).find((item) => item && item.direct && item.url);
    if (!found) {
      const detected = findOfficialVideoLink();
      if (detected && detected.direct) found = detected;
    }
    if (!found || !found.url) {
      const msg = "No direct downloadable video URL found. Use HeyGen official Export/Download, then Capture Video Link again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    if (!isDirectVideoUrl(found.url)) {
      const msg = "Captured link is not a direct video file. I will not bypass premium/protected download restrictions.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const topic = found.topic || videoState.currentTopic || "heygen-video";
    const folder = sanitizePathPart(getVideoFolder(), "Basit Social Media/HeyGen Videos");
    const ext = videoExtensionFromUrl(found.url);
    const filename = `${folder}/${timestamp()}_${slug(topic, "heygen-video")}_${shortHash(found.url)}.${ext}`;
    let payload;
    try {
      payload = await payloadForVideo(found.url);
    } catch (err) {
      const msg = `Could not prepare video download: ${err.message}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const reply = await sendRuntime({
      type: "ARIA_SUPER_DOWNLOAD_IMAGE",
      payload: { ...payload, filename }
    });
    if (!reply.ok) {
      const msg = `Video download failed: ${reply.error}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    videoState = await getVideoState();
    const links = (videoState.links || []).map((item) => item.url === found.url ? { ...item, downloaded: true, filename: reply.filename } : item);
    await saveVideoState({ links });
    const msg = `Official video saved: ${reply.filename}`;
    setStatus(msg);
    return { ok: true, message: msg, filename: reply.filename };
  }

  async function videoPipelineStatus() {
    const videoState = await getVideoState();
    const latest = (videoState.links || [])[0];
    const msg = [
      `Video topics: ${videoState.topics.length}`,
      `Next topic: ${Math.min(videoState.nextIndex + 1, videoState.topics.length || 1)}/${videoState.topics.length || 0}`,
      `Captured links: ${videoState.links.length}`,
      `Folder: ${getVideoFolder()}`,
      latest ? `Last link: ${latest.url}` : "Last link: none"
    ].join("\n");
    setStatus(msg);
    return { ok: true, message: msg, state: videoState };
  }

  function xCurrentArticle() {
    const articles = qAll("article").filter(visible);
    if (!articles.length) return null;
    const centerY = innerHeight * 0.45;
    return articles.sort((a, b) => Math.abs(a.getBoundingClientRect().top - centerY) - Math.abs(b.getBoundingClientRect().top - centerY))[0];
  }

  function xCommentDraft(text) {
    const lower = String(text || "").toLowerCase();
    const quoted = text.match(/comment\s+["']([^"']+)["']/i) || text.match(/write\s+["']([^"']+)["']/i);
    if (quoted && quoted[1]) return quoted[1].trim();
    if (lower.includes("btc")) return "BTC";
    if (lower.includes("money")) return "Money";
    if (lower.includes("canva")) return "Canva";
    if (lower.includes("yes")) return "YES";
    if (lower.includes("done")) return "Done";
    return "Done";
  }

  async function xSafePrep() {
    if (siteKind() !== "x") {
      setStatus("Open X/Twitter post first.");
      return { ok: false, error: "Open X first." };
    }
    const article = xCurrentArticle();
    if (!article) {
      setStatus("No visible X post found.");
      return { ok: false, error: "Post not found." };
    }
    article.classList.add("aria-super-highlight");
    const text = textOf(article);
    const comment = xCommentDraft(text);
    try {
      await navigator.clipboard.writeText(comment);
    } catch (err) {}
    qAll("button,[role='button'],a").forEach((el) => {
      const t = textOf(el).toLowerCase();
      if (t.match(/\b(like|repost|retweet|reply|follow)\b/)) el.classList.add("aria-super-highlight");
    });
    const replyBox = qAll("[contenteditable='true'],textarea").filter((el) => visible(el) && !inPanel(el)).pop();
    if (replyBox && location.href.includes("/compose/")) setInputText(replyBox, comment);
    const msg = `X safe prep done.\nComment copied: ${comment}\nPublic actions are highlighted. Review and click them yourself.`;
    setStatus(msg);
    return { ok: true, message: msg };
  }

  function getSelectionText() {
    try {
      return String(window.getSelection && window.getSelection().toString() || "").trim();
    } catch (err) {
      return "";
    }
  }

  function compactText(text, limit) {
    const cleaned = String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (!limit || cleaned.length <= limit) return cleaned;
    return cleaned.slice(0, limit - 18).trim() + "\n...[trimmed]";
  }

  function currentPostRoot() {
    const selection = window.getSelection && window.getSelection();
    if (selection && selection.rangeCount) {
      let node = selection.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const root = node && node.closest && node.closest("article,[role='article'],[data-testid='tweet'],[role='dialog'],main,section");
      if (root && visible(root) && !inPanel(root)) return root;
    }
    const hovered = document.querySelector(":hover article,:hover [role='article'],:hover [data-testid='tweet']");
    if (hovered && visible(hovered) && !inPanel(hovered)) return hovered;
    const dialog = activeDialog();
    if (dialog) return dialog;
    const roots = qAll("article,[role='article'],[data-testid='tweet'],main")
      .filter((el) => visible(el) && !inPanel(el))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const ac = Math.abs((ar.top + ar.bottom) / 2 - innerHeight / 2);
        const bc = Math.abs((br.top + br.bottom) / 2 - innerHeight / 2);
        return ac - bc;
      });
    return roots[0] || document.body;
  }

  function collectWhatsAppSourceText() {
    const selected = getSelectionText();
    if (selected) return compactText(selected, 5000);
    const root = currentPostRoot();
    const text = root ? root.innerText : document.body.innerText;
    const title = document.title ? `Source: ${document.title}` : "";
    const body = compactText(text, 5000);
    if (!body) return "";
    return compactText([body, title, location.href].filter(Boolean).join("\n\n"), 5600);
  }

  async function copyPostForWhatsApp() {
    if (siteKind() === "whatsapp") {
      readPanelInputs();
      return copyFromCurrentWhatsAppChat(state.whatsappSourceName);
    }
    const text = collectWhatsAppSourceText();
    if (!text) {
      const msg = "WhatsApp copy failed: select text/post first, then try again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const record = {
      text,
      sourceUrl: location.href,
      sourceTitle: document.title || "",
      sourceSite: siteKind(),
      savedAt: new Date().toISOString()
    };
    storageSet({ [WHATSAPP_DRAFT_KEY]: record });
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {}
    const msg = `Saved WhatsApp draft (${text.length} chars). Open WhatsApp Web chat, then click Fill WhatsApp Draft.`;
    setStatus(msg);
    return { ok: true, message: msg, chars: text.length, preview: text.slice(0, 240) };
  }

  async function getWhatsAppDraftText() {
    const data = await storageGet([WHATSAPP_DRAFT_KEY]);
    const record = data && data[WHATSAPP_DRAFT_KEY];
    if (record && record.text) return String(record.text);
    try {
      const clip = await navigator.clipboard.readText();
      return String(clip || "").trim();
    } catch (err) {
      return "";
    }
  }

  function findWhatsAppComposer() {
    const selectors = [
      "footer div[contenteditable='true'][role='textbox']",
      "footer div[contenteditable='true']",
      "div[aria-label='Type a message']",
      "div[aria-label='Message']",
      "div[contenteditable='true'][data-tab]",
      "div[role='textbox'][contenteditable='true']"
    ];
    for (const selector of selectors) {
      const candidates = qAll(selector).filter((el) => visible(el) && !inPanel(el) && el.getAttribute("aria-disabled") !== "true");
      if (candidates.length) return candidates[candidates.length - 1];
    }
    return null;
  }

  async function fillWhatsAppDraft(options = {}) {
    if (siteKind() !== "whatsapp") {
      const msg = "Open web.whatsapp.com and select the target chat first. Then click Fill WhatsApp Draft.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    readPanelInputs();
    const receiverName = String((options && options.receiverName) || state.whatsappReceiverName || "").trim();
    if (receiverName) {
      const opened = await openWhatsAppChatByName(receiverName);
      if (!opened.ok) {
        setStatus(opened.error);
        return opened;
      }
      await waitMs(500);
    }
    const text = await getWhatsAppDraftText();
    if (!text) {
      const msg = "No WhatsApp draft saved yet. On any source page, select/click a post and click Copy Post for WhatsApp.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const input = findWhatsAppComposer();
    if (!input) {
      const msg = "WhatsApp message box not found. Open a chat first, then try Fill WhatsApp Draft again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    setInputText(input, text);
    input.classList.add("aria-super-highlight");
    const msg = receiverName
      ? `WhatsApp draft filled for "${receiverName}". Review the message and press Send yourself.`
      : "WhatsApp draft filled. Review the message and press Send yourself.";
    setStatus(msg);
    return { ok: true, message: msg, chars: text.length, receiverName };
  }

  async function copyWhatsAppDraftToClipboard() {
    const text = await getWhatsAppDraftText();
    if (!text) {
      const msg = "No WhatsApp draft saved.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const reply = await sendRuntime({ type: "ARIA_SUPER_COPY_TEXT_TO_CLIPBOARD", payload: { text } });
      if (!reply || !reply.ok) {
        const msg = `Clipboard failed: ${(reply && reply.error) || err.message}`;
        setStatus(msg);
        return { ok: false, error: msg };
      }
    }
    const msg = "WhatsApp draft copied to clipboard.";
    setStatus(msg);
    return { ok: true, message: msg, chars: text.length };
  }

  async function openWhatsAppWeb() {
    window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
    const msg = "WhatsApp Web opened. Select your target chat, then click Fill WhatsApp Draft.";
    setStatus(msg);
    return { ok: true, message: msg };
  }

  function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function wordsMatch(haystack, needle) {
    const a = String(haystack || "").toLowerCase().replace(/\s+/g, " ").trim();
    const b = String(needle || "").toLowerCase().replace(/\s+/g, " ").trim();
    return Boolean(a && b && (a === b || a.includes(b)));
  }

  function clickWhatsAppVisibleChat(name) {
    const candidates = qAll(
      "div[role='listitem'], [data-testid='cell-frame-container'], [aria-label][role='button'], span[title], a[href*='web.whatsapp.com']"
    )
      .filter((el) => visible(el) && !inPanel(el))
      .map((el) => {
        const title = el.getAttribute("title") || el.getAttribute("aria-label") || "";
        const text = `${title} ${textOf(el)}`.trim();
        return { el, text };
      })
      .filter((item) => wordsMatch(item.text, name));
    if (!candidates.length) return false;
    const target = candidates[0].el.closest("div[role='listitem'], [data-testid='cell-frame-container'], [role='button'], a") || candidates[0].el;
    target.scrollIntoView({ block: "center", behavior: "instant" });
    target.click();
    target.classList.add("aria-super-highlight");
    return true;
  }

  function findWhatsAppSearchInput() {
    const candidates = qAll("input[type='text'], input[type='search'], div[contenteditable='true'][role='textbox'], div[contenteditable='true']")
      .filter((el) => visible(el) && !inPanel(el) && !el.closest("footer"));
    const scored = candidates
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = `${textOf(el)} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("data-placeholder") || ""} ${el.getAttribute("title") || ""}`.toLowerCase();
        let score = 0;
        if (label.includes("search")) score += 120;
        if (label.includes("message")) score -= 80;
        if (rect.left < Math.min(520, innerWidth * 0.45)) score += 35;
        if (rect.top < 260) score += 25;
        return { el, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored.length && scored[0].score > 20 ? scored[0].el : null;
  }

  async function openWhatsAppChatByName(name) {
    const chatName = String(name || "").trim();
    if (!chatName) return { ok: true, message: "No chat name given; using current selected WhatsApp chat." };
    if (siteKind() !== "whatsapp") {
      return { ok: false, error: "Open web.whatsapp.com first, then run the WhatsApp channel draft button." };
    }
    if (clickWhatsAppVisibleChat(chatName)) {
      await waitMs(900);
      return { ok: true, message: `Opened visible WhatsApp chat: ${chatName}` };
    }
    let search = findWhatsAppSearchInput();
    if (!search) {
      const searchButton = qAll("button,[role='button']").find((el) => visible(el) && !inPanel(el) && /search/i.test(textOf(el)));
      if (searchButton) {
        searchButton.click();
        await waitMs(350);
        search = findWhatsAppSearchInput();
      }
    }
    if (!search) {
      return { ok: false, error: `WhatsApp search box not found. Select/open "${chatName}" manually, then run again.` };
    }
    setInputText(search, chatName);
    search.classList.add("aria-super-highlight");
    await waitMs(1200);
    if (clickWhatsAppVisibleChat(chatName)) {
      await waitMs(900);
      return { ok: true, message: `Found and opened WhatsApp chat: ${chatName}` };
    }
    return { ok: false, error: `WhatsApp chat/channel not found: ${chatName}. Check spelling or open it once manually.` };
  }

  function currentWhatsAppChatName() {
    const header = qAll("header span[title], header [dir='auto'], header [aria-label], header [title]")
      .filter((el) => visible(el) && !inPanel(el))
      .map((el) => el.getAttribute("title") || textOf(el))
      .find((text) => text && !/search|menu|profile|status/i.test(text));
    if (header) return header.trim();
    const title = document.title.replace(/\s*-\s*WhatsApp.*$/i, "").trim();
    return title || "WhatsApp";
  }

  function collectWhatsAppVisibleMessage() {
    const selected = getSelectionText();
    if (selected) return compactText(selected, 5000);
    const seen = new Set();
    const selectors = [
      "[data-testid='msg-container']",
      "div.message-in",
      "div.message-out",
      "main [copyable-text]",
      "main div[role='row']"
    ];
    const candidates = [];
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el) || el.closest("footer")) return;
        if (seen.has(el)) return;
        seen.add(el);
        const text = compactText(textOf(el), 2200);
        if (text.length < 3) return;
        if (/^(today|yesterday|type a message|message|search|end-to-end encrypted)$/i.test(text)) return;
        candidates.push({ el, text, top: el.getBoundingClientRect().top });
      });
    });
    candidates.sort((a, b) => a.top - b.top);
    const picked = candidates[candidates.length - 1];
    if (picked) {
      picked.el.classList.add("aria-super-highlight");
      return compactText(picked.text, 5000);
    }
    const main = document.querySelector("main");
    return compactText(main ? main.innerText : "", 5000);
  }

  async function copyFromCurrentWhatsAppChat(sourceName) {
    const text = collectWhatsAppVisibleMessage();
    if (!text) {
      return { ok: false, error: "No visible WhatsApp message found. Click/select the source message first, then try again." };
    }
    const source = String(sourceName || "").trim() || currentWhatsAppChatName();
    const draft = compactText([`From ${source}:`, text].join("\n\n"), 5600);
    const record = {
      text: draft,
      sourceUrl: location.href,
      sourceTitle: document.title || "",
      sourceSite: "whatsapp",
      sourceChat: source,
      savedAt: new Date().toISOString()
    };
    await storageSet({ [WHATSAPP_DRAFT_KEY]: record });
    try {
      await navigator.clipboard.writeText(draft);
    } catch (err) {}
    return { ok: true, message: `Copied WhatsApp source from: ${source}`, chars: draft.length, preview: draft.slice(0, 240) };
  }

  async function setCurrentWhatsAppChatRole(role) {
    if (siteKind() !== "whatsapp") {
      const msg = "Open WhatsApp Web and select a chat/channel first.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const name = currentWhatsAppChatName();
    if (!name || name === "current chat") {
      const msg = "Current WhatsApp chat/channel name not detected. Open the chat/channel, then try again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    if (role === "receiver") state.whatsappReceiverName = name;
    else state.whatsappSourceName = name;
    syncPanelInputs();
    await saveOptionsFromState();
    const label = role === "receiver" ? "receiver" : "source";
    const msg = `Saved current WhatsApp chat/channel as ${label}: ${name}`;
    setStatus(msg);
    return { ok: true, message: msg, role: label, name };
  }

  async function setCurrentSourceAndCopyWhatsApp() {
    const role = await setCurrentWhatsAppChatRole("source");
    if (!role.ok) return role;
    const copied = await copyFromCurrentWhatsAppChat(role.name);
    if (!copied.ok) return copied;
    const msg = `${role.message}\n${copied.message}\nNow select/set receiver and click Fill WhatsApp draft or WA source -> receiver draft.`;
    setStatus(msg);
    return { ok: true, message: msg, name: role.name, chars: copied.chars, preview: copied.preview };
  }

  async function setCurrentReceiverAndFillWhatsApp() {
    const role = await setCurrentWhatsAppChatRole("receiver");
    if (!role.ok) return role;
    const filled = await fillWhatsAppDraft({ receiverName: role.name });
    if (!filled.ok) return filled;
    const msg = `${role.message}\n${filled.message}\nReview karein aur Send aap khud press karein.`;
    setStatus(msg);
    return { ok: true, message: msg, name: role.name, chars: filled.chars };
  }

  async function whatsappBridgeStatus() {
    readPanelInputs();
    const isWhatsApp = siteKind() === "whatsapp";
    const draftText = await getWhatsAppDraftText();
    const composer = isWhatsApp ? findWhatsAppComposer() : null;
    const currentChat = isWhatsApp ? currentWhatsAppChatName() : "";
    const visibleMessage = isWhatsApp ? collectWhatsAppVisibleMessage() : "";
    const lines = [
      "WhatsApp bridge status:",
      `Page: ${isWhatsApp ? "WhatsApp Web" : siteKind()}`,
      `Current chat/channel: ${currentChat || "(not detected)"}`,
      `Source field: ${state.whatsappSourceName || "(blank/current)"}`,
      `Receiver field: ${state.whatsappReceiverName || "(blank)"}`,
      `Saved draft: ${draftText ? `${draftText.length} chars` : "NO"}`,
      `Visible source message: ${visibleMessage ? `${visibleMessage.length} chars` : "NO"}`,
      `Composer box: ${composer ? "YES" : "NO"}`
    ];
    const message = lines.join("\n");
    setStatus(message);
    return {
      ok: true,
      message,
      isWhatsApp,
      currentChat,
      sourceName: state.whatsappSourceName,
      receiverName: state.whatsappReceiverName,
      draftChars: draftText.length,
      visibleMessageChars: visibleMessage.length,
      composerFound: Boolean(composer)
    };
  }

  async function swapWhatsAppBridge() {
    readPanelInputs();
    const oldSource = state.whatsappSourceName;
    state.whatsappSourceName = state.whatsappReceiverName;
    state.whatsappReceiverName = oldSource;
    syncPanelInputs();
    await saveOptionsFromState();
    const msg = `WhatsApp bridge swapped.\nSource: ${state.whatsappSourceName || "(blank/current)"}\nReceiver: ${state.whatsappReceiverName || "(blank)"}`;
    setStatus(msg);
    return { ok: true, message: msg, sourceName: state.whatsappSourceName, receiverName: state.whatsappReceiverName };
  }

  async function clearWhatsAppBridge() {
    state.whatsappSourceName = "";
    state.whatsappReceiverName = "";
    syncPanelInputs();
    await saveOptionsFromState();
    await storageSet({ [WHATSAPP_DRAFT_KEY]: null });
    const msg = "WhatsApp bridge cleared. Source, receiver, and saved draft reset.";
    setStatus(msg);
    return { ok: true, message: msg };
  }

  async function whatsappOneClickDraft(options = {}) {
    readPanelInputs();
    const sourceName = String(options.sourceName || state.whatsappSourceName || "").trim();
    const receiverName = String(options.receiverName || state.whatsappReceiverName || "").trim();
    await saveOptionsFromState();
    if (siteKind() !== "whatsapp") {
      const copied = await copyPostForWhatsApp();
      if (!copied.ok) return copied;
      const msg = receiverName
        ? `Source copied. WhatsApp Web open karein, receiver "${receiverName}" select/search karein, phir Fill WhatsApp draft dabayein.`
        : "Source copied. WhatsApp Web open karein, receiver chat select karein, phir Fill WhatsApp draft dabayein.";
      setStatus(msg);
      return { ok: true, message: msg, preview: copied.preview };
    }
    if (sourceName) {
      const openedSource = await openWhatsAppChatByName(sourceName);
      if (!openedSource.ok) {
        setStatus(openedSource.error);
        return openedSource;
      }
    }
    const copied = await copyFromCurrentWhatsAppChat(sourceName);
    if (!copied.ok) {
      setStatus(copied.error);
      return copied;
    }
    if (!receiverName) {
      const msg = `${copied.message}\nReceiver chat name blank hai. Receiver chat manually open karein, phir Fill WhatsApp draft dabayein.`;
      setStatus(msg);
      return { ok: true, message: msg, preview: copied.preview };
    }
    const openedReceiver = await openWhatsAppChatByName(receiverName);
    if (!openedReceiver.ok) {
      const msg = `${copied.message}\n${openedReceiver.error}\nDraft saved hai; receiver manually open karke Fill WhatsApp draft dabayein.`;
      setStatus(msg);
      return { ok: false, error: msg, preview: copied.preview };
    }
    const filled = await fillWhatsAppDraft();
    const msg = filled.ok
      ? `WhatsApp one-click draft ready.\nSource: ${sourceName || "current chat"}\nReceiver: ${receiverName}\nReview karein aur Send aap khud press karein.`
      : filled.error;
    setStatus(msg);
    return filled.ok
      ? { ok: true, message: msg, chars: filled.chars, preview: copied.preview }
      : { ok: false, error: msg };
  }

  function socialPlatformFromPayload(social) {
    const selected = String((social && social.platform) || "auto").toLowerCase();
    if (selected && selected !== "auto") return selected === "twitter" ? "x" : selected;
    const kind = siteKind();
    if (["facebook", "instagram", "linkedin", "x"].includes(kind)) return kind;
    return "facebook";
  }

  function activeDialog() {
    const dialogs = qAll("[role='dialog'],[aria-modal='true']").filter((el) => visible(el) && !inPanel(el));
    return dialogs.length ? dialogs[dialogs.length - 1] : null;
  }

  function socialRoots() {
    const roots = [];
    const dialog = activeDialog();
    if (dialog) roots.push(dialog);
    roots.push(document);
    return roots;
  }

  function fieldContext(el) {
    const parts = [
      textOf(el),
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder"),
      el.getAttribute("data-placeholder"),
      el.closest("[role='dialog'],form,article,main,div") ? textOf(el.closest("[role='dialog'],form,article,main,div")).slice(0, 260) : ""
    ];
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function socialTextTarget(purpose) {
    const patterns = purpose === "comment"
      ? /comment|reply|respond|your thoughts|add a comment|post your reply|write a reply|tweet your reply/
      : /what.?s on your mind|start a post|what do you want to talk|caption|write a caption|create post|what.?s happening|post text|share update|tell your network/;
    const all = [];
    for (const root of socialRoots()) {
      const candidates = Array.from(root.querySelectorAll("textarea,input[type='text'],div[contenteditable='true'],[role='textbox'],.ProseMirror"))
        .filter((el) => visible(el) && !inPanel(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
      candidates.forEach((el) => all.push(el));
      const matched = candidates.filter((el) => patterns.test(fieldContext(el)));
      if (matched.length) return matched[matched.length - 1];
    }
    return all.length ? all[all.length - 1] : null;
  }

  function buttonText(el) {
    return `${textOf(el)} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.toLowerCase();
  }

  function clickSocialButton(pattern) {
    for (const root of socialRoots()) {
      const buttons = Array.from(root.querySelectorAll("button,[role='button'],a,label"))
        .filter((el) => visible(el) && !inPanel(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
      const found = buttons.find((el) => pattern.test(buttonText(el)));
      if (found) {
        found.click();
        return true;
      }
    }
    return false;
  }

  async function ensureSocialComposer(platform, purpose) {
    let target = socialTextTarget(purpose);
    if (target) return target;
    if (purpose === "comment") {
      clickSocialButton(/comment|reply|respond/);
    } else if (platform === "linkedin") {
      clickSocialButton(/start a post|create a post|share a post|write a post|post an update|\bpost\b/);
    } else if (platform === "x") {
      clickSocialButton(/post|tweet|compose|what.?s happening/);
    } else if (platform === "instagram") {
      clickSocialButton(/create|new post|caption|share/);
    } else {
      clickSocialButton(/what.?s on your mind|create post|post/);
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
    return socialTextTarget(purpose);
  }

  function linkedInSocialPayload(kind) {
    const social = panelSocialPayload();
    const extra = String(social.extra || "").trim();
    const guidance = kind === "company"
      ? "LinkedIn company page: professional, practical, brand-safe, short hook, clear value, soft CTA, 3-5 relevant hashtags."
      : "LinkedIn profile: professional but human, short hook, useful insight, simple CTA, 3-5 relevant hashtags.";
    return {
      ...social,
      platform: "linkedin",
      extra: extra ? `${extra}\n${guidance}` : guidance
    };
  }

  async function linkedinProAssist(kind) {
    if (siteKind() !== "linkedin") {
      setStatus("Open LinkedIn first, then click LinkedIn Pro. ARIA will only fill visible drafts on the current LinkedIn tab.");
      return { ok: false, error: "not-linkedin" };
    }
    const target = await ensureSocialComposer("linkedin", "post");
    if (!target) {
      highlightLinkedInActions();
      const msg = "LinkedIn composer not found. Click Start a post / Create post once, then press LinkedIn Pro again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const filled = await fillSocialDraft(linkedInSocialPayload(kind || "profile"), "post");
    const highlighted = highlightLinkedInActions();
    const msg = [
      filled.message || "LinkedIn draft prepared.",
      `Highlighted ${highlighted.count || 0} LinkedIn controls.`,
      "Review the draft. Final Post/Share stays your visible click or the confirmed Publish Current Draft action."
    ].join("\n");
    setStatus(msg);
    return { ok: true, message: msg };
  }

  async function linkedinCommentAssist() {
    if (siteKind() !== "linkedin") {
      setStatus("Open a LinkedIn post first, then click LinkedIn Comment.");
      return { ok: false, error: "not-linkedin" };
    }
    const filled = await fillSocialDraft(linkedInSocialPayload("comment"), "comment");
    const highlighted = highlightLinkedInActions();
    const msg = [
      filled.message || "LinkedIn comment draft prepared.",
      `Highlighted ${highlighted.count || 0} LinkedIn controls.`,
      "Review the comment before posting."
    ].join("\n");
    setStatus(msg);
    return { ok: true, message: msg };
  }

  function highlightLinkedInActions() {
    const pattern = /start a post|create a post|post an update|\bpost\b|\bshare\b|\bsend\b|\bnext\b|\bcomment\b|\breply\b|\brepost\b|\bfollow\b|\bconnect\b|\blike\b|celebrate|support|love|insightful|curious|photo|image|media|document|article|newsletter|schedule/;
    let count = 0;
    qAll("button,[role='button'],a,label,input[type='file']").forEach((el) => {
      if (!visible(el) || inPanel(el)) return;
      if (pattern.test(buttonText(el))) {
        el.classList.add("aria-super-highlight");
        count += 1;
      }
    });
    const msg = `LinkedIn Pro highlighted ${count} control(s): composer, media, comment, repost, like/reaction, follow/connect, and post/share buttons.`;
    setStatus(msg);
    return { ok: true, message: msg, count };
  }

  function fallbackSocialText(social, purpose, platform) {
    const topic = String((social && social.topic) || "").trim();
    const extra = String((social && social.extra) || "").trim();
    if (purpose === "comment") {
      if (topic) return topic;
      if (platform === "x") return "Done";
      if (platform === "linkedin") return "Insightful update. Thanks for sharing this.";
      return "Great update. Thanks for sharing.";
    }
    if (platform === "linkedin") {
      const base = topic || "Building smarter workflows with AI, automation, and practical execution.";
      const suffix = extra ? `\n\n${extra}` : "";
      return `${base}${suffix}\n\nWhat would you automate first?\n\n#AI #Automation #BusinessGrowth #Productivity`;
    }
    const base = topic || "Fresh update from Basit Social Media.";
    const suffix = extra ? `\n\n${extra}` : "";
    return `${base}${suffix}\n\n#BasitSocialMedia #AI`;
  }

  async function socialCaption(social, purpose) {
    const platform = socialPlatformFromPayload(social);
    const topic = String((social && social.topic) || "").trim();
    const payload = {
      platform,
      tone: String((social && social.tone) || "friendly"),
      topic,
      extra: String((social && social.extra) || ""),
      pageText: String((document.querySelector("main") || document.body).innerText || "").slice(-1800),
      imageName: ""
    };
    const reply = await sendRuntime({ type: "ARIA_SUPER_GROQ_CAPTION", payload });
    const text = reply && reply.ok ? reply.text : fallbackSocialText(social, purpose, platform);
    state.lastSocialCaption = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {}
    const msg = reply && reply.ok
      ? `Caption ready for ${platform}. Copied to clipboard.`
      : `Fallback caption ready for ${platform}. Groq issue: ${reply && reply.error ? reply.error : "not available"}`;
    setStatus(`${msg}\n\n${text}`);
    return { ok: true, message: `${msg}\n\n${text}`, text, source: reply && reply.ok ? "groq" : "fallback" };
  }

  async function fillSocialDraft(social, purpose) {
    const platform = socialPlatformFromPayload(social);
    const captionReply = await socialCaption(social, purpose);
    const target = await ensureSocialComposer(platform, purpose);
    if (!target) {
      const msg = `Could not find ${purpose === "comment" ? "comment/reply" : "post"} text box on ${platform}. Open composer first, then try again.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    setInputText(target, captionReply.text);
    target.classList.add("aria-super-highlight");
    sendRuntime({ type: "ARIA_SUPER_LOG_SOCIAL", payload: { platform, purpose, text: captionReply.text, url: location.href } });
    const msg = `${purpose === "comment" ? "Comment/reply" : "Post"} draft filled for ${platform}. Review before publishing.`;
    setStatus(msg);
    return { ok: true, message: msg, text: captionReply.text };
  }

  function highlightSocialActions() {
    const pattern = /like|react|follow|repost|retweet|share|comment|reply|post|publish|send|next|photo|image|media|upload/;
    let count = 0;
    qAll("button,[role='button'],a,label,input[type='file']").forEach((el) => {
      if (!visible(el) || inPanel(el)) return;
      if (pattern.test(buttonText(el))) {
        el.classList.add("aria-super-highlight");
        count += 1;
      }
    });
    const msg = `Highlighted ${count} social action control(s).`;
    setStatus(msg);
    return { ok: true, message: msg, count };
  }

  function publishCurrentSocialDraft(confirmPublish) {
    if (!confirmPublish) {
      const msg = "Publish blocked. Tick confirm in popup first.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const platform = socialPlatformFromPayload({});
    const clicked = clickSocialButton(platform === "x" ? /\b(post|reply|tweet)\b/ : /\b(post|publish|share|send|next)\b/);
    if (!clicked) {
      const msg = "Publish button not found. Keep the composer open and try again.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    sendRuntime({ type: "ARIA_SUPER_LOG_SOCIAL", payload: { platform, purpose: "publish-click", text: state.lastSocialCaption, url: location.href } });
    const msg = `Publish button clicked on ${platform}. If the site shows a second confirmation, review and click it.`;
    setStatus(msg);
    return { ok: true, message: msg };
  }

  function scholarshipProfileObject(profileText) {
    const raw = String(profileText || state.scholarshipProfile || "").trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (err) {}
    const data = {};
    raw.split(/\r?\n|;/).forEach((line) => {
      const clean = line.trim();
      if (!clean) return;
      const match = clean.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (!match) return;
      const key = normalizeFieldKey(match[1]);
      if (key) data[key] = match[2].trim();
    });
    return data;
  }

  function normalizeFieldKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function profileValue(profile, keys) {
    for (const key of keys) {
      const direct = profile[key];
      if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();
      const normalized = normalizeFieldKey(key);
      if (profile[normalized] !== undefined && profile[normalized] !== null && String(profile[normalized]).trim()) {
        return String(profile[normalized]).trim();
      }
      const foundKey = Object.keys(profile).find((candidate) => normalizeFieldKey(candidate) === normalized);
      if (foundKey && String(profile[foundKey]).trim()) return String(profile[foundKey]).trim();
    }
    return "";
  }

  function fieldLabelFor(el) {
    const parts = [];
    const id = el.getAttribute("id");
    if (id && window.CSS && CSS.escape) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) parts.push(label.innerText || label.textContent || "");
    }
    ["aria-label", "placeholder", "name", "id", "title", "autocomplete"].forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value) parts.push(value);
    });
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((labelId) => {
        const node = document.getElementById(labelId);
        if (node) parts.push(node.innerText || node.textContent || "");
      });
    }
    const parentLabel = el.closest("label");
    if (parentLabel) parts.push(parentLabel.innerText || parentLabel.textContent || "");
    const wrapper = el.closest("div,fieldset,section,td,li");
    if (wrapper) parts.push(String(wrapper.innerText || wrapper.textContent || "").slice(0, 240));
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function scholarshipFormFields() {
    return qAll("input,textarea,select").filter((el) => {
      if (!visible(el) || inPanel(el) || el.disabled || el.readOnly) return false;
      const type = String(el.getAttribute("type") || "").toLowerCase();
      return !["hidden", "submit", "button", "reset", "image", "file", "password"].includes(type);
    }).map((el) => ({
      el,
      label: fieldLabelFor(el),
      tag: el.tagName.toLowerCase(),
      type: String(el.getAttribute("type") || "").toLowerCase()
    }));
  }

  function scholarshipGuessValue(label, profile, el) {
    const t = String(label || "").toLowerCase();
    const type = String(el && el.getAttribute("type") || "").toLowerCase();
    const auto = String(el && el.getAttribute("autocomplete") || "").toLowerCase();
    const map = [
      [/first\s*name|given\s*name|forename|\bfname\b|^first$/, ["first_name", "firstname", "given_name"]],
      [/last\s*name|family\s*name|surname|\blname\b|^last$/, ["last_name", "lastname", "surname", "family_name"]],
      [/full\s*name|applicant\s*name|student\s*name|candidate\s*name|\bname\b/, ["full_name", "name", "student_name", "applicant_name"]],
      [/father|guardian\s*name/, ["father_name", "guardian_name"]],
      [/mother/, ["mother_name"]],
      [/email|e-mail|mail/, ["email", "email_address"]],
      [/phone|mobile|contact|whatsapp|cell/, ["phone", "mobile", "contact", "whatsapp"]],
      [/cnic|nic|national\s*id|identity|passport|id\s*number/, ["cnic", "nic", "national_id", "passport", "id_number"]],
      [/date\s*of\s*birth|birth\s*date|\bdob\b/, ["dob", "date_of_birth", "birth_date"]],
      [/gender|sex/, ["gender"]],
      [/address|street|residence/, ["address", "street_address", "home_address"]],
      [/city|town/, ["city"]],
      [/province|state|region/, ["province", "state", "region"]],
      [/country|nationality/, ["country", "nationality"]],
      [/school|college|university|institute|institution/, ["school", "college", "university", "institution", "institute"]],
      [/class|grade|semester|year\s*of\s*study/, ["class", "grade", "semester", "year_of_study"]],
      [/degree|program|programme|course|major|field\s*of\s*study/, ["degree", "program", "programme", "course", "major", "field_of_study"]],
      [/gpa|cgpa|marks|percentage|score|result/, ["gpa", "cgpa", "marks", "percentage", "score", "result"]],
      [/income|salary|household|family\s*income/, ["income", "family_income", "household_income"]],
      [/scholarship\s*reason|why.*scholarship|need.*scholarship|personal\s*statement|motivation|essay|statement|bio|about/, ["statement", "personal_statement", "scholarship_reason", "essay", "motivation", "about"]]
    ];
    if (type === "email" || auto.includes("email")) return profileValue(profile, ["email", "email_address"]);
    if (type === "tel" || auto.includes("tel")) return profileValue(profile, ["phone", "mobile", "contact"]);
    for (const [pattern, keys] of map) {
      if (pattern.test(t)) return profileValue(profile, keys);
    }
    return "";
  }

  function setNativeFieldValue(el, value) {
    const text = String(value || "");
    if (el.tagName === "SELECT") {
      const options = Array.from(el.options || []);
      const wanted = text.toLowerCase();
      const found = options.find((opt) => String(opt.textContent || opt.value || "").toLowerCase().includes(wanted)) ||
        options.find((opt) => wanted.includes(String(opt.textContent || opt.value || "").toLowerCase()));
      if (!found) return false;
      el.value = found.value;
    } else if (el.type === "checkbox" || el.type === "radio") {
      const label = fieldLabelFor(el).toLowerCase();
      const wanted = text.toLowerCase();
      if (!wanted || !label.includes(wanted)) return false;
      el.checked = true;
    } else {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value");
      if (setter && setter.set) setter.set.call(el, text);
      else el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function clearScholarshipHighlights() {
    qAll(".aria-scholarship-filled,.aria-scholarship-missing").forEach((el) => {
      el.classList.remove("aria-scholarship-filled", "aria-scholarship-missing");
    });
    const msg = "Scholarship field marks cleared.";
    setStatus(msg);
    return { ok: true, message: msg };
  }

  function scholarshipAnalyzeText() {
    const profile = scholarshipProfileObject();
    const fields = scholarshipFormFields();
    const matched = fields.filter((field) => scholarshipGuessValue(field.label, profile, field.el));
    const missing = fields.length - matched.length;
    const lines = [
      "Scholarship form analysis:",
      `Visible fillable fields: ${fields.length}`,
      `Confident profile matches: ${matched.length}`,
      `Need review / missing: ${missing}`,
      "",
      "Matched fields:",
      ...matched.slice(0, 20).map((field) => `- ${field.label.slice(0, 90)}`),
      "",
      "Safe rule: ARIA will not submit the application. Review every field before final submit."
    ];
    const msg = lines.join("\n");
    state.scholarshipLastSummary = msg;
    setStatus(msg);
    return msg;
  }

  function highlightScholarshipFields() {
    clearScholarshipHighlights();
    const profile = scholarshipProfileObject();
    const fields = scholarshipFormFields();
    let matched = 0;
    let missing = 0;
    fields.forEach((field) => {
      const value = scholarshipGuessValue(field.label, profile, field.el);
      if (value) {
        field.el.classList.add("aria-scholarship-filled");
        matched += 1;
      } else {
        field.el.classList.add("aria-scholarship-missing");
        missing += 1;
      }
    });
    const msg = `Scholarship fields highlighted.\nGreen: ${matched} confident match(es).\nOrange: ${missing} missing/uncertain field(s).`;
    setStatus(msg);
    return { ok: true, message: msg, matched, missing };
  }

  async function fillScholarshipDraft() {
    clearScholarshipHighlights();
    const profile = scholarshipProfileObject();
    if (!Object.keys(profile).length) {
      const msg = "Paste scholarship profile first. Example:\nfull name=Basit\nemail=...\nphone=...\ncity=...\nstatement=...";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const fields = scholarshipFormFields();
    let filled = 0;
    let skipped = 0;
    const filledLabels = [];
    fields.forEach((field) => {
      const value = scholarshipGuessValue(field.label, profile, field.el);
      if (!value) {
        field.el.classList.add("aria-scholarship-missing");
        skipped += 1;
        return;
      }
      const ok = setNativeFieldValue(field.el, value);
      if (ok) {
        field.el.classList.add("aria-scholarship-filled");
        filled += 1;
        filledLabels.push(field.label.slice(0, 80));
      } else {
        field.el.classList.add("aria-scholarship-missing");
        skipped += 1;
      }
    });
    const msg = [
      "Scholarship draft fill complete.",
      `Filled: ${filled}`,
      `Needs review/manual: ${skipped}`,
      "",
      filledLabels.length ? `Filled fields:\n${filledLabels.slice(0, 18).map((x) => `- ${x}`).join("\n")}` : "No fields filled.",
      "",
      "Review manually. ARIA did not click Submit."
    ].join("\n");
    state.scholarshipLastSummary = msg;
    setStatus(msg);
    return { ok: true, message: msg, filled, skipped };
  }

  function antigravityAvailableModels() {
    return String(state.antigravityModelOrder || DEFAULTS.antigravityModelOrder)
      .split(/[,|\n>]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function antigravityPageText() {
    const root = document.querySelector("main") || activeDialog() || document.body;
    return compactText(root ? root.innerText || root.textContent || "" : "", 9000);
  }

  function antigravityLooksLimited() {
    if (siteKind() !== "antigravity") return null;
    const text = antigravityPageText();
    const match = text.match(/(?:usage|rate|model|message|request|quota|credit|limit)[^.?!]{0,160}(?:limit|reached|exceeded|unavailable|try again|wait|quota|credits?)[^.?!]*/i)
      || text.match(/(?:try again|wait|come back|temporarily unavailable)[^.?!]{0,160}/i);
    return match ? { reason: previewText(match[0], 180), text } : null;
  }

  function antigravityButtonLabel(el) {
    return `${textOf(el)} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.replace(/\s+/g, " ").trim();
  }

  function antigravityPermissionButtons() {
    const roots = [];
    const dialog = activeDialog();
    if (dialog) roots.push(dialog);
    roots.push(document);
    const allowPattern = /\b(allow|approve|yes|confirm|continue|run|accept|trust|authorize|grant|proceed|start|resume)\b/i;
    const riskyPattern = /\b(delete|remove|wipe|format|reset|rm\s+-rf|credential|password|secret|token|api key|payment|purchase|subscribe|transfer money|send money|logout|sign out|revoke)\b/i;
    const found = [];
    for (const root of roots) {
      const context = compactText(root.innerText || root.textContent || "", 2200);
      root.querySelectorAll("button,[role='button'],a,input[type='button'],input[type='submit']").forEach((el) => {
        if (!visible(el) || inPanel(el) || el.disabled || el.getAttribute("aria-disabled") === "true") return;
        const label = antigravityButtonLabel(el);
        if (!allowPattern.test(label)) return;
        found.push({ el, label, risky: riskyPattern.test(`${label}\n${context}`), context: previewText(context, 180) });
      });
      if (found.length) break;
    }
    return found;
  }

  async function antigravityPermissionGuard(options = {}) {
    if (siteKind() !== "antigravity") {
      const msg = "Open Antigravity first, then use Permission guard.";
      if (!options.silentNoop) setStatus(msg);
      return { ok: false, error: msg };
    }
    const buttons = antigravityPermissionButtons();
    buttons.forEach((item) => item.el.classList.add("aria-super-highlight"));
    if (!buttons.length) {
      const msg = "Antigravity permission guard: no visible approval button found.";
      if (!options.silentNoop) setStatus(msg);
      return { ok: true, clicked: false, message: msg };
    }
    const safe = buttons.find((item) => !item.risky);
    const riskyCount = buttons.filter((item) => item.risky).length;
    if (!state.antigravityConfirmPermissions || !safe) {
      const msg = safe
        ? `Highlighted ${buttons.length} Antigravity approval control(s). Enable guarded permission clicks if you want ARIA to click safe approvals.`
        : `Highlighted ${buttons.length} Antigravity approval control(s), but ${riskyCount} look risky. Please review manually.`;
      if (!options.silentNoop) setStatus(msg);
      return { ok: true, clicked: false, riskyCount, message: msg };
    }
    safe.el.click();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const msg = `Clicked guarded Antigravity permission: ${previewText(safe.label, 80)}. Risky approvals remain manual.`;
    if (!options.silent) setStatus(msg);
    return { ok: true, clicked: true, riskyCount, message: msg };
  }

  async function antigravitySwitchModel(options = {}) {
    if (siteKind() !== "antigravity") {
      const msg = "Open Antigravity first, then switch model.";
      if (!options.silent) setStatus(msg);
      return { ok: false, error: msg };
    }
    readPanelInputs();
    const models = antigravityAvailableModels();
    if (!models.length) {
      const msg = "Antigravity model order is blank.";
      if (!options.silent) setStatus(msg);
      return { ok: false, error: msg };
    }
    const allButtons = qAll("button,[role='button'],a,[aria-haspopup='menu'],[data-testid*='model' i]")
      .filter((el) => visible(el) && !inPanel(el));
    const modelTrigger = allButtons.find((el) => /model|claude|gemini|gpt|flash|pro|oss/i.test(antigravityButtonLabel(el)));
    if (modelTrigger) {
      modelTrigger.classList.add("aria-super-highlight");
      modelTrigger.click();
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    for (const model of models) {
      const pattern = new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const option = qAll("button,[role='option'],[role='menuitem'],[role='button'],li,div")
        .find((el) => visible(el) && !inPanel(el) && pattern.test(antigravityButtonLabel(el)));
      if (option) {
        option.classList.add("aria-super-highlight");
        option.click();
        await new Promise((resolve) => setTimeout(resolve, 800));
        const msg = `Antigravity model selected/tried: ${model}.`;
        if (!options.silent) setStatus(msg);
        return { ok: true, model, message: msg };
      }
    }
    const msg = `Could not find visible model option. Tried: ${models.join(", ")}. Open the model menu once, then press Switch model again.`;
    if (!options.silent) setStatus(msg);
    return { ok: false, error: msg };
  }

  function antigravityPromptInstruction() {
    const limit = antigravityLooksLimited();
    const base = String(state.smartPromptInstruction || "").trim();
    return [
      base || "Continue this software task in the most useful next step.",
      "You are sending this to Google Antigravity. Ask for complete, runnable code or exact next actions.",
      "If Antigravity asks for permission, explain the action clearly before requesting approval.",
      "If there is a model/usage limit, ask for a compact handoff prompt that can be pasted into Claude, Gemini Flash/Pro, GPT OSS, or another coding agent.",
      limit ? `Visible limit signal: ${limit.reason}` : ""
    ].filter(Boolean).join("\n");
  }

  async function antigravitySmartPrompt(options = {}) {
    if (siteKind() !== "antigravity") {
      setStatus("Open Antigravity first, then use AG smart prompt.");
      return { ok: false, error: "not-antigravity" };
    }
    const old = state.smartPromptInstruction;
    state.smartPromptInstruction = antigravityPromptInstruction();
    try {
      return await smartPromptToInput({ sendNow: Boolean(options.sendNow) });
    } finally {
      state.smartPromptInstruction = old;
      syncPanelInputs();
    }
  }

  async function antigravityOneClick(message = {}) {
    readPanelInputs();
    const permission = await antigravityPermissionGuard({ auto: true, silentNoop: true });
    if (permission && permission.clicked) {
      return { ok: true, message: `${permission.message}\nRun again after Antigravity settles, or press Run for continuous automation.` };
    }
    const limited = antigravityLooksLimited();
    if (limited && state.antigravityAutoSwitchModel) {
      const switched = await antigravitySwitchModel({ silent: true });
      if (switched.ok) return { ok: true, message: `${switched.message}\nPress One-click again to send the next prompt.` };
    }
    if (state.sendMode === "smart" || String(state.smartPromptInstruction || "").trim()) {
      return antigravitySmartPrompt({ sendNow: true });
    }
    start(message.options || {}, Boolean(message.resetPromptFirst));
    return { ok: true, message: `One-click: Antigravity runner started.\nNext: ${nextPreviewText()}\nWait: ${Math.round(state.intervalMs / 1000)}s\nPermission clicks: ${state.antigravityConfirmPermissions ? "guarded ON" : "highlight only"}` };
  }

  function manusDateKey() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function manusRefreshKey() {
    return MANUS_REFRESH_PREFIX + scopeBase();
  }

  function manusResumeKey() {
    return MANUS_RESUME_PREFIX + scopeBase();
  }

  function manusPageText(limit = 10000) {
    const root = document.querySelector("main") || document.querySelector("[role='main']") || document.body;
    return compactText(root ? root.innerText || root.textContent || "" : "", limit);
  }

  function manusLatestQuestionBlock() {
    const latest = latestResponseText({ ignoreSelection: true }) || manusPageText(9000);
    const lines = String(latest || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-18);
    return lines.join("\n").trim();
  }

  function manusLimitSignal() {
    const text = manusPageText(12000).toLowerCase();
    const hardLimit = text.match(/\b(no credits|0 credits|credits exhausted|out of credits|insufficient credits|credit balance is low|upgrade to continue|daily limit|usage limit|rate limit|try again later|too many requests|message limit|limit reached)\b/i);
    if (hardLimit) return { reason: hardLimit[0] };
    const signals = visibleCreditSignals();
    const empty = signals.find((line) => line.match(/\b(0\s*(credit|credits|tokens|coins|points)|no\s+credits|out of credits|limit reached|upgrade)\b/i));
    if (empty) return { reason: empty };
    return null;
  }

  function manusLooksNumberedChoice(text) {
    const clean = String(text || "");
    const numbered = (clean.match(/(?:^|\n)\s*(?:\d{1,2}[\).\]:-]|[A-Da-d][\).\]:-])\s+\S/g) || []).length;
    const asking = /\b(choose|select|pick|option|which|which one|tell me|should i|do you want|confirm|reply with|enter|type|send)\b/i.test(clean);
    return numbered >= 3 || (numbered >= 2 && asking);
  }

  function manusRepeatedQuestion(text) {
    const clean = compactText(text, 1400).toLowerCase();
    const hash = shortHash(clean);
    if (!hash) return false;
    if (state.manusLastQuestionHash === hash) {
      state.manusRepeatCount += 1;
    } else {
      state.manusLastQuestionHash = hash;
      state.manusRepeatCount = 0;
    }
    return state.manusRepeatCount >= 1;
  }

  function manusNextReply() {
    const block = manusLatestQuestionBlock();
    let text = "next";
    let reason = "normal next";
    const repeated = manusRepeatedQuestion(block);
    if (manusLooksNumberedChoice(block)) {
      text = "all";
      reason = "numbered/multiple choice detected";
    } else if (repeated) {
      text = state.manusFallbackText || "do what is best";
      reason = "same question repeated";
    }
    state.manusLastReply = text;
    state.manusLastReason = reason;
    return { text, reason };
  }

  function manusMaybeMorningRefresh() {
    if (siteKind() !== "manus" || state.manusMorningRefresh === false) return false;
    const hour = Math.max(0, Math.min(23, Number.parseInt(state.manusMorningRefreshHour || "7", 10) || 7));
    const now = new Date();
    if (now.getHours() < hour) return false;
    const key = manusRefreshKey();
    const today = manusDateKey();
    try {
      if (localStorage.getItem(key) === today) return false;
      localStorage.setItem(key, today);
      localStorage.setItem(manusResumeKey(), JSON.stringify({
        running: true,
        at: Date.now(),
        intervalMs: state.intervalMs,
        runCount: state.runCount,
        max: state.manusMaxSends,
        fallback: state.manusFallbackText
      }));
    } catch (err) {}
    setStatus(`Manus morning refresh: refreshing once for ${today} so credits/status update. Runner will resume after reload.`);
    setTimeout(() => location.reload(), 900);
    return true;
  }

  async function maybeResumeManusAfterRefresh() {
    if (siteKind() !== "manus") return;
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(manusResumeKey()) || "null");
      localStorage.removeItem(manusResumeKey());
    } catch (err) {}
    if (!data || !data.running || Date.now() - Number(data.at || 0) > 120000) return;
    state.mode = "manus";
    state.sendMode = "manus";
    state.manusMaxSends = Math.max(1, Number.parseInt(data.max || state.manusMaxSends || 300, 10) || 300);
    state.manusFallbackText = String(data.fallback || state.manusFallbackText || "do what is best");
    syncPanelInputs();
    await saveOptionsFromState();
    setStatus("Manus refreshed; resuming runner after page settles.");
    setTimeout(() => start(null, false), 3500);
  }

  async function manusNextPayload() {
    if (siteKind() !== "manus") {
      return { kind: "stop", text: "", message: "Stopped: current tab is not Manus AI." };
    }
    if (manusMaybeMorningRefresh()) {
      return { kind: "stop", text: "", message: "Refreshing Manus tab for daily credit/status update." };
    }
    const max = Math.max(1, Number.parseInt(state.manusMaxSends || "300", 10) || 300);
    if (state.runCount >= max) {
      state.manusLastStopReason = `Max Manus sends reached: ${max}`;
      return { kind: "stop", text: "", message: `Manus stopped safely: ${state.manusLastStopReason}.` };
    }
    const limit = manusLimitSignal();
    if (limit) {
      state.manusLastStopReason = `Credit/limit signal: ${limit.reason}`;
      return { kind: "stop", text: "", message: `Manus stopped safely.\n${state.manusLastStopReason}` };
    }
    const reply = manusNextReply();
    return { kind: "manus", text: reply.text, reason: reply.reason };
  }

  function manusStatusText() {
    const max = Math.max(1, Number.parseInt(state.manusMaxSends || "300", 10) || 300);
    const limit = manusLimitSignal();
    const signals = visibleCreditSignals().slice(0, 8);
    return [
      "Manus AI Runner",
      `Site: ${siteKind()}`,
      `Running: ${state.running ? "YES" : "NO"}`,
      `Sent/credits used by this tab: ${state.runCount}/${max}`,
      `Next reply: ${state.manusLastReply || "next"}`,
      `Decision reason: ${state.manusLastReason || "--"}`,
      `Repeated question count: ${state.manusRepeatCount || 0}`,
      `Morning refresh: ${state.manusMorningRefresh === false ? "OFF" : `ON after ${state.manusMorningRefreshHour || "7"}:00`}`,
      `Limit signal: ${limit ? limit.reason : "none"}`,
      signals.length ? `Visible credit/status lines:\n- ${signals.join("\n- ")}` : "Visible credit/status lines: none detected",
      state.manusLastStopReason ? `Last stop: ${state.manusLastStopReason}` : ""
    ].filter(Boolean).join("\n");
  }

  async function startManusRunner(options = {}) {
    if (siteKind() !== "manus") {
      const msg = "Open a Manus AI tab first, then press Manus Start.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    state.mode = "manus";
    state.sendMode = "manus";
    state.manusLastStopReason = "";
    syncPanelInputs();
    await saveOptionsFromState();
    const nextOptions = options.options ? { ...options.options, mode: "manus", sendMode: "manus" } : null;
    start(nextOptions, Boolean(options.resetPromptFirst));
    const msg = `Manus runner started.\nIt will send next/all/best only after response is stable.\nCap: ${state.manusMaxSends || 300} sends.`;
    setStatus(msg);
    return { ok: true, message: msg, ...currentStatus() };
  }

  function stopManusRunner() {
    stop();
    const msg = "Manus runner stopped.";
    setStatus(msg);
    return { ok: true, message: msg, ...currentStatus() };
  }

  function manusManualRefresh() {
    if (siteKind() !== "manus") {
      const msg = "Open Manus AI first, then refresh Manus from ARIA.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    try {
      localStorage.setItem(manusResumeKey(), JSON.stringify({
        running: state.running,
        at: Date.now(),
        intervalMs: state.intervalMs,
        runCount: state.runCount,
        max: state.manusMaxSends,
        fallback: state.manusFallbackText
      }));
    } catch (err) {}
    setStatus("Refreshing Manus page now. Runner resumes only if it was running.");
    setTimeout(() => location.reload(), 500);
    return { ok: true, message: "Refreshing Manus page." };
  }

  async function oneClickCurrentSite(message) {
    const kind = siteKind();
    if (kind === "antigravity") {
      return antigravityOneClick(message || {});
    }
    if (kind === "manus") {
      return startManusRunner(message || {});
    }
    if (kind === "chatgpt" || kind === "clickup") {
      start(message.options || {}, Boolean(message.resetPromptFirst));
      return { ok: true, message: `One-click: ${kind} runner started.\nNext: ${nextPreviewText()}\nWait: ${Math.round(state.intervalMs / 1000)}s` };
    }
    if (kind === "linkedin") {
      return linkedinProAssist("profile");
    }
    if (["facebook", "instagram", "x"].includes(kind)) {
      const filled = await fillSocialDraft(message.social || {}, "post");
      const highlighted = highlightSocialActions();
      return {
        ok: filled.ok,
        message: `${filled.message || filled.error}\n${highlighted.message}\nPublic publish needs confirm checkbox + Publish Current Draft.`
      };
    }
    if (kind === "whatsapp") {
      return fillWhatsAppDraft();
    }
    start(message.options || {}, Boolean(message.resetPromptFirst));
    return { ok: true, message: `One-click: universal runner started on ${kind}.\nNext: ${nextPreviewText()}` };
  }

  function tiktokHelper() {
    qAll("button,[role='button'],label,input[type='file']").forEach((el) => {
      const t = textOf(el).toLowerCase();
      if (t.match(/upload|select file|choose file|post|publish|caption/)) el.classList.add("aria-super-highlight");
    });
    setStatus("TikTok helper: upload/caption/post controls highlighted. Final Post is manual.");
  }

  function notebookHelper() {
    qAll("button,[role='button'],a").forEach((el) => {
      const t = textOf(el).toLowerCase();
      if (t.match(/video|overview|generate|download|audio/)) el.classList.add("aria-super-highlight");
    });
    setStatus("NotebookLM helper: video/download controls highlighted. Downloads save through browser.");
  }

  async function ariaServerJson(path, payload) {
    let lastError = "";
    for (const base of ARIA_SERVER_URLS) {
      try {
        const options = payload === undefined
          ? { method: "GET" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload || {})
            };
        const response = await fetch(`${base}${path}`, options);
        const text = await response.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (err) {
          data = { message: text };
        }
        if (!response.ok) {
          lastError = data.error || data.message || `HTTP ${response.status}`;
          continue;
        }
        return data;
      } catch (err) {
        lastError = String(err && err.message || err);
      }
    }
    throw new Error(lastError || "ARIA server not reachable on port 5050.");
  }

  function latestAssistantElement() {
    const selectors = [
      "[data-message-author-role='assistant']",
      "[data-testid*='assistant' i]",
      "[data-testid*='answer' i]",
      "[data-testid*='message' i]",
      "[class*='assistant' i]",
      "[class*='answer' i]",
      "[class*='message' i]",
      "main article",
      "main .markdown",
      "article"
    ];
    const candidates = [];
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el)) return;
        const text = String(el.innerText || el.textContent || "").trim();
        if (looksLikeResponseText(text)) candidates.push(el);
      });
    });
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function cleanPromptText(raw) {
    return String(raw || "")
      .replace(/\r/g, "")
      .replace(/\b(Copy|Edit|Share|Retry|Regenerate|Like|Dislike)\b\s*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function looksLikePromptText(raw) {
    const text = cleanPromptText(raw);
    if (!text) return false;
    if (text.length > 30000) return false;
    if (/ARIA\s+(Nexus|Super|ChatGPT|ClickUp|Video|Social)/i.test(text) && /Run|Stop|Settings|Dashboard|Ready/i.test(text)) return false;
    if (/^(copy|edit|share|retry|regenerate|thumbs up|thumbs down)$/i.test(text)) return false;
    if (/^(aria nexus|aria super|aria chatgpt sender|aria clickup sender)/i.test(text)) return false;
    return true;
  }

  function promptSelectorsForKind(kind) {
    if (kind === "chatgpt") {
      return [
        "[data-message-author-role='user']",
        "[data-testid*='user-message' i]",
        "[data-testid*='conversation-turn' i] [data-message-author-role='user']"
      ];
    }
    if (kind === "claude") {
      return [
        "[data-testid*='user' i]",
        "[data-is-streaming='false'] [class*='font-user-message' i]",
        "[class*='user-message' i]"
      ];
    }
    if (kind === "clickup") {
      return [
        "[data-testid*='user' i]",
        "[class*='user' i][class*='message' i]",
        "[class*='prompt' i]"
      ];
    }
    if (kind === "cursor" || kind === "langchain") {
      return [
        "[data-testid*='user' i]",
        "[class*='user' i][class*='message' i]",
        "[class*='human' i]",
        "[class*='prompt' i]"
      ];
    }
    return [
      "[data-message-author-role='user']",
      "[data-testid*='user' i]",
      "[data-testid*='prompt' i]",
      "[data-author*='user' i]",
      "[class*='user' i][class*='message' i]",
      "[class*='human' i]",
      "[class*='prompt' i]"
    ];
  }

  function promptCandidateElements() {
    const selectors = promptSelectorsForKind(siteKind());
    const nodes = [];
    const seenNodes = new Set();
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!el || seenNodes.has(el)) return;
        if (!visible(el) || inPanel(el)) return;
        if (el.matches && el.matches("textarea,input,button,select,[contenteditable='true']")) return;
        const text = cleanPromptText(el.innerText || el.textContent || "");
        if (!looksLikePromptText(text)) return;
        seenNodes.add(el);
        nodes.push(el);
      });
    });
    return nodes.filter((el) => {
      return !nodes.some((other) => {
        if (other === el) return false;
        if (!el.contains(other)) return false;
        const otherText = cleanPromptText(other.innerText || other.textContent || "");
        return looksLikePromptText(otherText);
      });
    });
  }

  function allPromptTexts(options) {
    const opts = options || {};
    const rows = [];
    const seen = new Set();
    promptCandidateElements().forEach((el) => {
      const text = cleanPromptText(el.innerText || el.textContent || "");
      if (!looksLikePromptText(text)) return;
      const key = `${shortHash(text)}:${text.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(text);
    });
    if (!rows.length && opts.includeFallback) {
      const fallback = cleanPromptText(state.initialPrompt || nextPreviewText());
      if (looksLikePromptText(fallback)) rows.push(fallback);
    }
    return rows.slice(-120);
  }

  function latestPromptText() {
    const prompts = allPromptTexts({ includeFallback: true });
    return prompts.length ? prompts[prompts.length - 1] : "";
  }

  function formatPromptRows(rows, label) {
    return (rows || [])
      .filter(Boolean)
      .map((row, index) => `===== ${label || "Prompt"} ${index + 1} =====\n${row}`)
      .join("\n\n")
      .trim();
  }

  function buildFullPromptResponseArchive() {
    const prompts = allPromptTexts({ includeFallback: false });
    const responses = allResponseTexts();
    const total = Math.max(prompts.length, responses.length);
    const blocks = [];
    for (let i = 0; i < total; i += 1) {
      if (prompts[i]) blocks.push(`===== Prompt ${i + 1} =====\n${prompts[i]}`);
      if (responses[i]) blocks.push(`===== Response ${i + 1} =====\n${responses[i]}`);
    }
    if (!blocks.length) {
      const latestPrompt = latestPromptText();
      const latestResponse = latestResponseText({ ignoreSelection: true });
      if (latestPrompt) blocks.push(`===== Prompt 1 =====\n${latestPrompt}`);
      if (latestResponse) blocks.push(`===== Response 1 =====\n${latestResponse}`);
    }
    return blocks.join("\n\n").trim();
  }

  function chatTopic(options) {
    const opts = options || {};
    const fromPanel = String(state.wordTopic || "").trim();
    if (fromPanel && !opts.ignorePanel) return fromPanel;
    const kind = siteKind();
    const title = String(document.title || "")
      .replace(/\s*[-|]\s*(ChatGPT|Claude|Gemini|ClickUp|Cursor|LangChain)\s*$/i, "")
      .replace(/^(ChatGPT|Claude|Gemini|ClickUp|Cursor|LangChain)\s*[-|]\s*/i, "")
      .trim();
    if (title && !["chatgpt", "claude", "gemini", "clickup", "cursor", "langchain"].includes(title.toLowerCase())) return title;
    const pathPart = location.pathname.split("/").filter(Boolean).pop() || `${kind}_capture`;
    return `${kind}_${pathPart.slice(0, 40)}`;
  }

  function safeWordTopicPart(value) {
    return String(value || "capture")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 70) || "capture";
  }

  function compactDateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function freshWordTopicForCurrentTab() {
    const kind = safeWordTopicPart(siteKind());
    const base = safeWordTopicPart(chatTopic({ ignorePanel: true }));
    return `basit_${kind}_${base}_${compactDateStamp()}`.slice(0, 120);
  }

  function codeLanguage(block) {
    const className = String(block.className || "");
    const match = className.match(/language-([a-z0-9+#.-]+)/i);
    if (match) return match[1].slice(0, 40);
    const pre = block.closest && block.closest("pre");
    const header = pre && pre.parentElement ? String(pre.parentElement.innerText || "").split("\n")[0].trim() : "";
    if (header && header.length <= 40 && !header.match(/[{}();=<>]/)) return header;
    return "code";
  }

  function fencedCodeBlocksFromText(text) {
    const blocks = [];
    const pattern = /```([^\n`]*)\n([\s\S]*?)```/g;
    let match = null;
    while ((match = pattern.exec(String(text || ""))) !== null) {
      const code = String(match[2] || "").trim("\n");
      if (!code.trim()) continue;
      blocks.push({ language: String(match[1] || "code").trim() || "code", code });
    }
    return blocks;
  }

  function extractLatestCodeBlocks() {
    const container = latestAssistantElement() || document;
    const nodes = Array.from(container.querySelectorAll(codeBlockSelector())).filter((el) => {
      if (!visible(el) || inPanel(el)) return false;
      const raw = String(el.innerText || el.textContent || "").trim();
      return looksLikeCodeText(raw);
    });
    const unique = [];
    const seen = new Set();
    for (const node of nodes) {
      const raw = String(node.innerText || node.textContent || "").trim();
      const key = raw.slice(0, 500);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ language: codeLanguage(node), code: raw });
    }
    if (unique.length) return unique.slice(-30);
    return fencedCodeBlocksFromText(latestUsefulText()).slice(-30);
  }

  function lastPromptNumber() {
    ensureCounterScope();
    const value = state.runCount > 0 ? state.nextNumber + state.runCount - 1 : state.nextNumber;
    return Math.max(1, Number.parseInt(value, 10) || 1);
  }

  function latestWordSignature(responseText, codeBlocks) {
    const codeSig = (codeBlocks || []).map((block) => `${block.language || ""}:${String(block.code || "").slice(0, 800)}`).join("\n");
    return `${location.href}\n${String(responseText || "").slice(-5000)}\n${codeSig}`;
  }

  function responseWordHash(text) {
    const clean = cleanCopiedResponse(String(text || ""));
    return `${shortHash(clean)}:${clean.length}`;
  }

  function rememberWordSavedResponses(rows) {
    const existing = new Set(Array.isArray(state.wordSavedResponseHashes) ? state.wordSavedResponseHashes : []);
    (rows || []).forEach((row) => {
      const hash = responseWordHash(row);
      if (hash && hash !== "0:0") existing.add(hash);
    });
    state.wordSavedResponseHashes = Array.from(existing).slice(-260);
  }

  function unsavedResponseRows() {
    const saved = new Set(Array.isArray(state.wordSavedResponseHashes) ? state.wordSavedResponseHashes : []);
    return allResponseTexts().filter((row) => {
      const hash = responseWordHash(row);
      return hash && hash !== "0:0" && !saved.has(hash);
    });
  }

  async function sendLatestToWord(options) {
    const opts = options || {};
    try {
      readPanelInputs();
      let responseText = latestResponseText({ ignoreSelection: Boolean(opts.ignoreSelection || opts.onlyUnsavedResponse) });
      let rowsSaved = [];
      if (opts.onlyUnsavedResponse) {
        const freshRows = unsavedResponseRows();
        if (!freshRows.length) {
          const msg = "Word auto-save skipped: no new unsaved response yet.";
          if (!opts.silent) setStatus(msg);
          return { ok: true, skipped: true, message: msg };
        }
        rowsSaved = freshRows.slice(-1);
        responseText = rowsSaved[0] || responseText;
      }
      if (!rowsSaved.length && looksLikeResponseText(responseText)) rowsSaved = [responseText];
      const codeBlocks = extractLatestCodeBlocks();
      if (!responseText && !codeBlocks.length) {
        const msg = "Word save failed: no latest response/code found.";
        setStatus(msg);
        return { ok: false, error: msg };
      }
      const signature = latestWordSignature(responseText, codeBlocks);
      if (opts.avoidDuplicate && signature && signature === state.lastWordSignature) {
        const msg = "Word auto-save skipped: response already saved.";
        if (!opts.silent) setStatus(msg);
        return { ok: true, skipped: true, message: msg };
      }
      if (!opts.silent) setStatus("Saving latest ChatGPT response/code to Word...");
      const data = await ariaServerJson("/api/gpt-word/append", {
        number: lastPromptNumber(),
        prompt_text: latestPromptText(),
        response_text: responseText,
        code_blocks: codeBlocks,
        source_url: location.href,
        page_title: document.title,
        topic: chatTopic(),
        save_mode: state.wordSaveMode || "full"
      });
      state.lastWordPath = data.document_path || state.lastWordPath || "";
      if (data.success !== false) {
        state.lastWordSignature = signature;
        if (rowsSaved.length) rememberWordSavedResponses(rowsSaved);
      }
      const msg = data.message || `Saved to Word (${codeBlocks.length} code block(s)).`;
      if (!opts.silent && data.success !== false && state.wordOpenAfterSave) {
        await openWordDocument();
      }
      if (!opts.silent) setStatus(`${msg}${state.lastWordPath ? "\n" + state.lastWordPath : ""}`);
      return { ok: Boolean(data.success !== false), ...data };
    } catch (err) {
      const msg = `Word save failed: ${String(err && err.message || err)}`;
      if (!opts.silent) setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function newWordDocument() {
    try {
      readPanelInputs();
      let topic = chatTopic();
      const typed = window.prompt("Word file name/topic:", topic);
      if (typed !== null && String(typed).trim()) {
        topic = String(typed).trim();
        state.wordTopic = topic;
        syncPanelInputs();
        saveOptionsFromState();
      }
      const data = await ariaServerJson("/api/gpt-word/reset-document", { topic });
      state.lastWordPath = data.document_path || "";
      state.lastWordSignature = "";
      state.wordSavedResponseHashes = [];
      setStatus(`${data.message || "New Word document ready."}${state.lastWordPath ? "\n" + state.lastWordPath : ""}`);
      return { ok: Boolean(data.success !== false), ...data };
    } catch (err) {
      const msg = `New Word failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function resetWordForCurrentTab(options) {
    const opts = options || {};
    try {
      const topic = opts.topic || freshWordTopicForCurrentTab();
      state.wordTopic = topic;
      state.lastWordSignature = "";
      state.wordSavedResponseHashes = [];
      syncPanelInputs();
      await saveOptionsFromState();
      const data = await ariaServerJson("/api/gpt-word/reset-document", { topic });
      state.lastWordPath = data.document_path || "";
      state.lastWordSignature = "";
      state.wordSavedResponseHashes = [];
      await saveOptionsFromState();
      const ok = Boolean(data.success !== false);
      const msg = `${data.message || "Fresh Word document ready."}${state.lastWordPath ? "\n" + state.lastWordPath : ""}`;
      if (!opts.silent) setStatus(msg);
      return { ok, topic, message: msg, ...data };
    } catch (err) {
      const msg = `Fresh Word reset failed: ${String(err && err.message || err)}`;
      if (!opts.silent) setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function openWordDocument() {
    try {
      const data = await ariaServerJson("/api/gpt-word/open-document", {});
      setStatus(data.message || "Opening Word document.");
      return { ok: Boolean(data.success !== false), ...data };
    } catch (err) {
      const msg = `Open Word failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function openWordFolder() {
    try {
      const data = await ariaServerJson("/api/gpt-word/open-folder", {});
      setStatus(data.message || "Opening Word folder.");
      return { ok: Boolean(data.success !== false), ...data };
    } catch (err) {
      const msg = `Open Word folder failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function copyAndSendWord(options) {
    const opts = options || {};
    const copied = await copyLatestResponse({ allowOnce: Boolean(opts.allowOnce) });
    if (!copied.ok) return copied;
    const saved = await sendLatestToWord({ silent: true });
    if (!saved.ok) {
      const msg = `${copied.message}\n${saved.error || "Word save failed."}`;
      setStatus(msg);
      return { ok: false, error: msg, copied: true };
    }
    if (state.wordOpenAfterSave) await openWordDocument();
    const msg = `${copied.message}\n${saved.message || "Saved to Word."}${saved.document_path ? "\n" + saved.document_path : ""}`;
    setStatus(msg);
    return { ok: true, message: msg, document_path: saved.document_path || state.lastWordPath || "" };
  }

  async function sendAllResponsesToWord(options) {
    const opts = options || {};
    try {
      readPanelInputs();
      const rows = allResponseTexts();
      const codeBlocks = allCodeBlocks();
      if (!rows.length && !codeBlocks.length) {
        if (opts.allowEmpty) {
          if (state.wordOpenAfterSave || opts.forceOpen) await openWordDocument();
          const msg = `Fresh Word file is ready. No old visible responses found yet.${state.lastWordPath ? "\n" + state.lastWordPath : ""}`;
          setStatus(msg);
          return { ok: true, empty: true, message: msg, responseCount: 0, codeBlocks: 0, document_path: state.lastWordPath || "" };
        }
        const msg = "All responses -> Word failed: no visible responses/code found.";
        setStatus(msg);
        return { ok: false, error: msg };
      }
      const responseText = rows.map((row, index) => `===== Response ${index + 1} =====\n${row}`).join("\n\n");
      setStatus(`Saving all visible responses to Word. Responses: ${rows.length}, code blocks: ${codeBlocks.length}...`);
      const data = await ariaServerJson("/api/gpt-word/append", {
        number: "all",
        prompt_text: "All visible responses captured from current page.",
        response_text: responseText,
        code_blocks: codeBlocks,
        source_url: location.href,
        page_title: document.title,
        topic: chatTopic(),
        save_mode: "full"
      });
      state.lastWordPath = data.document_path || state.lastWordPath || "";
      const ok = Boolean(data.success !== false);
      if (ok) rememberWordSavedResponses(rows);
      if (ok && (state.wordOpenAfterSave || opts.forceOpen)) await openWordDocument();
      const msg = `${data.message || "Saved all visible responses to Word."}\nResponses: ${rows.length}. Code blocks: ${codeBlocks.length}.${state.lastWordPath ? "\n" + state.lastWordPath : ""}`;
      setStatus(msg);
      return { ok, message: msg, responseCount: rows.length, codeBlocks: codeBlocks.length, ...data };
    } catch (err) {
      const msg = `All responses -> Word failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  function buildLatestDesktopText() {
    const responseText = latestResponseText({ ignoreSelection: false });
    const codeBlocks = extractLatestCodeBlocks();
    const codeText = codeBlocks.length
      ? "\n\n" + codeBlocks.map((block, index) => {
          const language = block.language || "text";
          return `----- Code block ${index + 1} (${language}) -----\n${block.code || ""}`;
        }).join("\n\n")
      : "";
    const text = `${responseText || ""}${codeText}`.trim();
    if (!looksLikeResponseText(responseText) && !codeBlocks.length) {
      return { ok: false, error: "No latest response/code found." };
    }
    return { ok: true, text, responseText, codeBlocks };
  }

  function buildAllDesktopText() {
    const rows = allResponseTexts();
    const codeBlocks = allCodeBlocks();
    if (!rows.length && !codeBlocks.length) {
      return { ok: false, error: "No visible responses/code found." };
    }
    const responseText = rows.map((row, index) => `===== Response ${index + 1} =====\n${row}`).join("\n\n");
    const codeText = codeBlocks.length
      ? "\n\n===== Code Blocks =====\n" + codeBlocks.map((block, index) => {
          const language = block.language || "text";
          return `----- Code block ${index + 1} (${language}) -----\n${block.code || ""}`;
        }).join("\n\n")
      : "";
    return {
      ok: true,
      text: `${responseText}${codeText}`.trim(),
      responseCount: rows.length,
      codeBlocks
    };
  }

  function buildLatestPromptDesktopText() {
    const text = latestPromptText();
    if (!looksLikePromptText(text)) {
      return { ok: false, error: "No latest prompt found." };
    }
    return { ok: true, text, promptCount: 1 };
  }

  function buildAllPromptsDesktopText() {
    const rows = allPromptTexts({ includeFallback: true });
    if (!rows.length) {
      return { ok: false, error: "No visible prompts found." };
    }
    return {
      ok: true,
      text: formatPromptRows(rows, "Prompt"),
      promptCount: rows.length
    };
  }

  function buildFullChatDesktopText() {
    const text = buildFullPromptResponseArchive();
    if (!text) {
      return { ok: false, error: "No prompts or responses found." };
    }
    return {
      ok: true,
      text,
      promptCount: allPromptTexts({ includeFallback: false }).length,
      responseCount: allResponseTexts().length
    };
  }

  function cleanTransferText(value, maxLength) {
    const limit = Number.isFinite(Number(maxLength)) ? Number(maxLength) : 4000;
    return String(value || "")
      .replace(/\r/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, limit);
  }

  function markdownEscape(value) {
    return String(value || "").replace(/\|/g, "\\|").trim();
  }

  function selectedPageText() {
    try {
      return cleanTransferText(window.getSelection ? window.getSelection().toString() : "", 12000);
    } catch (err) {
      return "";
    }
  }

  function transferVisibleTextSnippets() {
    const selectors = [
      "main",
      "[role='main']",
      "article",
      "[data-message-author-role]",
      "[data-testid*='message' i]",
      "[class*='message' i]",
      "[class*='response' i]",
      "[class*='content' i]",
      "section"
    ];
    const rows = [];
    const seen = new Set();
    selectors.forEach((selector) => {
      qAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el)) return;
        if (el.closest && el.closest("nav,header,footer,aside,form,button,[role='button'],input,textarea,select")) return;
        const text = cleanTransferText(el.innerText || el.textContent || "", 2400);
        if (text.length < 40) return;
        if (text.match(/ARIA Nexus|ARIA Super|Run|Stop|Copy|Paste|Download|Settings/i) && text.length < 500) return;
        const key = `${shortHash(text)}:${text.length}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(text);
      });
    });
    return rows
      .filter((row, index, arr) => !arr.some((other, otherIndex) => otherIndex !== index && other.includes(row) && other.length > row.length))
      .slice(-10);
  }

  function addTransferLink(list, seen, url, label) {
    const href = absolutizeUrl(url);
    if (!href || href.startsWith("javascript:")) return;
    const key = href.replace(/#.*$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      url: href,
      label: cleanTransferText(label || href, 140)
    });
  }

  function collectTransferMedia() {
    const imageSeen = new Set();
    const videoSeen = new Set();
    const fileSeen = new Set();
    const images = [];
    const videos = [];
    const files = [];

    qAll("img").forEach((img) => {
      if (!visible(img) || inPanel(img)) return;
      const src = img.currentSrc || img.src || img.getAttribute("src");
      if (!src || String(src).startsWith("data:")) return;
      addTransferLink(images, imageSeen, src, img.alt || img.title || "visible image");
    });

    qAll("video").forEach((video) => {
      if (!visible(video) || inPanel(video)) return;
      addTransferLink(videos, videoSeen, video.currentSrc || video.src, video.getAttribute("aria-label") || "visible video");
      Array.from(video.querySelectorAll("source")).forEach((source) => {
        addTransferLink(videos, videoSeen, source.src || source.getAttribute("src"), source.type || "video source");
      });
    });

    qAll("source[src]").forEach((source) => {
      const parent = source.closest && source.closest("video,audio,picture");
      if (parent && inPanel(parent)) return;
      const src = source.src || source.getAttribute("src");
      if (String(source.type || src || "").match(/\bvideo\b|\.mp4|\.webm|\.mov|\.m4v/i)) {
        addTransferLink(videos, videoSeen, src, source.type || "video source");
      }
    });

    qAll("a[href]").forEach((link) => {
      if (!visible(link) || inPanel(link)) return;
      const href = absolutizeUrl(link.getAttribute("href"));
      const label = cleanTransferText(`${textOf(link)} ${link.getAttribute("download") || ""}`, 180);
      if (!href) return;
      const fileLike = href.match(/\.(zip|pdf|docx?|xlsx?|csv|txt|md|json|html|mp4|webm|mov|m4v|png|jpe?g|gif|webp)(?:[?#].*)?$/i);
      const labelLike = label.match(/\b(download|export|file|zip|pdf|doc|sheet|video|image|attachment|open)\b/i);
      if (fileLike || labelLike || link.hasAttribute("download")) addTransferLink(files, fileSeen, href, label || "file/link");
    });

    return {
      images: images.slice(0, 40),
      videos: videos.slice(0, 30),
      files: files.slice(0, 60)
    };
  }

  function formatTransferList(title, rows) {
    if (!rows || !rows.length) return `## ${title}\n\n(none detected)`;
    return `## ${title}\n\n` + rows.map((row, index) => {
      if (row && typeof row === "object") {
        return `${index + 1}. [${markdownEscape(row.label || row.url)}](${row.url})`;
      }
      return `### ${title.replace(/s$/, "")} ${index + 1}\n\n${String(row || "").trim()}`;
    }).join("\n\n");
  }

  function transferBundleText() {
    const prompts = allPromptTexts({ includeFallback: false });
    const responses = allResponseTexts();
    const selected = selectedPageText();
    const snippets = transferVisibleTextSnippets();
    const media = collectTransferMedia();
    const title = document.title || chatTopic();
    const lines = [
      "# ARIA App Transfer Bundle",
      "",
      `Source app: ${siteKind()}`,
      `Title: ${title}`,
      `URL: ${location.href}`,
      `Created: ${new Date().toISOString()}`,
      `Prompt count: ${prompts.length}`,
      `Response count: ${responses.length}`,
      `Images detected: ${media.images.length}`,
      `Videos detected: ${media.videos.length}`,
      `File/link count: ${media.files.length}`,
      "",
      "Use this bundle to transfer context between ChatGPT, Claude, Gemini, ClickUp, Codex, Cursor, Lovable, Bolt, WhatsApp, Notepad, Word, or another app. Review before sending.",
      "",
      selected ? `## Selected Text\n\n${selected}` : "## Selected Text\n\n(none selected)",
      "",
      formatTransferList("Prompts", prompts),
      "",
      formatTransferList("Responses", responses),
      "",
      formatTransferList("Visible Context", snippets),
      "",
      formatTransferList("Images", media.images),
      "",
      formatTransferList("Videos", media.videos),
      "",
      formatTransferList("Files / Links", media.files)
    ];
    return lines.join("\n").trim();
  }

  function transferBundleFilename() {
    return `aria_transfer_${slug(siteKind(), "app")}_${slug(chatTopic({ ignorePanel: true }), "bundle")}_${compactDateStamp()}.md`.slice(0, 180);
  }

  async function copyTransferBundle() {
    const text = transferBundleText();
    const ok = await writeClipboard(text);
    const media = collectTransferMedia();
    const msg = ok
      ? `App transfer bundle copied. Prompts: ${allPromptTexts({ includeFallback: false }).length}, responses: ${allResponseTexts().length}, images: ${media.images.length}, videos: ${media.videos.length}.`
      : "App transfer bundle copy failed: clipboard permission blocked.";
    setStatus(msg);
    return { ok: Boolean(ok), message: msg, textLength: text.length, imageCount: media.images.length, videoCount: media.videos.length };
  }

  async function pasteTransferToCurrentInput() {
    const input = findInput();
    if (!input) {
      const msg = "Transfer paste failed: no input/composer found on this page.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const text = transferBundleText();
    setInputText(input, text);
    input.classList.add("aria-super-highlight");
    const msg = "Transfer bundle pasted into current input. Review it, then send manually.";
    setStatus(msg);
    return { ok: true, message: msg, textLength: text.length };
  }

  async function pasteTransferToDesktop(options) {
    return pasteTextToDesktopApp(transferBundleText(), "ARIA app transfer bundle", options);
  }

  async function downloadTransferBundle() {
    try {
      const text = transferBundleText();
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = transferBundleFilename();
      link.style.display = "none";
      document.documentElement.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 5000);
      const msg = `Transfer Markdown downloaded: ${link.download}`;
      setStatus(msg);
      return { ok: true, message: msg, filename: link.download, textLength: text.length };
    } catch (err) {
      const msg = `Transfer download failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  function appCapabilityProfile(kind) {
    const value = String(kind || siteKind()).toLowerCase();
    const profiles = {
      chatgpt: ["reasoning", "writing", "coding help", "image prompt creation", "caption drafting"],
      claude: ["long-form writing", "coding help", "analysis", "large context review"],
      gemini: ["research", "Google ecosystem handoff", "multimodal reasoning"],
      aistudio: ["model testing", "prompt engineering", "API prototype work"],
      grok: ["social/news-aware drafting", "short-form ideation"],
      poe: ["multi-model prompt testing"],
      perplexity: ["web research", "source finding", "summaries"],
      clickup: ["project planning", "task breakdown", "coding-agent conversation", "project management"],
      codex: ["code implementation", "local file edits", "tests", "repo analysis"],
      cursor: ["editor-side coding", "refactors", "project navigation"],
      langchain: ["agent workflow design", "AI app planning", "LangChain/LangGraph implementation"],
      bolt: ["web app scaffolding", "frontend prototype generation"],
      lovable: ["web app scaffolding", "UI app generation"],
      v0: ["React UI generation", "component design"],
      replit: ["hosted coding", "quick app execution"],
      stackblitz: ["browser IDE coding"],
      codesandbox: ["browser IDE coding"],
      githubdev: ["repo editing", "code review"],
      kling: ["video generation", "video inspiration", "visual reference capture"],
      heygen: ["avatar video", "talking video", "video workflow"],
      facebook: ["social post drafting", "page/group workflow", "manual publish review"],
      instagram: ["visual caption drafting", "manual publish review"],
      linkedin: ["professional content", "company page drafting", "manual publish review"],
      x: ["short-form post/comment drafts", "giveaway helper review", "manual public actions"],
      tiktok: ["short video workflow", "caption drafts", "manual publish review"],
      whatsapp: ["chat/channel draft transfer", "manual send review"],
      notebooklm: ["source-grounded notes", "document Q&A"]
    };
    return profiles[value] || ["general web context", "copy/paste transfer", "manual review handoff"];
  }

  function visibleCreditSignals() {
    const selectors = [
      "[aria-label]",
      "[title]",
      "button",
      "a",
      "span",
      "div",
      "p",
      "li",
      "small",
      "label"
    ];
    const keyword = /\b(credit|credits|token|tokens|quota|balance|usage|remaining|left|limit|limits|rate limit|message cap|generation|generations|minutes|subscription|plan|trial|free|paid|coins|points|billing|upgrade|usage left)\b/i;
    const seen = new Set();
    const rows = [];
    for (const el of qAll(selectors.join(","))) {
      if (!visible(el) || inPanel(el)) continue;
      const text = cleanTransferText(textOf(el), 220);
      if (!text || text.length < 3 || !keyword.test(text)) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(text);
      if (rows.length >= 18) break;
    }
    return rows;
  }

  function appRouterTaskText(task) {
    return String(task || state.appRouterTask || state.pipelineTopic || state.socialTopic || state.videoTopicPrompt || "").trim();
  }

  function appRouterSnapshot(task) {
    const media = collectTransferMedia();
    const responses = allResponseTexts();
    const prompts = allPromptTexts({ includeFallback: false });
    const kind = siteKind();
    const signals = visibleCreditSignals();
    return {
      task: appRouterTaskText(task),
      site: kind,
      title: document.title || chatTopic({ ignorePanel: true }),
      url: location.href,
      capabilities: appCapabilityProfile(kind),
      creditSignals: signals,
      promptCount: prompts.length,
      responseCount: responses.length,
      imageCount: media.images.length,
      videoCount: media.videos.length,
      fileCount: media.files.length
    };
  }

  function appRoutePlanText(task) {
    const snap = appRouterSnapshot(task);
    const requestedTask = snap.task || "Use the best available app/account for this task, then transfer the output to the next tool.";
    const signals = snap.creditSignals.length
      ? snap.creditSignals.map((line) => `- ${line}`).join("\n")
      : "- No visible credits/quota/balance text detected on the current page.";
    const capabilities = snap.capabilities.map((line) => `- ${line}`).join("\n");
    const targetPrompt = [
      "You are helping continue an ARIA app-to-app workflow.",
      `Main task: ${requestedTask}`,
      `Current source app: ${snap.site}`,
      "Use the context below. Do not claim paid credits were transferred. If this app is limited, tell me the best next app/account to use and prepare a paste-ready prompt for it.",
      "Keep the next step concrete, short, and safe."
    ].join("\n");
    const lines = [
      "# ARIA Credits-Aware App Task Router",
      "",
      `Task: ${requestedTask}`,
      `Current app: ${snap.site}`,
      `Page title: ${snap.title}`,
      `URL: ${snap.url}`,
      `Created: ${new Date().toISOString()}`,
      "",
      "## Important Rule",
      "Credits, subscriptions, paid minutes, and account balance cannot be moved between apps unless the platform itself officially supports it. ARIA only transfers task context, prompts, files, and drafts between apps. Final paid/public actions stay under user control.",
      "",
      "## Current App Strengths",
      capabilities,
      "",
      "## Visible Credits / Quota / Limit Signals",
      signals,
      "",
      "## Recommended Safe Route",
      "1. Use the current app only for the work it is good at and only while its visible quota/credits allow it.",
      "2. If credits/limits appear low, copy this route plan into the next app/account instead of trying to move credits.",
      "3. Save outputs to Word, Drive, Notepad, ZIP, or the Response Vault before sending the next prompt.",
      "4. For social/video/public posting, prepare drafts and review before publishing.",
      "",
      "## Paste-Ready Target-App Prompt",
      "```text",
      targetPrompt,
      "```",
      "",
      "## Captured Context Bundle",
      transferBundleText()
    ];
    return lines.join("\n").trim();
  }

  function appRouteFilename() {
    return `aria_route_${slug(siteKind(), "app")}_${slug(chatTopic({ ignorePanel: true }), "route")}_${compactDateStamp()}.md`.slice(0, 180);
  }

  async function appRouterStatus(task) {
    const snap = appRouterSnapshot(task);
    const msg = [
      "ARIA App Router Status",
      `Task: ${snap.task || "(not set)"}`,
      `Current app: ${snap.site}`,
      `Strengths: ${snap.capabilities.join(", ")}`,
      `Visible credit/limit signals: ${snap.creditSignals.length}`,
      `Captured context: prompts ${snap.promptCount}, responses ${snap.responseCount}, images ${snap.imageCount}, videos ${snap.videoCount}, files ${snap.fileCount}`,
      "Note: ARIA cannot transfer paid credits between apps. It can transfer context and prepare the safest next prompt."
    ].join("\n");
    setStatus(msg);
    return { ok: true, message: msg, ...snap };
  }

  async function copyAppRoutePlan(task) {
    const text = appRoutePlanText(task);
    const ok = await writeClipboard(text);
    const msg = ok
      ? "Credits-aware app route plan copied. Paste it into the target app/account you want to use next."
      : "Route plan copy failed: clipboard permission blocked.";
    setStatus(msg);
    return { ok: Boolean(ok), message: msg, textLength: text.length };
  }

  async function pasteAppRouteToCurrentInput(task) {
    const input = findInput();
    if (!input) {
      const msg = "Route paste failed: no input/composer found on this page.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const text = appRoutePlanText(task);
    setInputText(input, text);
    input.classList.add("aria-super-highlight");
    const msg = "Credits-aware route plan pasted into current input. Review it, then send manually.";
    setStatus(msg);
    return { ok: true, message: msg, textLength: text.length };
  }

  async function pasteAppRouteToDesktop(options, task) {
    return pasteTextToDesktopApp(appRoutePlanText(task), "ARIA credits-aware app route plan", options);
  }

  async function downloadAppRoutePlan(task) {
    try {
      const text = appRoutePlanText(task);
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = appRouteFilename();
      link.style.display = "none";
      document.documentElement.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 5000);
      const msg = `Credits-aware route Markdown downloaded: ${link.download}`;
      setStatus(msg);
      return { ok: true, message: msg, filename: link.download, textLength: text.length };
    } catch (err) {
      const msg = `Route download failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function pasteTextToDesktopApp(text, label, options) {
    const opts = options || {};
    const content = String(text || "").trim();
    if (!content) {
      const msg = "Desktop paste failed: no response text found.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const delaySource = opts.delay_seconds !== undefined ? opts.delay_seconds : state.desktopPasteDelay;
    const delaySeconds = Number.isFinite(Number(delaySource)) ? Math.max(0, Number(delaySource)) : 3;
    const targetApp = String(opts.target_app || state.desktopTarget || "focused").trim().toLowerCase();
    const openApp = opts.open_app !== undefined ? Boolean(opts.open_app) : Boolean(state.desktopOpenTarget);
    const targetLabel = targetApp && targetApp !== "focused" ? targetApp : "focused app";
    const msg = openApp && targetApp && targetApp !== "focused"
      ? `Opening ${targetLabel} and pasting the captured text...`
      : `Desktop paste armed. Focus Notepad, Word, VS Code, Codex, Cursor, or any editor in ${delaySeconds}s.`;
    setStatus(msg);
    try {
      const data = await ariaServerJson("/api/desktop-paste/paste-text", {
        text: content,
        label: label || "ARIA response",
        source_url: location.href,
        page_title: document.title,
        platform: siteKind(),
        delay_seconds: delaySeconds,
        target_app: targetApp,
        open_app: openApp
      });
      const ok = Boolean(data.success !== false);
      const finalMsg = data.message || msg;
      setStatus(finalMsg);
      return { ok, message: finalMsg, textLength: content.length, ...data };
    } catch (err) {
      const error = `Desktop paste failed: ${String(err && err.message || err)}`;
      setStatus(error);
      return { ok: false, error };
    }
  }

  async function pasteLatestToDesktop(options) {
    const built = buildLatestDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for desktop paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "latest response", options);
  }

  async function pasteAllResponsesToDesktop(options) {
    const built = buildAllDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for desktop paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "all visible responses", options);
  }

  async function pasteLatestPromptToDesktop(options) {
    const built = buildLatestPromptDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for desktop paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "latest prompt", options);
  }

  async function pasteAllPromptsToDesktop(options) {
    const built = buildAllPromptsDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for desktop paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "all visible prompts", options);
  }

  async function pasteFullChatToDesktop(options) {
    const built = buildFullChatDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for desktop paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "full prompt/response archive", options);
  }

  async function pasteLatestToNotepad() {
    const built = buildLatestDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for Notepad paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "latest response to Notepad", {
      target_app: "notepad",
      open_app: true,
      delay_seconds: 1
    });
  }

  async function pasteAllResponsesToNotepad() {
    const built = buildAllDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for Notepad paste.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return pasteTextToDesktopApp(built.text, "all visible responses to Notepad", {
      target_app: "notepad",
      open_app: true,
      delay_seconds: 1
    });
  }

  async function openGoogleDocsWithClipboard(text, label) {
    const content = String(text || "").trim();
    if (!content) {
      const msg = "Google Docs handoff failed: no response text found.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const copied = await writeClipboard(content);
    window.open("https://docs.new", "_blank", "noopener,noreferrer");
    const msg = copied
      ? `${label || "Response"} copied. Google Docs opened in a new tab; click the document body and press Ctrl+V if it is not pasted automatically.`
      : `Google Docs opened, but clipboard copy was blocked. Use Copy Response first, then paste in the document.`;
    setStatus(msg);
    return { ok: Boolean(copied), message: msg, textLength: content.length };
  }

  async function openLatestInGoogleDocs() {
    const built = buildLatestDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for Google Docs.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return openGoogleDocsWithClipboard(built.text, "Latest response");
  }

  async function openAllInGoogleDocs() {
    const built = buildAllDesktopText();
    if (!built.ok) {
      const msg = `${built.error} for Google Docs.`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    return openGoogleDocsWithClipboard(built.text, "All visible responses");
  }

  function driveCaptureTitle(label) {
    const typed = String(state.driveTitle || "").trim();
    const topic = String(state.wordTopic || "").trim();
    const base = typed || topic || chatTopic() || document.title || siteKind();
    return `${base} - ${label || "capture"}`;
  }

  function rememberDriveSavedResponses(rows) {
    const existing = new Set(Array.isArray(state.driveSavedResponseHashes) ? state.driveSavedResponseHashes : []);
    (rows || []).forEach((row) => {
      const hash = responseWordHash(row);
      if (hash && hash !== "0:0") existing.add(hash);
    });
    state.driveSavedResponseHashes = Array.from(existing).slice(-260);
  }

  function unsavedDriveRows() {
    const saved = new Set(Array.isArray(state.driveSavedResponseHashes) ? state.driveSavedResponseHashes : []);
    return allResponseTexts().filter((row) => {
      const hash = responseWordHash(row);
      return hash && hash !== "0:0" && !saved.has(hash);
    });
  }

  async function saveLatestToDrive(options) {
    const opts = options || {};
    try {
      readPanelInputs();
      let responseText = latestResponseText({ ignoreSelection: Boolean(opts.ignoreSelection || opts.onlyUnsavedResponse) });
      let rowsSaved = [];
      if (opts.onlyUnsavedResponse) {
        const freshRows = unsavedDriveRows();
        if (!freshRows.length) {
          const msg = "Drive auto-save skipped: no new unsaved response yet.";
          if (!opts.silent) setStatus(msg);
          return { ok: true, skipped: true, message: msg };
        }
        rowsSaved = freshRows.slice(-1);
        responseText = rowsSaved[0] || responseText;
      }
      if (!rowsSaved.length && looksLikeResponseText(responseText)) rowsSaved = [responseText];
      const codeBlocks = extractLatestCodeBlocks();
      if (!responseText && !codeBlocks.length) {
        const msg = "Drive save failed: no latest response/code found.";
        if (!opts.silent) setStatus(msg);
        return { ok: false, error: msg };
      }
      const codeText = codeBlocks.length ? formatCodeBlocksForCodex(codeBlocks, "Code block") : "";
      const content = `${responseText || ""}${codeText}`;
      if (!opts.silent) setStatus("Saving latest response to Google Drive backup...");
      const data = await ariaServerJson("/api/drive/save-text", {
        title: driveCaptureTitle(`response ${lastPromptNumber() || state.runCount || "latest"}`),
        content,
        source_url: location.href,
        platform: siteKind(),
        ext: "md",
        subfolder: "ARIA_Auto_Saves"
      });
      const ok = Boolean(data.success !== false);
      if (ok && rowsSaved.length) rememberDriveSavedResponses(rowsSaved);
      const msg = `${data.message || "Saved to Google Drive backup."}${data.path ? "\n" + data.path : ""}`;
      if (!opts.silent) setStatus(msg);
      return { ok, message: msg, ...data };
    } catch (err) {
      const msg = `Drive save failed: ${String(err && err.message || err)}`;
      if (!opts.silent) setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function saveAllResponsesToDrive() {
    try {
      readPanelInputs();
      const rows = allResponseTexts();
      const codeBlocks = allCodeBlocks();
      if (!rows.length && !codeBlocks.length) {
        const msg = "All responses -> Drive failed: no visible responses/code found.";
        setStatus(msg);
        return { ok: false, error: msg };
      }
      const responseText = rows.map((row, index) => `===== Response ${index + 1} =====\n${row}`).join("\n\n");
      const codeText = formatCodeBlocksForCodex(codeBlocks, "Code block");
      setStatus(`Saving all visible responses to Google Drive backup. Responses: ${rows.length}, code blocks: ${codeBlocks.length}...`);
      const data = await ariaServerJson("/api/drive/save-text", {
        title: driveCaptureTitle("all visible responses"),
        content: `${responseText}${codeText}`,
        source_url: location.href,
        platform: siteKind(),
        ext: "md",
        subfolder: "ARIA_Auto_Saves"
      });
      const ok = Boolean(data.success !== false);
      if (ok) rememberDriveSavedResponses(rows);
      const msg = `${data.message || "Saved all visible responses to Google Drive backup."}\nResponses: ${rows.length}. Code blocks: ${codeBlocks.length}.${data.path ? "\n" + data.path : ""}`;
      setStatus(msg);
      return { ok, message: msg, responseCount: rows.length, codeBlocks: codeBlocks.length, ...data };
    } catch (err) {
      const msg = `All responses -> Drive failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function openDriveFolder() {
    try {
      const data = await ariaServerJson("/api/drive/open-folder", {});
      setStatus(data.message || "Opening Google Drive backup folder.");
      return { ok: Boolean(data.success !== false), ...data };
    } catch (err) {
      const msg = `Open Drive folder failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  async function driveStatus() {
    try {
      const data = await ariaServerJson("/api/drive/status");
      const msg = [
        data.sync_ready ? "Google Drive folder detected." : "Google Drive Desktop not detected, using local fallback backup.",
        `Folder: ${data.target_dir || ""}`,
        `Saves: ${data.saves || 0}`,
        `Last: ${data.last_saved_path || "none"}`
      ].join("\n");
      setStatus(msg);
      return { ok: Boolean(data.success !== false), message: msg, ...data };
    } catch (err) {
      const msg = `Drive status failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  function codingContextPayload(content, label) {
    return {
      content,
      source_url: location.href,
      page_title: `${document.title || siteKind()} - ${label}`,
      scope_id: counterScope(),
      run_count: state.runCount
    };
  }

  function formatCodeBlocksForCodex(codeBlocks, prefix) {
    return (codeBlocks || []).map((block, index) => {
      const lang = block.language || "text";
      const label = prefix || "Code block";
      return `\n\n===== ${label} ${index + 1} (${lang}) =====\n\`\`\`${lang}\n${block.code || ""}\n\`\`\``;
    }).join("");
  }

  function rememberCodexSavedResponses(rows) {
    const existing = new Set(Array.isArray(state.codexSavedResponseHashes) ? state.codexSavedResponseHashes : []);
    (rows || []).forEach((row) => {
      const hash = responseWordHash(row);
      if (hash && hash !== "0:0") existing.add(hash);
    });
    state.codexSavedResponseHashes = Array.from(existing).slice(-260);
  }

  function unsavedCodexRows() {
    const saved = new Set(Array.isArray(state.codexSavedResponseHashes) ? state.codexSavedResponseHashes : []);
    return allResponseTexts().filter((row) => {
      const hash = responseWordHash(row);
      return hash && hash !== "0:0" && !saved.has(hash);
    });
  }

  async function saveCodexContext(content, label, options) {
    const opts = options || {};
    const saved = await ariaServerJson("/api/chatgpt/save-coding-context", codingContextPayload(content, label));
    const ok = Boolean(saved.success !== false);
    const msg = saved.message || "Context saved and copied for Codex.";
    if (!opts.silent) setStatus(msg);
    return { ...saved, ok, message: msg };
  }

  async function openCodexWithContext(content, label) {
    const saved = await saveCodexContext(content, label, { silent: true });
    const opened = await ariaServerJson("/api/coding-tools/open-target", { target: "codex" });
    const msg = [
      saved.message || "Context saved and copied.",
      opened.message || "Codex opened.",
      "Agar Codex input mein text na aaye to Ctrl+V press kar dein."
    ].join("\n");
    setStatus(msg);
    return { ok: Boolean(saved.ok && opened.success !== false), message: msg, saved, opened, ...currentStatus() };
  }

  function codingTargetName(target) {
    const value = String(target || "codex").trim().toLowerCase();
    if (value === "vscode" || value === "vs code" || value === "code") return "VS Code";
    if (value === "cursor") return "Cursor";
    if (value === "claude") return "Claude";
    if (value === "chatgpt") return "ChatGPT";
    if (value === "gemini") return "Gemini";
    if (value === "clickup") return "ClickUp";
    return "Codex";
  }

  function selectedCodingTarget(target) {
    return String(target || state.codingTarget || "codex").trim().toLowerCase() || "codex";
  }

  async function openSelectedCodingTarget(target) {
    const selected = selectedCodingTarget(target);
    const targetName = codingTargetName(selected);
    try {
      const opened = await ariaServerJson("/api/coding-tools/open-target", { target: selected });
      const msg = opened.message || `${targetName} opened.`;
      setStatus(msg);
      return { ok: Boolean(opened.success !== false), message: msg, opened, ...currentStatus() };
    } catch (err) {
      const msg = `Open ${targetName} failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
  }

  async function saveLatestToCodexBridge(options) {
    const opts = options || {};
    const target = selectedCodingTarget(opts.target || "codex");
    const targetName = codingTargetName(target);
    try {
      readPanelInputs();
      let responseText = latestResponseText({ ignoreSelection: Boolean(opts.ignoreSelection || opts.onlyUnsavedResponse) });
      let rowsSaved = [];
      if (opts.onlyUnsavedResponse) {
        const freshRows = unsavedCodexRows();
        if (!freshRows.length) {
          const msg = "Codex bridge auto-save skipped: no new unsaved response yet.";
          if (!opts.silent) setStatus(msg);
          return { ok: true, skipped: true, message: msg };
        }
        rowsSaved = freshRows.slice(-1);
        responseText = rowsSaved[0] || responseText;
      }
      if (!rowsSaved.length && looksLikeResponseText(responseText)) rowsSaved = [responseText];
      const codeBlocks = extractLatestCodeBlocks();
      const codeText = formatCodeBlocksForCodex(codeBlocks, "Code block");
      const content = cleanCopiedResponse(`${responseText || ""}${codeText}`);
      if (!looksLikeResponseText(content)) {
        const msg = "Codex bridge save failed: no latest response/code found.";
        if (!opts.silent) setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      const signature = latestWordSignature(responseText, codeBlocks);
      if (opts.avoidDuplicate && signature && signature === state.lastCodexSignature) {
        const msg = "Codex bridge auto-save skipped: response already saved.";
        if (!opts.silent) setStatus(msg);
        return { ok: true, skipped: true, message: msg };
      }
      const saved = await saveCodexContext(content, "latest-response", { silent: true });
      if (saved.ok) {
        state.lastCodexSignature = signature;
        if (rowsSaved.length) rememberCodexSavedResponses(rowsSaved);
      }
      let opened = null;
      if (opts.openAfterSave) opened = await ariaServerJson("/api/coding-tools/open-target", { target });
      const msg = [
        saved.message || `Latest response saved to ${targetName} bridge.`,
        opts.openAfterSave ? (opened && opened.message || `${targetName} opened.`) : `${targetName} bridge ready for next handoff.`
      ].join("\n");
      if (!opts.silent) setStatus(msg);
      return { ok: saved.ok && (!opened || opened.success !== false), message: msg, saved, opened, ...currentStatus() };
    } catch (err) {
      const msg = `Latest -> ${targetName} failed: ${String(err && err.message || err)}`;
      if (!opts.silent) setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
  }

  async function sendLatestToCodex() {
    return saveLatestToCodexBridge({ openAfterSave: true, ignoreSelection: true });
  }

  async function sendLatestToVSCode() {
    return saveLatestToCodexBridge({ openAfterSave: true, ignoreSelection: true, target: "vscode" });
  }

  async function sendLatestToCodingTarget(target) {
    return saveLatestToCodexBridge({ openAfterSave: true, ignoreSelection: true, target: selectedCodingTarget(target) });
  }

  async function saveAllResponsesToCodexBridge(options) {
    const opts = options || {};
    const target = selectedCodingTarget(opts.target || "codex");
    const targetName = codingTargetName(target);
    try {
      readPanelInputs();
      const rows = allResponseTexts();
      const codeBlocks = allCodeBlocks();
      if (!rows.length && !codeBlocks.length) {
        const msg = "All -> Codex failed: no visible responses/code found.";
        if (!opts.silent) setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      const responseText = rows.map((row, index) => `===== Response ${index + 1} =====\n${row}`).join("\n\n");
      const codeText = formatCodeBlocksForCodex(codeBlocks, "Code block");
      const content = `${responseText}${codeText}`.trim();
      const saved = await saveCodexContext(content, "all-responses", { silent: true });
      if (saved.ok) {
        rememberCodexSavedResponses(rows);
        state.lastCodexSignature = shortHash(content) + ":" + content.length;
      }
      let opened = null;
      if (opts.openAfterSave) opened = await ariaServerJson("/api/coding-tools/open-target", { target });
      const msg = [
        saved.message || `All responses saved to ${targetName} bridge.`,
        `Responses: ${rows.length}. Code blocks: ${codeBlocks.length}.`,
        opts.openAfterSave ? (opened && opened.message || `${targetName} opened.`) : `${targetName} bridge ready.`
      ].join("\n");
      if (!opts.silent) setStatus(msg);
      return { ok: saved.ok && (!opened || opened.success !== false), message: msg, responseCount: rows.length, codeBlocks: codeBlocks.length, saved, opened, ...currentStatus() };
    } catch (err) {
      const msg = `All -> ${targetName} failed: ${String(err && err.message || err)}`;
      if (!opts.silent) setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
  }

  async function sendAllResponsesToCodex() {
    return saveAllResponsesToCodexBridge({ openAfterSave: true });
  }

  async function sendAllResponsesToVSCode() {
    return saveAllResponsesToCodexBridge({ openAfterSave: true, target: "vscode" });
  }

  async function sendAllResponsesToCodingTarget(target) {
    return saveAllResponsesToCodexBridge({ openAfterSave: true, target: selectedCodingTarget(target) });
  }

  async function pullCodexOutboxToInput(options) {
    const opts = options || {};
    try {
      readPanelInputs();
      ensureCounterScope();
      const cooldown = limitGuardCheck();
      if (cooldown.active) {
        const msg = limitCooldownMessage(cooldown);
        setStatus(msg);
        return { ok: false, cooldown: true, error: msg, ...currentStatus() };
      }
      const data = await ariaServerJson("/api/coding-tools/outbox/next", { consume: true });
      if (!data || data.success === false || !data.content) {
        const msg = data && data.message ? data.message : "Codex -> GPT outbox is empty.";
        setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      const input = findInput();
      if (!input) {
        const msg = "Codex -> GPT failed: input box not found on this tab.";
        setStatus(msg);
        return { ok: false, error: msg, ...currentStatus() };
      }
      setInputText(input, data.content);
      await new Promise((resolve) => setTimeout(resolve, 450));
      let sent = false;
      if (opts.sendNow) {
        sent = await sendInput(input);
        if (sent) {
          state.lastSendAt = Date.now();
          state.promptSent = true;
          saveState();
        }
      }
      const msg = [
        opts.sendNow && sent ? "Codex outbox prompt sent to this GPT tab." : "Codex outbox prompt filled into this tab.",
        data.item && data.item.filename ? `File: ${data.item.filename}` : "",
        `Chars: ${String(data.content || "").length}`,
        `Outbox remaining: ${data.outbox_count || 0}`
      ].filter(Boolean).join("\n");
      setStatus(msg);
      return { ok: true, message: msg, sent, ...currentStatus() };
    } catch (err) {
      const msg = `Codex -> GPT failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
  }

  async function sendWordDocToTarget(target) {
    const selected = selectedCodingTarget(target);
    const targetName = codingTargetName(selected);
    try {
      const data = await ariaServerJson("/api/coding-tools/word-to-codex", { target: selected });
      const msg = data.message || `Word document copied and ${targetName} opened.`;
      setStatus(`${msg}${data.path ? "\n" + data.path : ""}`);
      return { ok: Boolean(data.success !== false), message: msg, ...data, ...currentStatus() };
    } catch (err) {
      const msg = `Word -> ${targetName} failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg, ...currentStatus() };
    }
  }

  async function sendWordDocToCodex() {
    return sendWordDocToTarget("codex");
  }

  async function sendWordDocToVSCode() {
    return sendWordDocToTarget("vscode");
  }

  async function sendWordDocToCodingTarget(target) {
    return sendWordDocToTarget(selectedCodingTarget(target));
  }

  async function basitWordAutopilot(options) {
    const opts = options || {};
    try {
      readPanelInputs();
      const freshWord = await resetWordForCurrentTab({ silent: true });
      if (!freshWord.ok) {
        const msg = freshWord.error || freshWord.message || "Fresh Word document could not be created.";
        setStatus(msg);
        return { ok: false, error: msg, ...freshWord };
      }
      state.responseCopyAllowed = true;
      state.autoWordSave = true;
      state.driveAutoSave = true;
      if (!state.driveTitle) state.driveTitle = freshWord.topic || chatTopic();
      if (opts.codex) state.autoCodexSave = true;
      state.wordOpenAfterSave = true;
      state.sendMode = "numbers";
      syncPanelInputs();
      await saveOptionsFromState();
      const allSaved = await sendAllResponsesToWord({ forceOpen: true, allowEmpty: true });
      if (allSaved && allSaved.ok === false) return allSaved;
      if (!(allSaved && allSaved.empty)) {
        await saveAllResponsesToDrive();
      }
      let codexSaved = null;
      if (opts.codex) {
        codexSaved = await saveAllResponsesToCodexBridge({ silent: true });
      }
      state.lastSendAt = 0;
      start(null, false);
      scheduleAutoWordSave(3500);
      scheduleAutoDriveSave(3700);
      if (opts.sendNow) {
        clearTimeout(state.timer);
        setTimeout(() => tick(), 250);
      }
      const msg = [
        opts.codex ? "Basit Word + Codex automation ON." : opts.sendNow ? "Basit Word full run ON." : "Basit Word automation ON.",
        `Fresh Word file created for this tab: ${freshWord.topic || chatTopic()}`,
        allSaved && allSaved.empty ? "No old visible responses found yet; Word is open and next completed response will be pasted." : "Old visible responses saved to the fresh Word file and Word opened.",
        "Google Drive backup is ON for this tab.",
        opts.codex ? (codexSaved && codexSaved.ok ? "Old visible responses also saved to Codex bridge." : "Codex bridge will capture the next completed response.") : "",
        `Next number: ${nextPreviewText()}`,
        opts.sendNow ? "ARIA abhi next number send karne ki koshish karega." : "Ab response complete hoga to ARIA next number bhejne se pehle latest response Word mein save karega."
      ].filter(Boolean).join("\n");
      setStatus(msg);
      return { ok: true, message: msg, document_path: state.lastWordPath || "" };
    } catch (err) {
      const msg = `Basit Word automation failed: ${String(err && err.message || err)}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
  }

  function codeBlockText(block, index) {
    const raw = String(block.innerText || block.textContent || "").trim();
    if (!raw) return "";
    const header = block.closest("[data-testid], article, pre, div") || block;
    const label = textOf(header).split("\n")[0].slice(0, 80);
    return `----- code block ${index + 1}${label ? " | " + label : ""} -----\n${raw}`;
  }

  async function copyCodeBlocks() {
    const blocks = qAll("pre code, pre, [class*='code'], [data-testid*='code']").filter((el) => {
      if (!visible(el) || inPanel(el)) return false;
      const raw = String(el.innerText || el.textContent || "").trim();
      return raw.length >= 20 && raw.match(/[{}();=<>]|import |export |function |class |const |let |def |SELECT |#!/);
    });
    const unique = [];
    const seen = new Set();
    for (const block of blocks) {
      const raw = String(block.innerText || block.textContent || "").trim();
      const key = raw.slice(0, 300);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(block);
    }
    if (!unique.length) {
      const msg = "No visible code blocks found.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const latest = unique.slice(-20);
    const output = latest.map(codeBlockText).join("\n\n");
    try {
      await navigator.clipboard.writeText(output);
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = output;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    const msg = `Copied ${latest.length} code block(s) to clipboard.`;
    setStatus(msg);
    return { ok: true, message: msg, count: latest.length };
  }

  function codeVaultSimpleHash(text) {
    let hash = 2166136261;
    const value = String(text || "");
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function codeVaultSafeSegment(value, fallback) {
    return String(value || fallback || "snippet")
      .replace(/[<>:"|?*\u0000-\u001f]/g, "")
      .replace(/\\/g, "/")
      .replace(/\/{2,}/g, "/")
      .replace(/^\.+/, "")
      .trim()
      .slice(0, 160) || fallback || "snippet";
  }

  function codeVaultProject() {
    const base = state.wordTopic || state.pipelineTopic || chatTopic({ fallback: document.title || siteKind() }) || siteKind();
    return codeVaultSafeSegment(base, "aria-code-vault")
      .replace(/[\/.]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "aria-code-vault";
  }

  function codeVaultLanguageFrom(code, className) {
    const cls = String(className || "").toLowerCase();
    const tagged = cls.match(/language-([a-z0-9+#-]+)/) || cls.match(/lang-([a-z0-9+#-]+)/);
    if (tagged) return tagged[1].replace("javascript", "js").replace("typescript", "ts");
    const text = String(code || "");
    if (/^\s*<(!doctype|html|div|script|style|section|main|body)[\s>]/i.test(text)) return "html";
    if (/\b(import|export)\s+.*\bfrom\b|=>|React|useState|tsx/i.test(text)) return text.includes("<") && text.includes("/>") ? "tsx" : "ts";
    if (/\b(def|import|from|async def|class)\b.*:/.test(text) || /if __name__\s*==/.test(text)) return "py";
    if (/\b(function|const|let|var|document\.|window\.|chrome\.)\b/.test(text)) return "js";
    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\b/i.test(text)) return "sql";
    if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(text)) return "json";
    if (/\b(public class|private static|System\.out|package\s+[\w.]+;)/.test(text)) return "java";
    if (/\b(fn main|let mut|impl |use std::)/.test(text)) return "rs";
    if (/^\s*#include\s+</.test(text)) return "cpp";
    if (/^\s*#!/.test(text)) return "sh";
    return "txt";
  }

  function codeVaultFilenameFrom(code, language, index) {
    const text = String(code || "");
    const explicit = text.match(/(?:file|filename|path)\s*[:=]\s*["'`]?([A-Za-z0-9_./\\ -]+\.[A-Za-z0-9]+)["'`]?/i) ||
      text.match(/^\s*(?:\/\/|#|<!--)\s*([A-Za-z0-9_./\\ -]+\.[A-Za-z0-9]+)\s*(?:-->)?/m) ||
      text.match(/^\s*(?:Update|Create|Replace)\s+([A-Za-z0-9_./\\ -]+\.[A-Za-z0-9]+)\b/im);
    if (explicit && explicit[1]) return codeVaultSafeSegment(explicit[1], `snippet_${index + 1}.${language}`);
    const extMap = {
      js: "js", jsx: "jsx", ts: "ts", tsx: "tsx", py: "py", html: "html", css: "css",
      json: "json", sql: "sql", sh: "sh", bash: "sh", rs: "rs", cpp: "cpp", c: "c",
      java: "java", md: "md", txt: "txt"
    };
    return `snippet_${String(index + 1).padStart(3, "0")}.${extMap[language] || "txt"}`;
  }

  function codeVaultLooksLikeCode(text) {
    const value = String(text || "").trim();
    if (value.length < 24 || value.length > 220000) return false;
    if (isNoiseResponseText(value)) return false;
    const lines = value.split("\n").filter(Boolean);
    if (lines.length < 2 && value.length < 120) return false;
    return /[{}()[\];=<>]|^\s*(import|export|from|def|class|function|const|let|var|SELECT|CREATE|#include|package|<\w+)/mi.test(value);
  }

  function collectVisibleCodeVaultFiles() {
    const selectors = [
      "pre code",
      "pre",
      "code",
      "[class*='language-']",
      "[class*='code-block']",
      "[data-testid*='code']",
      ".cm-content",
      ".monaco-editor .view-lines"
    ];
    const blocks = qAll(selectors.join(",")).filter((el) => visible(el) && !inPanel(el));
    const files = [];
    const seen = new Set();
    blocks.forEach((block) => {
      const raw = String(block.innerText || block.textContent || "").trim();
      if (!codeVaultLooksLikeCode(raw)) return;
      const key = codeVaultSimpleHash(raw);
      if (seen.has(key)) return;
      seen.add(key);
      const language = codeVaultLanguageFrom(raw, block.className || "");
      files.push({
        project: codeVaultProject(),
        filename: codeVaultFilenameFrom(raw, language, files.length),
        language,
        code: raw,
        hash: codeVaultSimpleHash(`${location.href}\n${raw}`),
        platform: siteKind(),
        sourceUrl: location.href,
        title: document.title,
        createdAt: Date.now()
      });
    });
    return files.slice(-80);
  }

  async function saveVisibleCodeToVault(options) {
    const opts = options || {};
    const files = collectVisibleCodeVaultFiles().filter((file) => {
      if (opts.manual) return true;
      if (codeVaultSessionHashes.has(file.hash)) return false;
      return true;
    });
    if (!files.length) {
      const msg = opts.manual ? "No visible code blocks found for Code Vault." : "Code vault scan: no new visible code.";
      if (opts.manual) setStatus(msg);
      return { ok: false, skipped: true, error: msg };
    }
    files.forEach((file) => codeVaultSessionHashes.add(file.hash));
    const reply = await sendRuntime({ type: "ARIA_SUPER_CODE_VAULT_SAVE_MANY", files });
    const msg = reply && reply.ok
      ? `${reply.message || "Code vault saved."}\nProject: ${codeVaultProject()}\nUse Code ZIP to download all saved files.`
      : `Code vault save failed: ${reply && reply.error ? reply.error : "unknown error"}`;
    if (!opts.silent) setStatus(msg);
    return reply && reply.ok ? { ...reply, message: msg } : { ok: false, error: msg };
  }

  async function downloadCodeVaultZip() {
    const project = codeVaultProject();
    const reply = await sendRuntime({ type: "ARIA_SUPER_CODE_VAULT_DOWNLOAD_ZIP", project, structure: "by-project" });
    const msg = reply && reply.ok
      ? `Code ZIP download started.\n${reply.filename || ""}\nProject: ${project}`
      : `Code ZIP failed: ${reply && reply.error ? reply.error : "Save visible code first."}`;
    setStatus(msg);
    return reply && reply.ok ? { ...reply, message: msg } : { ok: false, error: msg };
  }

  async function codeVaultStatus() {
    const reply = await sendRuntime({ type: "ARIA_SUPER_CODE_VAULT_STATS" });
    if (!reply || !reply.ok) {
      const msg = `Code vault status failed: ${reply && reply.error ? reply.error : "unknown error"}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const latest = (reply.latest || []).slice(0, 6).map((file) => `- ${file.project}/${file.filename}`).join("\n");
    const msg = `Code Vault ready.\nFiles: ${reply.fileCount || 0}\nProjects: ${reply.projectCount || 0}\nCurrent project: ${codeVaultProject()}${latest ? "\nLatest:\n" + latest : ""}`;
    setStatus(msg);
    return { ok: true, message: msg };
  }

  async function latestCodeVaultFile() {
    const project = codeVaultProject();
    let reply = await sendRuntime({ type: "ARIA_SUPER_CODE_VAULT_LIST", project });
    if (!reply || !reply.ok || !Array.isArray(reply.files) || !reply.files.length) {
      reply = await sendRuntime({ type: "ARIA_SUPER_CODE_VAULT_LIST" });
    }
    if (!reply || !reply.ok) {
      return { ok: false, error: reply && reply.error ? reply.error : "Code Vault list failed." };
    }
    const files = Array.isArray(reply.files) ? reply.files.slice() : [];
    files.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!files.length) return { ok: false, error: "Code Vault empty. Save visible code first." };
    return { ok: true, file: files[0] };
  }

  function codeVaultPromptForFile(file) {
    const language = String(file.language || "text").replace(/[^A-Za-z0-9+#-]/g, "") || "text";
    const filename = String(file.filename || "snippet.txt");
    const project = String(file.project || "aria-code-vault");
    const sourceUrl = String(file.sourceUrl || "");
    const code = String(file.code || "").trim();
    return [
      "Use this saved ARIA Code Vault file in the current project.",
      "",
      `Project: ${project}`,
      `Filename: ${filename}`,
      sourceUrl ? `Source: ${sourceUrl}` : "",
      "",
      `\`\`\`${language}`,
      code,
      "```"
    ].filter(Boolean).join("\n");
  }

  async function copyLatestCodeVaultFile() {
    const latest = await latestCodeVaultFile();
    if (!latest.ok) {
      const msg = `Copy latest code failed: ${latest.error}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const text = codeVaultPromptForFile(latest.file);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    const msg = `Copied latest Code Vault file.\n${latest.file.project}/${latest.file.filename}`;
    setStatus(msg);
    return { ok: true, message: msg, file: latest.file };
  }

  async function pasteLatestCodeVaultFile(options) {
    const opts = options || {};
    const latest = await latestCodeVaultFile();
    if (!latest.ok) {
      const msg = `Vault -> input failed: ${latest.error}`;
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const input = findInput();
    if (!input) {
      const msg = "Vault -> input failed: no chat/input box found on this page.";
      setStatus(msg);
      return { ok: false, error: msg };
    }
    const text = codeVaultPromptForFile(latest.file);
    setInputText(input, text);
    if (opts.sendNow) {
      const sent = await sendInput(input);
      if (!sent) {
        const msg = `Latest Code Vault file pasted, but send button was not ready.\n${latest.file.project}/${latest.file.filename}`;
        setStatus(msg);
        return { ok: true, sent: false, message: msg, file: latest.file };
      }
    }
    const msg = `${opts.sendNow ? "Sent" : "Pasted"} latest Code Vault file.\n${latest.file.project}/${latest.file.filename}`;
    setStatus(msg);
    return { ok: true, sent: Boolean(opts.sendNow), message: msg, file: latest.file };
  }

  async function toggleCodeVaultAutoScan() {
    const enabled = localStorage.getItem(CODE_VAULT_SCAN_KEY) === "1";
    localStorage.setItem(CODE_VAULT_SCAN_KEY, enabled ? "0" : "1");
    const msg = enabled
      ? "Auto code scan OFF for this tab."
      : "Auto code scan ON. ARIA will save new visible code blocks while this tab is open.";
    setStatus(msg);
    return { ok: true, enabled: !enabled, message: msg };
  }

  function shouldAutoCodeVaultScan() {
    const saved = localStorage.getItem(CODE_VAULT_SCAN_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
    return siteKind() === "clickup";
  }

  function scheduleCodeVaultAutoScan(ms) {
    if (!shouldAutoCodeVaultScan()) return;
    clearTimeout(codeVaultAutoScanTimer);
    codeVaultAutoScanTimer = setTimeout(() => {
      saveVisibleCodeToVault({ silent: true }).catch(() => {});
    }, ms || 6500);
  }

  function nextPipelineLabel() {
    const index = Math.max(0, Math.min(state.pipelineStep || 0, PIPELINE_STEPS.length));
    return index >= PIPELINE_STEPS.length ? "(complete)" : `next: ${PIPELINE_STEPS[index]}`;
  }

  function pipelineStatusText() {
    const done = Math.max(0, Math.min(state.pipelineStep || 0, PIPELINE_STEPS.length));
    return [
      `Guided pipeline: ${done}/${PIPELINE_STEPS.length}`,
      nextPipelineLabel(),
      `Topic: ${state.pipelineTopic || state.socialTopic || state.wordTopic || "(not set)"}`,
      state.pipelineLastResult ? `Last: ${state.pipelineLastResult}` : "Last: none yet",
      "Public posting is never automatic here; use Publish only after your explicit confirm click."
    ].join("\n");
  }

  function pipelineSocialPayload(social) {
    const payload = { ...(social || panelSocialPayload()) };
    const topic = String(state.pipelineTopic || payload.topic || state.socialTopic || "").trim();
    if (topic) payload.topic = topic;
    payload.tone = payload.tone || state.socialTone || "friendly";
    payload.extra = payload.extra || state.socialExtra || "";
    return payload;
  }

  function pipelineResultMessage(result, label) {
    if (!result) return `${label}: done.`;
    return result.message || result.error || `${label}: done.`;
  }

  async function runGuidedPipelineStep(social) {
    readPanelInputs();
    const step = Math.max(0, Math.min(state.pipelineStep || 0, PIPELINE_STEPS.length));
    if (step >= PIPELINE_STEPS.length) {
      const msg = `${pipelineStatusText()}\nPipeline already complete. Reset to run again.`;
      setStatus(msg);
      return { ok: true, message: msg };
    }

    const label = PIPELINE_STEPS[step];
    let result;
    if (step === 0) {
      result = await sendLatestToWord({ silent: true });
    } else if (step === 1) {
      result = await copyLatestResponse({ allowOnce: true });
      if (!result.ok) result = await copyCodeBlocks();
    } else if (step === 2) {
      result = await scanImages("guided-pipeline");
    } else if (step === 3) {
      result = await socialCaption(pipelineSocialPayload(social), "post");
    } else if (step === 4) {
      result = await fillSocialDraft(pipelineSocialPayload(social), "post");
    } else if (step === 5) {
      result = highlightSocialActions();
    }

    if (result && result.ok === false) {
      const msg = `Step ${step + 1} blocked: ${label}\n${pipelineResultMessage(result, label)}\nFix this page/setup, then click Next Step again.`;
      state.pipelineLastResult = msg;
      setStatus(msg);
      return { ok: false, error: msg, step };
    }

    state.pipelineStep = step + 1;
    state.pipelineLastResult = pipelineResultMessage(result, label);
    await saveOptionsFromState();
    const msg = `Step ${step + 1} done: ${label}\n${state.pipelineLastResult}\n\n${pipelineStatusText()}`;
    setStatus(msg);
    return { ok: true, message: msg, step: state.pipelineStep, complete: state.pipelineStep >= PIPELINE_STEPS.length };
  }

  async function startGuidedPipeline(social) {
    readPanelInputs();
    state.pipelineStep = 0;
    state.pipelineLastResult = "";
    await saveOptionsFromState();
    const msg = `Guided pipeline started.\n${pipelineStatusText()}\nClick Next Step to run one stage.`;
    setStatus(msg);
    return { ok: true, message: msg, step: state.pipelineStep };
  }

  async function nextGuidedPipeline(social) {
    return runGuidedPipelineStep(social);
  }

  function resetGuidedPipeline() {
    state.pipelineStep = 0;
    state.pipelineLastResult = "";
    const msg = `Guided pipeline reset.\n${pipelineStatusText()}`;
    setStatus(msg);
    return { ok: true, message: msg, step: state.pipelineStep };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = message && message.type;
    if (!type) return false;
    (async () => {
      acceptKnownTabId(message.activeTabId);
      if (message.options) applyOptions(message.options);
      if (type === "ARIA_SUPER_START") {
        start(message.options || {}, Boolean(message.resetPromptFirst));
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_ONE_CLICK") {
        sendResponse(await oneClickCurrentSite(message));
        return;
      }
      if (type === "ARIA_SUPER_MANUS_START") {
        sendResponse(await startManusRunner(message || {}));
        return;
      }
      if (type === "ARIA_SUPER_MANUS_STOP") {
        sendResponse(stopManusRunner());
        return;
      }
      if (type === "ARIA_SUPER_MANUS_STATUS") {
        sendResponse({ ok: true, message: manusStatusText(), ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_MANUS_REFRESH") {
        sendResponse(manusManualRefresh());
        return;
      }
      if (type === "ARIA_SUPER_SCHOLARSHIP_ANALYZE") {
        sendResponse({ ok: true, message: scholarshipAnalyzeText(), ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_SCHOLARSHIP_FILL") {
        sendResponse(await fillScholarshipDraft());
        return;
      }
      if (type === "ARIA_SUPER_SCHOLARSHIP_HIGHLIGHT") {
        sendResponse(highlightScholarshipFields());
        return;
      }
      if (type === "ARIA_SUPER_SCHOLARSHIP_CLEAR") {
        sendResponse(clearScholarshipHighlights());
        return;
      }
      if (type === "ARIA_SUPER_LIMIT_TOGGLE") {
        sendResponse(await toggleLimitGuard(typeof message.enabled === "boolean" ? message.enabled : undefined));
        return;
      }
      if (type === "ARIA_SUPER_LIMIT_CLEAR") {
        sendResponse(await clearLimitGuardWait());
        return;
      }
      if (type === "ARIA_SUPER_LIMIT_PAUSE") {
        sendResponse(await pauseLimitGuard(message.minutes || state.limitCooldownMinutes, message.reason || "Manual limit pause"));
        return;
      }
      if (type === "ARIA_SUPER_LIMIT_STATUS") {
        sendResponse({ ok: true, message: limitGuardStatusText(), ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_STOP") {
        stop();
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_RESET") {
        resetCounter(message.nextNumber || 1);
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_SEND_PROMPT_NOW") {
        sendResponse(await sendPromptNow(message.prompt || state.initialPrompt));
        return;
      }
      if (type === "ARIA_SUPER_SEND_CURRENT_NUMBER_NOW") {
        sendResponse(await sendCurrentNumberNow());
        return;
      }
      if (type === "ARIA_SUPER_AISTUDIO_FORCE_SEND") {
        sendResponse(await forceAiStudioSend(message || {}));
        return;
      }
      if (type === "ARIA_SUPER_AISTUDIO_DIAGNOSE") {
        sendResponse({ ok: true, message: aiStudioDiagnoseText(), ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_RESCUE_STUCK_INPUT") {
        sendResponse(await manualRescueStuckInput());
        return;
      }
      if (type === "ARIA_SUPER_RETRY_FAILED_SEND") {
        sendResponse(await retryFailedSend());
        return;
      }
      if (type === "ARIA_SUPER_SKIP_FAILED_SEND") {
        sendResponse(await skipFailedSend());
        return;
      }
      if (type === "ARIA_SUPER_RESET_PROMPT_FLAG") {
        state.promptSent = false;
        setStatus("Prompt can be sent again on this tab.");
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_SMART_PROMPT_FILL") {
        sendResponse(await smartPromptToInput({ sendNow: false }));
        return;
      }
      if (type === "ARIA_SUPER_SMART_PROMPT_SEND") {
        sendResponse(await smartPromptToInput({ sendNow: true }));
        return;
      }
      if (type === "ARIA_SUPER_SHOW_PANEL") {
        makePanel();
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_STATUS") {
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_GET_RESPONSE_HISTORY") {
        // ARIA v4.8.0 — Feature 8: Response Snapshot History
        updateResponseHistoryIfChanged();
        sendResponse({ ok: true, history: state.responseHistory || [], ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_DIAGNOSE") {
        sendResponse(diagnosePage());
        return;
      }
      if (type === "ARIA_SUPER_BACKGROUND_TICK") {
        if (state.running) tick();
        if (state.clickupChatgptBridgeRunning) tickClickUpChatGptBridge();
        sendResponse({ ok: true, ...currentStatus() });
        return;
      }
      // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
      if (type === "ARIA_SUPER_SYNC_TICK") {
        if (state.running && (state.syncMode || "off") === "follower") tick();
        sendResponse({ ok: true, syncTick: true, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_GENERATE_IMAGE") {
        const reply = await generateImage(message.prompt);
        sendResponse(reply);
        return;
      }
      if (type === "ARIA_SUPER_SAVE_IMAGES") {
        sendResponse(await scanImages("manual"));
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_ASK_TOPICS") {
        sendResponse(await askChatGptVideoTopics(message.prompt || (message.options && message.options.videoTopicPrompt)));
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_CAPTURE_TOPICS") {
        sendResponse(await captureVideoTopics());
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_COPY_SHEET_ROWS") {
        sendResponse(await copyVideoSheetRows());
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_FILL_HEYGEN") {
        sendResponse(await fillHeyGenTopic());
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_CAPTURE_LINK") {
        sendResponse(await captureVideoLink());
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_DOWNLOAD") {
        sendResponse(await downloadOfficialVideo());
        return;
      }
      if (type === "ARIA_SUPER_VIDEO_STATUS") {
        sendResponse(await videoPipelineStatus());
        return;
      }
      if (type === "ARIA_SUPER_X_SAFE_PREP") {
        sendResponse(await xSafePrep());
        return;
      }
      if (type === "ARIA_SUPER_SOCIAL_GENERATE_CAPTION") {
        sendResponse(await socialCaption(message.social || {}, "post"));
        return;
      }
      if (type === "ARIA_SUPER_SOCIAL_FILL_POST") {
        sendResponse(await fillSocialDraft(message.social || {}, "post"));
        return;
      }
      if (type === "ARIA_SUPER_SOCIAL_FILL_COMMENT") {
        sendResponse(await fillSocialDraft(message.social || {}, "comment"));
        return;
      }
      if (type === "ARIA_SUPER_SOCIAL_HIGHLIGHT") {
        sendResponse(highlightSocialActions());
        return;
      }
      // ARIA v4.28.1 - Pulse Post Suite: popup-safe analyzer and draft-only helpers.
      if (type === "ARIA_SUPER_PULSE_ANALYZE") {
        sendResponse(pulseAnalyzeCurrentPage());
        return;
      }
      if (type === "ARIA_SUPER_PULSE_DRAFT") {
        sendResponse(await pulsePrepareCurrentDraft(message.text || ""));
        return;
      }
      if (type === "ARIA_SUPER_PULSE_COPY") {
        sendResponse(await pulseCopyDraft(message.text || ""));
        return;
      }
      if (type === "ARIA_SUPER_PULSE_YOUTUBE_DRAFT") {
        sendResponse(await pulsePrepareYouTubeCommentDraft(message.text || ""));
        return;
      }
      if (type === "ARIA_SUPER_SOCIAL_PUBLISH_DRAFT") {
        sendResponse(publishCurrentSocialDraft(Boolean(message.confirmPublish)));
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_COPY_POST") {
        sendResponse(await copyPostForWhatsApp());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_FILL_DRAFT") {
        sendResponse(await fillWhatsAppDraft(message.whatsapp || {}));
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_SET_CURRENT_ROLE") {
        sendResponse(await setCurrentWhatsAppChatRole(message.role || "source"));
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_SET_SOURCE_AND_COPY") {
        sendResponse(await setCurrentSourceAndCopyWhatsApp());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_SET_RECEIVER_AND_FILL") {
        sendResponse(await setCurrentReceiverAndFillWhatsApp());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_ONE_CLICK_DRAFT") {
        sendResponse(await whatsappOneClickDraft(message.whatsapp || {}));
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_STATUS") {
        sendResponse(await whatsappBridgeStatus());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_SWAP") {
        sendResponse(await swapWhatsAppBridge());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_CLEAR") {
        sendResponse(await clearWhatsAppBridge());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_COPY_DRAFT") {
        sendResponse(await copyWhatsAppDraftToClipboard());
        return;
      }
      if (type === "ARIA_SUPER_WHATSAPP_OPEN") {
        sendResponse(await openWhatsAppWeb());
        return;
      }
      if (type === "ARIA_SUPER_COPY_CODE_BLOCKS") {
        sendResponse(await copyCodeBlocks());
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_SAVE_VISIBLE") {
        sendResponse(await saveVisibleCodeToVault({ manual: true }));
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_DOWNLOAD_ZIP") {
        sendResponse(await downloadCodeVaultZip());
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_STATUS") {
        sendResponse(await codeVaultStatus());
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_AUTO_SCAN") {
        sendResponse(await toggleCodeVaultAutoScan());
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_COPY_LATEST") {
        sendResponse(await copyLatestCodeVaultFile());
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_PASTE_LATEST") {
        sendResponse(await pasteLatestCodeVaultFile());
        return;
      }
      if (type === "ARIA_SUPER_CODE_VAULT_SEND_LATEST") {
        sendResponse(await pasteLatestCodeVaultFile({ sendNow: true }));
        return;
      }
      if (type === "ARIA_SUPER_ALLOW_RESPONSE_COPY") {
        sendResponse(setResponseCopyAllowed(message.allowed !== false));
        return;
      }
      if (type === "ARIA_SUPER_BLOCK_RESPONSE_COPY") {
        sendResponse(setResponseCopyAllowed(false));
        return;
      }
      if (type === "ARIA_SUPER_COPY_LATEST_RESPONSE") {
        sendResponse(await copyLatestResponse({ allowOnce: Boolean(message.allowOnce) }));
        return;
      }
      if (type === "ARIA_SUPER_COPY_ALL_RESPONSES") {
        sendResponse(await copyAllResponses({ allowOnce: Boolean(message.allowOnce) }));
        return;
      }
      if (type === "ARIA_SUPER_COPY_LATEST_PROMPT") {
        sendResponse(await copyLatestPrompt({ allowOnce: Boolean(message.allowOnce) }));
        return;
      }
      if (type === "ARIA_SUPER_COPY_ALL_PROMPTS") {
        sendResponse(await copyAllPrompts({ allowOnce: Boolean(message.allowOnce) }));
        return;
      }
      if (type === "ARIA_RESPONSE_VAULT_SAVE_LATEST") {
        const text = latestResponseText({ ignoreSelection: true });
        if (!looksLikeResponseText(text)) {
          sendResponse({ ok: false, error: "No latest response found to save.", ...currentStatus() });
          return;
        }
        const vault = await saveRowsToResponseVault([text], "manual-latest");
        sendResponse({ ...vault, message: vault.ok ? (vault.message || "Latest response saved to vault.") : (vault.error || "Vault save failed."), ...currentStatus() });
        return;
      }
      if (type === "ARIA_RESPONSE_VAULT_SAVE_ALL") {
        const rows = allResponseTexts();
        if (!rows.length) {
          sendResponse({ ok: false, error: "No visible responses found to save.", ...currentStatus() });
          return;
        }
        const vault = await saveRowsToResponseVault(rows, "manual-all");
        sendResponse({ ...vault, message: vault.ok ? (vault.message || "All visible responses saved to vault.") : (vault.error || "Vault save failed."), responseCount: rows.length, ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_COPY_AND_WORD") {
        sendResponse(await copyAndSendWord({ allowOnce: Boolean(message.allowOnce) }));
        return;
      }
      if (type === "ARIA_SUPER_ALLOW_COPY_AND_WORD") {
        setResponseCopyAllowed(true);
        sendResponse(await copyAndSendWord({ allowOnce: true }));
        return;
      }
      if (type === "ARIA_SUPER_SEND_TO_WORD") {
        sendResponse(await sendLatestToWord());
        return;
      }
      if (type === "ARIA_SUPER_SEND_ALL_TO_WORD") {
        sendResponse(await sendAllResponsesToWord({ forceOpen: true }));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_LATEST_DESKTOP") {
        sendResponse(await pasteLatestToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_ALL_DESKTOP") {
        sendResponse(await pasteAllResponsesToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_LATEST_PROMPT_DESKTOP") {
        sendResponse(await pasteLatestPromptToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_ALL_PROMPTS_DESKTOP") {
        sendResponse(await pasteAllPromptsToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_FULL_CHAT_DESKTOP") {
        sendResponse(await pasteFullChatToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }));
        return;
      }
      if (type === "ARIA_SUPER_COPY_TRANSFER_BUNDLE") {
        sendResponse(await copyTransferBundle());
        return;
      }
      if (type === "ARIA_SUPER_PASTE_TRANSFER_CURRENT_INPUT") {
        sendResponse(await pasteTransferToCurrentInput());
        return;
      }
      if (type === "ARIA_SUPER_PASTE_TRANSFER_DESKTOP") {
        sendResponse(await pasteTransferToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }));
        return;
      }
      if (type === "ARIA_SUPER_DOWNLOAD_TRANSFER_BUNDLE") {
        sendResponse(await downloadTransferBundle());
        return;
      }
      if (type === "ARIA_SUPER_APP_ROUTER_STATUS") {
        sendResponse(await appRouterStatus(message.task));
        return;
      }
      if (type === "ARIA_SUPER_COPY_APP_ROUTE_PLAN") {
        sendResponse(await copyAppRoutePlan(message.task));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_APP_ROUTE_CURRENT_INPUT") {
        sendResponse(await pasteAppRouteToCurrentInput(message.task));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_APP_ROUTE_DESKTOP") {
        sendResponse(await pasteAppRouteToDesktop({
          target_app: message.target_app,
          open_app: message.open_app,
          delay_seconds: message.delay_seconds
        }, message.task));
        return;
      }
      if (type === "ARIA_SUPER_DOWNLOAD_APP_ROUTE_PLAN") {
        sendResponse(await downloadAppRoutePlan(message.task));
        return;
      }
      if (type === "ARIA_SUPER_PASTE_LATEST_NOTEPAD") {
        sendResponse(await pasteLatestToNotepad());
        return;
      }
      if (type === "ARIA_SUPER_PASTE_ALL_NOTEPAD") {
        sendResponse(await pasteAllResponsesToNotepad());
        return;
      }
      if (type === "ARIA_SUPER_LATEST_GOOGLE_DOCS") {
        sendResponse(await openLatestInGoogleDocs());
        return;
      }
      if (type === "ARIA_SUPER_ALL_GOOGLE_DOCS") {
        sendResponse(await openAllInGoogleDocs());
        return;
      }
      if (type === "ARIA_SUPER_SAVE_LATEST_DRIVE") {
        sendResponse(await saveLatestToDrive());
        return;
      }
      if (type === "ARIA_SUPER_SAVE_ALL_DRIVE") {
        sendResponse(await saveAllResponsesToDrive());
        return;
      }
      if (type === "ARIA_SUPER_DRIVE_STATUS") {
        sendResponse(await driveStatus());
        return;
      }
      if (type === "ARIA_SUPER_OPEN_DRIVE_FOLDER") {
        sendResponse(await openDriveFolder());
        return;
      }
      if (type === "ARIA_SUPER_SEND_LATEST_TO_CODEX") {
        sendResponse(await sendLatestToCodex());
        return;
      }
      if (type === "ARIA_SUPER_SEND_ALL_TO_CODEX") {
        sendResponse(await sendAllResponsesToCodex());
        return;
      }
      if (type === "ARIA_SUPER_SEND_LATEST_TO_VSCODE") {
        sendResponse(await sendLatestToVSCode());
        return;
      }
      if (type === "ARIA_SUPER_SEND_ALL_TO_VSCODE") {
        sendResponse(await sendAllResponsesToVSCode());
        return;
      }
      if (type === "ARIA_SUPER_SEND_LATEST_TO_TARGET") {
        sendResponse(await sendLatestToCodingTarget(message.target || state.codingTarget));
        return;
      }
      if (type === "ARIA_SUPER_SEND_ALL_TO_TARGET") {
        sendResponse(await sendAllResponsesToCodingTarget(message.target || state.codingTarget));
        return;
      }
      if (type === "ARIA_SUPER_SEND_WORD_TO_TARGET") {
        sendResponse(await sendWordDocToCodingTarget(message.target || state.codingTarget));
        return;
      }
      if (type === "ARIA_SUPER_OPEN_CODING_TARGET") {
        sendResponse(await openSelectedCodingTarget(message.target || state.codingTarget));
        return;
      }
      if (type === "ARIA_SUPER_CLICKUP_ALL_TO_CHATGPT") {
        sendResponse(await sendClickUpAllToChatGpt({ sendNow: message.sendNow !== false }));
        return;
      }
      if (type === "ARIA_SUPER_CLICKUP_LIVE_TO_CHATGPT_START") {
        sendResponse(await startClickUpChatGptBridge({
          sendNow: message.sendNow !== false,
          intervalMs: message.intervalMs
        }));
        return;
      }
      if (type === "ARIA_SUPER_CLICKUP_LIVE_TO_CHATGPT_STOP") {
        sendResponse(stopClickUpChatGptBridge());
        return;
      }
      if (type === "ARIA_SUPER_CLICKUP_LIVE_TO_CHATGPT_STATUS") {
        sendResponse({ ok: true, message: clickupChatGptBridgeStatusText(), ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_RECEIVE_EXTERNAL_TEXT") {
        sendResponse(await receiveExternalTextForInput(message));
        return;
      }
      if (type === "ARIA_SUPER_PULL_CODEX_OUTBOX_INPUT") {
        sendResponse(await pullCodexOutboxToInput({ sendNow: false }));
        return;
      }
      if (type === "ARIA_SUPER_PULL_CODEX_OUTBOX_SEND") {
        sendResponse(await pullCodexOutboxToInput({ sendNow: true }));
        return;
      }
      if (type === "ARIA_SUPER_SEND_WORD_TO_CODEX") {
        sendResponse(await sendWordDocToCodex());
        return;
      }
      if (type === "ARIA_SUPER_SEND_WORD_TO_VSCODE") {
        sendResponse(await sendWordDocToVSCode());
        return;
      }
      if (type === "ARIA_SUPER_BASIT_WORD_AUTOPILOT") {
        sendResponse(await basitWordAutopilot());
        return;
      }
      if (type === "ARIA_SUPER_BASIT_WORD_CODEX_AUTOPILOT") {
        sendResponse(await basitWordAutopilot({ codex: true }));
        return;
      }
      if (type === "ARIA_SUPER_BASIT_WORD_FULL_RUN") {
        sendResponse(await basitWordAutopilot({ sendNow: true }));
        return;
      }
      if (type === "ARIA_SUPER_NEW_WORD_DOC") {
        sendResponse(await newWordDocument());
        return;
      }
      if (type === "ARIA_SUPER_OPEN_WORD_DOC") {
        sendResponse(await openWordDocument());
        return;
      }
      if (type === "ARIA_SUPER_OPEN_WORD_FOLDER") {
        sendResponse(await openWordFolder());
        return;
      }
      if (type === "ARIA_SUPER_PIPELINE_START") {
        sendResponse(await startGuidedPipeline(message.social || {}));
        return;
      }
      if (type === "ARIA_SUPER_PIPELINE_NEXT") {
        sendResponse(await nextGuidedPipeline(message.social || {}));
        return;
      }
      if (type === "ARIA_SUPER_PIPELINE_STATUS") {
        sendResponse({ ok: true, message: pipelineStatusText(), ...currentStatus() });
        return;
      }
      if (type === "ARIA_SUPER_PIPELINE_RESET") {
        sendResponse(resetGuidedPipeline());
        return;
      }
      sendResponse({ ok: false, error: "Unknown action." });
    })().catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  });

  function currentStatus() {
    ensureCounterScope();
    const cooldown = currentLimitCooldown();
    return {
      running: state.running,
      runCount: state.runCount,
      awaitingResponseAck: Boolean(state.awaitingResponseAck),
      awaitingResponseSince: state.awaitingResponseSince || 0,
      awaitingResponseRetryCount: state.awaitingResponseRetryCount || 0,
      responseAckTimeoutMs: responseAckTimeoutMs(),
      responseAckRetryLimit: responseAckRetryLimit(),
      // ARIA v4.25.0 - Send Acceptance Verification
      lastSendAcceptedAt: state.lastSendAcceptedAt || 0,
      lastSendAcceptedText: state.lastSendAcceptedText || "",
      sendAcceptVerifyMs: sendAcceptVerifyMs(),
      counterScope: state.counterScope,
      nextText: nextPreviewText(),
      promptQueued: promptQueued(),
      queueEnabled: state.usePromptQueue,
      queueIndex: state.queueIndex,
      queueTotal: queueItems().length,
      stopAfterN: Math.max(0, Number.parseInt(state.stopAfterN || "0", 10) || 0),
      consecutiveSendFails: state.consecutiveSendFails || 0,
      failedSendText: state.failedSendText || "",
      failedSendReason: state.failedSendReason || "",
      failedSendAt: state.failedSendAt || 0,
      failedSendKind: state.failedSendPayload && state.failedSendPayload.kind ? state.failedSendPayload.kind : "",
      // ARIA v4.26.7 - Self-Healing Failed Send Retry
      selfHealFailedSends: state.selfHealFailedSends !== false,
      selfHealRetryMs: String(Math.max(30000, Number.parseInt(state.selfHealRetryMs || "60000", 10) || 60000)),
      promptSent: state.promptSent,
      autoWordSave: state.autoWordSave,
      autoCodexSave: state.autoCodexSave,
      driveAutoSave: state.driveAutoSave,
      driveSavedResponses: (state.driveSavedResponseHashes || []).length,
      wordSaveMode: state.wordSaveMode,
      wordOpenAfterSave: state.wordOpenAfterSave,
      pipelineStep: state.pipelineStep,
      pipelineTotal: PIPELINE_STEPS.length,
      pipelineNext: nextPipelineLabel(),
      pipelineLastResult: state.pipelineLastResult,
      responseCopyAllowed: state.responseCopyAllowed,
      lastWordPath: state.lastWordPath,
      clickupChatgptBridgeRunning: state.clickupChatgptBridgeRunning,
      clickupChatgptSentCount: state.clickupChatgptSentCount,
      clickupChatgptSendNow: state.clickupChatgptSendNow,
      manusMaxSends: state.manusMaxSends || 300,
      manusMorningRefresh: state.manusMorningRefresh !== false,
      manusMorningRefreshHour: state.manusMorningRefreshHour || "7",
      manusFallbackText: state.manusFallbackText || "do what is best",
      manusLastReply: state.manusLastReply || "next",
      manusLastReason: state.manusLastReason || "",
      manusRepeatCount: state.manusRepeatCount || 0,
      manusLastStopReason: state.manusLastStopReason || "",
      scholarshipProfileReady: Boolean(String(state.scholarshipProfile || "").trim()),
      scholarshipLastSummary: state.scholarshipLastSummary || "",
      limitGuardEnabled: state.limitGuardEnabled !== false,
      limitCooldownMinutes: state.limitCooldownMinutes || "10",
      limitCooldownUntil: state.limitCooldownUntil || 0,
      limitCooldownReason: state.limitCooldownReason || "",
      limitCooldownActive: Boolean(cooldown.active),
      limitCooldownRemainingMs: cooldown.remainingMs || 0,
      autoScroll: state.autoScroll !== false,
      minResponseChars: Math.max(0, Number.parseInt(state.minResponseChars || "0", 10) || 0),
      scheduledStartTime: state.scheduledStartTime || "",
      sleepFrom: state.sleepFrom || "",
      sleepUntil: state.sleepUntil || "",
      stopKeywords: state.stopKeywords || "",
      customInputSelector: state.customInputSelector || "",
      customSendSelector: state.customSendSelector || "",
      responseHistoryCount: (state.responseHistory || []).length,
      dailySentToday: state.dailySentToday || 0,
      dailySentLifetime: state.dailySentLifetime || 0,
      pauseOnHidden: Boolean(state.pauseOnHidden),
      webhookOnStop: Boolean(state.webhookOnStop && state.webhookUrl),
      intervalMs: state.intervalMs,
      mode: resolvedMode(),
      site: siteKind(),
      codeVaultAutoScan: shouldAutoCodeVaultScan(),
      backgroundScheduler: state.backgroundScheduler,
      url: location.href,
      title: document.title,
      lastMessage: state.lastMessage
    };
  }

  const observer = new MutationObserver(() => {
    if (siteKind() === "chatgpt") scheduleImageScan(1800);
    if (state.responseCopyAllowed) scheduleAutoResponseCopy(5000);
    if (state.autoWordSave) scheduleAutoWordSave(5200);
    if (state.driveAutoSave) scheduleAutoDriveSave(5400);
    if (shouldAutoCodeVaultScan()) scheduleCodeVaultAutoScan(6500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["src", "aria-busy", "disabled"] });

  // ARIA v4.8.0 — Feature 14: Auto-Pause on Tab Visibility Change
  document.addEventListener("visibilitychange", () => {
    if (!state.pauseOnHidden) return;
    if (document.visibilityState === "hidden" && state.running) {
      state.pausedByHidden = true;
      state.running = false;
      clearTimeout(state.timer);
      unregisterBackground();
      setStatus("Paused because this tab is hidden. It will resume when visible.");
      updatePanelMeta();
      return;
    }
    if (document.visibilityState === "visible" && state.pausedByHidden) {
      state.pausedByHidden = false;
      state.running = true;
      registerBackground();
      setStatus("Resumed after tab became visible.");
      schedule(500);
      updatePanelMeta();
    }
  });

  loadOptions().then(() => {
    requestTabScope();
    ensureCounterScope(true);
    refreshDailyStats();
    if (siteKind() === "chatgpt") scheduleImageScan(2500);
    if (state.responseCopyAllowed) scheduleAutoResponseCopy(4000);
    if (state.autoWordSave) scheduleAutoWordSave(4500);
    if (state.driveAutoSave) scheduleAutoDriveSave(4700);
    if (shouldAutoCodeVaultScan()) scheduleCodeVaultAutoScan(4500);
    if (siteKind() === "tiktok") tiktokHelper();
    if (siteKind() === "notebooklm") notebookHelper();
    maybeResumeManusAfterRefresh();
  });
})();

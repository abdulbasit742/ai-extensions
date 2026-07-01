ARIA Nexus One Hub v4.28.0
==============================

One extension. No local server required for ChatGPT/ClickUp/universal sending.
This is now the single master extension: the older separate ChatGPT, ClickUp,
Word copier, image saver, social publisher, X helper, video helper, NotebookLM,
TikTok, and universal sender features have been consolidated here.

What it does:
- NEW v4.28.0: Send Number Lock. Popup and in-page panel now include
  "Send # Now" for stubborn tabs. ARIA sends the exact current number/prompt,
  verifies that the site accepted it, and does not advance the counter while
  the same prompt is still sitting in the input box.
- NEW v4.27.0: Native Browser Input Fallback. If ClickUp or Google AI Studio
  leaves a number/prompt typed in the input after normal send attempts, ARIA
  now uses a last-resort Chrome native click/Enter fallback on the exact safe
  Run/Send control, then verifies acceptance before advancing the counter.
- NEW v4.26.9: Native Input Commit Bridge. ARIA now writes prompts through
  native textarea/input setters, composed input events, stronger pointer clicks,
  and safe form-submit fallback so ClickUp/Google AI Studio do not leave a
  number typed in the box without sending it.
- NEW v4.26.8: Held Prompt Multi-Tap Send Guard. If ClickUp, Google AI Studio,
  or another AI page leaves the exact number/text in the input after a send
  click, ARIA keeps that same prompt held and pulses the safe send/run controls
  several times instead of advancing the counter or stopping too early.
- NEW v4.26.7: Self-Healing Failed Send Retry. If a prompt is rejected five
  times, ARIA can keep the exact failed payload and retry it slowly instead of
  advancing the counter or stopping the run. Popup and in-page panel include
  controls for self-heal ON/OFF and retry delay.
- NEW v4.26.6: Strict Send Acceptance Guard. ARIA no longer treats a generic
  busy/loader signal as a successful send when the exact prompt is still sitting
  in the input box. This prevents silent counter drift such as 1 -> 2 -> 3 when
  the prompt was typed but not actually submitted.
- NEW v4.26.5: Failed Send Memory. If a site types the next number/text but
  still does not accept the prompt, ARIA stores that exact failed payload and
  exposes Retry Failed / Skip Failed in both popup and in-page panel. This keeps
  the sequence honest: no silent 2 -> 3 -> 4 drift after a failed send.
- NEW v4.26.4: Stuck Input Auto-Rescue. If ClickUp, Google AI Studio, or a
  universal chat page types the next number/text but leaves it sitting in the
  composer, ARIA now retries site-specific send buttons, nearby send controls,
  composer hotspots, Enter, and Ctrl/Cmd+Enter before counting the send as
  failed. Popup and in-page panel include "Rescue Stuck Send" for manual rescue.
- NEW v4.26.3: ClickUp Send Rescue. If ClickUp writes the next number/text into
  the composer but does not submit it, ARIA now targets the real right-side send
  arrow first, retries safe composer hotkeys only when needed, and accepts
  ClickUp page/user-message changes without prematurely stopping.
- NEW v4.26.2: Google AI Studio Force Send rescue. Popup and in-page panel now
  include AI Studio Diagnose and Force AI Studio Send buttons; when normal
  detection is stuck, ARIA verifies the prompt editor, injects the next text,
  clicks Run/play, and then waits for the response gate.
- NEW v4.26.1: Google AI Studio limit/stability gate repair. Limit Guard OFF
  now clears every stale cooldown scope, and AI Studio no longer treats the
  mobile preview/device spinner as a reason to block prompt 1.
- NEW v4.26.0: Google AI Studio Prompt/Run hard fix. ARIA now scans open
  web-component shadow DOM, prefers the real AI Studio prompt editor, injects
  text through native setters/editor events, and clicks the real Run/play
  control instead of relying on plain Enter. This fixes "Run this tab" doing
  nothing on aistudio.google.com.
- NEW v4.25.0: Send Acceptance Verification. ARIA now checks that the
  target site actually accepted the prompt before starting the response wait.
  If Enter/click does not submit and the prompt stays in the input, ARIA keeps
  the next number locked and retries safely instead of creating a phantom send.
- NEW v4.24.0: No-Response Retry Guard. If a sent prompt does not produce a
  fresh stable response within the guard timeout, ARIA resends the same prompt
  up to two times and keeps the next number locked. If the page still does not
  answer, ARIA stops with a clear response-timeout message instead of skipping.
- NEW v4.23.0: Response Ack Gate. Numbers, queues, smart prompts, and
  action clicks now wait for a new stable response before runCount or the
  next number advances, preventing 1 -> 2 -> 3 jumps before the page has
  actually answered.
- NEW v4.22.0: Google AI Studio Run This Tab repair. AI Studio wrappers now
  resolve to the real editable textbox before prompt injection, submit checks
  read the actual textbox, and a failed first injection retries the resolved
  field before stopping. Alternate AI Studio domains are treated as AI tabs.
- NEW v4.21.0: Desktop Bridge Doctor. One click checks the ARIA local
  server and reports whether Notepad, Word, VS Code, Cursor, Chrome, Edge,
  and Android Studio can be found for open/paste automation.
- NEW v4.20.0: Android Studio desktop bridge. Open Android Studio from
  the popup/command launcher, paste latest/all AI responses or prompts into
  Android Studio, and send Word/Codex bridge context to Android Studio as a
  coding target.
- NEW v4.19.0: Google AI Studio Force Send. Finds prompt boxes inside
  Google/Angular web components and shadow DOM, injects prompts using
  real insertText/native setter fallbacks, allows safe Send message/Run
  buttons, verifies the page accepted the send before incrementing counters,
  and falls back to Ctrl+Enter/Enter when needed.
- NEW v4.18.0: Prompt Queue Wizard. Convert one goal or rough plan into a
  multi-step prompt queue, copy it, load it into ARIA's existing prompt queue,
  or load and start the current AI tab in one click. Useful for long coding,
  research, social, content, debug, and agent-handoff workflows.
- NEW v4.17.0: Prompt Recipe Builder. Build clean, reusable prompts for
  code generation, debugging, research, social drafts, video/content
  workflows, automation planning, and AI-agent handoffs. You can build,
  copy, or fill the recipe into the current AI tab with one click.
- NEW v4.16.0: AI Tool Radar. Research-backed router for Claude Code,
  OpenAI Codex/ChatGPT, Google Jules, Gemini CLI, Google AI Studio, Cursor,
  Lovable, Bolt, v0, and similar AI tools. Paste a goal, get the best tool
  stack, open the best tool, or fill a ready prompt into the current AI tab.
  Unverified names such as "Claude Mythos" are treated as research signals
  only unless an official product source exists.
- NEW v4.15.0: Money Brief. On any page or AI/social tab, build an ethical
  business action brief from the visible context, copy it, or fill a visible
  draft box. Public publish/share still stays under your visible confirmation.
- NEW v4.14.0: Quick Command Launcher. Type commands like open word,
  open ai studio, search files invoice, run, stop, status, money brief, or
  fill money draft directly from the popup.
- NEW v4.13.0: Google AI Studio send repair plus desktop app/search launcher.
  AI Studio now has stronger prompt-box detection, Run/Send button detection,
  and Ctrl+Enter fallback. The popup can also open safe desktop apps
  (Notepad, Word, Excel, VS Code, Chrome, Explorer, etc.) and launch Google
  or Windows file search through the local ARIA dashboard server.
- NEW v4.12.0: Site Doctor + profile backup. Automation Doctor now reports
  trained profile/input/response status, and trained site selectors can be
  exported/imported as JSON for another Chrome profile or PC.
- NEW v4.11.0: Site Trainer Pro. On any unsupported AI/chat site, click
  Train this site, then click the input box, send button, and a completed
  response once. ARIA saves those selectors per site and reuses them for
  future runs, including Google AI Studio-style custom pages and coding agents.
- NEW v4.10.0: OMNI bridge compatibility from the v30 mini build, stronger
  Google AI Studio input/send detection, deterministic prompt clearing before
  every send, AI-tab-only sync broadcast, and API vault compatibility handlers.
- NEW v4.8.0: Response-aware universal automation for Google AI Studio and
  more AI/coding sites. Adds auto-scroll before send, minimum response length
  guard, scheduled starts, sleep windows, stale-input clearing, keyword
  auto-stop, custom input/send selectors, response history, daily send stats,
  better Gemini/DeepSeek/Mistral busy detection, popup theme toggle,
  full state export/import, pause-on-hidden, and stop/limit webhook alerts.
- NEW v4.7.1: Best-merge from v4.7.0 Limit Guard Pro. Adds Stop-after-N
  sends, exponential send-failure backoff, expanded AI site detection/modes
  (DeepSeek, Mistral, Phind, You.com, Character.AI, Coze, HuggingFace,
  Together, OpenRouter, Cerebras, Ideogram, Suno, Runway, Luma, Krea,
  Replicate, Dify, Devin, MS Copilot, GitHub Copilot, Windsurf), and visible
  fail counters while keeping the v4.6.5 hardened security/Drive/Word fixes.
- NEW v4.6.5: Bugfix hardening. README/version now match, Chrome MV3
  offscreen reasons are valid, limit cooldowns survive tab reloads, soft limit
  detection is stricter, stale tab runners are validated before restore, Drive
  queue overflow warnings are visible, and Codex/source detection is safer.
- NEW v4.6.1: Antigravity Pro. Detects Google Antigravity-style coding
  pages, generates useful next prompts with Groq/OpenAI/OpenRouter/local LLM
  settings, can run normal number/custom/smart prompt loops, highlights
  permission prompts, supports guarded safe approval clicks only when you
  explicitly enable the checkbox, and can try your configured model fallback
  order when a visible model/rate limit appears.
- NEW v4.5.9: Credits-Aware App Router. Detect visible credits/quota/balance
  hints on the current app, summarize that app's strengths, and build a
  portable route plan that can be copied, pasted into the current input,
  sent to any desktop app, or downloaded as Markdown. It cannot transfer
  paid credits or subscriptions between services; it safely transfers
  context, prompts, responses, media links, and next-step instructions.
- NEW v4.5.8: App-to-App Transfer Bridge. Build a portable Markdown bundle
  from the current page with source app, title, URL, selected text, prompts,
  responses, visible context, image links, video links, and downloadable/file
  links. Use Copy Transfer Bundle, Transfer -> Current Input, Transfer -> Any
  App, or Download Transfer .md to move project history and chats between
  ChatGPT, Claude, Gemini, ClickUp, Codex, Cursor, Lovable, Bolt, WhatsApp,
  Word, Notepad, VS Code, and other apps. It pastes drafts/context only;
  final Send/Post remains your visible click.
- NEW v4.5.7: Universal Prompt Bridge. Copy Latest Prompt, Copy All Prompts,
  Latest Prompt -> Any App, All Prompts -> Any App, and Full Chat -> Any App
  now work from normal AI/coding pages. Use it to move user prompts or full
  prompt/response archives into Notepad, Word, VS Code, Cursor, Codex, or any
  focused desktop app through the same ARIA local bridge.
- NEW v4.5.6: Advanced Control Pack. Save/load named presets for different
  workflows, export/import all extension settings as a JSON backup, run a
  system snapshot for tab/runner/vault health, and use Emergency Stop All to
  stop every supported tab if any automation keeps running.
- NEW v4.5.5: Limit Guard pauses automation when the visible AI page says
  usage limit, message cap, quota, too many requests, or rate limit reached.
  If the page says "try again in 20 minutes" or "retry at 8:30 PM", ARIA uses
  that retry time. Otherwise it uses the fallback cooldown from the popup or
  in-page panel, minimum 5 minutes. Cooldown is saved per tab/chat scope and
  can be cleared manually.
- NEW v4.5.4: Desktop App Bridge target selector. Use "Paste Latest -> Any App"
  or "Paste All -> Any App" with target choices: focused app, Notepad, Word,
  VS Code, Cursor, or Codex/ChatGPT. Optional "Open target" opens the chosen
  app first, waits, then pastes the captured response through the ARIA local
  server.
- NEW v4.5.3: Smart LLM prompt mode. Save a Groq, OpenAI, OpenRouter/free-model,
  or local OpenAI-compatible endpoint once, then ARIA can read the latest
  ClickUp/ChatGPT/coding-agent response and generate the best next prompt
  instead of only sending numbers.
- NEW v4.5.2: ClickUp -> ChatGPT bridge. From a ClickUp coding-agent tab,
  "ClickUp all -> ChatGPT" forwards all visible ClickUp responses to an open
  ChatGPT tab. "Live CU -> GPT" watches ClickUp, waits until the response is
  complete/stable, skips duplicates, and then pastes/sends the new response to
  ChatGPT while you keep working in other tabs.
- NEW v4.5.1: Coding target router. Choose Codex web, VS Code, Cursor,
  Claude, ChatGPT, Gemini, or ClickUp, then send latest response, all visible
  responses, or the current Word doc to that selected target. Local editor
  targets open through the ARIA bridge; web targets open in the browser with
  the handoff text copied.
- NEW v4.5.0: VS Code handoff added. "Latest -> VS Code",
  "All -> VS Code", and "Word Doc -> VS Code" save/copy the selected context
  through the local ARIA bridge and open VS Code with the saved context file
  when VS Code is installed.
- NEW v4.4.9: AI Response Vault ZIP/export is now all-response by default.
  Build ZIP / Store+Send first captures all visible responses from the current
  tab, then exports all saved responses instead of only the latest response.
  Added stronger Codex web and Antigravity/coding-agent detection.
- NEW v4.4.8: AI Response Vault. Copied/captured AI responses are persisted in
  browser IndexedDB with source, topic, timestamp, URL, and hash metadata.
  Select saved responses, build a JSZip ZIP in .txt/.md/.json/.html format,
  prepare agent-forward payloads, and optionally send a manifest to the local
  Google Drive bridge or a webhook/n8n/Zapier URL.
- NEW v4.4.7: Notepad and Google Docs handoff buttons. "Latest -> Notepad"
  and "All -> Notepad" open Notepad and paste via the local ARIA bridge.
  "Latest -> GDocs" and "All -> GDocs" open docs.new and copy the captured
  text so you can paste it into the new Google Doc.
- NEW v4.4.6: ClickUp / coding-agent Code Vault from Auto Coder PRO MAX:
  save visible code blocks, auto-scan ClickUp code, paste latest saved code
  back into an input, and download a project ZIP from this same master
  extension.
- NEW v4.4.5: WhatsApp quick receiver fill. "Current WA -> Receiver + Fill"
  saves the current chat/channel as receiver and fills the saved source draft
  in the current composer in one click. Final Send remains manual.
- NEW v4.4.4: WhatsApp quick source capture. "Current WA -> Source + Copy"
  saves the current chat/channel as source and copies the latest/selected
  visible message into the WhatsApp bridge draft in one click.
- NEW v4.4.3: WhatsApp bridge utility buttons. Swap source/receiver when you
  want to reverse a channel bridge, and Clear WhatsApp bridge to reset source,
  receiver, and saved draft text safely.
- NEW v4.4.2: WhatsApp bridge status check. One click shows current
  WhatsApp chat/channel detection, saved draft length, source/receiver fields,
  and whether the message composer is visible.
- NEW v4.4.1: WhatsApp current-chat buttons. On WhatsApp Web, click
  "Current WA -> Source" or "Current WA -> Receiver" to save the currently
  selected chat/channel into the bridge fields. This avoids typing long channel
  names by hand.
- NEW v4.4.0: WhatsApp bridge polish. "Copy post for WhatsApp" now copies the
  current selected/visible WhatsApp chat message when you are already on
  WhatsApp Web, and "Fill WhatsApp draft" can search/open the receiver
  chat/channel from the receiver field before filling the draft. Final Send is
  still manual.
- NEW v4.3.9: WhatsApp channel/chat bridge. On WhatsApp Web, enter an
  optional source chat/channel name and a receiver chat/channel name, then
  click "WA source -> receiver draft". ARIA opens/searches the source, copies
  the latest visible/selected message, opens/searches the receiver, and fills
  the message draft. It does not press Send; review and send manually.
- NEW v4.3.8: WhatsApp Web post-to-draft bridge. On any source page, select
  text or click near a post and use "Copy post for WhatsApp". Then open
  WhatsApp Web, select the target chat, and use "Fill WhatsApp draft". ARIA
  fills the chat box only; final Send stays your manual click.
- NEW v4.3.7: Desktop paste bridge. Use Paste Latest -> Any App or Paste All
  -> Any App, then focus Notepad, Word, VS Code, Codex, or any textbox within
  3 seconds. ARIA sets the clipboard and presses Ctrl+V into the focused app.
- NEW v4.3.6: Google Drive auto-backup for captured GPT/ClickUp/AI responses.
  Basit Automate Word can now keep Word capture and Drive backup running
  together, with Latest -> Drive, All -> Drive, Drive Status, and Drive Folder
  controls. If Google Drive Desktop is not detected, ARIA saves to the safe
  fallback folder: Documents/ARIA_Docs/Google_Drive_Backups/ARIA_Auto_Saves.
- NEW v4.3.5: Automation Doctor checks the active tab, send input/button,
  busy/ready state, running state, background runners, Groq key status, and
  supported extension APIs, then gives a clear next action.
- NEW v4.3.5: Repair Current Tab re-injects the ARIA page helper into the
  current website tab and refreshes the background watcher without installing
  another extension folder.
- NEW v4.3.4: Reload Extension Now button added to the popup and in-page
  ARIA panel. Future fixes can be copied into the same installed folder; then
  press Reload once instead of loading a new folder again.
- NEW v4.3.3: Basit Automate Word now filters out ClickUp notification banners,
  ARIA panels, and other page noise so the Word file receives the real
  assistant/code response instead of "ClickUp needs permission" text.
- NEW v4.3.3: Auto Word capture now has a live response watcher. When a new
  answer finishes and the page settles, ARIA appends it to the same open Word
  file even before the next number is sent.
- NEW v4.3.2: Basit Automate Word creates a fresh Word document for the
  current tab/platform first, opens it, pastes all visible old responses when
  available, then starts the numbered auto-save loop for new responses.
- NEW v4.3.2: ARIA Word reset now creates the actual .docx file immediately,
  so Open Word works even before a new response arrives.
- NEW v4.3.1: Refreshed ARIA Nexus logo in the toolbar, extension card, popup
  header, and packaged ready-load folder.
- NEW v4.3: Codex <-> GPT transfer bridge. GPT responses are saved in
  data/coding_tools_bridge, code fences are extracted into real files, and
  Codex prompts can be queued in the dashboard outbox then pulled into any GPT
  tab with "Codex -> Input" or "Codex -> Send".
- NEW v4.2: Basit Word + Codex Auto saves visible responses to Word, opens
  the Word file, also stores the same context for Codex, then keeps saving each
  newly completed response before the next number/dot/custom send.
- NEW v4.2: Auto-save to Codex bridge checkbox can run beside Word auto-save,
  so ChatGPT/ClickUp/Claude/Gemini/LangChain style responses stay handoff-ready.
- NEW v3.7: Word auto-save now uses per-response hashes after the old
  all-response save, so each newly completed response is appended to Word
  instead of being skipped as a duplicate.
- NEW v3.6: Save Old + Send Next saves visible old responses to Word, opens
  the Word document, turns on auto-save, and immediately tries the next number
  on the target tab.
- NEW v3.6: Full Page Panel shows the exact target tab title and URL so you
  know which chat it is controlling.
- NEW v3.5: Open Full Page Panel opens the same ARIA controls in a normal
  browser tab, so the controls are not trapped in the small extension popup.
- NEW v3.5: Basit Automate Word saves all visible old responses to Word,
  opens the Word file on the PC, turns on Word auto-save, and starts numbered
  automation for the current tab.
- NEW v3.5: All Responses -> Word opens the Word document after saving so you
  can see the pasted content immediately.
- Updated ARIA Nexus logo in the extension toolbar, extension card, and popup header.
- This is the permanent master extension. Future features should be added here,
  then you only press Reload on the existing extension card.
- Universal per-tab sender for normal websites.
- ChatGPT sender with per-chat/per-tab counters.
- ClickUp sender with response-aware waiting.
- ChatGPT image prompt helper and image saver to Downloads/Basit Social Media.
- Video workflow helper: ChatGPT topics -> Google Sheets rows -> HeyGen prompt
  fill -> official video link capture -> authorized direct video download to
  Downloads/Basit Social Media/HeyGen Videos.
- Run all tabs from the same site at once, for example all ChatGPT tabs.
- Run AI/coding tabs across all Chrome/Edge windows at once: ChatGPT, ClickUp,
  Claude, Gemini, LangChain/Smith, Fireworks, Cursor, v0, Bolt, Replit, and
  similar coding/chat tools.
- Also recognizes newer AI/video workflow pages such as HeyGen, Kling, Grok,
  Perplexity, Poe, Lovable, Manus, Same, StackBlitz, Codesandbox, and GitHub
  web editors through the universal runner.
- Run safe normal tabs in the current browser window. Social/email/payment and
  ARIA dashboard tabs are skipped in bulk mode.
- Run all safe normal tabs across all browser windows. This is the broadest
  mode for 9, 20, or more coding/research tabs.
- Auto-inject into old already-open tabs after extension reload, so you do not
  have to refresh every tab first in most cases.
- If a page has no text input but has a clear next/continue/run/generate
  button, ARIA can click that safe action button instead of getting stuck.
- Diagnose AI Tabs and Diagnose Safe Tabs show exactly which tabs are ready,
  which tabs are busy, and which tabs have no usable input/action button.
- Stop all running ARIA tabs from one popup button.
- Copy visible code blocks from coding tools to clipboard.
- Per-tab response copy permission: click "Allow Copy This Tab", then "Copy
  Latest Response". Other tabs are not touched. After allow, the tab also
  auto-copies a new stable response when it finishes.
- Save the latest ChatGPT prompt, response, and code blocks directly into a
  Word document created by ARIA on the local dashboard server.
- Optional "Open Word after every manual save" lets you immediately see copied
  content landing in Microsoft Word.
- Copy All Responses and All Responses -> Word capture every visible assistant
  response from the current chat/page, not only the latest one.
- Guided one-click pipeline: Start Pipeline, then press Next Step for each safe
  stage. It saves/copies work, saves images, prepares caption, fills the current
  social draft, and highlights the final controls. It never publishes publicly
  without your separate confirmed publish click.
- Send a full pasted prompt or selected text/code file first, then continue
  automatically with numbers, dot, or custom text after the response completes.
- Prompt queue mode: paste many prompts, tasks, or file requests into one box.
  ARIA sends them one by one only after the previous response/page has settled,
  then falls back to numbers, dot, or custom text.
- Check This Tab diagnostic button tells you whether the current tab has a
  usable input, safe action button, or busy response state before you start.
- X/Twitter safe giveaway helper: analyze, highlight, copy/fill draft only.
- Social publisher for Facebook, Instagram, LinkedIn, and X:
  Groq caption generation, post draft fill, comment/reply draft fill,
  action highlighting, and a visible confirmed "publish current draft" button.
- WhatsApp Web helper for copying posts from other pages/channels and drafting
  them into the selected WhatsApp chat without auto-sending.
- TikTok and NotebookLM helper highlighting.
- Page panel quick buttons for One-click, social drafts, video capture,
  authorized video download, code copy, image generation, and per-tab run/stop.
- Strict interval guard: if you set 4s, 5s, 30s, etc. ARIA will not send
  earlier than that, even when Chrome wakes a background tab.

Important:
- Chrome/Edge extensions cannot run on chrome://, edge://, extension pages,
  Chrome Web Store, or browser security pages.
- For file:// pages, enable "Allow access to file URLs" on the extension card.
- Public social actions such as like, repost, follow, comment, and post are
  protected by visible controls. ARIA can prepare drafts/highlight controls.
  The "Publish Current Draft" button only works after you tick the confirm box
  in the popup and only on the current visible composer.

Install:
1. Open edge://extensions or chrome://extensions.
2. Turn Developer mode ON.
3. Click Load unpacked.
4. Select this folder, not a ZIP file:
   aria_super_extension_READY_LOAD_THIS_FOLDER
   or aria_super_extension_SUPER_READY_LOAD_THIS_FOLDER

Use:
1. Open any normal website tab.
2. Click the ARIA Nexus One Hub icon.
3. Choose mode, wait seconds, and send text style.
4. Click Run This Tab.

Guided pipeline:
1. Open the AI/chat/social tab you want to work on.
2. Put your campaign or project topic in "Guided one-click pipeline".
3. Click Start Pipeline.
4. Click Next Step once per stage. If a stage needs a different site, open that
   site and click Next Step there.
5. Review the filled draft. Public publish still needs the confirm checkbox and
   Publish Current Draft click.
5. Repeat on any other tab. Each tab keeps its own counter and state.

Multi-tab use:
1. Open 4 ChatGPT tabs or 4 ClickUp tabs.
2. Open the extension popup on one of those tabs.
3. Click Run Same Site Tabs.
4. Each tab runs independently with its own counter.
5. Click Stop This Tab to stop only current tab, or Stop Running Tabs to stop all.

Large AI/coding tab use:
1. Open your ChatGPT, ClickUp, Claude, LangChain/Smith, Fireworks, Cursor, v0,
   or other coding-agent tabs.
2. Open the ARIA Nexus One Hub popup on any normal tab.
3. Click Run AI/Coding Tabs.
4. ARIA injects itself into already-open tabs and starts every supported AI tab.
5. If a tab is a protected browser/internal page, it will be skipped or shown
   in the first-errors list.

Current-window bulk use:
1. Put the tabs you want in one Chrome/Edge window.
2. Click Run Window Tabs.
3. ARIA starts safe normal tabs in that window and skips social/email/payment
   pages so they are not touched accidentally.

All-safe-tabs bulk use:
1. Open many coding/research/AI tabs across Chrome/Edge windows.
2. Click Run All Safe Tabs.
3. ARIA starts all normal supported pages and skips social/email/payment and
   dashboard pages.
4. On pages that only show a "next", "continue", "run", or "generate" button,
   ARIA can click that button after the response/page has settled.

Diagnostics:
1. Click Diagnose AI Tabs before starting a big run.
2. Read the result lines:
   OK means the tab has a usable input box or safe action button.
   WAIT means the page is busy or no usable control was found.
   FAIL means the content script could not be injected into that tab.
3. If a normal website shows FAIL, refresh that page once and try again.

Full prompt/file first:
1. Paste the full prompt/file text into "Full prompt / file text first".
2. Or choose a local text/code file from the file picker.
3. Tick "Send this prompt first, then auto-continue".
4. Click Run This Tab.
5. ARIA sends the full prompt first. After the response finishes, it continues
   with your selected sequence: numbers, dot, or custom text.

Prompt queue:
1. Paste many prompts into "Prompt queue".
2. Use one prompt per line for short prompts, or leave blank lines between
   larger prompts.
3. Tick "Use prompt queue before numbers/dot/custom".
4. Click Run This Tab or Run Same Site Tabs.
5. Each tab keeps its own queue index and counter, so 4 ChatGPT tabs can run
   independently without sharing the same count.

ChatGPT image saving:
1. Open ChatGPT.
2. Click the extension icon.
3. Write the image prompt.
4. Click Generate Image.
5. Generated images save in Downloads/Basit Social Media.

ChatGPT to Word:
1. Keep the ARIA dashboard server running on http://127.0.0.1:5050.
2. Open ChatGPT and wait for a response/code block to finish.
3. In the floating page panel or popup, click Send Latest to Word.
4. Click New Word Doc when you want a fresh file for a specific chat/project.
5. Click Open Word or Word Folder to view the generated document.
6. Turn on Auto-save each finished response to Word if you want ARIA to save
   every completed response before it sends the next number/dot/custom prompt.
7. For a one-click fresh run on any new tab/platform, click Basit Automate Word.
   ARIA creates a brand-new Word file for that tab, opens it, pastes old visible
   responses if any, then continues saving new completed responses.

Social publisher:
1. Open Facebook, Instagram, LinkedIn, or X in the logged-in account you want.
2. Click the ARIA Nexus One Hub icon.
3. Save your Groq key once if you want AI captions.
4. Select the platform, write topic/instructions, and click Generate Caption.
5. Click Fill Post Draft or Fill Comment Draft.
6. Use Highlight Actions to outline Like/Repost/Share/Upload/Post buttons.
7. To publish your own visible draft, tick the confirm box and click
   Publish Current Draft. If the platform shows another confirmation, review it.

Multiple Chrome profiles/accounts:
- Install this same extension in each Chrome/Edge profile.
- The extension runs inside the currently logged-in account for that profile.
- It does not share cookies or log into accounts by itself.

Video pipeline:
1. Open the exact ChatGPT project chat that creates HeyGen video ideas.
2. In the extension popup, write the video topic seed and click Ask ChatGPT Topics.
3. After ChatGPT finishes, click Capture Topics.
4. Click Copy Sheet Rows, open Google Sheets, click A1, and paste.
5. Open HeyGen. Click Fill HeyGen Topic to paste the next saved topic.
6. Use your HeyGen account to generate/export the video.
7. Click Capture Video Link. If the page exposes a direct official video file,
   click Download Official Video to save it to your chosen folder.

Video safety:
- ARIA will not bypass HeyGen premium/export limits.
- ARIA will not use SaveFrom or protected-stream workarounds.
- Only official direct/authorized video URLs are downloaded.

If a page does not accept automation:
- Click Show Panel, then try Run from the page panel.
- Refresh the website tab once after installing/updating the extension.
- Some sites intentionally block scripted input; those need manual help.

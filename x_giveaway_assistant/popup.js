(function () {
  "use strict";

  const status = document.getElementById("status");
  const friendsInput = document.getElementById("approvedFriends");
  const FRIENDS_KEY = "ariaXGiveawayApprovedFriends";

  function setStatus(text) {
    status.textContent = text;
  }

  async function send(command) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus("No active tab found.");
      return;
    }
    if (!/^https:\/\/(x\.com|twitter\.com)\//i.test(tab.url || "")) {
      setStatus("Open x.com or twitter.com first.");
      return;
    }
    chrome.tabs.sendMessage(tab.id, {
      type: "ARIA_X_COMMAND",
      command,
      options: { approvedFriends: friendsInput ? friendsInput.value : "" }
    }, (reply) => {
      if (chrome.runtime.lastError) {
        setStatus("Refresh the X tab once, then try again.");
        return;
      }
      setStatus((reply && reply.message) || "Done.");
    });
  }

  document.querySelectorAll("button[data-command]").forEach((button) => {
    button.addEventListener("click", () => send(button.dataset.command));
  });

  if (friendsInput && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ [FRIENDS_KEY]: "" }, (items) => {
      friendsInput.value = items[FRIENDS_KEY] || "";
    });
  }

  document.querySelectorAll("button[data-save-friends]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = friendsInput ? friendsInput.value : "";
      chrome.storage.local.set({ [FRIENDS_KEY]: value }, () => {
        setStatus("Approved tag list saved. Smart Prepare will pick from this list only.");
      });
    });
  });
})();

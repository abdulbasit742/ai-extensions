// [ARIA] V40 OMNIPOTENCE - Notifications
export const Notifications = {
  toast: (msg, type = "info") => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

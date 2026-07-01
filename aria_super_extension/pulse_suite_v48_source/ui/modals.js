// [ARIA] V40 OMNIPOTENCE - Modal Component
export const Modals = {
  show: (title, content) => {
    const modal = document.createElement('div');
    modal.className = 'aria-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>${title}</h3>
        <p>${content}</p>
        <button onclick="this.parentElement.parentElement.remove()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
};

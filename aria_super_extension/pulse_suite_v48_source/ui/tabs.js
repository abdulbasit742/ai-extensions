// [ARIA] V40 OMNIPOTENCE - Tab Component
export const Tabs = {
  init: (container, tabs) => {
    const nav = document.createElement('div');
    nav.className = 'tabs-nav';
    tabs.forEach(tab => {
      const link = document.createElement('div');
      link.className = 'tab-link';
      link.innerText = tab.label;
      link.onclick = () => Tabs.switch(tab.id);
      nav.appendChild(link);
    });
    container.prepend(nav);
  },
  switch: (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
};

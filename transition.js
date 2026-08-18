/* soft passage between rooms: every page breathes in on arrival,
   and breathes out before leaving */
(function () {
  const style = document.createElement('style');
  style.textContent = 'body{opacity:0;transition:opacity .5s ease}body.room-in{opacity:1}';
  document.head.appendChild(style);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('room-in');
  }));

  window.fadeGo = function (url) {
    document.body.classList.remove('room-in');
    if (window.sfx && window.sfx.fadeOut) window.sfx.fadeOut(0.38);
    setTimeout(() => { window.location.href = url; }, 420);
  };

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    e.preventDefault();
    window.fadeGo(href);
  }, true);
})();

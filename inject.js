(function () {
  if (window.__preventDefaultDisabled) return;
  window.__preventDefaultDisabled = true;

  const blockedEvents = new Set([
    'copy',
    'cut',
    'paste',
    'contextmenu',
    'selectstart',
    'dragstart',
    'keydown',
    'keyup',
    'keypress',
  ]);

  const originalPreventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    if (blockedEvents.has(this.type)) return;
    return originalPreventDefault.call(this);
  };
})();

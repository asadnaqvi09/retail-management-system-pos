function normalizeKeyToken(token) {
  const value = token.trim();
  if (value.toLowerCase() === 'ctrl') {
    return 'ctrl';
  }
  if (value.toLowerCase() === 'shift') {
    return 'shift';
  }
  if (value.toLowerCase() === 'alt') {
    return 'alt';
  }
  return value.toUpperCase();
}

export function matchesKeyboardShortcut(event, shortcutKeys) {
  if (!shortcutKeys) {
    return false;
  }
  const tokens = shortcutKeys.split('+').map(normalizeKeyToken);
  const keyToken = tokens[tokens.length - 1];
  const needsCtrl = tokens.includes('CTRL');
  const needsShift = tokens.includes('SHIFT');
  const needsAlt = tokens.includes('ALT');

  if (needsCtrl !== event.ctrlKey) {
    return false;
  }
  if (needsShift !== event.shiftKey) {
    return false;
  }
  if (needsAlt !== event.altKey) {
    return false;
  }

  const eventKey = event.key.length === 1 ? event.key.toUpperCase() : event.key.toUpperCase();
  return eventKey === keyToken || event.key === keyToken;
}

export function buildShortcutMap(shortcuts = []) {
  const map = new Map();
  for (const shortcut of shortcuts) {
    if (!shortcut.isActive) {
      continue;
    }
    map.set(shortcut.actionKey, shortcut.shortcutKeys);
  }
  return map;
}

export function isEditableTarget(target) {
  if (!target) {
    return false;
  }
  const tagName = target.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

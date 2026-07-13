INSERT INTO keyboard_shortcuts (store_id, action_key, shortcut_keys, description)
SELECT s.id, 'lock_session', 'Ctrl+L', 'Lock session'
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM keyboard_shortcuts ks
  WHERE ks.store_id = s.id AND ks.action_key = 'lock_session'
);

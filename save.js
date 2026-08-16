/* ============================================================
   トリリオネアを目指せ！ - セーブ / ロード モジュール（複数スロット対応）
   ゲームロジックから独立した「保存」だけの担当。
   今はブラウザの localStorage を使っているが、将来 Capacitor 等で
   Android アプリ化する際は、この _read/_write/_remove の中身を
   Capacitor Preferences 等に差し替えるだけで済むようにしてある。

   ゲーム側（game.js）は listSlots/saveToSlot/loadFromSlot/deleteSlot/
   hasAnySave/getActiveSlot/setActiveSlot しか呼ばない。「meta」（年月・現在地・
   総資産など、一覧表示用の要約情報）はゲームロジック側で作って渡すことで、
   このファイルはゲームの状態の中身を一切知らずに済むようにしている。
   ============================================================ */
const SaveManager = (function () {
  const SLOT_COUNT = 5;
  const SLOT_KEY_PREFIX = "trillionaire_slot_";
  const ACTIVE_SLOT_KEY = "trillionaire_active_slot";
  const LEGACY_KEY = "trillionaire_save_v2"; // 旧・単一セーブ方式のキー（移行用）
  const SAVE_VERSION = 3;

  // ---- ストレージ実装（差し替えポイント） ----
  function _write(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn("SaveManager: failed to write", e);
      return false;
    }
  }
  function _read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn("SaveManager: failed to read", e);
      return null;
    }
  }
  function _remove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn("SaveManager: failed to remove", e);
      return false;
    }
  }

  function slotKey(id) {
    return SLOT_KEY_PREFIX + id;
  }
  function readSlotPayload(id) {
    const raw = _read(slotKey(id));
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== SAVE_VERSION || !payload.data) return null;
      return payload;
    } catch (e) {
      console.warn("SaveManager: corrupted slot data", id, e);
      return null;
    }
  }

  // ---- 旧・単一セーブ方式からの移行（データを失わないため） ----
  // 新方式のスロットに何かデータが既にあれば「移行済み」とみなし、旧キーだけ掃除する。
  function migrateLegacyIfNeeded() {
    const legacyRaw = _read(LEGACY_KEY);
    if (!legacyRaw) return;
    for (let i = 1; i <= SLOT_COUNT; i++) {
      if (_read(slotKey(i))) {
        _remove(LEGACY_KEY);
        return;
      }
    }
    try {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && legacy.data) {
        _write(
          slotKey(1),
          JSON.stringify({ version: SAVE_VERSION, savedAt: legacy.savedAt || Date.now(), meta: null, data: legacy.data })
        );
        _write(ACTIVE_SLOT_KEY, "1");
      }
    } catch (e) {
      console.warn("SaveManager: failed to migrate legacy save", e);
    }
    _remove(LEGACY_KEY);
  }
  migrateLegacyIfNeeded();

  // ---- 公開API（ゲームロジックはこれだけ使う） ----
  // 全スロットの一覧。存在しないスロットは exists:false のみを返す（中身は読まない）。
  function listSlots() {
    const slots = [];
    for (let id = 1; id <= SLOT_COUNT; id++) {
      const payload = readSlotPayload(id);
      slots.push(payload ? { id, exists: true, savedAt: payload.savedAt, meta: payload.meta || null } : { id, exists: false });
    }
    return slots;
  }
  function saveToSlot(id, dataObject, meta) {
    const payload = { version: SAVE_VERSION, savedAt: Date.now(), meta: meta || null, data: dataObject };
    return _write(slotKey(id), JSON.stringify(payload));
  }
  function loadFromSlot(id) {
    const payload = readSlotPayload(id);
    return payload ? payload.data : null;
  }
  function deleteSlot(id) {
    if (getActiveSlot() === id) _remove(ACTIVE_SLOT_KEY);
    return _remove(slotKey(id));
  }
  function hasAnySave() {
    for (let id = 1; id <= SLOT_COUNT; id++) {
      if (readSlotPayload(id)) return true;
    }
    return false;
  }
  function getActiveSlot() {
    const v = _read(ACTIVE_SLOT_KEY);
    const n = v ? Number(v) : null;
    return n && n >= 1 && n <= SLOT_COUNT ? n : null;
  }
  function setActiveSlot(id) {
    _write(ACTIVE_SLOT_KEY, String(id));
  }

  return { SLOT_COUNT, listSlots, saveToSlot, loadFromSlot, deleteSlot, hasAnySave, getActiveSlot, setActiveSlot };
})();

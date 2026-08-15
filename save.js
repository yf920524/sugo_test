/* ============================================================
   トリリオネアを目指せ！ - セーブ / ロード モジュール
   ゲームロジックから独立した「保存」だけの担当。
   今はブラウザの localStorage を使っているが、将来 Capacitor 等で
   Android アプリ化する際は、この _read/_write/_remove の中身を
   Capacitor Preferences 等に差し替えるだけで済むようにしてある。
   ゲーム側（game.js）は SaveManager.save/load/clear/hasSave しか呼ばない。
   ============================================================ */
const SaveManager = (function () {
  const SAVE_KEY = "trillionaire_save_v2";
  const SAVE_VERSION = 2;

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

  // ---- 公開API（ゲームロジックはこれだけ使う） ----
  function save(dataObject) {
    const payload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      data: dataObject,
    };
    return _write(SAVE_KEY, JSON.stringify(payload));
  }

  function load() {
    const raw = _read(SAVE_KEY);
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== SAVE_VERSION) {
        // 旧バージョンのセーブは互換性がないため無効化する
        return null;
      }
      return payload.data;
    } catch (e) {
      console.warn("SaveManager: corrupted save data", e);
      return null;
    }
  }

  function clear() {
    return _remove(SAVE_KEY);
  }

  function hasSave() {
    return _read(SAVE_KEY) != null;
  }

  return { save, load, clear, hasSave };
})();

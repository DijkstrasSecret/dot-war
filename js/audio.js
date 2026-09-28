'use strict';
// Background music. Browsers only allow playback after a user gesture, so start() is called from
// the menu's Start button and the top-bar toggle. Preference is remembered in localStorage.
// TODO(patch 0.7): sound effects (shots, shells, alerts) with their own volume; a small playlist.
const Music = (() => {
  const SRC = 'assets/music/grieg-violin-sonata-3.mp3';
  const CREDIT = 'Grieg, Violin Sonata No. 3 (Gregor Quendel)';
  let el = null, enabled = true, volume = 0.35;

  function load() { try { const s = JSON.parse(localStorage.getItem('dotwar.music') || '{}'); if (typeof s.enabled === 'boolean') enabled = s.enabled; if (typeof s.volume === 'number') volume = s.volume; } catch (e) { /* storage unavailable */ } }
  function save() { try { localStorage.setItem('dotwar.music', JSON.stringify({ enabled, volume })); } catch (e) { /* ignore */ } }
  function ensure() { if (!el) { el = new Audio(SRC); el.loop = true; el.volume = volume; } }
  function start() { ensure(); if (!enabled) return; el.play().catch(() => {}); }
  function toggle() { enabled = !enabled; ensure(); if (enabled) start(); else el.pause(); save(); UI.refreshMusic(); }
  function setVolume(v) { volume = Util.clamp(v, 0, 1); ensure(); el.volume = volume; save(); }

  load();
  return { start, toggle, setVolume, CREDIT, get enabled() { return enabled; }, get volume() { return volume; } };
})();

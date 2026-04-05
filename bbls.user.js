// ==UserScript==
// @name         Bring Back Live Seek
// @namespace    https://github.com/ramvignesh-b/bbls
// @version      1.0.3
// @description  Restores seek (rewind/forward) buttons on Hotstar live streams with a glassmorphism UI.
// @author       RamVignesh B
// @homepageURL  https://github.com/ramvignesh-b/bbls
// @supportURL   https://github.com/ramvignesh-b/bbls/issues
// @match        https://www.hotstar.com/*
// @icon         https://raw.githubusercontent.com/ramvignesh-b/bbls/main/icons/icon-48.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
 * Bring Back Live Seek — core.js
 *
 * Injects glassmorphism rewind/fast-forward buttons onto Hotstar live streams.
 * Works as both a browser extension content script and a Tampermonkey userscript.
 *
 * @license MIT
 * @author  RamVignesh B <https://github.com/ramvignesh-b>
 */
(function bringBackLiveSeek() {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────────────

  /** Seconds to rewind or fast-forward on each button press / arrow key. */
  const SEEK_AMOUNT_SECONDS = 10;

  /**
   * Only activate on Hotstar live stream pages.
   * Matches: /in/video/live/watch, /us/video/live/watch, etc.
   */
  const LIVE_PAGE_PATTERN = /\/video\/live\/watch/;

  // ─── Internal constants ────────────────────────────────────────────────────

  const STYLE_ID = 'bbls-styles';
  const OVERLAY_ID = 'bbls-overlay';

  // ─── State ─────────────────────────────────────────────────────────────────

  /** Reference to the injected overlay element, or null when not active. */
  let overlayEl = null;

  /** Bound keyboard handler so it can be removed on cleanup. */
  let keydownHandler = null;

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Injects the shared stylesheet once into <head>.
   * Idempotent — safe to call multiple times.
   */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Layout ───────────────────────────────────────────────────────── */
      #${OVERLAY_ID} {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 5%;
        pointer-events: none;   /* transparent to clicks by default … */
        z-index: 9999;
        box-sizing: border-box;
      }

      /* ── Glass button ─────────────────────────────────────────────────── */
      .bbls-btn {
        position: relative;
        width: 80px; height: 80px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        outline: none;
        transition:
          background 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
          transform  0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
          box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        overflow: hidden;
        pointer-events: auto;  /* … but buttons capture their own clicks */
      }
      .bbls-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
        box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.3);
      }
      .bbls-btn:active  { transform: scale(0.95); }
      .bbls-btn svg {
        width: 32px; height: 32px;
        fill: #ffffff;
        z-index: 2;
        transition: transform 0.2s ease;
      }

      /* ── Feedback label ───────────────────────────────────────────────── */
      .bbls-feedback {
        position: absolute;
        top: -40px; left: 50%;
        transform: translateX(-50%);
        color: #ffffff;
        font-weight: 700;
        font-size: 1.1rem;
        font-family: system-ui, -apple-system, sans-serif;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        opacity: 0;
        pointer-events: none;
        z-index: 20;
        white-space: nowrap;
      }

      /* ── Ripple ───────────────────────────────────────────────────────── */
      .bbls-ripple-wrap {
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        border-radius: 50%; overflow: hidden;
        z-index: 1; pointer-events: none;
      }
      .bbls-ripple {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 20px; height: 20px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        animation: bbls-ripple-anim 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
      }
      @keyframes bbls-ripple-anim {
        to { transform: translate(-50%, -50%) scale(10); opacity: 0; }
      }

      /* ── Icon nudge animations ────────────────────────────────────────── */
      .bbls-nudge-left  svg { animation: bbls-nudge-left-anim  0.4s ease-out; }
      @keyframes bbls-nudge-left-anim {
        0%   { transform: translateX(0);    }
        30%  { transform: translateX(-8px); }
        100% { transform: translateX(0);    }
      }
      .bbls-nudge-right svg { animation: bbls-nudge-right-anim 0.4s ease-out; }
      @keyframes bbls-nudge-right-anim {
        0%   { transform: translateX(0);   }
        30%  { transform: translateX(8px); }
        100% { transform: translateX(0);   }
      }

      /* ── Feedback float animation ─────────────────────────────────────── */
      .bbls-float-text {
        animation: bbls-float-up-anim 0.8s ease-out forwards;
      }
      @keyframes bbls-float-up-anim {
        0%   { opacity: 0; transform: translate(-50%, 10px);  }
        20%  { opacity: 1; transform: translate(-50%, 0);     }
        80%  { opacity: 1; transform: translate(-50%, -15px); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
      }

      /* ── Responsive ───────────────────────────────────────────────────── */
      @media (max-width: 600px) {
        .bbls-btn { width: 60px; height: 60px; }
        .bbls-btn svg { width: 24px; height: 24px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── DOM Construction ──────────────────────────────────────────────────────

  /** Creates the overlay element (does not insert it into the DOM). */
  function buildOverlay() {
    const container = document.createElement('div');
    container.id = OVERLAY_ID;

    /* Inline SVG paths — no external assets required */
    container.innerHTML = `
      <button class="bbls-btn" id="bbls-seek-left"
              aria-label="Rewind ${SEEK_AMOUNT_SECONDS} seconds">
        <span class="bbls-feedback" aria-hidden="true">−${SEEK_AMOUNT_SECONDS}s</span>
        <div class="bbls-ripple-wrap"></div>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12.5 12L20 18V6L12.5 12Z"/>
          <path d="M4 12L11.5 18V6L4 12Z"/>
        </svg>
      </button>

      <button class="bbls-btn" id="bbls-seek-right"
              aria-label="Fast forward ${SEEK_AMOUNT_SECONDS} seconds">
        <span class="bbls-feedback" aria-hidden="true">+${SEEK_AMOUNT_SECONDS}s</span>
        <div class="bbls-ripple-wrap"></div>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11.5 12L4 6V18L11.5 12Z"/>
          <path d="M20 12L12.5 6V18L20 12Z"/>
        </svg>
      </button>
    `;

    return container;
  }

  // ─── Animation Helpers ─────────────────────────────────────────────────────

  /** Spawns a ripple element inside the button's ripple container. */
  function triggerRipple(button) {
    const wrap = button.querySelector('.bbls-ripple-wrap');
    const ripple = document.createElement('div');
    ripple.classList.add('bbls-ripple');
    wrap.appendChild(ripple);
    // Remove after the animation completes to keep the DOM clean
    setTimeout(() => ripple.remove(), 600);
  }

  /**
   * Plays the icon-nudge, feedback-text-float, and ripple animations.
   * Forces a reflow between class removal and re-addition to allow re-triggering.
   *
   * @param {HTMLElement} button   - The button element to animate.
   * @param {string}      nudgeCls - 'bbls-nudge-left' | 'bbls-nudge-right'
   */
  function triggerFeedback(button, nudgeCls) {
    button.classList.remove('bbls-nudge-left', 'bbls-nudge-right');
    void button.offsetWidth; // force reflow

    button.classList.add(nudgeCls);

    const text = button.querySelector('.bbls-feedback');
    text.classList.remove('bbls-float-text');
    void text.offsetWidth; // force reflow
    text.classList.add('bbls-float-text');

    triggerRipple(button);
  }

  // ─── Seek Logic ────────────────────────────────────────────────────────────

  /** Returns the first <video> element on the page, or null. */
  function getVideo() {
    return document.querySelector('video');
  }

  /**
   * Animates the given button and adjusts video.currentTime.
   *
   * @param {number}      deltaSeconds - Positive (forward) or negative (rewind).
   * @param {HTMLElement} button       - The clicked / keyboard-activated button.
   * @param {string}      nudgeCls     - Animation class name.
   */
  function seekVideo(deltaSeconds, button, nudgeCls) {
    triggerFeedback(button, nudgeCls);

    const video = getVideo();
    if (!video) return; // video may have been removed between click and handler

    // Use nullish coalescing to safely handle currentTime === 0
    video.currentTime = (video.currentTime ?? 0) + deltaSeconds;
  }

  // ─── Overlay Lifecycle ─────────────────────────────────────────────────────

  /**
   * Finds the best container element for the overlay —
   * walks up from the <video> looking for a player wrapper.
   */
  function findPlayerContainer(video) {
    // Hotstar's player is usually a sibling wrapper with a recognisable class
    return (
      video.closest('[class*="player"]') ||
      video.closest('[class*="Player"]') ||
      video.parentElement ||
      document.body
    );
  }

  /** Injects the overlay if a live-stream video is present. Idempotent. */
  function inject() {
    if (overlayEl) return; // already active
    if (!LIVE_PAGE_PATTERN.test(window.location.pathname)) return;

    const video = getVideo();
    if (!video) return;

    injectStyles();

    const parent = findPlayerContainer(video);

    // Absolute-positioned overlay needs a non-static parent
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    overlayEl = buildOverlay();
    parent.appendChild(overlayEl);

    /* ── Button listeners ─────────────────────────────────────────────── */
    const btnLeft  = overlayEl.querySelector('#bbls-seek-left');
    const btnRight = overlayEl.querySelector('#bbls-seek-right');

    btnLeft.addEventListener('click',  () => seekVideo(-SEEK_AMOUNT_SECONDS, btnLeft,  'bbls-nudge-left'));
    btnRight.addEventListener('click', () => seekVideo(+SEEK_AMOUNT_SECONDS, btnRight, 'bbls-nudge-right'));

    /* ── Keyboard listener ────────────────────────────────────────────── */
    keydownHandler = (event) => {
      // Skip when the user is typing in a text field
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;

      if (event.key === 'ArrowLeft')  seekVideo(-SEEK_AMOUNT_SECONDS, btnLeft,  'bbls-nudge-left');
      if (event.key === 'ArrowRight') seekVideo(+SEEK_AMOUNT_SECONDS, btnRight, 'bbls-nudge-right');
    };
    document.addEventListener('keydown', keydownHandler);
  }

  /** Removes the overlay and detaches all listeners. */
  function cleanup() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
  }

  // ─── SPA Navigation Observer ───────────────────────────────────────────────

  /**
   * Hotstar is a React SPA — page navigations don't reload the document.
   * A MutationObserver watches for the video element appearing/disappearing
   * and manages the overlay lifecycle accordingly.
   */
  function observe() {
    // Attempt immediate injection in case the page is already loaded
    inject();

    let lastPathname = window.location.pathname;

    const mo = new MutationObserver(() => {
      const pathChanged = window.location.pathname !== lastPathname;
      if (pathChanged) {
        lastPathname = window.location.pathname;
        cleanup(); // always clean up on route change
      }

      const video = getVideo();
      if (video && !overlayEl) {
        inject();
      } else if (!video && overlayEl) {
        cleanup();
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });
  }

  observe();
})();

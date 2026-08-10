(function () {
  'use strict';

  const CLOSE_DURATION = 260;
  const states = new Map();
  const backdropStates = new Map();
  let activeStandardSheet = null;

  function sheetBody(sheet) {
    return sheet.querySelector(':scope > .body, .camera-sheet-content');
  }

  function sheetHandle(sheet) {
    return sheet.querySelector(':scope > .grip, :scope > .camera-sheet-handle, [data-bottom-sheet-handle]');
  }

  function isInteractive(target) {
    return Boolean(target.closest('button, input, textarea, select, a, [contenteditable="true"]'));
  }

  function isOpen(state) {
    return state.sheet.classList.contains(state.openClass) && !state.sheet.hidden;
  }

  function setBackdropVisible(state, visible) {
    const backdrop = state.backdrop;
    if (!backdrop) return;
    if (backdrop.id === 'sheetmask') {
      backdrop.classList.toggle('on', visible);
    } else {
      backdrop.hidden = !visible;
      backdrop.classList.toggle('on', visible);
    }
  }

  function finishClose(state) {
    state.sheet.classList.remove('is-dragging');
    state.sheet.style.transform = '';
    if (state.hideWhenClosed) state.sheet.hidden = true;
    setBackdropVisible(state, false);
    if (activeStandardSheet === state.sheet) activeStandardSheet = null;
    state.closeTimer = null;
  }

  function close(sheet, options) {
    const state = states.get(sheet);
    if (!state || (!isOpen(state) && !state.closeTimer)) return false;
    const settings = options || {};
    clearTimeout(state.closeTimer);
    state.sheet.classList.remove('is-dragging');
    state.sheet.style.transform = '';
    state.sheet.classList.remove(state.openClass);
    state.handle.setAttribute('aria-expanded', 'false');
    state.drag = null;
    if (settings.immediate) finishClose(state);
    else state.closeTimer = setTimeout(() => finishClose(state), CLOSE_DURATION);
    return true;
  }

  function open(sheet) {
    const state = initBottomSheet(sheet);
    if (!state) return false;
    if (state.standard && activeStandardSheet && activeStandardSheet !== sheet) {
      close(activeStandardSheet, { immediate: true });
    }
    clearTimeout(state.closeTimer);
    state.closeTimer = null;
    state.sheet.hidden = false;
    state.sheet.classList.remove('is-dragging');
    state.sheet.style.transform = '';
    setBackdropVisible(state, true);
    void state.sheet.offsetHeight;
    state.sheet.classList.add(state.openClass);
    state.handle.setAttribute('aria-expanded', 'true');
    if (state.standard) activeStandardSheet = sheet;
    return true;
  }

  function closeActiveStandard(options) {
    if (activeStandardSheet) return close(activeStandardSheet, options);
    const openState = Array.from(states.values()).find(state => state.standard && isOpen(state));
    return openState ? close(openState.sheet, options) : false;
  }

  function dragThresholdReached(state, distance, elapsed) {
    const heightThreshold = Math.min(160, state.sheet.getBoundingClientRect().height * 0.25);
    const velocity = elapsed > 0 ? distance / elapsed : 0;
    return distance >= heightThreshold || (distance >= 56 && velocity >= 0.65);
  }

  function beginDrag(state, clientY, source, pointerId) {
    state.drag = {
      source,
      pointerId,
      startY: clientY,
      currentY: clientY,
      startTime: performance.now(),
      active: source === 'handle' || source === 'header',
      moved: false
    };
    if (state.drag.active) state.sheet.classList.add('is-dragging');
  }

  function updateDrag(state, clientY, event) {
    const drag = state.drag;
    if (!drag) return;
    drag.currentY = clientY;
    const distance = Math.max(0, clientY - drag.startY);
    if (!drag.active) {
      if (clientY <= drag.startY || (state.body && state.body.scrollTop > 0)) {
        state.drag = null;
        return;
      }
      if (distance < 5) return;
      drag.active = true;
      state.sheet.classList.add('is-dragging');
    }
    if (event.cancelable) event.preventDefault();
    drag.moved = drag.moved || distance > 5;
    state.sheet.style.transform = `translateY(${distance}px)`;
  }

  function endDrag(state) {
    const drag = state.drag;
    if (!drag) return;
    const distance = Math.max(0, drag.currentY - drag.startY);
    const elapsed = Math.max(1, performance.now() - drag.startTime);
    state.drag = null;
    state.sheet.classList.remove('is-dragging');
    state.sheet.style.transform = '';
    if (drag.moved) state.suppressClickUntil = performance.now() + 350;
    if (drag.active && dragThresholdReached(state, distance, elapsed)) close(state.sheet);
  }

  function bindPointerEvents(state) {
    state.sheet.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || (event.button != null && event.button !== 0)) return;
      const onHandle = state.handle.contains(event.target);
      const directHeading = event.target.closest('h3');
      const onHeader = Boolean(directHeading && directHeading.parentElement === state.sheet);
      const inBody = Boolean(state.body && state.body.contains(event.target));
      if (!onHandle && !onHeader && (!inBody || isInteractive(event.target))) return;
      if (inBody && state.body.scrollTop > 0) return;
      beginDrag(state, event.clientY, onHandle ? 'handle' : onHeader ? 'header' : 'content', event.pointerId);
      if (state.drag.active) {
        state.sheet.setPointerCapture(event.pointerId);
        if (event.cancelable) event.preventDefault();
      }
    });
    state.sheet.addEventListener('pointermove', event => {
      if (!state.drag || state.drag.pointerId !== event.pointerId) return;
      updateDrag(state, event.clientY, event);
      if (state.drag && state.drag.active && !state.sheet.hasPointerCapture(event.pointerId)) state.sheet.setPointerCapture(event.pointerId);
    });
    const endPointer = event => {
      if (!state.drag || state.drag.pointerId !== event.pointerId) return;
      endDrag(state);
    };
    state.sheet.addEventListener('pointerup', endPointer);
    state.sheet.addEventListener('pointercancel', endPointer);
  }

  function bindTouchEvents(state) {
    state.sheet.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      const target = event.target;
      const onHandle = state.handle.contains(target);
      const directHeading = target.closest('h3');
      const onHeader = Boolean(directHeading && directHeading.parentElement === state.sheet);
      const inBody = Boolean(state.body && state.body.contains(target));
      if (!onHandle && !onHeader && (!inBody || isInteractive(target))) return;
      if (inBody && state.body.scrollTop > 0) return;
      beginDrag(state, event.touches[0].clientY, onHandle ? 'handle' : onHeader ? 'header' : 'content', null);
    }, { passive: true });
    state.sheet.addEventListener('touchmove', event => {
      if (!state.drag || event.touches.length !== 1) return;
      updateDrag(state, event.touches[0].clientY, event);
    }, { passive: false });
    state.sheet.addEventListener('touchend', () => endDrag(state), { passive: true });
    state.sheet.addEventListener('touchcancel', () => endDrag(state), { passive: true });
  }

  function bindBackdrop(state) {
    if (!state.backdrop) return;
    let related = backdropStates.get(state.backdrop);
    if (!related) {
      related = new Set();
      backdropStates.set(state.backdrop, related);
      state.backdrop.addEventListener('click', event => {
        if (event.target !== state.backdrop) return;
        const openState = Array.from(related).map(sheet => states.get(sheet)).reverse().find(candidate => candidate && isOpen(candidate));
        if (openState) close(openState.sheet);
      });
    }
    related.add(state.sheet);
  }

  function initBottomSheet(sheet, options) {
    if (!sheet) return null;
    if (states.has(sheet)) return states.get(sheet);
    const settings = options || {};
    const standard = sheet.classList.contains('sheet');
    const handle = sheetHandle(sheet);
    if (!handle) return null;
    const state = {
      sheet,
      handle,
      body: sheetBody(sheet),
      standard,
      backdrop: settings.backdrop || document.getElementById(standard ? 'sheetmask' : 'cameraSheetBackdrop'),
      openClass: settings.openClass || (standard ? 'on' : 'is-open'),
      hideWhenClosed: settings.hideWhenClosed == null ? !standard : Boolean(settings.hideWhenClosed),
      closeTimer: null,
      drag: null,
      suppressClickUntil: 0
    };
    states.set(sheet, state);
    sheet.dataset.bottomSheetReady = 'true';
    handle.classList.add('bottom-sheet-handle');
    handle.setAttribute('role', 'button');
    if (handle.tagName !== 'BUTTON') handle.tabIndex = 0;
    handle.setAttribute('aria-label', '하단 시트 닫기');
    handle.setAttribute('aria-expanded', String(isOpen(state)));
    handle.addEventListener('click', event => {
      if (performance.now() < state.suppressClickUntil) {
        event.preventDefault();
        return;
      }
      close(sheet);
    });
    handle.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      close(sheet);
    });
    bindPointerEvents(state);
    bindTouchEvents(state);
    bindBackdrop(state);
    return state;
  }

  document.querySelectorAll('.sheet, #cameraFallback').forEach(sheet => initBottomSheet(sheet));

  window.CookCoachBottomSheets = {
    initBottomSheet,
    open,
    close,
    closeActiveStandard,
    isOpen: sheet => {
      const state = states.get(sheet);
      return Boolean(state && isOpen(state));
    },
    getRegisteredIds: () => Array.from(states.keys()).map(sheet => sheet.id)
  };
})();

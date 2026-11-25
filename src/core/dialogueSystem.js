import { PORTRAITS } from './assetRegistry.js';

/**
 * Storybook Subtitle Dialogue Engine with Dynamic Codex Portraits & Soft Voice Blips.
 * Supports typewriter text, mood switches per line, interactive choice buttons, and keyboard/click advance.
 */
export function createDialogueSystem({ voiceBlip, eventBus }) {
  const boxEl = document.getElementById('dialogue-box');
  const portraitEl = document.getElementById('dlg-portrait');
  const nameEl = document.getElementById('dlg-speaker');
  const roleEl = document.getElementById('dlg-role');
  const textEl = document.getElementById('dlg-text');
  const nextHintEl = document.getElementById('dlg-next-hint');
  const choicesEl = document.getElementById('dlg-choices');

  let active = false;
  let script = null;
  let lineIndex = 0;
  let visibleChars = 0;
  let typeTimer = 0;
  let onCloseCallback = null;

  function renderCurrentLine() {
    if (!script || !script.lines[lineIndex]) return;
    const line = script.lines[lineIndex];
    const speakerId = line.speakerId || script.speakerId;
    const mood = line.mood || 'neutral';
    const src = (PORTRAITS[speakerId] && PORTRAITS[speakerId][mood]) || PORTRAITS.player.neutral;

    if (portraitEl) portraitEl.src = src;
    if (nameEl) nameEl.textContent = line.speakerName || script.speakerName;
    if (roleEl) roleEl.textContent = line.role || script.role || '';
    if (textEl) textEl.textContent = '';
    if (choicesEl) {
      choicesEl.innerHTML = '';
      choicesEl.classList.add('hidden');
    }
    if (nextHintEl) nextHintEl.classList.remove('hidden');

    visibleChars = 0;
    typeTimer = 0;
  }

  function showChoices() {
    if (!script || !script.choices || !script.choices.length) return;
    if (!choicesEl) return;
    choicesEl.innerHTML = '';
    for (const ch of script.choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dlg-choice-btn ${ch.primary ? 'primary' : ''}`;
      btn.textContent = ch.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cb = ch.onSelect;
        close();
        if (cb) cb();
      });
      choicesEl.appendChild(btn);
    }
    choicesEl.classList.remove('hidden');
    if (nextHintEl) nextHintEl.classList.add('hidden');
  }

  function open(dialogueScript, onClose = null) {
    script = dialogueScript;
    lineIndex = 0;
    active = true;
    onCloseCallback = onClose;
    boxEl?.classList.remove('hidden');
    renderCurrentLine();
    eventBus.emit('dialogue:opened', { speakerId: script.speakerId });
  }

  function close() {
    if (!active) return;
    active = false;
    script = null;
    boxEl?.classList.add('hidden');
    if (choicesEl) {
      choicesEl.innerHTML = '';
      choicesEl.classList.add('hidden');
    }
    const cb = onCloseCallback;
    onCloseCallback = null;
    if (cb) cb();
    eventBus.emit('dialogue:closed');
  }

  function advance() {
    if (!active || !script) return;
    const line = script.lines[lineIndex];
    if (!line) {
      close();
      return;
    }

    if (visibleChars < line.text.length) {
      // Finish typing current sentence immediately!
      visibleChars = line.text.length;
      if (textEl) textEl.textContent = line.text;
      if (lineIndex === script.lines.length - 1 && script.choices?.length) {
        showChoices();
      }
      return;
    }

    if (lineIndex < script.lines.length - 1) {
      lineIndex += 1;
      renderCurrentLine();
    } else if (script.choices?.length) {
      showChoices();
    } else {
      close();
    }
  }

  boxEl?.addEventListener('click', () => {
    if (!active) return;
    // Don't auto-close if choices are already visible and waiting for selection
    if (choicesEl && !choicesEl.classList.contains('hidden')) return;
    advance();
  });

  return {
    isOpen: () => active,
    open,
    close,
    advance,
    update(dt) {
      if (!active || !script) return;
      const line = script.lines[lineIndex];
      if (!line || visibleChars >= line.text.length) return;

      typeTimer += Math.min(dt, 0.05);
      const stepSec = 0.036;
      while (typeTimer >= stepSec && visibleChars < line.text.length) {
        typeTimer -= stepSec;
        visibleChars += 1;
        const ch = line.text[visibleChars - 1];
        if (textEl) textEl.textContent = line.text.slice(0, visibleChars);

        // Soft Animal-Crossing-style voice blip on every 2nd non-punctuation character!
        const isPunct = /[\s，。！？、…“”‘’：；（）().,!?\-]/.test(ch);
        if (!isPunct && visibleChars % 2 === 1) {
          voiceBlip.playBlip(line.speakerId || script.speakerId, ch.charCodeAt(0));
        }

        if (visibleChars >= line.text.length && lineIndex === script.lines.length - 1 && script.choices?.length) {
          showChoices();
        }
      }
    },
  };
}

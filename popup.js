'use strict';

const $ = (id) => document.getElementById(id);
const NATIVE_HOST = 'com.onenote.quick_save';
let screenshotDataUrl = null;
let sections = [];
let language = 'tr';

const t = (key, values) => OneNoteI18n.t(key, language, values);

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = 'OneNote Quick Save';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  }
  $('languageSelect').setAttribute('aria-label', t('language'));
  renderSections($('sectionSelect').value);
}

function setStatus(message, kind = '') {
  $('status').textContent = message;
  $('status').className = kind;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.querySelector('.spinner').hidden = !busy;
}

async function nativeRequest(message) {
  try {
    const response = await browser.runtime.sendNativeMessage(NATIVE_HOST, message);
    if (!response?.ok) throw new Error(response?.error || t('refreshError', { error: '' }));
    return response;
  } catch (error) {
    const message = error.message.toLowerCase();
    if (message.includes('no such native application')
      || message.includes('failed to connect to the native messaging host')) {
      throw new Error(t('nativeMissing'));
    }
    throw error;
  }
}

function renderSections(selectedId = '') {
  const select = $('sectionSelect');
  select.replaceChildren(new Option(t('sectionPlaceholder'), ''));
  const groups = new Map();
  for (const section of sections) {
    const groupName = [section.notebook, section.group].filter(Boolean).join(' / ');
    if (!groups.has(groupName)) {
      const group = document.createElement('optgroup');
      group.label = groupName;
      groups.set(groupName, group);
      select.append(group);
    }
    groups.get(groupName).append(new Option(section.name, section.id));
  }
  if (sections.some((section) => section.id === selectedId)) select.value = selectedId;
}

async function loadSections() {
  const { targetSectionId } = await browser.storage.local.get('targetSectionId');
  const selectedId = $('sectionSelect').value || targetSectionId || '';
  const result = await nativeRequest({ command: 'listSections' });
  sections = result.sections;
  renderSections(selectedId);

  if (selectedId && sections.some((section) => section.id === selectedId)) {
    await browser.storage.local.set({ targetSectionId: selectedId });
  }
  const response = await browser.runtime.sendMessage({ type: 'onenote:refresh-menus' });
  if (response?.error && sections.length) throw new Error(response.error);
  if (!sections.length) {
    setStatus(t('noSections'), 'err');
    return;
  }
  if (response?.error) throw new Error(response.error);
  setStatus(t('sectionCount', { count: sections.length }), 'ok');
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error(t('noActiveTab'));
  return tab;
}

async function readSelection(tabId) {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) return { empty: true };
      const rects = [...selection.getRangeAt(0).getClientRects()]
        .filter((rect) => rect.width > 0 && rect.height > 0);
      if (!rects.length) return { empty: true };
      const bounds = rects.reduce((result, rect) => ({
        left: Math.min(result.left, rect.left),
        top: Math.min(result.top, rect.top),
        right: Math.max(result.right, rect.right),
        bottom: Math.max(result.bottom, rect.bottom),
      }), {
        left: rects[0].left,
        top: rects[0].top,
        right: rects[0].right,
        bottom: rects[0].bottom,
      });
      return {
        text: selection.toString(),
        rect: {
          x: bounds.left,
          y: bounds.top,
          width: bounds.right - bounds.left,
          height: bounds.bottom - bounds.top,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    },
  });
  if (injection?.result?.empty) throw new Error(t('emptySelection'));
  return injection.result;
}

async function cropSelection(dataUrl, rect, viewport) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const scaleX = image.naturalWidth / viewport.width;
  const scaleY = image.naturalHeight / viewport.height;
  const left = Math.max(0, Math.floor(rect.x * scaleX));
  const top = Math.max(0, Math.floor(rect.y * scaleY));
  const right = Math.min(image.naturalWidth, Math.ceil((rect.x + rect.width) * scaleX));
  const bottom = Math.min(image.naturalHeight, Math.ceil((rect.y + rect.height) * scaleY));
  if (right <= left || bottom <= top) throw new Error(t('offscreenSelection'));

  const scale = Math.min(1, 1200 / (right - left), 1200 / (bottom - top));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((right - left) * scale));
  canvas.height = Math.max(1, Math.round((bottom - top) * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error(t('screenshotFailed'));
  context.drawImage(
    image, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height,
  );
  return canvas.toDataURL('image/png');
}

function showPreview(dataUrl) {
  screenshotDataUrl = dataUrl;
  $('preview').style.backgroundImage = `url("${dataUrl}")`;
  $('preview').hidden = false;
  $('removeImageBtn').hidden = false;
}

function removeScreenshot() {
  screenshotDataUrl = null;
  $('preview').style.backgroundImage = '';
  $('preview').hidden = true;
  $('removeImageBtn').hidden = true;
}

async function insertSelection() {
  setStatus('');
  try {
    const tab = await getActiveTab();
    const selection = await readSelection(tab.id);
    const note = $('note');
    const prefix = note.value && !note.value.endsWith('\n') ? '\n' : '';
    note.value += `${prefix}${selection.text}`;
    setStatus(t('selectionAdded'), 'ok');
  } catch (error) {
    setStatus(t('selectionError', { error: error.message }), 'err');
  }
}

async function captureSelection() {
  setStatus('');
  try {
    const tab = await getActiveTab();
    const selection = await readSelection(tab.id);
    const screenshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    showPreview(await cropSelection(screenshot, selection.rect, selection.viewport));
    setStatus(t('screenshotAdded'), 'ok');
  } catch (error) {
    setStatus(t('screenshotError', { error: error.message }), 'err');
  }
}

async function save() {
  const sectionId = $('sectionSelect').value;
  const text = $('note').value;
  if (!sectionId) return setStatus(t('chooseSectionError'), 'err');
  if (!text.trim() && !screenshotDataUrl) return setStatus(t('emptyNote'), 'err');

  setBusy($('saveBtn'), true);
  setStatus('');
  try {
    const tab = await getActiveTab();
    const result = await nativeRequest({
      command: 'createPage',
      sectionId,
      title: tab.title || 'Firefox note',
      text,
      imageData: screenshotDataUrl,
    });
    setStatus(t('saveSuccess', { title: result.title }), 'ok');
    $('note').value = '';
    removeScreenshot();
  } catch (error) {
    setStatus(t('saveError', { error: error.message }), 'err');
  } finally {
    setBusy($('saveBtn'), false);
  }
}

$('saveBtn').addEventListener('click', save);
$('continueBtn').addEventListener('click', async () => {
  language = OneNoteI18n.getLanguage($('languageSelect').value);
  await browser.storage.local.set({ language });
  applyLanguage();
  $('languageGate').hidden = true;
  $('app').hidden = false;
  await loadSections().catch((error) => {
    setStatus(t('connectionError', { error: error.message }), 'err');
  });
});
$('languageSelect').addEventListener('change', async () => {
  language = OneNoteI18n.getLanguage($('languageSelect').value);
  applyLanguage();
  const { language: savedLanguage } = await browser.storage.local.get('language');
  if (!savedLanguage) return;
  await browser.storage.local.set({ language });
  const result = await browser.runtime.sendMessage({ type: 'onenote:set-language', language });
  if (result?.error) setStatus(result.error, 'err');
});
$('sectionSelect').addEventListener('change', async () => {
  const sectionId = $('sectionSelect').value;
  const section = sections.find((item) => item.id === sectionId);
  if (sectionId) {
    await browser.storage.local.set({
      targetSectionId: sectionId,
      targetSectionName: `${section.notebook} / ${section.group ? `${section.group} / ` : ''}${section.name}`,
    });
  } else {
    await browser.storage.local.remove(['targetSectionId', 'targetSectionName']);
  }
});
$('insertSelectionBtn').addEventListener('click', insertSelection);
$('captureSelectionBtn').addEventListener('click', captureSelection);
$('removeImageBtn').addEventListener('click', removeScreenshot);
$('refreshSectionsBtn').addEventListener('click', async () => {
  setStatus('');
  try {
    await loadSections();
  } catch (error) {
    setStatus(t('refreshError', { error: error.message }), 'err');
  }
});

(async function init() {
  try {
    const { language: savedLanguage } = await browser.storage.local.get('language');
    language = OneNoteI18n.getLanguage(
      savedLanguage || (navigator.language.toLowerCase().startsWith('en') ? 'en' : 'tr'),
    );
    $('languageSelect').value = language;
    applyLanguage();
    if (!savedLanguage) {
      $('languageGate').hidden = false;
      return;
    }
    $('app').hidden = false;
    await loadSections();
  } catch (error) {
    setStatus(t('connectionError', { error: error.message }), 'err');
  }
})();

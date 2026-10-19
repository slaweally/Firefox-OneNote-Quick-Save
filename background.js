'use strict';

const NATIVE_HOST = 'com.onenote.quick_save';
const MENU_ROOT = 'onenote-send-root';
const MENU_TEXT = 'onenote-send-text';
const MENU_IMAGE = 'onenote-send-image';
const sectionsByMenuId = new Map();
let setupPromise = null;

async function getLanguage() {
  const { language } = await browser.storage.local.get('language');
  return OneNoteI18n.getLanguage(
    language || (browser.i18n.getUILanguage().toLowerCase().startsWith('en') ? 'en' : 'tr'),
  );
}

async function translate(key, values) {
  return OneNoteI18n.t(key, await getLanguage(), values);
}

async function showNotice(message, error = false) {
  try {
    const language = await getLanguage();
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/onenote.svg'),
      title: error
        ? OneNoteI18n.t('notificationErrorTitle', language)
        : 'OneNote Quick Save',
      message,
    });
  } catch (notificationError) {
    console.error('OneNote notification could not be displayed:', notificationError);
  }
}

async function nativeRequest(message) {
  let response;
  try {
    response = await browser.runtime.sendNativeMessage(NATIVE_HOST, message);
  } catch (error) {
    if (error.message.toLowerCase().includes('no such native application')
      || error.message.toLowerCase().includes('failed to connect to the native messaging host')) {
      throw new Error(await translate('nativeMissing'));
    }
    throw error;
  }
  if (!response?.ok) {
    throw new Error(response?.error || await translate('refreshError', { error: '' }));
  }
  return response;
}

function addSectionMenu(actionId, actionTitle, section, index) {
  const notebookName = section.notebook || 'Notebook';
  const groupPath = section.group || '';
  const branchId = `${actionId}-notebook-${index}`;
  browser.contextMenus.create({
    id: branchId,
    parentId: actionId,
    title: notebookName,
    contexts: ['selection'],
  });

  let parentId = branchId;
  if (groupPath) {
    const groupId = `${actionId}-group-${index}`;
    browser.contextMenus.create({
      id: groupId,
      parentId: branchId,
      title: groupPath,
      contexts: ['selection'],
    });
    parentId = groupId;
  }

  const menuId = `${actionId}-section-${index}`;
  browser.contextMenus.create({
    id: menuId,
    parentId,
    title: section.name,
    contexts: ['selection'],
  });
  sectionsByMenuId.set(menuId, { ...section, actionTitle });
}

function setupMenus() {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    await browser.contextMenus.removeAll();
    sectionsByMenuId.clear();
    const language = await getLanguage();
    const result = await nativeRequest({ command: 'listSections' });
    if (!result.sections.length) {
      throw new Error(OneNoteI18n.t('noContextSections', language));
    }

    browser.contextMenus.create({
      id: MENU_ROOT,
      title: OneNoteI18n.t('menuRoot', language),
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: MENU_TEXT,
      parentId: MENU_ROOT,
      title: OneNoteI18n.t('textRoot', language),
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: MENU_IMAGE,
      parentId: MENU_ROOT,
      title: OneNoteI18n.t('imageRoot', language),
      contexts: ['selection'],
    });

    result.sections.forEach((section, index) => {
      addSectionMenu(MENU_TEXT, 'text', section, index);
      addSectionMenu(MENU_IMAGE, 'image', section, index);
    });
  })().catch(async (error) => {
    await showNotice(await translate('refreshContextError', { error: error.message }), true);
    throw error;
  }).finally(() => {
    setupPromise = null;
  });
  return setupPromise;
}

browser.runtime.onInstalled.addListener(() => {
  setupMenus().catch((error) => console.error('OneNote menus could not be installed:', error));
});
browser.runtime.onStartup.addListener(() => {
  setupMenus().catch((error) => console.error('OneNote menus could not be restored:', error));
});
browser.runtime.onMessage.addListener((message) => {
  if (message?.type === 'onenote:set-language' || message?.type === 'onenote:refresh-menus') {
    return setupMenus().then(() => ({ ok: true }), (error) => ({ error: error.message }));
  }
  return undefined;
});
browser.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenu(info, tab).catch((error) => showNotice(error.message, true));
});

setupMenus().catch((error) => console.error('OneNote menus could not be initialized:', error));

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
  const selection = injection?.result;
  if (selection?.empty) throw new Error(await translate('noSelection'));
  return selection;
}

async function cropSelection(dataUrl, rect, viewport) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const language = await getLanguage();
    const scaleX = bitmap.width / viewport.width;
    const scaleY = bitmap.height / viewport.height;
    const left = Math.max(0, Math.floor(rect.x * scaleX));
    const top = Math.max(0, Math.floor(rect.y * scaleY));
    const right = Math.min(bitmap.width, Math.ceil((rect.x + rect.width) * scaleX));
    const bottom = Math.min(bitmap.height, Math.ceil((rect.y + rect.height) * scaleY));
    if (right <= left || bottom <= top) throw new Error(await translate('imageNotVisible'));

    let scale = Math.min(1, 1200 / (right - left), 1200 / (bottom - top));
    let canvas = new OffscreenCanvas(
      Math.max(1, Math.round((right - left) * scale)),
      Math.max(1, Math.round((bottom - top) * scale)),
    );
    const draw = (target) => {
      const context = target.getContext('2d');
      if (!context) throw new Error(OneNoteI18n.t('imageCreateFailed', language));
      context.drawImage(
        bitmap, left, top, right - left, bottom - top,
        0, 0, target.width, target.height,
      );
    };

    draw(canvas);
    let png = await canvas.convertToBlob({ type: 'image/png' });
    while (png.size > 2 * 1024 * 1024 && scale > 0.2) {
      scale *= 0.75;
      canvas = new OffscreenCanvas(
        Math.max(1, Math.round((right - left) * scale)),
        Math.max(1, Math.round((bottom - top) * scale)),
      );
      draw(canvas);
      png = await canvas.convertToBlob({ type: 'image/png' });
    }
    if (png.size > 2 * 1024 * 1024) throw new Error(await translate('imageTooLarge'));

    const bytes = new Uint8Array(await png.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } finally {
    bitmap.close();
  }
}

async function handleContextMenu(info, tab) {
  const section = sectionsByMenuId.get(info.menuItemId);
  if (!section) throw new Error(await translate('menuMissing'));
  if (!tab?.id) throw new Error(await translate('noActiveTab'));

  const title = (tab.title || 'Firefox note').slice(0, 150);
  let text = '';
  let imageData = null;
  if (section.actionTitle === 'text') {
    text = (info.selectionText || '').trim();
    if (!text) throw new Error(await translate('noSelection'));
  } else {
    const selection = await readSelection(tab.id);
    const screenshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    imageData = await cropSelection(screenshot, selection.rect, selection.viewport);
  }

  await nativeRequest({
    command: 'createPage',
    sectionId: section.id,
    title,
    text,
    imageData,
  });
  await showNotice(await translate(
    section.actionTitle === 'text' ? 'textSent' : 'imageSent',
    { title, section: section.name },
  ));
}

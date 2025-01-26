const FAVICONS = [
  "hot_1.png",
  "hot_2.png",
  "hot_3.png",
  "hot_4.png",
  "hot_5.png",
  "hot_6.png",
];

// LIB

function temporaryHideAllOriginalFavicons() {
  const favs = [
    ...document.querySelectorAll('link[rel*="icon"],link[rel*="apple"]'),
  ];
  favs.forEach((e) => {
    const h = e.getAttribute("href");
    if (h === null) {
      return;
    }
    e.setAttribute("original-href", h);
    e.removeAttribute("href");
  });
}

function showAllOriginalFavicons() {
  [...document.querySelectorAll("link[data-tabaholic]")].forEach((e) => {
    e.remove();
  });
  [...document.querySelectorAll("link[original-href]")].forEach((e) => {
    const h = e.getAttribute("original-href");
    e.removeAttribute("original-href");
    e.setAttribute("href", h);
  });

  // prepend default favicon.ico - this fixes sites where they don't include link tag
  const link = document.createElement("link");
  link.setAttribute("href", "favicon.ico");
  link.setAttribute("rel", "icon");
  document.head.prepend(link);
}

/**
 * @param {number} counter
 * @param {string[]} faviconPaths
 */
function changeFaviconTo(counter, faviconPaths) {
  const c = Math.min(counter, faviconPaths.length - 1);

  // instead of appending new one, we can just replace existing one if exists
  const l = document.querySelector(`link[data-tabaholic]`);
  const favUrl = chrome.runtime.getURL(`/favicons/${faviconPaths[c]}`);
  if (l === null) {
    // append new one
    const linkEl = document.createElement("link");
    linkEl.rel = "icon";
    linkEl.dataset["tabaholic"] = "1";
    linkEl.href = favUrl;
    document.head.append(linkEl);
  } else {
    // replace
    l.setAttribute("href", favUrl);
  }
}

// CHROME APIs - functions in chrome API are executed in different
// context and can't access anything outside of the function body

async function chromeTemporaryHideAllOriginalFavicons(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: temporaryHideAllOriginalFavicons,
    args: [],
  });
}

async function chromeShowAllOriginalFavicons(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: showAllOriginalFavicons,
    args: [],
  });
}

/**
 * @param {number} tabId
 * @param {number} counter favicon n-th path
 */
async function chromeChangeFaviconTo(tabId, counter) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: changeFaviconTo,
    args: [counter, FAVICONS],
  });
}

// TAB watching - change favicons

/** @type {Map<string, any>} */
const tabStates = new Map();

/** @type {?number} */
let lastUsedTab = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    /** @type {number} */
    const currentTabId = activeInfo.tabId;

    // Clear any existing interval for this tab
    if (tabStates.has(currentTabId)) {
      // we are back to tab we visited, we need to stop and bring the favicon back
      clearInterval(tabStates.get(currentTabId).interval);
      // reset to default
      await chromeShowAllOriginalFavicons(currentTabId);
    }

    if (lastUsedTab === null) {
      // do nothing and save this tab
      lastUsedTab = currentTabId;
      return;
    }

    if (lastUsedTab === currentTabId) {
      return;
    }

    const tId = lastUsedTab;
    lastUsedTab = currentTabId;

    let secondsLeft = FAVICONS.length - 1;

    // start immediately
    await chromeTemporaryHideAllOriginalFavicons(tId);
    await chromeChangeFaviconTo(tId, secondsLeft);

    let interval = setInterval(async () => {
      // we want to execute favicon on secondsLeft === 0
      if (secondsLeft <= -1) {
        clearInterval(interval);
        await chromeShowAllOriginalFavicons(tId);
        tabStates.delete(tId);
        return;
      } else {
        await chromeTemporaryHideAllOriginalFavicons(tId);
        await chromeChangeFaviconTo(tId, secondsLeft);
      }

      secondsLeft -= 1;
    }, 2000);

    tabStates.set(tId, {
      interval,
    });
  } catch (error) {
    console.error(error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates.has(tabId)) {
    clearInterval(tabStates.get(tabId).interval);
    tabStates.delete(tabId);
  }
});

// Configuration
const DECAY_DURATION_MS = 5000; // Time for the color to fully decay (5 seconds)
const UPDATE_INTERVAL_MS = 1000; // Update every second
const EMOJI_NUMBERS = [
  "0️⃣",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
];
const SECONDS_COUNTER = EMOJI_NUMBERS.length - 1;
const TITLE_DELIMITER = " - ";
const tabStates = new Map();
/** @type {?number} */
let lastUsedTab = null;

// Helper function to update tab title
async function updateTabTitle(tabId, originalTitle, secondsLeft) {
  const emoji = EMOJI_NUMBERS[Math.min(secondsLeft, EMOJI_NUMBERS.length - 1)];
  const newTitle = `${emoji}${TITLE_DELIMITER}${originalTitle}`;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (title) => {
        document.title = title;
      },
      args: [newTitle],
    });
  } catch (error) {
    // Silence is golden
  }
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const currentTabId = activeInfo.tabId;

    if (lastUsedTab === null) {
      // do nothing and save this tab
      lastUsedTab = currentTabId;
      return;
    }

    if (lastUsedTab === currentTabId) {
      return;
    }

    // tabId that we want to change
    const tabId = lastUsedTab;
    // update the global state to point to the current tab as previous
    lastUsedTab = currentTabId;

    // Get the current tab title
    const tab = await chrome.tabs.get(tabId);
    let originalTitle = tab.title;

    // If title already has our counter, get the original part
    if (originalTitle.includes(TITLE_DELIMITER)) {
      originalTitle = originalTitle.split(TITLE_DELIMITER)[1];
    }

    // Clear any existing interval for this tab
    if (tabStates.has(tabId)) {
      clearInterval(tabStates.get(tabId).interval);
    }

    // Set initial state
    // const startTime = Date.now();
    let secondsLeft = 10;
    let interval = setInterval(async () => {
      if (secondsLeft <= 0) {
        clearInterval(interval);

        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (title) => {
            document.title = title;
          },
          args: [originalTitle],
        });

        tabStates.delete(tabId);
      } else {
        await updateTabTitle(tabId, originalTitle, secondsLeft);
      }

      secondsLeft -= 1;
    }, UPDATE_INTERVAL_MS);

    // Store the state
    tabStates.set(tabId, {
      interval,
      originalTitle,
    });

    // Set initial title
    await updateTabTitle(tabId, originalTitle, SECONDS_COUNTER);
  } catch (e) {
    console.error("extions error", e);
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates.has(tabId)) {
    clearInterval(tabStates.get(tabId).interval);
    tabStates.delete(tabId);
  }
});

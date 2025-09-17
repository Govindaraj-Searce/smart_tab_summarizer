// This function calls the cloud-based Gemini Pro API
async function summarizeWithGeminiAPI(text) {
    const data = await chrome.storage.local.get('geminiApiKey');
    const API_KEY = data.geminiApiKey;
  
    if (!API_KEY) {
        return "Error: Gemini API key is not set.";
    }
  
    // Correct code
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;
    const requestBody = {
        "contents": [{
            "parts": [{"text": `Summarize this in 3 sentences:\n\n${text}`}]
        }]
    };
  
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody)
        });
  
        if (!response.ok) {
            const errorData = await response.json();
            console.error("API Error:", errorData);
            return `API Error: ${errorData.error.message}`;
        }
  
        const responseData = await response.json();
        return responseData.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Network Error:", error);
        return "Network error or invalid API key.";
    }
  }
  
  // The rest of your background script, now calling the cloud function
  async function summarizeAndStore(tabId, text, title, favIconUrl) {
    if (!text || text.trim().length < 100) return;
  
    // We now call our new cloud function
    const summary = await summarizeWithGeminiAPI(text);
  
    const data = { title, summary, favIconUrl };
    await chrome.storage.local.set({ [tabId]: data });
    console.log(`Cloud summary stored for tab ${tabId}`);
  }
  
  // --- All other functions (getTextFromTab, handleTabUpdate, listeners) remain the same ---
  
  async function getTextFromTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['lib/Readability.js', 'content.js'],
        });
        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
    } catch (e) {
        console.error(`Could not extract text from tab ${tabId}:`, e);
    }
    return null;
  }
  
  async function handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
        const text = await getTextFromTab(tabId);
        if (text) {
            await summarizeAndStore(tabId, text, tab.title, tab.favIconUrl);
        }
    }
  }
  
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(tabId.toString());
  });
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAllTabs") {
        chrome.tabs.query({}, async (tabs) => {
            const storageData = await chrome.storage.local.get(null);
            const responseData = tabs.map(tab => ({
              id: tab.id,
              title: tab.title,
              url: tab.url,
              favIconUrl: tab.favIconUrl,
              windowId: tab.windowId, // <-- ADD THIS LINE
              summary: storageData[tab.id] ? storageData[tab.id].summary : "No summary available yet."
          }));
          sendResponse(responseData);
        });
        return true;
    }
  });
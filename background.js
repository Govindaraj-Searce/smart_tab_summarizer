// Enhanced background script with better summarization and topic detection

// This function calls the cloud-based Gemini Pro API with enhanced prompting
async function summarizeWithGeminiAPI(text, title, url) {
    const data = await chrome.storage.local.get('geminiApiKey');
    const API_KEY = data.geminiApiKey;
  
    if (!API_KEY) {
      return "Error: Gemini API key is not set.";
    }
  
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;
    
    // Enhanced prompt for better categorization and summarization
    const prompt = `Analyze this webpage and Summarize this in 3 sentences:\n\n${text}, focusing on the main purpose and key information.
  
  Content:
  ${text.substring(0, 3000)}
  
  Summary:`;
  
    const requestBody = {
      "contents": [{
        "parts": [{"text": prompt}]
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
        return `API Error: ${errorData.error?.message || 'Unknown error'}`;
      }
  
      const responseData = await response.json();
      return responseData.candidates[0]?.content?.parts[0]?.text || "Unable to generate summary";
    } catch (error) {
      console.error("Network Error:", error);
      return "Network error or invalid API key.";
    }
  }
  
  // Fallback local summarization for when API is unavailable
  function generateLocalSummary(text, title, url) {
    // Simple keyword extraction and sentence scoring
    const sentences = text.split(/[.!?]+/).filter(s => s.length > 20);
    if (sentences.length === 0) return "No content available for summary.";
  
    // Score sentences based on position and keyword relevance
    const titleWords = title.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const urlKeywords = extractUrlKeywords(url);
    
    const scoredSentences = sentences.slice(0, 10).map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      let score = 0;
      
      // Higher score for sentences containing title words
      titleWords.forEach(word => {
        if (lowerSentence.includes(word)) score += 2;
      });
      
      // Higher score for sentences containing URL keywords
      urlKeywords.forEach(word => {
        if (lowerSentence.includes(word)) score += 1;
      });
      
      // Prefer sentences at the beginning
      score += (10 - sentences.indexOf(sentence)) * 0.1;
      
      return { sentence: sentence.trim(), score };
    });
  
    // Get top 2-3 sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(item => item.sentence)
      .join('. ');
  
    return topSentences || sentences[0];
  }
  
  function extractUrlKeywords(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const pathKeywords = urlObj.pathname.split('/').filter(p => p.length > 2);
      return [domain.split('.')[0], ...pathKeywords];
    } catch {
      return [];
    }
  }
  
  // Enhanced tab data processing with retry mechanism
  async function summarizeAndStore(tabId, text, title, favIconUrl, url) {
    if (!text || text.trim().length < 100) {
      await chrome.storage.local.set({ 
        [tabId]: { 
          title, 
          summary: "Content too short for summarization",
          favIconUrl,
          url,
          timestamp: Date.now()
        } 
      });
      return;
    }
  
    let summary;
    
    try {
      // Try API first
      summary = await summarizeWithGeminiAPI(text, title, url);
      
      // If API fails, use local summarization
      if (summary.includes("Error:") || summary.includes("Network error")) {
        summary = generateLocalSummary(text, title, url);
      }
    } catch (error) {
      console.error("Summarization error:", error);
      summary = generateLocalSummary(text, title, url);
    }
  
    const data = { 
      title, 
      summary, 
      favIconUrl,
      url,
      timestamp: Date.now(),
      domain: extractDomain(url)
    };
    
    await chrome.storage.local.set({ [tabId]: data });
    console.log(`Summary stored for tab ${tabId}: ${title}`);
  }
  
  function extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
  
  // Enhanced text extraction with better error handling
  async function getTextFromTab(tabId) {
    try {
      // Check if tab still exists
      const tab = await chrome.tabs.get(tabId);
      if (!tab) return null;
  
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['lib/Readability.js', 'content.js'],
      });
      
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
    } catch (e) {
      console.error(`Could not extract text from tab ${tabId}:`, e);
      
      // Try alternative extraction method
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            // Fallback text extraction
            const content = document.body?.innerText || document.textContent || '';
            return content.substring(0, 5000); // Limit content size
          }
        });
        return results[0]?.result;
      } catch (fallbackError) {
        console.error(`Fallback extraction also failed for tab ${tabId}:`, fallbackError);
      }
    }
    return null;
  }
  
  // Enhanced tab update handler with debouncing
  const processingTabs = new Set();
  
  async function handleTabUpdate(tabId, changeInfo, tab) {
    // Only process completed loads of HTTP(S) pages
    if (changeInfo.status !== 'complete' || 
        !tab.url || 
        (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) ||
        processingTabs.has(tabId)) {
      return;
    }
  
    // Skip certain URLs
    const skipUrls = [
      'chrome://', 'chrome-extension://', 'moz-extension://',
      'about:', 'data:', 'javascript:', 'file://'
    ];
    
    if (skipUrls.some(prefix => tab.url.startsWith(prefix))) {
      return;
    }
  
    processingTabs.add(tabId);
    
    try {
      // Add a small delay to ensure page is fully loaded
      setTimeout(async () => {
        try {
          const text = await getTextFromTab(tabId);
          if (text) {
            await summarizeAndStore(tabId, text, tab.title, tab.favIconUrl, tab.url);
          }
        } catch (error) {
          console.error(`Error processing tab ${tabId}:`, error);
        } finally {
          processingTabs.delete(tabId);
        }
      }, 2000); // 2 second delay
      
    } catch (error) {
      console.error(`Error in handleTabUpdate for tab ${tabId}:`, error);
      processingTabs.delete(tabId);
    }
  }
  
  // Enhanced message handling with additional actions
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAllTabs") {
      chrome.tabs.query({}, async (tabs) => {
        try {
          const storageData = await chrome.storage.local.get(null);
          const responseData = tabs
            .filter(tab => tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https')))
            .map(tab => ({
              id: tab.id,
              title: tab.title || 'Untitled',
              url: tab.url,
              favIconUrl: tab.favIconUrl,
              windowId: tab.windowId,
              pinned: tab.pinned,
              active: tab.active,
              summary: storageData[tab.id]?.summary || "Summary being generated...",
              domain: extractDomain(tab.url),
              timestamp: storageData[tab.id]?.timestamp || Date.now()
            }))
            .sort((a, b) => {
              // Sort by pinned status first, then by last activity
              if (a.pinned !== b.pinned) return b.pinned - a.pinned;
              return b.timestamp - a.timestamp;
            });
          
          sendResponse(responseData);
        } catch (error) {
          console.error("Error in getAllTabs:", error);
          sendResponse([]);
        }
      });
      return true; // Indicates we will respond asynchronously
    }
    
    if (request.action === "refreshTab") {
      const { tabId } = request;
      chrome.tabs.get(tabId, async (tab) => {
        if (tab) {
          const text = await getTextFromTab(tabId);
          if (text) {
            await summarizeAndStore(tabId, text, tab.title, tab.favIconUrl, tab.url);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: "Could not extract text" });
          }
        }
      });
      return true;
    }
  
    if (request.action === "setApiKey") {
      chrome.storage.local.set({ geminiApiKey: request.apiKey }, () => {
        sendResponse({ success: true });
      });
      return true;
    }
  });
  
  // Event listeners
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  
  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(tabId.toString());
    processingTabs.delete(tabId);
  });
  
  // Clean up old storage data periodically
  chrome.alarms.create('cleanupStorage', { delayInMinutes: 60, periodInMinutes: 60 });
  
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanupStorage') {
      const storageData = await chrome.storage.local.get(null);
      const currentTabs = await chrome.tabs.query({});
      const currentTabIds = new Set(currentTabs.map(tab => tab.id.toString()));
      
      // Remove storage entries for tabs that no longer exist
      const keysToRemove = Object.keys(storageData).filter(key => 
        key !== 'geminiApiKey' && !currentTabIds.has(key)
      );
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} orphaned storage entries`);
      }
    }
  });
  
  // Initialize extension - process existing tabs
  chrome.runtime.onStartup.addListener(async () => {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.status === 'complete') {
        handleTabUpdate(tab.id, { status: 'complete' }, tab);
      }
    }
  });
  
  // Handle extension installation
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('Smart Tab Organizer installed successfully');
      // You could open a setup page here if needed
    }
  });
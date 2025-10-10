// Enhanced background script with AI-based topic classification

// Call Gemini API to get summary and topic classification
async function summarizeAndClassifyWithGemini(text, title, url) {
  const data = await chrome.storage.local.get('geminiApiKey');
  const API_KEY = data.geminiApiKey;

  if (!API_KEY) {
    return {
      summary: "Error: Gemini API key is not set.",
      topic: "other"
    };
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;
  
  // Enhanced prompt for better categorization and summarization
  const prompt = `Analyze this webpage and provide:
1. Summary (2-3 sentences)
  - Focus on the PRIMARY purpose and main content of the page
  - Be specific and factual—avoid generic statements
  - Include key information that distinguishes this page from others
  - If it's a landing page, mention what product/service it offers
  - If it's an article, capture the main thesis or findings

2. Topic Classification
  Classify into ONE category that BEST represents the page's primary purpose:
  - **development**: Programming, coding, software development, developer tools, technical documentation, APIs, frameworks
  - **research**: Academic papers, scientific studies, research findings, scholarly articles, data analysis
  - **social**: Social media platforms, forums, community discussions, messaging, social networking
  - **entertainment**: Streaming services, games, movies, TV shows, music, videos, memes, leisure content
  - **news**: Current events, journalism, news articles, press releases, breaking news
  - **shopping**: E-commerce, product listings, online stores, marketplaces, price comparisons
  - **productivity**: Project management, note-taking, calendars, task management, collaboration tools, business software
  - **health**: Medical information, fitness, wellness, mental health, healthcare services, nutrition
  - **finance**: Banking, investing, cryptocurrency, personal finance, accounting, financial news, trading
  - **travel**: Booking sites, destination guides, travel blogs, maps, transportation, accommodation
  - **other**: Content that doesn't fit the above categories (educational resources, documentation, personal blogs, portfolios, government sites, etc.)

  ### Classification Guidelines:
  - Choose based on PRIMARY purpose, not secondary features
  - For hybrid pages (e.g., news about technology), prioritize the format over the subject
  - Company/product pages go to their industry category (e.g., a SaaS product → productivity/development)
  - Informational tech blogs about coding → development
  - General tech news → news

Title: ${title}
URL: ${url}
Content: ${text.substring(0, 10000)}

Respond in this exact JSON format:
{
  "summary": "your summary here",
  "topic": "category_name"
}`;

  const requestBody = {
    "contents": [{
      "parts": [{"text": prompt}]
    }],
    "generationConfig": {
      "temperature": 0.3,
      "topK": 1,
      "topP": 1,
      "maxOutputTokens": 500
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      console.error("Status:", response.status, response.statusText);
      return generateLocalSummaryAndTopic(text, title, url);
    }

    const responseData = await response.json();
    console.log("Gemini API Response:", responseData);
    
    const responseText = responseData.candidates[0]?.content?.parts[0]?.text || "";
    
    if (!responseText) {
      console.error("Empty response from Gemini API");
      return generateLocalSummaryAndTopic(text, title, url);
    }
    
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to find JSON in code blocks
        jsonMatch = responseText.match(/```json\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) jsonMatch = [jsonMatch[1]];
      }
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log("Parsed result:", result);
        return {
          summary: result.summary || "Unable to generate summary",
          topic: validateTopic(result.topic)
        };
      } else {
        console.error("Could not find JSON in response:", responseText);
      }
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      console.error("Response text:", responseText);
    }
    
    return generateLocalSummaryAndTopic(text, title, url);
  } catch (error) {
    console.error("Network Error calling Gemini:", error);
    return generateLocalSummaryAndTopic(text, title, url);
  }
}

// Validate topic is one of the allowed categories
function validateTopic(topic) {
  const validTopics = ['development', 'research', 'social', 'entertainment', 'news', 'shopping', 'productivity', 'health', 'finance', 'travel'];
  const normalizedTopic = topic?.toLowerCase().trim();
  return validTopics.includes(normalizedTopic) ? normalizedTopic : 'other';
}

// Fallback local summarization and topic detection
function generateLocalSummaryAndTopic(text, title, url) {
  const sentences = text.split(/[.!?]+/).filter(s => s.length > 20);
  if (sentences.length === 0) {
    return {
      summary: "No content available for summary.",
      topic: detectTopicFromUrl(url)
    };
  }

  const titleWords = title.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const urlKeywords = extractUrlKeywords(url);
  
  const scoredSentences = sentences.slice(0, 10).map(sentence => {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;
    
    titleWords.forEach(word => {
      if (lowerSentence.includes(word)) score += 2;
    });
    
    urlKeywords.forEach(word => {
      if (lowerSentence.includes(word)) score += 1;
    });
    
    score += (10 - sentences.indexOf(sentence)) * 0.1;
    
    return { sentence: sentence.trim(), score };
  });

  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(item => item.sentence)
    .join('. ');

  return {
    summary: topSentences || sentences[0],
    topic: detectTopicFromUrl(url)
  };
}

// Simple topic detection from URL as fallback
function detectTopicFromUrl(url) {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('github') || urlLower.includes('stackoverflow') || urlLower.includes('dev')) {
    return 'development';
  } else if (urlLower.includes('youtube') || urlLower.includes('netflix') || urlLower.includes('spotify')) {
    return 'entertainment';
  } else if (urlLower.includes('twitter') || urlLower.includes('facebook') || urlLower.includes('reddit')) {
    return 'social';
  } else if (urlLower.includes('amazon') || urlLower.includes('shop') || urlLower.includes('ebay')) {
    return 'shopping';
  } else if (urlLower.includes('news') || urlLower.includes('cnn') || urlLower.includes('bbc')) {
    return 'news';
  } else if (urlLower.includes('gmail') || urlLower.includes('docs') || urlLower.includes('notion')) {
    return 'productivity';
  } else if (urlLower.includes('health') || urlLower.includes('fitness') || urlLower.includes('medical')) {
    return 'health';
  } else if (urlLower.includes('finance') || urlLower.includes('bank') || urlLower.includes('invest')) {
    return 'finance';
  } else if (urlLower.includes('travel') || urlLower.includes('hotel') || urlLower.includes('flight')) {
    return 'travel';
  }
  
  return 'other';
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

// Enhanced tab data processing
async function summarizeAndStore(tabId, text, title, favIconUrl, url) {
  if (!text || text.trim().length < 100) {
    await chrome.storage.local.set({ 
      [tabId]: { 
        title, 
        summary: "Content too short for summarization",
        topic: detectTopicFromUrl(url),
        favIconUrl,
        url,
        timestamp: Date.now()
      } 
    });
    return;
  }

  let result;
  
  try {
    result = await summarizeAndClassifyWithGemini(text, title, url);
    
    if (result.summary.includes("Error:") || result.summary.includes("Network error")) {
      result = generateLocalSummaryAndTopic(text, title, url);
    }
  } catch (error) {
    console.error("Summarization error:", error);
    result = generateLocalSummaryAndTopic(text, title, url);
  }

  const data = { 
    title, 
    summary: result.summary, 
    topic: result.topic,
    favIconUrl,
    url,
    timestamp: Date.now(),
    domain: extractDomain(url)
  };
  
  await chrome.storage.local.set({ [tabId]: data });
  console.log(`Summary and topic stored for tab ${tabId}: ${title} [${result.topic}]`);
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

async function getTextFromTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return null;

    // First try with Readability
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['lib/Readability.js', 'content.js'],
      });
      
      if (results && results[0] && results[0].result) {
        console.log(`Extracted ${results[0].result.length} characters from tab ${tabId}`);
        return results[0].result;
      }
    } catch (readabilityError) {
      console.log(`Readability failed for tab ${tabId}, trying fallback`);
    }
    
    // Fallback: direct text extraction
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => {
        // Try multiple methods to get content
        const getText = () => {
          // Method 1: Get article content
          const article = document.querySelector('article');
          if (article) return article.innerText;
          
          // Method 2: Get main content
          const main = document.querySelector('main');
          if (main) return main.innerText;
          
          // Method 3: Get content divs
          const content = document.querySelector('.content, #content, [role="main"]');
          if (content) return content.innerText;
          
          // Method 4: Get body text
          return document.body?.innerText || document.textContent || '';
        };
        
        const text = getText();
        return text.substring(0, 15000); // Increased limit
      }
    });
    
    if (results && results[0] && results[0].result) {
      console.log(`Fallback extracted ${results[0].result.length} characters from tab ${tabId}`);
      return results[0].result;
    }
  } catch (e) {
    console.error(`Could not extract text from tab ${tabId}:`, e);
  }
  return null;
}

const processingTabs = new Set();

async function handleTabUpdate(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete' || 
      !tab.url || 
      (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) ||
      processingTabs.has(tabId)) {
    return;
  }

  const skipUrls = [
    'chrome://', 'chrome-extension://', 'moz-extension://',
    'about:', 'data:', 'javascript:', 'file://'
  ];
  
  if (skipUrls.some(prefix => tab.url.startsWith(prefix))) {
    return;
  }

  processingTabs.add(tabId);
  
  // Process immediately without delay
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
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request.action);
  
  if (request.action === "getAllTabs") {
    chrome.tabs.query({}, async (tabs) => {
      console.log("Total tabs found:", tabs.length);
      
      try {
        const storageData = await chrome.storage.local.get(null);
        console.log("Storage data keys:", Object.keys(storageData));
        
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
            summary: storageData[tab.id]?.summary || "Analyzing content...",
            topic: storageData[tab.id]?.topic || "other",
            domain: extractDomain(tab.url),
            timestamp: storageData[tab.id]?.timestamp || Date.now()
          }))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned - a.pinned;
            return b.timestamp - a.timestamp;
          });
        
        console.log("Sending response with tabs:", responseData.length);
        sendResponse(responseData);
      } catch (error) {
        console.error("Error in getAllTabs:", error);
        sendResponse([]);
      }
    });
    return true;
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

chrome.tabs.onUpdated.addListener(handleTabUpdate);

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(tabId.toString());
  processingTabs.delete(tabId);
});

// Clean up old storage data periodically (with safety check)
if (chrome.alarms) {
  chrome.alarms.create('cleanupStorage', { delayInMinutes: 60, periodInMinutes: 60 });
  
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanupStorage') {
      const storageData = await chrome.storage.local.get(null);
      const currentTabs = await chrome.tabs.query({});
      const currentTabIds = new Set(currentTabs.map(tab => tab.id.toString()));
      
      const keysToRemove = Object.keys(storageData).filter(key => 
        key !== 'geminiApiKey' && !currentTabIds.has(key)
      );
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} orphaned storage entries`);
      }
    }
  });
} else {
  console.warn('Alarms API not available. Storage cleanup disabled.');
}

// Initialize extension - process existing tabs
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up - processing existing tabs');
  const tabs = await chrome.tabs.query({});
  console.log(`Found ${tabs.length} tabs to process`);
  
  for (const tab of tabs) {
    if (tab.status === 'complete' && 
        tab.url && 
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      handleTabUpdate(tab.id, { status: 'complete' }, tab);
    }
  }
});

// Also process on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  // Process all existing tabs
  const tabs = await chrome.tabs.query({});
  console.log(`Processing ${tabs.length} existing tabs`);
  
  for (const tab of tabs) {
    if (tab.status === 'complete' && 
        tab.url && 
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      // Add small delay between tabs to avoid overwhelming the API
      setTimeout(() => {
        handleTabUpdate(tab.id, { status: 'complete' }, tab);
      }, Math.random() * 1000);
    }
  }
});
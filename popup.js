document.addEventListener('DOMContentLoaded', () => {
  const tabsContainer = document.getElementById('tabs-container');
  const searchBar = document.getElementById('search-bar');
  const sortBtn = document.getElementById('sort-btn');
  const groupBtn = document.getElementById('group-btn');
  const tabCount = document.getElementById('tab-count');
  const topicCount = document.getElementById('topic-count');
  const closeAllBtn = document.getElementById('close-all-btn');
  const exportBtn = document.getElementById('export-btn');

  let allTabsData = [];
  let currentView = 'grouped';
  let activeTabId = null;

  // Topic definitions with icons and colors
  const topicDefinitions = {
    development: { icon: '💻', color: '#3b82f6', name: 'Development' },
    research: { icon: '📚', color: '#8b5cf6', name: 'Research' },
    social: { icon: '👥', color: '#ec4899', name: 'Social' },
    entertainment: { icon: '🎬', color: '#f59e0b', name: 'Entertainment' },
    news: { icon: '📰', color: '#ef4444', name: 'News' },
    shopping: { icon: '🛒', color: '#10b981', name: 'Shopping' },
    productivity: { icon: '⚡', color: '#06b6d4', name: 'Productivity' },
    health: { icon: '💚', color: '#059669', name: 'Health' },
    finance: { icon: '💰', color: '#0891b2', name: 'Finance' },
    travel: { icon: '✈️', color: '#7c3aed', name: 'Travel' },
    other: { icon: '📄', color: '#6b7280', name: 'Other' }
  };

  function organizeTabsByTopic(tabs) {
    const organized = {};
    
    tabs.forEach(tab => {
      const topic = tab.topic || 'other';
      if (!organized[topic]) {
        organized[topic] = [];
      }
      organized[topic].push(tab);
    });

    return organized;
  }

  function createTabElement(tab) {
    const item = document.createElement('div');
    item.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    item.dataset.tabId = tab.id;

    const favicon = tab.favIconUrl || 'icons/icon16.png';
    const title = escapeHTML(tab.title || 'Untitled');
    const url = escapeHTML(new URL(tab.url).hostname);
    const summary = escapeHTML(tab.summary || 'Summary being generated...');

    item.innerHTML = `
      <div class="tab-header">
        <img src="${favicon}" class="tab-favicon" alt="" onerror="this.src='icons/icon16.png'">
        <div class="tab-content">
          <div class="tab-title">${title}</div>
          <div class="tab-url">${url}</div>
        </div>
        <div class="tab-actions">
          <button class="tab-action" title="Pin Tab" data-action="pin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 4v8l-4 4-4-4V4h8z" fill="currentColor"/>
              <path d="M12 20v-8" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="tab-action danger" title="Close Tab" data-action="close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="tab-summary-container">
        <div class="tab-summary">${summary}</div>
      </div>
    `;

    // Event listeners
    item.querySelector('.tab-content').addEventListener('click', () => {
      switchToTab(tab);
    });

    item.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    item.querySelector('[data-action="pin"]').addEventListener('click', (e) => {
      e.stopPropagation();
      pinTab(tab.id);
    });

    return item;
  }

  function createTopicGroup(topic, tabs) {
    const group = document.createElement('div');
    group.className = 'topic-group';
    group.dataset.topic = topic;

    const topicData = topicDefinitions[topic] || topicDefinitions.other;

    group.innerHTML = `
      <div class="topic-header" style="border-left: 4px solid ${topicData.color}">
        <div class="topic-info">
          <div class="topic-icon" style="background: ${topicData.color}">${topicData.icon}</div>
          <span class="topic-title">${topicData.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="topic-count">${tabs.length}</span>
          <svg class="topic-toggle" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
      </div>
      <div class="topic-tabs"></div>
    `;

    const tabsContainer = group.querySelector('.topic-tabs');
    tabs.forEach(tab => {
      tabsContainer.appendChild(createTabElement(tab));
    });

    group.querySelector('.topic-header').addEventListener('click', () => {
      group.classList.toggle('collapsed');
    });

    return group;
  }

  function renderGroupedView(tabsData) {
    const organized = organizeTabsByTopic(tabsData);
    tabsContainer.innerHTML = '';

    Object.entries(organized).forEach(([topic, tabs]) => {
      if (tabs.length > 0) {
        tabsContainer.appendChild(createTopicGroup(topic, tabs));
      }
    });

    updateStats(tabsData, Object.keys(organized).length);
  }

  function renderListView(tabsData) {
    tabsContainer.innerHTML = '';
    
    if (tabsData.length === 0) {
      tabsContainer.innerHTML = `
        <div class="loading-state">
          <p>No tabs found</p>
        </div>
      `;
      return;
    }

    const listContainer = document.createElement('div');
    listContainer.className = 'topic-tabs';
    
    tabsData.forEach(tab => {
      listContainer.appendChild(createTabElement(tab));
    });

    tabsContainer.appendChild(listContainer);
    updateStats(tabsData, 0);
  }

  function renderTabs(tabsData) {
    if (currentView === 'grouped') {
      renderGroupedView(tabsData);
    } else {
      renderListView(tabsData);
    }
  }

  function filterTabs(query) {
    const lowerCaseQuery = query.toLowerCase();
    const filteredData = allTabsData.filter(tab => 
      tab.title.toLowerCase().includes(lowerCaseQuery) || 
      tab.summary.toLowerCase().includes(lowerCaseQuery) ||
      tab.url.toLowerCase().includes(lowerCaseQuery)
    );
    renderTabs(filteredData);
  }

  function updateStats(tabs, topics) {
    tabCount.textContent = `${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`;
    if (currentView === 'grouped') {
      topicCount.textContent = `${topics} topic${topics !== 1 ? 's' : ''}`;
    } else {
      topicCount.textContent = 'List view';
    }
  }

  function switchToTab(tab) {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
    
    document.querySelectorAll('.tab-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-tab-id="${tab.id}"]`)?.classList.add('active');
    
    activeTabId = tab.id;
    window.close();
  }

  function closeTab(tabId) {
    chrome.tabs.remove(tabId, () => {
      allTabsData = allTabsData.filter(tab => tab.id !== tabId);
      renderTabs(allTabsData);
    });
  }

  function pinTab(tabId) {
    chrome.tabs.update(tabId, { pinned: true });
  }

  function closeAllTabs() {
    if (confirm(`Close all ${allTabsData.length} tabs?`)) {
      const tabIds = allTabsData.map(tab => tab.id);
      chrome.tabs.remove(tabIds);
      allTabsData = [];
      renderTabs([]);
    }
  }

  function exportTabs() {
    const exportData = {
      timestamp: new Date().toISOString(),
      tabs: allTabsData.map(tab => ({
        title: tab.title,
        url: tab.url,
        summary: tab.summary,
        topic: tab.topic
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabs-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getCurrentActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        activeTabId = tabs[0].id;
        document.querySelectorAll('.tab-item').forEach(item => {
          item.classList.toggle('active', item.dataset.tabId == activeTabId);
        });
      }
    });
  }

  sortBtn.addEventListener('click', () => {
    currentView = 'list';
    sortBtn.classList.add('active');
    groupBtn.classList.remove('active');
    renderTabs(allTabsData);
  });

  groupBtn.addEventListener('click', () => {
    currentView = 'grouped';
    groupBtn.classList.add('active');
    sortBtn.classList.remove('active');
    renderTabs(allTabsData);
  });

  searchBar.addEventListener('input', (e) => {
    filterTabs(e.target.value);
  });

  closeAllBtn.addEventListener('click', closeAllTabs);
  exportBtn.addEventListener('click', exportTabs);

  // Show loading state initially
  tabsContainer.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading tabs...</p>
    </div>
  `;

  chrome.runtime.sendMessage({ action: "getAllTabs" }, (tabsData) => {
    console.log("Received tabs data:", tabsData);
    
    if (chrome.runtime.lastError) {
      console.error("Runtime error:", chrome.runtime.lastError);
      tabsContainer.innerHTML = `
        <div class="loading-state">
          <p style="color: var(--danger-color); font-weight: 600;">Error: ${chrome.runtime.lastError.message}</p>
          <p style="margin-top: 10px; font-size: 12px;">Please reload the extension</p>
        </div>
      `;
      return;
    }
    
    if (!tabsData) {
      console.error("No tabs data received");
      tabsContainer.innerHTML = `
        <div class="loading-state">
          <p style="color: var(--warning-color); font-weight: 600;">No response from background script</p>
          <p style="margin-top: 10px; font-size: 12px;">Try reloading the extension</p>
        </div>
      `;
      return;
    }
    
    if (tabsData.length === 0) {
      tabsContainer.innerHTML = `
        <div class="loading-state">
          <p>No tabs found</p>
          <p style="margin-top: 10px; font-size: 12px;">Open some web pages to see them here</p>
        </div>
      `;
      updateStats([], 0);
      return;
    }
    
    allTabsData = tabsData;
    console.log(`Rendering ${allTabsData.length} tabs`);
    renderTabs(allTabsData);
    getCurrentActiveTab();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    } else if (e.ctrlKey || e.metaKey) {
      if (e.key === 'f') {
        e.preventDefault();
        searchBar.focus();
      } else if (e.key === 'w') {
        e.preventDefault();
        closeAllTabs();
      }
    }
  });

  setTimeout(() => {
    searchBar.focus();
  }, 100);
});
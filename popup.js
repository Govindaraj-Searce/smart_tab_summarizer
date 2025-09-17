document.addEventListener('DOMContentLoaded', () => {
  const tabsList = document.getElementById('tabs-list');
  const searchBar = document.getElementById('search-bar');
  let allTabsData = []; 

  function renderTabs(tabsData) {
    tabsList.innerHTML = '';
    if (tabsData.length === 0) {
      tabsList.innerHTML = '<p class="loading">No open tabs found.</p>';
      return;
    }

    tabsData.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item';

      item.innerHTML = `
        <img src="${tab.favIconUrl || 'icons/icon16.png'}" class="favicon" alt="">
        <div class="tab-content">
          <p class="tab-title">${escapeHTML(tab.title)}</p>
          <p class="tab-summary">${escapeHTML(tab.summary)}</p>
        </div>
        <button class="close-btn" title="Close Tab">&times;</button>
      `;

      // Event listener to switch to the tab
      item.querySelector('.tab-content').addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        // The tab object from chrome.tabs.query includes the windowId
        chrome.windows.update(tab.windowId, { focused: true });
      });

      // Event listener for the close button
      item.querySelector('.close-btn').addEventListener('click', (e) => {
        e.stopPropagation(); 
        chrome.tabs.remove(tab.id);
        item.remove();
      });

      tabsList.appendChild(item);
    });
  }

  function filterTabs(query) {
    const lowerCaseQuery = query.toLowerCase();
    const filteredData = allTabsData.filter(tab => 
        tab.title.toLowerCase().includes(lowerCaseQuery) || 
        tab.summary.toLowerCase().includes(lowerCaseQuery)
    );
    renderTabs(filteredData);
  }

  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }
  
  chrome.runtime.sendMessage({ action: "getAllTabs" }, (tabsData) => {
    // The response now needs to include the windowId
    if (tabsData) {
        allTabsData = tabsData;
        renderTabs(allTabsData);
    } else {
        tabsList.innerHTML = '<p class="loading">Error loading tabs. Check background script.</p>';
        console.error("Received no data from background script. Check for errors in the Service Worker console.");
    }
  });

  searchBar.addEventListener('input', (e) => {
    filterTabs(e.target.value);
  });
});
// Frontend application code for AlphaSearch

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements Cache ---
  const themeToggle = document.getElementById('themeToggle');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const searchBtn = document.getElementById('searchBtn'); // Hidden trigger
  const alphaSearchBtn = document.getElementById('alphaSearchBtn'); // Primary Yellow button
  const luckyBtn = document.getElementById('luckyBtn'); // Lucky Cyan button
  const mainContainer = document.getElementById('mainContainer');
  const searchWrapper = document.getElementById('searchWrapper');
  const resultsContainer = document.getElementById('resultsContainer');
  const resultsList = document.getElementById('resultsList');
  const resultsCount = document.getElementById('resultsCount');
  const searchSpeed = document.getElementById('searchSpeed');
  const suggestionsBox = document.getElementById('suggestionsBox');
  const toastContainer = document.getElementById('toastContainer');
  const navLogo = document.getElementById('navLogo');
  const hudDbCount = document.getElementById('hudDbCount');

  // Modal elements for Instagram Gate
  const followModal = document.getElementById('followModal');
  const modalFollowBtn = document.getElementById('modalFollowBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  let activeRedirectUrl = '';
  let activeRedirectId = '';

  // API base URL configuration (supports running on different host/port if needed)
  const API_BASE = ''; 

  // List of all keywords/titles compiled for live autocomplete suggestions
  let allLinksCache = [];

  // --- Theme Controller ---
  const getPreferredTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };

  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = themeToggle.querySelector('i');
    if (theme === 'light') {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  };

  // Initialize Theme
  setTheme(getPreferredTheme());

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  });

  // --- Initialize Suggestions Cache ---
  const fetchAllLinks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/links`);
      if (response.ok) {
        allLinksCache = await response.json();
        // Update System Diagnostics Panel
        if (hudDbCount) {
          hudDbCount.textContent = `${allLinksCache.length} SECURE RECORDS`;
        }
      }
    } catch (e) {
      console.warn('Failed to load suggestions database', e);
    }
  };
  
  fetchAllLinks();

  // --- Event Listeners ---
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      triggerSearch();
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    suggestionsBox.classList.remove('active');
    resetToHomeState();
    searchInput.focus();
  });

  // Dual search button triggers
  if (searchBtn) searchBtn.addEventListener('click', triggerSearch);
  if (alphaSearchBtn) alphaSearchBtn.addEventListener('click', triggerSearch);
  if (luckyBtn) luckyBtn.addEventListener('click', triggerLucky);

  // Modal Gate event listeners
  if (followModal) {
    modalCancelBtn.addEventListener('click', () => {
      followModal.classList.remove('active');
      activeRedirectUrl = '';
      activeRedirectId = '';
    });

    modalFollowBtn.addEventListener('click', () => {
      followModal.classList.remove('active');
      if (activeRedirectId) {
        trackClick(activeRedirectId);
      }
      if (activeRedirectUrl) {
        const dest = activeRedirectUrl;
        activeRedirectUrl = '';
        activeRedirectId = '';
        // Wait briefly for target tab to open, redirect page in 100ms
        setTimeout(() => {
          window.open(dest, '_blank');
        }, 100);
      }
    });
  }
  
  navLogo.addEventListener('click', (e) => {
    // Reset page on logo click
    e.preventDefault();
    searchInput.value = '';
    clearBtn.style.display = 'none';
    suggestionsBox.classList.remove('active');
    resetToHomeState();
  });

  // Close suggestions dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!suggestionsBox.contains(e.target) && e.target !== searchInput) {
      suggestionsBox.classList.remove('active');
    }
  });

  // --- Core Functions ---

  function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase();
    
    // Toggle clear button
    if (searchInput.value.length > 0) {
      clearBtn.style.display = 'flex';
    } else {
      clearBtn.style.display = 'none';
    }

    if (!query) {
      suggestionsBox.classList.remove('active');
      return;
    }

    // Generate smart suggestions based on cache
    const suggestions = new Set();
    
    // Match titles, URLs, and keywords
    allLinksCache.forEach(link => {
      const title = link.title.toLowerCase();
      const keywords = link.keywords || [];

      if (title.includes(query)) {
        suggestions.add(link.title);
      }
      
      keywords.forEach(kw => {
        const kwLower = kw.toLowerCase();
        if (kwLower.includes(query)) {
          suggestions.add(kw);
        }
      });
    });

    const suggestionsList = Array.from(suggestions).slice(0, 5); // limit to 5 suggestions

    if (suggestionsList.length > 0) {
      suggestionsBox.innerHTML = '';
      suggestionsList.forEach(text => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i><span>${highlightMatch(text, query)}</span>`;
        div.addEventListener('click', () => {
          searchInput.value = text;
          suggestionsBox.classList.remove('active');
          triggerSearch();
        });
        suggestionsBox.appendChild(div);
      });
      suggestionsBox.classList.add('active');
    } else {
      suggestionsBox.classList.remove('active');
    }
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return (
      text.substring(0, idx) +
      `<strong>${text.substring(idx, idx + query.length)}</strong>` +
      text.substring(idx + query.length)
    );
  }

  async function triggerSearch() {
    const query = searchInput.value.trim();
    suggestionsBox.classList.remove('active');
    searchInput.blur();

    if (!query) {
      showToast('INPUT LOG FAILURE: ENTER QUERY TAG', 'danger');
      return;
    }

    const startTime = performance.now();
    resultsList.innerHTML = `<div class="no-results-state" style="border-style: dashed;">
      <div class="no-results-icon"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
      <div class="no-results-text"><h3 style="font-family: var(--font-hud); font-size: 1.6rem;">[SCANNING] COMPILING DATABANK INDEXES...</h3></div>
    </div>`;
    
    // Transition UI to results layout
    mainContainer.classList.add('has-results');
    resultsContainer.style.display = 'flex';

    try {
      const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      const elapsedMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        throw new Error('DATABANK UNREACHABLE');
      }

      const results = await response.json();
      renderResults(results, elapsedMs, query);
    } catch (e) {
      showToast(`SYSTEM GLITCH: ${e.message}`, 'danger');
      resultsList.innerHTML = `<div class="no-results-state" style="border-color: var(--danger-color);">
        <div class="no-results-icon" style="color: var(--danger-color)"><i class="fa-solid fa-circle-exclamation"></i></div>
        <div class="no-results-text" style="color: var(--danger-color);">
          <h3 style="font-family: var(--font-title); font-size: 1.1rem;">[!] CONNECTION TERMINATED</h3>
          <p style="font-family: var(--font-hud); font-size: 1.4rem; margin-top: 1rem; color: var(--text-muted);">CRITICAL: THE SEARCH ENGINE DATABASE API IS NOT INITIATING RESPONSE HANDLES.</p>
          <p style="font-family: var(--font-body); font-size: 1rem; margin-top: 0.5rem; opacity: 0.8;">ADVICE: ENSURE RECTOR PYTHON SERVER IS EXECUTED LOCALLY ON PORT 8000.</p>
        </div>
      </div>`;
    }
  }

  function renderResults(results, elapsedMs, query) {
    resultsCount.textContent = `[MATCHES_DETECTED]: ${results.length} RECORD${results.length === 1 ? '' : 'S'}`;
    searchSpeed.textContent = `[LATENCY]: ${elapsedMs}MS`;

    if (results.length === 0) {
      resultsList.innerHTML = `
        <div class="no-results-state" style="border-color: var(--accent-secondary);">
          <div class="no-results-icon" style="color: var(--accent-secondary);"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="no-results-text" style="color: var(--accent-secondary);">
            <h3 style="font-family: var(--font-title); font-size: 1.1rem;">[!] ERROR 404: TAG NOT DETECTED</h3>
            <p style="font-family: var(--font-hud); font-size: 1.4rem; margin-top: 1rem; color: var(--text-muted);">CRITICAL: THE SPECIFIED KEYWORD IS NOT MAPPED TO ANY METADATA DATASHEET IN REGISTRY.</p>
            <p style="font-family: var(--font-body); font-size: 0.95rem; margin-top: 0.5rem; opacity: 0.8; text-transform: uppercase;">ADVICE: RE-VERIFY KEYWORDS OR CONFIGURE NEW ASSET VALUES IN ADMIN SYSTEM.</p>
          </div>
        </div>
      `;
      return;
    }

    resultsList.innerHTML = '';
    results.forEach((link, idx) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.setAttribute('data-index', idx + 1);
      
      const displayUrl = link.url.replace(/^(https?:\/\/)?(www\.)?/, '');
      
      // Keywords chips HTML
      const tagsHtml = (link.keywords || []).map(kw => 
        `<span class="keyword-badge">${escapeHtml(kw)}</span>`
      ).join(' ');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 0.5rem;">
          <span style="font-family: var(--font-hud); font-size: 1.1rem; color: var(--accent-color); background: rgba(255,0,0,0.08); padding: 0.1rem 0.5rem; border: 1px solid var(--accent-color);"><i class="fa-solid fa-shield-halved"></i> SECURE HIT</span>
          <span style="font-family: var(--font-hud); font-size: 1.1rem; color: var(--text-secondary);">META_ID: #${escapeHtml(link.id.substring(0,8).toUpperCase())}</span>
        </div>
        
        <div class="result-url">
          <i class="fa-solid fa-globe"></i> ${escapeHtml(displayUrl)}
        </div>
        
        <h2 class="result-title">${escapeHtml(link.title)}</h2>
        
        <p class="result-description">${escapeHtml(link.description || 'NO ADDITIONAL DESCRIPTIVE METADATA REGISTERED.')}</p>
        
        <div class="result-meta" style="margin-bottom: 1.25rem;">
          ${tagsHtml}
          <span class="click-tracker"><i class="fa-regular fa-eye"></i> READS: ${link.clickCount || 0}</span>
        </div>
        
        <div style="display: flex; margin-top: 1rem; gap: 1rem;">
          <button class="btn-primary btn-launch-secure" style="width: 70%; justify-content: center; text-align: center;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> ACCESS SECURE LINK
          </button>
          <button class="btn-secondary btn-delete-db" style="width: 30%; justify-content: center; text-align: center; border-color: var(--accent-color); color: var(--accent-color);">
            <i class="fa-solid fa-trash-can"></i> DELETE
          </button>
        </div>
      `;

      // Intercept and launch modal
      const launchBtn = card.querySelector('.btn-launch-secure');
      launchBtn.addEventListener('click', () => {
        activeRedirectUrl = link.url;
        activeRedirectId = link.id;
        followModal.classList.add('active');
      });

      // Admin quick delete option directly from card
      const deleteBtn = card.querySelector('.btn-delete-db');
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`ADMIN CONFIGURATION ACCESS:\nAre you sure you want to permanently delete "${link.title}" from the registry database?`)) {
          try {
            const response = await fetch(`/api/links?id=${link.id}`, { method: 'DELETE' });
            if (response.ok) {
              showToast(`"${link.title}" has been deleted from search index.`, 'success');
              triggerSearch(); // Refresh results list
            } else {
              throw new Error('API request rejected');
            }
          } catch (e) {
            showToast(`Error deleting link: ${e.message}`, 'danger');
          }
        }
      });

      resultsList.appendChild(card);
    });
  }

  // I'm feeling lucky algorithm
  async function triggerLucky() {
    const query = searchInput.value.trim();
    
    // If cache is empty, fetch first
    if (allLinksCache.length === 0) {
      await fetchAllLinks();
    }
    
    if (allLinksCache.length === 0) {
      showToast('DATABANK SYSTEM ERROR: INDEX EMPTY', 'danger');
      return;
    }

    if (!query) {
      // Pick completely random link from Cache
      const randomIdx = Math.floor(Math.random() * allLinksCache.length);
      const target = allLinksCache[randomIdx];
      
      activeRedirectUrl = target.url;
      activeRedirectId = target.id;
      followModal.classList.add('active');
    } else {
      // Search first, redirect to first result
      try {
        const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const results = await response.json();
          if (results.length > 0) {
            const target = results[0];
            
            activeRedirectUrl = target.url;
            activeRedirectId = target.id;
            followModal.classList.add('active');
          } else {
            // No hits found
            showToast('LUCKY LAUNCH FAILURE: NO MATCH DETECTED', 'danger');
            triggerSearch(); // Show 404 block on screen
          }
        }
      } catch (e) {
        showToast('SYSTEM FAULT ON LAUNCH ROUTINE', 'danger');
      }
    }
  }

  async function trackClick(id) {
    try {
      fetch(`${API_BASE}/api/click?id=${id}`, { method: 'POST' });
      const link = allLinksCache.find(l => l.id === id);
      if (link) {
        link.clickCount = (link.clickCount || 0) + 1;
      }
    } catch (e) {
      console.error('Click tracking error', e);
    }
  }

  function resetToHomeState() {
    mainContainer.classList.remove('has-results');
    resultsContainer.style.display = 'none';
    resultsList.innerHTML = '';
    fetchAllLinks();
  }

  // --- Helper Functions ---

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s steps(4) forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});

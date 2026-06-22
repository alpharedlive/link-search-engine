// Admin Dashboard frontend logic

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements Cache ---
  const themeToggle = document.getElementById('themeToggle');
  const linkForm = document.getElementById('linkForm');
  const linkIdInput = document.getElementById('linkId');
  const linkTitleInput = document.getElementById('linkTitle');
  const linkUrlInput = document.getElementById('linkUrl');
  const linkDescInput = document.getElementById('linkDesc');
  const linkKeywordsInput = document.getElementById('linkKeywords');
  
  const formHeaderTitle = document.getElementById('formHeaderTitle');
  const submitFormBtn = document.getElementById('submitFormBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  
  const listFilter = document.getElementById('listFilter');
  const linksTableBody = document.getElementById('linksTableBody');
  const toastContainer = document.getElementById('toastContainer');

  const API_BASE = window.location.hostname.endsWith('github.io') ? 'http://localhost:8000' : ''; 
  let localLinksCache = [];

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

  setTheme(getPreferredTheme());

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  });

  // --- API Handlers (CRUD) ---

  // Load and Render Table Links
  const fetchLinks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/links`);
      if (!response.ok) throw new Error('Database request failed');
      localLinksCache = await response.json();
      renderLinksTable(localLinksCache);
    } catch (e) {
      showToast(`Error fetching database: ${e.message}`, 'danger');
      linksTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--danger-color); padding: 2rem;">
            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem;"></i> Could not load links registry. Make sure server is running.
          </td>
        </tr>
      `;
    }
  };

  // Render rows
  function renderLinksTable(links) {
    if (links.length === 0) {
      linksTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 3rem 0;">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
            No links inside the search engine database yet. Add your first link!
          </td>
        </tr>
      `;
      return;
    }

    linksTableBody.innerHTML = '';
    links.forEach(link => {
      const tr = document.createElement('tr');
      tr.className = 'link-table-row';
      tr.setAttribute('data-id', link.id);

      const keywordsHtml = (link.keywords || []).map(k => 
        `<span class="keyword-badge">${escapeHtml(k)}</span>`
      ).join(' ');

      tr.innerHTML = `
        <td>
          <div class="table-title">${escapeHtml(link.title)}</div>
          <div class="table-desc" title="${escapeHtml(link.description)}">${escapeHtml(link.description || 'No description.')}</div>
        </td>
        <td>
          <a href="${escapeHtml(link.url)}" target="_blank" class="table-url" title="${escapeHtml(link.url)}">
            ${escapeHtml(link.url)}
          </a>
        </td>
        <td>
          <div class="table-keywords">${keywordsHtml}</div>
        </td>
        <td style="text-align: center; font-weight: 500;">
          ${link.clickCount || 0}
        </td>
        <td>
          <div class="table-actions" style="justify-content: center;">
            <button class="btn-table btn-edit" title="Edit Link Details" data-id="${link.id}">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="btn-table btn-delete" title="Delete Link" data-id="${link.id}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      // Attach row event listeners
      const editBtn = tr.querySelector('.btn-edit');
      editBtn.addEventListener('click', () => startEditMode(link));

      const deleteBtn = tr.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', () => deleteLink(link.id, link.title));

      linksTableBody.appendChild(tr);
    });
  }

  // Submit Handler (Create or Update)
  linkForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = linkIdInput.value;
    const title = linkTitleInput.value.trim();
    const url = linkUrlInput.value.trim();
    const description = linkDescInput.value.trim();
    const keywords = linkKeywordsInput.value.split(',').map(k => k.strip ? k.strip() : k.trim()).filter(k => k.length > 0);

    const linkPayload = { title, url, description, keywords };
    if (id) {
      linkPayload.id = id;
    }

    try {
      const method = id ? 'PUT' : 'POST';
      const response = await fetch(`${API_BASE}/api/links`, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(linkPayload)
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server rejected request');
      }

      showToast(id ? 'Link details updated successfully!' : 'New link successfully added to search index!', 'success');
      
      resetForm();
      fetchLinks();
    } catch (e) {
      showToast(`Database write error: ${e.message}`, 'danger');
    }
  });

  // Edit State Triggers
  function startEditMode(link) {
    linkIdInput.value = link.id;
    linkTitleInput.value = link.title;
    linkUrlInput.value = link.url;
    linkDescInput.value = link.description || '';
    linkKeywordsInput.value = (link.keywords || []).join(', ');

    formHeaderTitle.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--accent-secondary);"></i> Edit Link Details`;
    submitFormBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Link`;
    cancelEditBtn.style.display = 'inline-block';
    
    // Smooth scroll form into view on mobile
    linkForm.scrollIntoView({ behavior: 'smooth' });
    linkTitleInput.focus();
  }

  // Form Reset
  function resetForm() {
    linkIdInput.value = '';
    linkForm.reset();
    
    formHeaderTitle.innerHTML = `<i class="fa-solid fa-circle-plus" style="color: var(--accent-color);"></i> Add New Link`;
    submitFormBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Link`;
    cancelEditBtn.style.display = 'none';
  }

  cancelEditBtn.addEventListener('click', resetForm);

  // Delete Action
  async function deleteLink(id, title) {
    if (!confirm(`Are you sure you want to delete "${title}" from the search results index?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/links?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Server delete command failed');
      }

      showToast(`"${title}" has been deleted.`, 'success');
      
      // If we deleted the link currently being edited, reset form
      if (linkIdInput.value === id) {
        resetForm();
      }

      fetchLinks();
    } catch (e) {
      showToast(`Delete error: ${e.message}`, 'danger');
    }
  }

  // --- Filtering ---
  listFilter.addEventListener('input', () => {
    const filterText = listFilter.value.trim().toLowerCase();
    const rows = linksTableBody.querySelectorAll('.link-table-row');
    
    rows.forEach(row => {
      const id = row.getAttribute('data-id');
      const link = localLinksCache.find(l => l.id === id);
      
      if (!link) return;

      const title = link.title.toLowerCase();
      const url = link.url.toLowerCase();
      const desc = (link.description || '').toLowerCase();
      const keywords = (link.keywords || []).join(' ').toLowerCase();

      const isMatch = title.includes(filterText) || 
                      url.includes(filterText) || 
                      desc.includes(filterText) || 
                      keywords.includes(filterText);

      if (isMatch) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  // --- Notification Toast Helpers ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s forwards';
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

  // Fetch all link entries on mount
  fetchLinks();
});

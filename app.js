/**
 * Quotation Maker - Core Application Logic
 * Client database from clients.json + localStorage. No API needed.
 * Designed for static hosting on Vercel.
 */

// ===================== STATE =====================
const state = {
    baseClients: [],      // Loaded from clients.json
    userClients: [],      // Saved in localStorage (user-added)
    selectedClient: null,
    editingClientId: null,
    gstType: 'intra',
    gstRate: 18,
    gstCalculation: 'exclusive'
};

// All clients merged (base + user-added)
function getAllClients() {
    return [...state.baseClients, ...state.userClients];
}

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', async () => {
    await loadBaseClients();
    loadUserClients();
    setDefaultDate();
    addItemRow();
    bindEvents();
    updateClientCountBadge();
});

async function loadBaseClients() {
    const syncBtn = document.getElementById('btn-cloud-sync');
    if (syncBtn) syncBtn.textContent = '☁️ Syncing...';

    try {
        // Try fetching latest clients.json via GitHub API proxy
        const cloudResp = await fetch('/api/sync-clients');
        if (cloudResp.ok) {
            const data = await cloudResp.json();
            if (data.success && Array.isArray(data.clients)) {
                state.baseClients = data.clients;
                if (syncBtn) syncBtn.textContent = '☁️ GitHub Live';
                return;
            }
        }
    } catch {
        // Fall back to local clients.json
    }

    try {
        const resp = await fetch('clients.json');
        if (resp.ok) {
            state.baseClients = await resp.json();
        }
    } catch (e) {
        console.warn('Could not load clients.json:', e);
        state.baseClients = [];
    }
    if (syncBtn) syncBtn.textContent = '☁️ GitHub DB';
}

function loadUserClients() {
    try {
        const saved = localStorage.getItem('stda_user_clients');
        state.userClients = saved ? JSON.parse(saved) : [];
    } catch {
        state.userClients = [];
    }
}

function saveUserClients() {
    localStorage.setItem('stda_user_clients', JSON.stringify(state.userClients));
    updateClientCountBadge();
    syncClientsToCloud();
}

async function syncClientsToCloud() {
    const syncBtn = document.getElementById('btn-cloud-sync');
    if (syncBtn) syncBtn.textContent = '☁️ Syncing...';

    try {
        const allClients = getAllClients();
        const resp = await fetch('/api/sync-clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clients: allClients })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
            if (syncBtn) syncBtn.textContent = '☁️ GitHub Synced';
            showToast('Client database committed to GitHub!', 'success');
        } else {
            if (syncBtn) syncBtn.textContent = '☁️ Local Saved';
        }
    } catch {
        if (syncBtn) syncBtn.textContent = '☁️ Local Saved';
    }
}

function updateClientCountBadge() {
    const total = getAllClients().length;
    document.getElementById('client-count-badge').textContent = `${total} client${total !== 1 ? 's' : ''}`;
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('quotation-date').value = today;
}

// ===================== EVENT BINDINGS =====================
function bindEvents() {
    // Cloud sync button
    const btnCloudSync = document.getElementById('btn-cloud-sync');
    if (btnCloudSync) {
        btnCloudSync.addEventListener('click', () => {
            syncClientsToCloud();
        });
    }

    // API Settings modal
    const btnApiSettings = document.getElementById('btn-api-settings');
    if (btnApiSettings) btnApiSettings.addEventListener('click', openApiSettingsModal);
    
    const closeApiSettings = document.getElementById('close-api-settings');
    if (closeApiSettings) closeApiSettings.addEventListener('click', closeApiSettingsModal);
    
    const cancelApiSettings = document.getElementById('btn-cancel-api-settings');
    if (cancelApiSettings) cancelApiSettings.addEventListener('click', closeApiSettingsModal);
    
    const saveApiKeyBtn = document.getElementById('btn-save-api-key');
    if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);
    
    const modalApiSettings = document.getElementById('modal-api-settings');
    if (modalApiSettings) {
        modalApiSettings.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeApiSettingsModal();
        });
    }

    // GST Lookup button & input auto-trigger
    const btnFetchGst = document.getElementById('btn-fetch-buyer-gst');
    if (btnFetchGst) {
        btnFetchGst.addEventListener('click', () => {
            const gstin = document.getElementById('buyer-gstin').value.trim();
            fetchGSTDetails(gstin);
        });
    }

    const buyerGstinInput = document.getElementById('buyer-gstin');
    if (buyerGstinInput) {
        buyerGstinInput.addEventListener('input', (e) => {
            const val = e.target.value.trim().toUpperCase();
            if (val.length === 15) {
                fetchGSTDetails(val);
            }
        });
    }

    // Client search
    const searchInput = document.getElementById('client-search');
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', handleSearch);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) closeDropdown();
    });

    const btnFetchOnline = document.getElementById('btn-fetch-online');
    if (btnFetchOnline) {
        btnFetchOnline.addEventListener('click', triggerOnlineFetch);
    }

    document.getElementById('search-clear').addEventListener('click', () => {
        searchInput.value = '';
        document.getElementById('search-clear').classList.remove('visible');
        closeDropdown();
    });

    // Client manager modal
    document.getElementById('btn-manage-clients').addEventListener('click', openClientManager);
    document.getElementById('close-client-modal').addEventListener('click', closeClientManager);
    document.getElementById('modal-client-manager').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeClientManager();
    });

    // Add new client
    document.getElementById('btn-add-new-client').addEventListener('click', () => {
        state.editingClientId = null;
        clearClientForm();
        openClientForm('➕ Add Client');
    });

    // Client form modal
    document.getElementById('close-client-form').addEventListener('click', closeClientForm);
    document.getElementById('btn-cancel-client').addEventListener('click', closeClientForm);
    document.getElementById('modal-client-form').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeClientForm();
    });
    document.getElementById('btn-save-client').addEventListener('click', saveClient);

    // Same as buyer checkbox
    document.getElementById('same-as-buyer').addEventListener('change', handleSameAsBuyer);

    // Add item
    document.getElementById('btn-add-item').addEventListener('click', addItemRow);

    // GST toggle
    document.getElementById('gst-toggle').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        document.querySelectorAll('#gst-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.gstType = btn.dataset.type;
        updateGSTDisplay();
        recalculate();
    });

    document.getElementById('gst-rate').addEventListener('change', (e) => {
        state.gstRate = parseFloat(e.target.value);
        updateGSTDisplay();
        recalculate();
    });

    document.getElementById('gst-calculation').addEventListener('change', (e) => {
        state.gstCalculation = e.target.value;
        recalculate();
    });

    // New quotation
    document.getElementById('btn-new-quotation').addEventListener('click', resetForm);

    // Export PDF
    document.getElementById('btn-export-pdf').addEventListener('click', () => exportPDF(false));
    document.getElementById('btn-preview-pdf').addEventListener('click', () => exportPDF(true));
}

// ===================== CLIENT SEARCH =====================
let highlightedIndex = -1;

function handleSearch() {
    const query = document.getElementById('client-search').value.trim().toLowerCase();
    const clearBtn = document.getElementById('search-clear');
    clearBtn.classList.toggle('visible', query.length > 0);

    if (query.length === 0) {
        // Show all clients when focused with empty input
        const all = getAllClients();
        if (all.length > 0 && document.activeElement === document.getElementById('client-search')) {
            showDropdownResults(all, '');
        } else {
            closeDropdown();
        }
        return;
    }

    // Search by name, GSTIN, address, contact
    const results = getAllClients().filter(c =>
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.gstin && c.gstin.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query)) ||
        (c.contact && c.contact.toLowerCase().includes(query))
    );

    showDropdownResults(results, query);
}

function showDropdownResults(results, query) {
    const dropdown = document.getElementById('search-dropdown');
    dropdown.innerHTML = '';

    const cleanQuery = (query || '').trim().toUpperCase();
    const isGstinLength = cleanQuery.length === 15;

    if (results.length === 0) {
        dropdown.innerHTML = `
            <div class="no-results" style="padding: 12px 16px;">
                <div style="margin-bottom: 6px;">No local clients found matching "<strong>${query}</strong>"</div>
                <div style="display: flex; gap: 10px; align-items: center; margin-top: 8px;">
                    <button class="btn btn-primary btn-sm" onclick="event.preventDefault(); triggerOnlineFetch();" style="font-size: 12px;">
                        🌐 Search / Fetch Online
                    </button>
                    <a href="#" style="color: var(--accent-sky); font-size: 12px;" onclick="event.preventDefault(); quickAddFromSearch();">Add manually?</a>
                </div>
            </div>`;
    } else {
        results.forEach((client) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <div class="client-name">${query ? highlightMatch(client.name || '', query) : (client.name || '')}</div>
                <div class="client-gstin">${client.gstin || 'No GSTIN'} &nbsp;|&nbsp; ${client.state || ''} ${client.stateCode ? '(' + client.stateCode + ')' : ''}</div>
            `;
            item.addEventListener('click', () => selectClient(client));
            dropdown.appendChild(item);
        });

        // Add Online Fetch row at bottom of dropdown
        const onlineRow = document.createElement('div');
        onlineRow.className = 'dropdown-item online-fetch-option';
        onlineRow.style.background = 'rgba(56, 189, 248, 0.05)';
        onlineRow.style.borderTop = '1px solid var(--border-subtle)';
        onlineRow.innerHTML = `
            <div style="color: var(--accent-sky); font-weight: 500; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                <span>🌐</span> Fetch details live for "${query}"
            </div>
        `;
        onlineRow.addEventListener('click', () => {
            closeDropdown();
            triggerOnlineFetch();
        });
        dropdown.appendChild(onlineRow);
    }

    highlightedIndex = -1;
    dropdown.classList.add('active');
}

async function triggerOnlineFetch() {
    const input = document.getElementById('client-search');
    let query = (input.value || '').trim();

    if (!query) {
        query = prompt('Enter 15-digit GSTIN number to fetch online company details:');
        if (!query) return;
        input.value = query;
    }

    const cleanGstin = query.toUpperCase();
    const statusDiv = document.getElementById('online-fetch-status');
    
    if (statusDiv) {
        statusDiv.style.display = 'flex';
        statusDiv.className = 'online-status-bar loading';
        statusDiv.innerHTML = `<span>🔄 Fetching GSTIN details live from internet...</span>`;
    }

    const data = await fetchGSTDetails(cleanGstin);

    if (data && data.success) {
        if (statusDiv) {
            statusDiv.className = 'online-status-bar success';
            statusDiv.innerHTML = `
                <span>✅ Fetched: <strong>${data.name || cleanGstin}</strong> (${data.state || ''} ${data.stateCode ? '[' + data.stateCode + ']' : ''})</span>
                <button class="btn btn-secondary btn-sm" onclick="saveFetchedClientLocally('${data.name}', '${data.gstin}', '${(data.address || '').replace(/'/g, "\\'")}', '${data.state}', '${data.stateCode}')">💾 Saved to Clients</button>
            `;
        }
        // Auto select fetched client
        selectClient({
            name: data.name,
            gstin: cleanGstin,
            address: data.address,
            state: data.state,
            stateCode: data.stateCode
        });
    } else {
        if (statusDiv) {
            statusDiv.className = 'online-status-bar warning';
            statusDiv.innerHTML = `
                <span>⚠️ Could not fetch details live for "${query}". Check GSTIN format or network connection.</span>
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('online-fetch-status').style.display='none'">✕</button>
            `;
        }
    }
}

function saveFetchedClientLocally(name, gstin, address, state, stateCode) {
    autoSaveClientFromGST({ name, gstin, address, state, stateCode });
    showToast(`Saved ${name} to your client database!`, 'success');
}

function handleSearchKeydown(e) {
    const dropdown = document.getElementById('search-dropdown');
    const items = dropdown.querySelectorAll('.dropdown-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        updateHighlight(items);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        items[highlightedIndex]?.click();
    } else if (e.key === 'Escape') {
        closeDropdown();
    }
}

function updateHighlight(items) {
    items.forEach((item, idx) => {
        item.classList.toggle('highlighted', idx === highlightedIndex);
    });
    // Scroll highlighted item into view
    if (highlightedIndex >= 0 && items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function highlightMatch(text, query) {
    if (!text || !query) return text || '';
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong style="color: var(--accent-sky);">$1</strong>');
}

function closeDropdown() {
    document.getElementById('search-dropdown').classList.remove('active');
}

function selectClient(client) {
    state.selectedClient = client;
    closeDropdown();
    document.getElementById('client-search').value = '';
    document.getElementById('search-clear').classList.remove('visible');

    // Fill buyer fields
    document.getElementById('buyer-name').value = client.name || '';
    document.getElementById('buyer-address').value = client.address || '';
    document.getElementById('buyer-state').value = client.state || '';
    document.getElementById('buyer-state-code').value = client.stateCode || '';
    document.getElementById('buyer-gstin').value = client.gstin || '';

    // Sync consignee if checkbox checked
    if (document.getElementById('same-as-buyer').checked) {
        syncConsigneeFromBuyer();
    }

    // Show selected tag
    const bar = document.getElementById('selected-client-bar');
    bar.innerHTML = `
        <div class="client-tag">
            🏢 ${client.name}
            <span class="tag-remove" onclick="clearSelectedClient()">✕</span>
        </div>
    `;

    showToast(`Client "${client.name}" selected — details auto-filled`, 'success');
}

function clearSelectedClient() {
    state.selectedClient = null;
    document.getElementById('selected-client-bar').innerHTML = '';
}
window.clearSelectedClient = clearSelectedClient;

// Quick add from search "no results" link
window.quickAddFromSearch = function() {
    closeDropdown();
    const searchVal = document.getElementById('client-search').value.trim();
    state.editingClientId = null;
    clearClientForm();
    // Pre-fill name or GSTIN from search query
    if (/^[0-9]{2}[A-Z]/.test(searchVal.toUpperCase())) {
        document.getElementById('cf-gstin').value = searchVal.toUpperCase();
    } else {
        document.getElementById('cf-name').value = searchVal;
    }
    openClientForm('➕ Add Client');
};

// ===================== SAME AS BUYER =====================
function handleSameAsBuyer() {
    const checked = document.getElementById('same-as-buyer').checked;
    const fields = ['consignee-name', 'consignee-address', 'consignee-state', 'consignee-state-code', 'consignee-gstin'];
    fields.forEach(id => { document.getElementById(id).disabled = checked; });
    if (checked) syncConsigneeFromBuyer();
}

function syncConsigneeFromBuyer() {
    document.getElementById('consignee-name').value = document.getElementById('buyer-name').value;
    document.getElementById('consignee-address').value = document.getElementById('buyer-address').value;
    document.getElementById('consignee-state').value = document.getElementById('buyer-state').value;
    document.getElementById('consignee-state-code').value = document.getElementById('buyer-state-code').value;
    document.getElementById('consignee-gstin').value = document.getElementById('buyer-gstin').value;
}

['buyer-name', 'buyer-address', 'buyer-state', 'buyer-state-code', 'buyer-gstin'].forEach(id => {
    document.addEventListener('input', (e) => {
        if (e.target.id === id && document.getElementById('same-as-buyer').checked) {
            syncConsigneeFromBuyer();
        }
    });
});

// ===================== CLIENT MODALS =====================
function openClientManager() {
    renderClientsList();
    document.getElementById('modal-client-manager').classList.add('active');
}

function closeClientManager() {
    document.getElementById('modal-client-manager').classList.remove('active');
}

function renderClientsList() {
    const list = document.getElementById('clients-list');
    const all = getAllClients();

    if (all.length === 0) {
        list.innerHTML = '<div class="no-results">No clients yet. Click "Add New Client" to get started.</div>';
        return;
    }

    list.innerHTML = all.map((client, idx) => {
        const isBase = idx < state.baseClients.length;
        const sourceLabel = isBase ? 'JSON' : 'Local';
        return `
        <div class="client-list-item">
            <div class="client-info">
                <div class="name">${client.name || 'Unnamed'}</div>
                <div class="details">
                    ${client.gstin || 'No GSTIN'} | ${client.state || ''} ${client.stateCode ? '(' + client.stateCode + ')' : ''}
                    <span style="opacity: 0.5; margin-left: 6px;">[${sourceLabel}]</span>
                </div>
            </div>
            <div class="client-actions">
                ${!isBase ? `
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="editClient(${idx})" title="Edit">✏️</button>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteClient(${idx})" title="Delete">🗑️</button>
                ` : `
                    <span style="font-size: 11px; color: var(--text-muted);">Edit clients.json</span>
                `}
            </div>
        </div>`;
    }).join('');
}

function clearClientForm() {
    ['cf-name', 'cf-address', 'cf-state', 'cf-state-code', 'cf-gstin', 'cf-contact', 'cf-phone', 'cf-email'].forEach(id => {
        document.getElementById(id).value = '';
    });
}

function openClientForm(title) {
    document.getElementById('client-form-title').textContent = title;
    document.getElementById('modal-client-form').classList.add('active');
}

function closeClientForm() {
    document.getElementById('modal-client-form').classList.remove('active');
    state.editingClientId = null;
}

function saveClient() {
    const name = document.getElementById('cf-name').value.trim();
    const address = document.getElementById('cf-address').value.trim();

    if (!name) { showToast('Company name is required', 'error'); return; }
    if (!address) { showToast('Address is required', 'error'); return; }

    const clientData = {
        id: state.editingClientId !== null ? state.editingClientId : Date.now(),
        name,
        address,
        state: document.getElementById('cf-state').value.trim(),
        stateCode: document.getElementById('cf-state-code').value.trim(),
        gstin: document.getElementById('cf-gstin').value.trim().toUpperCase(),
        contact: document.getElementById('cf-contact').value.trim(),
        phone: document.getElementById('cf-phone').value.trim(),
        email: document.getElementById('cf-email').value.trim()
    };

    if (state.editingClientId !== null) {
        const idx = state.userClients.findIndex(c => c.id === state.editingClientId);
        if (idx >= 0) state.userClients[idx] = clientData;
        showToast(`Client "${name}" updated`, 'success');
    } else {
        state.userClients.push(clientData);
        showToast(`Client "${name}" added`, 'success');
    }

    saveUserClients();
    closeClientForm();
    renderClientsList();
}

window.editClient = function(globalIdx) {
    const userIdx = globalIdx - state.baseClients.length;
    const client = state.userClients[userIdx];
    if (!client) return;

    state.editingClientId = client.id;
    document.getElementById('cf-name').value = client.name || '';
    document.getElementById('cf-address').value = client.address || '';
    document.getElementById('cf-state').value = client.state || '';
    document.getElementById('cf-state-code').value = client.stateCode || '';
    document.getElementById('cf-gstin').value = client.gstin || '';
    document.getElementById('cf-contact').value = client.contact || '';
    document.getElementById('cf-phone').value = client.phone || '';
    document.getElementById('cf-email').value = client.email || '';

    openClientForm('✏️ Edit Client');
};

window.deleteClient = function(globalIdx) {
    const userIdx = globalIdx - state.baseClients.length;
    const client = state.userClients[userIdx];
    if (!client) return;
    if (confirm(`Delete client "${client.name}"?`)) {
        state.userClients.splice(userIdx, 1);
        saveUserClients();
        renderClientsList();
        showToast(`Client "${client.name}" deleted`, 'info');
    }
};

// ===================== ITEMS TABLE =====================
let itemIdCounter = 0;

function addItemRow() {
    const tbody = document.getElementById('items-tbody');
    const tr = document.createElement('tr');
    tr.dataset.rowId = ++itemIdCounter;
    tr.innerHTML = `
        <td class="col-sl" style="text-align: center; color: var(--text-muted); font-size: 13px;">${tbody.children.length + 1}</td>
        <td class="col-desc"><input type="text" placeholder="Description of goods/services" data-field="description"></td>
        <td class="col-hsn"><input type="text" placeholder="HSN/SAC" data-field="hsn"></td>
        <td class="col-qty"><input type="number" placeholder="0" min="0" step="1" data-field="quantity" value="1"></td>
        <td class="col-unit"><input type="text" placeholder="nos" data-field="unit" value="nos"></td>
        <td class="col-rate"><input type="number" placeholder="0.00" min="0" step="0.01" data-field="rate" value=""></td>
        <td class="col-disc"><input type="number" placeholder="0" min="0" max="100" step="0.01" data-field="discount" value="0"></td>
        <td class="col-amount"><span class="amount-display" data-field="amount">₹ 0.00</span></td>
        <td class="col-action"><button class="btn btn-ghost btn-icon btn-sm" onclick="removeItemRow(this)" title="Remove item">✕</button></td>
    `;

    tr.querySelectorAll('input[data-field="quantity"], input[data-field="rate"], input[data-field="discount"]').forEach(input => {
        input.addEventListener('input', () => { calculateRowAmount(tr); recalculate(); });
    });

    tbody.appendChild(tr);
    updateItemsBadge();
    tr.querySelector('input[data-field="description"]').focus();
}

window.removeItemRow = function(btn) {
    btn.closest('tr').remove();
    renumberRows();
    recalculate();
    updateItemsBadge();
};

function renumberRows() {
    document.querySelectorAll('#items-tbody tr').forEach((row, idx) => {
        row.querySelector('.col-sl').textContent = idx + 1;
    });
}

function updateItemsBadge() {
    const count = document.querySelectorAll('#items-tbody tr').length;
    document.getElementById('items-count-badge').textContent = `${count} item${count !== 1 ? 's' : ''}`;
}

function calculateRowAmount(tr) {
    const qty = parseFloat(tr.querySelector('[data-field="quantity"]').value) || 0;
    const rate = parseFloat(tr.querySelector('[data-field="rate"]').value) || 0;
    const disc = parseFloat(tr.querySelector('[data-field="discount"]').value) || 0;
    let amount = qty * rate;
    if (disc > 0) amount *= (1 - disc / 100);
    tr.querySelector('[data-field="amount"]').textContent = `₹ ${formatNumber(amount)}`;
    return amount;
}

// ===================== CALCULATIONS =====================
function recalculate() {
    const rows = document.querySelectorAll('#items-tbody tr');
    let subtotal = 0;
    rows.forEach(row => { subtotal += calculateRowAmount(row); });

    let taxableAmount = subtotal;
    let gstAmount = 0;

    if (state.gstCalculation === 'inclusive') {
        taxableAmount = subtotal / (1 + state.gstRate / 100);
        gstAmount = subtotal - taxableAmount;
    } else {
        gstAmount = taxableAmount * state.gstRate / 100;
    }

    const grandTotal = state.gstCalculation === 'inclusive' ? subtotal : taxableAmount + gstAmount;

    if (state.gstType === 'intra') {
        const half = gstAmount / 2;
        document.getElementById('cgst-value').textContent = `₹ ${formatNumber(half)}`;
        document.getElementById('sgst-value').textContent = `₹ ${formatNumber(half)}`;
        document.getElementById('cgst-row').style.display = 'flex';
        document.getElementById('sgst-row').style.display = 'flex';
        document.getElementById('igst-row').style.display = 'none';
    } else {
        document.getElementById('igst-value').textContent = `₹ ${formatNumber(gstAmount)}`;
        document.getElementById('cgst-row').style.display = 'none';
        document.getElementById('sgst-row').style.display = 'none';
        document.getElementById('igst-row').style.display = 'flex';
    }

    document.getElementById('subtotal').textContent = `₹ ${formatNumber(state.gstCalculation === 'inclusive' ? taxableAmount : subtotal)}`;
    document.getElementById('grand-total').textContent = `₹ ${formatNumber(Math.round(grandTotal))}`;
    document.getElementById('amount-words').textContent = `INR ${numberToWords(Math.round(grandTotal))} Only`;
}

function updateGSTDisplay() {
    const rate = state.gstRate;
    document.getElementById('cgst-label').textContent = `CGST @ ${rate / 2}%`;
    document.getElementById('sgst-label').textContent = `SGST @ ${rate / 2}%`;
    document.getElementById('igst-label').textContent = `IGST @ ${rate}%`;
}

// ===================== NUMBER FORMATTING (Indian) =====================
function formatNumber(num) {
    if (isNaN(num)) return '0.00';
    const parts = num.toFixed(2).split('.');
    let intPart = parts[0];
    const decPart = parts[1];
    let sign = '';
    if (intPart.startsWith('-')) { sign = '-'; intPart = intPart.substring(1); }
    if (intPart.length > 3) {
        const last3 = intPart.slice(-3);
        const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
        intPart = rest + ',' + last3;
    }
    return sign + intPart + '.' + decPart;
}

// ===================== NUMBER TO WORDS (Indian) =====================
function numberToWords(num) {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function below100(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''); }
    function below1000(n) { return n < 100 ? below100(n) : ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : ''); }

    if (num < 0) return 'Minus ' + numberToWords(-num);
    let result = '';
    if (num >= 10000000) { result += below1000(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
    if (num >= 100000) { result += below100(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
    if (num >= 1000) { result += below100(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
    if (num > 0) result += below1000(num);
    return result.trim();
}

// ===================== RESET FORM =====================
function resetForm() {
    if (!confirm('Clear all fields and start a new quotation?')) return;

    ['quotation-no', 'reference-no', 'buyer-order-no', 'delivery-note',
     'dispatch-doc-no', 'dispatched-through', 'destination', 'payment-terms',
     'other-references', 'terms-delivery'].forEach(id => { document.getElementById(id).value = ''; });

    setDefaultDate();
    document.getElementById('buyer-order-date').value = '';
    document.getElementById('delivery-note-date').value = '';

    ['buyer-name', 'buyer-address', 'buyer-state', 'buyer-state-code', 'buyer-gstin',
     'consignee-name', 'consignee-address', 'consignee-state', 'consignee-state-code', 'consignee-gstin'].forEach(id => {
        document.getElementById(id).value = '';
    });

    document.getElementById('same-as-buyer').checked = true;
    handleSameAsBuyer();
    document.getElementById('items-tbody').innerHTML = '';
    addItemRow();

    state.gstType = 'intra';
    state.gstRate = 18;
    state.gstCalculation = 'exclusive';
    document.getElementById('gst-rate').value = '18';
    document.getElementById('gst-calculation').value = 'exclusive';
    document.querySelectorAll('#gst-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.type === 'intra');
    });
    updateGSTDisplay();
    clearSelectedClient();
    recalculate();
    showToast('Form cleared for new quotation', 'info');
}

// ===================== TOAST NOTIFICATIONS =====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===================== COLLECT FORM DATA =====================
function collectFormData() {
    const rows = document.querySelectorAll('#items-tbody tr');
    const items = [];

    rows.forEach(row => {
        const desc = row.querySelector('[data-field="description"]').value.trim();
        const hsn = row.querySelector('[data-field="hsn"]').value.trim();
        const qty = parseFloat(row.querySelector('[data-field="quantity"]').value) || 0;
        const unit = row.querySelector('[data-field="unit"]').value.trim() || 'nos';
        const rate = parseFloat(row.querySelector('[data-field="rate"]').value) || 0;
        const disc = parseFloat(row.querySelector('[data-field="discount"]').value) || 0;
        let amount = qty * rate;
        if (disc > 0) amount *= (1 - disc / 100);
        if (desc || rate > 0) items.push({ description: desc, hsn, quantity: qty, unit, rate, discount: disc, amount });
    });

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    let taxableAmount = subtotal, gstAmount = 0;
    if (state.gstCalculation === 'inclusive') {
        taxableAmount = subtotal / (1 + state.gstRate / 100);
        gstAmount = subtotal - taxableAmount;
    } else {
        gstAmount = taxableAmount * state.gstRate / 100;
    }
    const grandTotal = state.gstCalculation === 'inclusive' ? subtotal : taxableAmount + gstAmount;

    return {
        quotationNo: document.getElementById('quotation-no').value.trim(),
        date: document.getElementById('quotation-date').value,
        referenceNo: document.getElementById('reference-no').value.trim(),
        buyerOrderNo: document.getElementById('buyer-order-no').value.trim(),
        buyerOrderDate: document.getElementById('buyer-order-date').value,
        deliveryNote: document.getElementById('delivery-note').value.trim(),
        deliveryNoteDate: document.getElementById('delivery-note-date').value,
        dispatchDocNo: document.getElementById('dispatch-doc-no').value.trim(),
        dispatchedThrough: document.getElementById('dispatched-through').value.trim(),
        destination: document.getElementById('destination').value.trim(),
        paymentTerms: document.getElementById('payment-terms').value.trim(),
        otherReferences: document.getElementById('other-references').value.trim(),
        termsDelivery: document.getElementById('terms-delivery').value.trim(),
        buyer: {
            name: document.getElementById('buyer-name').value.trim(),
            address: document.getElementById('buyer-address').value.trim(),
            state: document.getElementById('buyer-state').value.trim(),
            stateCode: document.getElementById('buyer-state-code').value.trim(),
            gstin: document.getElementById('buyer-gstin').value.trim()
        },
        consignee: {
            name: document.getElementById('consignee-name').value.trim(),
            address: document.getElementById('consignee-address').value.trim(),
            state: document.getElementById('consignee-state').value.trim(),
            stateCode: document.getElementById('consignee-state-code').value.trim(),
            gstin: document.getElementById('consignee-gstin').value.trim()
        },
        items, gstType: state.gstType, gstRate: state.gstRate, gstCalculation: state.gstCalculation,
        subtotal: state.gstCalculation === 'inclusive' ? taxableAmount : subtotal,
        taxableAmount, gstAmount,
        cgst: state.gstType === 'intra' ? gstAmount / 2 : 0,
        sgst: state.gstType === 'intra' ? gstAmount / 2 : 0,
        igst: state.gstType === 'inter' ? gstAmount : 0,
        grandTotal: Math.round(grandTotal),
        bankHolder: document.getElementById('bank-holder').value.trim(),
        bankName: document.getElementById('bank-name').value.trim(),
        bankAccount: document.getElementById('bank-account').value.trim(),
        bankIFSC: document.getElementById('bank-ifsc').value.trim(),
        bankSwift: document.getElementById('bank-swift').value.trim(),
        declaration: document.getElementById('declaration-text').value.trim()
    };
}

// ===================== EXPORT PDF =====================
function exportPDF(preview = false) {
    const data = collectFormData();
    if (!data.quotationNo) { showToast('Please enter a Quotation Number', 'error'); document.getElementById('quotation-no').focus(); return; }
    if (data.items.length === 0) { showToast('Please add at least one item', 'error'); return; }
    try {
        generateQuotationPDF(data, preview);
        if (!preview) showToast('PDF downloaded successfully!', 'success');
    } catch (err) {
        console.error('PDF generation error:', err);
        showToast('Error generating PDF: ' + err.message, 'error');
    }
}

// ===================== GST API INTEGRATION (OPTION B) =====================
function openApiSettingsModal() {
    const savedKey = localStorage.getItem('stda_sandbox_api_key') || '';
    document.getElementById('input-api-key').value = savedKey;
    document.getElementById('modal-api-settings').classList.add('active');
}

function closeApiSettingsModal() {
    document.getElementById('modal-api-settings').classList.remove('active');
}

function saveApiKey() {
    const key = document.getElementById('input-api-key').value.trim();
    if (key) {
        localStorage.setItem('stda_sandbox_api_key', key);
        showToast('Sandbox API Key saved locally!', 'success');
    } else {
        localStorage.removeItem('stda_sandbox_api_key');
        showToast('Using Vercel environment variable SANDBOX_API_KEY', 'info');
    }
    closeApiSettingsModal();
}

async function fetchGSTDetails(gstin) {
    if (!gstin || gstin.trim().length !== 15) {
        showToast('Please enter a valid 15-character GSTIN number', 'error');
        return null;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    const badge = document.getElementById('gst-fetch-badge');
    if (badge) {
        badge.style.display = 'inline-flex';
        badge.className = 'gst-badge loading';
        badge.textContent = '🔄 Fetching...';
    }

    try {
        const storedKey = localStorage.getItem('stda_sandbox_api_key') || '';
        const queryUrl = `/api/gst-lookup?gstin=${encodeURIComponent(cleanGstin)}${storedKey ? '&apiKey=' + encodeURIComponent(storedKey) : ''}`;
        const resp = await fetch(queryUrl);
        const data = await resp.json();

        if (resp.ok && data.success) {
            if (badge) {
                badge.className = 'gst-badge active';
                badge.textContent = `✅ ${data.status || 'Active'}`;
            }

            // Auto-fill Buyer fields if present
            if (data.name) document.getElementById('buyer-name').value = data.name;
            if (data.address) document.getElementById('buyer-address').value = data.address;
            if (data.state) document.getElementById('buyer-state').value = data.state;
            if (data.stateCode) document.getElementById('buyer-state-code').value = data.stateCode;
            document.getElementById('buyer-gstin').value = cleanGstin;

            // Automatically select CGST+SGST (state 27) vs IGST (other states)
            checkStateGST(data.stateCode);

            // Sync consignee if checked
            if (document.getElementById('same-as-buyer').checked) {
                syncConsigneeWithBuyer();
            }

            // Save client to user clients list so future searches are instant
            if (data.name) {
                autoSaveClientFromGST({
                    name: data.name,
                    address: data.address,
                    state: data.state,
                    stateCode: data.stateCode,
                    gstin: cleanGstin
                });
            }

            showToast(`GST Details Fetched for ${data.name || cleanGstin}!`, 'success');
            return data;
        } else {
            if (badge) {
                badge.className = 'gst-badge error';
                badge.textContent = '⚠️ API Error';
            }
            showToast(data.error || 'Could not fetch GST details', 'error');
            return null;
        }
    } catch (err) {
        if (badge) {
            badge.className = 'gst-badge error';
            badge.textContent = '⚠️ Offline';
        }
        showToast('GST API endpoint offline or not running locally', 'warning');
        return null;
    }
}

function checkStateGST(buyerStateCode) {
    // Seller (SensoTech) State Code is 27 (Maharashtra)
    const SELLER_STATE_CODE = '27';
    const gstToggle = document.querySelectorAll('#gst-toggle button');
    if (buyerStateCode === SELLER_STATE_CODE) {
        // Intra-state (CGST + SGST)
        gstToggle.forEach(b => b.classList.remove('active'));
        const intraBtn = document.querySelector('#gst-toggle button[data-type="intra"]');
        if (intraBtn) intraBtn.classList.add('active');
        state.gstType = 'intra';
    } else {
        // Inter-state (IGST)
        gstToggle.forEach(b => b.classList.remove('active'));
        const interBtn = document.querySelector('#gst-toggle button[data-type="inter"]');
        if (interBtn) interBtn.classList.add('active');
        state.gstType = 'inter';
    }
    updateGSTDisplay();
    recalculate();
}

function autoSaveClientFromGST(clientData) {
    if (!clientData.name || !clientData.gstin) return;
    
    const existingIndex = state.userClients.findIndex(c => c.gstin && c.gstin.toUpperCase() === clientData.gstin.toUpperCase());
    if (existingIndex >= 0) {
        state.userClients[existingIndex] = { ...state.userClients[existingIndex], ...clientData };
    } else {
        const newClient = {
            id: 'user_' + Date.now(),
            ...clientData
        };
        state.userClients.push(newClient);
    }
    saveUserClients();
}

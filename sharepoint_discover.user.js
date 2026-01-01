// ==UserScript==
// @name         Train Tracker - SharePoint File Discovery
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Discover all WorktoSheets files across SharePoint folders
// @author       Train Tracker
// @match        https://*.sharepoint.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    // State
    let discoveredFiles = [];
    let foldersToVisit = [];
    let currentPhase = null;
    let isScanning = false;

    // Create UI
    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'tt-discover-panel';
        panel.innerHTML = `
            <style>
                #tt-discover-panel {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 400px;
                    max-height: 85vh;
                    background: #1e293b;
                    border: 1px solid #475569;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #f1f5f9;
                    overflow: hidden;
                }
                #tt-discover-panel .header {
                    background: #0f172a;
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #475569;
                }
                #tt-discover-panel .header h3 {
                    margin: 0;
                    font-size: 14px;
                }
                #tt-discover-panel .status-badge {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    background: #3B82F6;
                }
                #tt-discover-panel .status-badge.scanning {
                    background: #F59E0B;
                    animation: pulse 1s infinite;
                }
                #tt-discover-panel .status-badge.complete {
                    background: #10B981;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                #tt-discover-panel .body {
                    padding: 16px;
                    max-height: 55vh;
                    overflow-y: auto;
                }
                #tt-discover-panel .stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 16px;
                }
                #tt-discover-panel .stat-box {
                    background: #334155;
                    padding: 12px;
                    border-radius: 8px;
                    text-align: center;
                }
                #tt-discover-panel .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #3B82F6;
                }
                #tt-discover-panel .stat-label {
                    font-size: 10px;
                    color: #94a3b8;
                    text-transform: uppercase;
                }
                #tt-discover-panel .log {
                    background: #0f172a;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-family: monospace;
                    max-height: 150px;
                    overflow-y: auto;
                    margin-bottom: 16px;
                }
                #tt-discover-panel .log-entry {
                    margin-bottom: 4px;
                    color: #94a3b8;
                }
                #tt-discover-panel .log-entry.info { color: #3B82F6; }
                #tt-discover-panel .log-entry.success { color: #10B981; }
                #tt-discover-panel .log-entry.warning { color: #F59E0B; }
                #tt-discover-panel .log-entry.error { color: #EF4444; }
                #tt-discover-panel .footer {
                    padding: 12px 16px;
                    border-top: 1px solid #475569;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                #tt-discover-panel button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                    font-weight: 500;
                }
                #tt-discover-panel .btn-primary {
                    background: #3B82F6;
                    color: white;
                }
                #tt-discover-panel .btn-primary:hover {
                    background: #2563EB;
                }
                #tt-discover-panel .btn-success {
                    background: #10B981;
                    color: white;
                }
                #tt-discover-panel .btn-secondary {
                    background: #475569;
                    color: white;
                }
                #tt-discover-panel .btn-warning {
                    background: #F59E0B;
                    color: white;
                }
                #tt-discover-panel .file-list {
                    margin-top: 8px;
                }
                #tt-discover-panel .file-item {
                    background: #334155;
                    padding: 8px 10px;
                    border-radius: 6px;
                    margin-bottom: 6px;
                    font-size: 11px;
                }
                #tt-discover-panel .file-item .train-num {
                    color: #3B82F6;
                    font-weight: 700;
                    font-size: 13px;
                }
                #tt-discover-panel .file-item .units {
                    color: #10B981;
                    margin-left: 8px;
                }
                #tt-discover-panel .file-item .phase {
                    color: #94a3b8;
                    margin-left: 8px;
                }
                #tt-discover-panel .folder-queue {
                    background: #334155;
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }
                #tt-discover-panel .folder-queue h4 {
                    margin: 0 0 8px 0;
                    font-size: 12px;
                    color: #94a3b8;
                }
                #tt-discover-panel .folder-queue .folder-item {
                    font-size: 11px;
                    padding: 4px 8px;
                    margin-bottom: 4px;
                    background: #1e293b;
                    border-radius: 4px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #tt-discover-panel .folder-queue .folder-item.current {
                    background: #3B82F6;
                    color: white;
                }
                #tt-discover-panel .folder-queue .folder-item .go-btn {
                    background: #10B981;
                    color: white;
                    border: none;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    cursor: pointer;
                }
                #tt-discover-panel .current-location {
                    background: #334155;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    margin-bottom: 12px;
                    word-break: break-all;
                }
                #tt-discover-panel .current-location strong {
                    color: #3B82F6;
                }
            </style>
            <div class="header">
                <h3>Train Tracker Discovery v2</h3>
                <span class="status-badge" id="tt-status">Ready</span>
            </div>
            <div class="body">
                <div class="current-location" id="tt-location">
                    <strong>Location:</strong> <span id="tt-path">Loading...</span>
                </div>
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-value" id="tt-files-count">0</div>
                        <div class="stat-label">Files Found</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" id="tt-pending-count">0</div>
                        <div class="stat-label">Folders Pending</div>
                    </div>
                </div>
                <div class="folder-queue" id="tt-queue-section" style="display: none;">
                    <h4>Folders to Visit:</h4>
                    <div id="tt-folder-queue"></div>
                </div>
                <div class="log" id="tt-log"></div>
                <div class="file-list" id="tt-file-list"></div>
            </div>
            <div class="footer">
                <button class="btn-primary" id="tt-scan">Scan Page</button>
                <button class="btn-warning" id="tt-auto" title="Auto-traverse all folders">Auto Traverse</button>
                <button class="btn-success" id="tt-copy" disabled>Copy Results</button>
                <button class="btn-secondary" id="tt-export" disabled>Export JSON</button>
                <button class="btn-secondary" id="tt-clear">Clear</button>
            </div>
        `;
        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('tt-scan').onclick = scanCurrentPage;
        document.getElementById('tt-auto').onclick = startAutoTraverse;
        document.getElementById('tt-copy').onclick = copyResults;
        document.getElementById('tt-export').onclick = exportJSON;
        document.getElementById('tt-clear').onclick = clearAll;

        // Load saved data
        loadSaved();
        updateLocation();

        // Auto-scan on page load
        setTimeout(scanCurrentPage, 1500);
    }

    function log(msg, type = 'info') {
        const logDiv = document.getElementById('tt-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logDiv.insertBefore(entry, logDiv.firstChild);
        while (logDiv.children.length > 50) {
            logDiv.removeChild(logDiv.lastChild);
        }
        console.log(`[Discovery] ${msg}`);
    }

    function updateStats() {
        document.getElementById('tt-files-count').textContent = discoveredFiles.length;
        document.getElementById('tt-pending-count').textContent = foldersToVisit.length;

        const hasFiles = discoveredFiles.length > 0;
        document.getElementById('tt-copy').disabled = !hasFiles;
        document.getElementById('tt-export').disabled = !hasFiles;
    }

    function updateLocation() {
        const pathSpan = document.getElementById('tt-path');
        const url = new URL(window.location.href);

        // Extract path from SharePoint URL
        let path = 'Unknown';
        const idParam = url.searchParams.get('id');
        if (idParam) {
            path = decodeURIComponent(idParam).split('/').slice(-3).join(' > ');
        } else {
            const pathMatch = url.pathname.match(/\/sites\/[^\/]+\/Shared%20Documents\/(.+)/);
            if (pathMatch) {
                path = decodeURIComponent(pathMatch[1]).replace(/\//g, ' > ');
            }
        }

        pathSpan.textContent = path;
        currentPhase = extractPhase(path);
    }

    function extractTrainNumber(text) {
        const patterns = [
            /T(\d+)\s*[-–]/i,
            /T(\d+)\s*\(/i,
            /Train\s*(\d+)/i,
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m) return parseInt(m[1], 10);
        }
        return null;
    }

    function extractUnitNumbers(text) {
        const units = [];
        // 5-digit pattern
        const m5 = text.match(/(\d{5})\s*(?:and|&|,)\s*(\d{5})/gi);
        if (m5) {
            m5.forEach(match => {
                const nums = match.match(/\d{5}/g);
                if (nums) units.push(...nums);
            });
        }
        // 3-digit pattern
        if (units.length === 0) {
            const m3 = text.match(/(\d{3})\s*[&,]\s*(\d{3})/g);
            if (m3) {
                m3.forEach(match => {
                    const nums = match.match(/\d{3}/g);
                    if (nums) units.push(...nums.map(n => '96' + n));
                });
            }
        }
        return [...new Set(units)];
    }

    function extractPhase(text) {
        const m = text.match(/Phase\s*(\d+)/i);
        return m ? `Phase ${m[1]}` : null;
    }

    // Get items from current page
    function getPageItems() {
        const items = [];
        const rows = document.querySelectorAll('[data-automationid^="row-"]:not([data-automationid="row-header"])');

        rows.forEach(row => {
            const nameCell = row.querySelector('[data-automationid="field-LinkFilename"]');
            if (!nameCell) return;

            const nameSpan = nameCell.querySelector('span[title]');
            if (!nameSpan) return;

            const name = nameSpan.getAttribute('title') || nameSpan.textContent;
            const modifiedCell = row.querySelector('[data-automationid="field-Modified"]');
            const modified = modifiedCell ? (modifiedCell.getAttribute('title') || modifiedCell.textContent) : '';

            // Check if it's a file or folder
            const iconCell = row.querySelector('[data-automationid="field-DocIcon"]');
            const hasXlsIcon = iconCell && iconCell.querySelector('img[alt*="xls"]');
            const hasFolderIcon = iconCell && iconCell.querySelector('svg');

            const isExcel = hasXlsIcon || /\.xls[mx]$/i.test(name);
            const isFolder = hasFolderIcon && !isExcel;

            // Get the URL for this item
            let itemUrl = null;
            const currentUrl = new URL(window.location.href);
            const currentId = currentUrl.searchParams.get('id') || '';

            if (isFolder) {
                // Build folder URL
                const basePath = currentId || decodeURIComponent(currentUrl.pathname.replace('/Forms/AllItems.aspx', ''));
                itemUrl = new URL(window.location.href);
                itemUrl.searchParams.set('id', basePath + '/' + encodeURIComponent(name));
            }

            items.push({
                name,
                modified,
                isFolder,
                isExcel,
                url: itemUrl ? itemUrl.href : window.location.href,
                element: nameSpan
            });
        });

        return items;
    }

    // Scan current page for files and folders
    function scanCurrentPage() {
        log('Scanning current page...', 'info');
        updateLocation();

        const items = getPageItems();
        log(`Found ${items.length} items on page`, 'info');

        let filesFound = 0;
        let foldersFound = 0;

        items.forEach(item => {
            // Check for WorktoSheets files
            if (item.isExcel && /worktosheet/i.test(item.name)) {
                const fileInfo = {
                    name: item.name,
                    url: window.location.href,
                    modified: item.modified,
                    trainNumber: extractTrainNumber(item.name),
                    units: extractUnitNumbers(item.name),
                    phase: currentPhase || extractPhase(window.location.href),
                    discoveredAt: new Date().toISOString()
                };

                // Check if already discovered
                const exists = discoveredFiles.some(f => f.name === fileInfo.name && f.url === fileInfo.url);
                if (!exists) {
                    discoveredFiles.push(fileInfo);
                    filesFound++;
                    log(`Found: T${fileInfo.trainNumber || '?'} - ${item.name}`, 'success');
                }
            }

            // Queue relevant folders
            if (item.isFolder) {
                const name = item.name.toLowerCase();
                const shouldVisit =
                    /^phase\s*\d/i.test(item.name) ||  // Phase folders
                    /^t\d+\s*[-–(]/i.test(item.name) ||  // T## folders (T01, T02, etc.)
                    /work\s*to\s*sheets/i.test(item.name) ||  // Work to Sheets folders
                    /05\s*work/i.test(item.name);  // 05 Work folders

                if (shouldVisit) {
                    const exists = foldersToVisit.some(f => f.url === item.url);
                    if (!exists) {
                        foldersToVisit.push({
                            name: item.name,
                            url: item.url,
                            phase: currentPhase || extractPhase(item.name)
                        });
                        foldersFound++;
                    }
                }
            }
        });

        log(`Added ${filesFound} files, ${foldersFound} folders to queue`, 'info');
        updateStats();
        displayFiles();
        displayFolderQueue();
        saveData();
    }

    // Auto traverse folders
    async function startAutoTraverse() {
        if (isScanning) {
            log('Already traversing...', 'warning');
            return;
        }

        if (foldersToVisit.length === 0) {
            log('No folders in queue. Scan first!', 'warning');
            return;
        }

        isScanning = true;
        document.getElementById('tt-status').textContent = 'Traversing...';
        document.getElementById('tt-status').className = 'status-badge scanning';

        log('Starting auto-traverse...', 'info');

        // Process next folder
        await processNextFolder();
    }

    async function processNextFolder() {
        if (foldersToVisit.length === 0) {
            isScanning = false;
            document.getElementById('tt-status').textContent = 'Complete';
            document.getElementById('tt-status').className = 'status-badge complete';
            log(`Discovery complete! Found ${discoveredFiles.length} files`, 'success');
            saveData();
            return;
        }

        const folder = foldersToVisit.shift();
        log(`Navigating to: ${folder.name}`, 'info');
        updateStats();
        displayFolderQueue();

        // Navigate to folder
        window.location.href = folder.url;

        // The page will reload, and the script will continue scanning
        // We save state so it persists across page loads
        GM_setValue('isAutoTraversing', true);
        saveData();
    }

    // Display discovered files
    function displayFiles() {
        const container = document.getElementById('tt-file-list');
        if (discoveredFiles.length === 0) {
            container.innerHTML = '<div style="color: #94a3b8; text-align: center; font-size: 11px;">No files discovered yet</div>';
            return;
        }

        const sorted = [...discoveredFiles].sort((a, b) => {
            if (a.trainNumber && b.trainNumber) return a.trainNumber - b.trainNumber;
            if (a.trainNumber) return -1;
            if (b.trainNumber) return 1;
            return a.name.localeCompare(b.name);
        });

        container.innerHTML = sorted.map(f => `
            <div class="file-item">
                <span class="train-num">T${f.trainNumber || '?'}</span>
                <span class="units">${f.units.join(' + ') || '?'}</span>
                <span class="phase">${f.phase || ''}</span>
                <div style="color: #64748b; font-size: 10px; margin-top: 4px;">${f.name}</div>
            </div>
        `).join('');
    }

    // Display folder queue
    function displayFolderQueue() {
        const section = document.getElementById('tt-queue-section');
        const container = document.getElementById('tt-folder-queue');

        if (foldersToVisit.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Show first 10 folders
        const toShow = foldersToVisit.slice(0, 10);
        container.innerHTML = toShow.map((f, i) => `
            <div class="folder-item ${i === 0 ? 'current' : ''}">
                <span>${f.name}</span>
                <button class="go-btn" onclick="window.location.href='${f.url}'">Go</button>
            </div>
        `).join('');

        if (foldersToVisit.length > 10) {
            container.innerHTML += `<div style="color: #94a3b8; font-size: 10px; padding: 4px;">...and ${foldersToVisit.length - 10} more</div>`;
        }
    }

    // Save/Load functions
    function saveData() {
        GM_setValue('discoveredFiles', JSON.stringify(discoveredFiles));
        GM_setValue('foldersToVisit', JSON.stringify(foldersToVisit));
    }

    function loadSaved() {
        try {
            const savedFiles = GM_getValue('discoveredFiles', '[]');
            const savedFolders = GM_getValue('foldersToVisit', '[]');
            discoveredFiles = JSON.parse(savedFiles);
            foldersToVisit = JSON.parse(savedFolders);

            if (discoveredFiles.length > 0) {
                log(`Loaded ${discoveredFiles.length} saved files`, 'info');
            }
            if (foldersToVisit.length > 0) {
                log(`${foldersToVisit.length} folders pending`, 'info');
            }

            updateStats();
            displayFiles();
            displayFolderQueue();

            // Check if we were auto-traversing
            const wasTraversing = GM_getValue('isAutoTraversing', false);
            if (wasTraversing && foldersToVisit.length > 0) {
                GM_setValue('isAutoTraversing', false);
                log('Continuing auto-traverse...', 'info');
                setTimeout(() => {
                    scanCurrentPage();
                    setTimeout(startAutoTraverse, 2000);
                }, 1500);
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }

    function clearAll() {
        if (confirm('Clear all discovered files and folder queue?')) {
            discoveredFiles = [];
            foldersToVisit = [];
            GM_setValue('discoveredFiles', '[]');
            GM_setValue('foldersToVisit', '[]');
            GM_setValue('isAutoTraversing', false);
            updateStats();
            displayFiles();
            displayFolderQueue();
            log('Cleared all data', 'info');
        }
    }

    function copyResults() {
        const header = 'Train\tUnits\tPhase\tFilename\tURL\n';
        const text = discoveredFiles.map(f =>
            `T${f.trainNumber || '?'}\t${f.units.join(' + ')}\t${f.phase || ''}\t${f.name}\t${f.url}`
        ).join('\n');

        GM_setClipboard(header + text);
        log('Results copied to clipboard!', 'success');
        alert(`Copied ${discoveredFiles.length} file locations to clipboard!`);
    }

    function exportJSON() {
        const data = {
            files: discoveredFiles,
            exportedAt: new Date().toISOString(),
            summary: {
                totalFiles: discoveredFiles.length,
                phases: [...new Set(discoveredFiles.map(f => f.phase).filter(Boolean))],
                trains: [...new Set(discoveredFiles.map(f => f.trainNumber).filter(Boolean))].sort((a,b) => a-b)
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `worktosheets_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        log('Exported to JSON file', 'success');
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(createUI, 1000));
    } else {
        setTimeout(createUI, 1000);
    }
})();

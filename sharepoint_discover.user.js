// ==UserScript==
// @name         Train Tracker - SharePoint File Discovery
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    // Configuration
    const ROOT_FOLDER = 'Train Records';
    const WORK_SHEETS_FOLDER_PATTERN = /work\s*to\s*sheets/i;
    const FILE_PATTERN = /worktosheet.*\.xls[mx]$/i;

    // State
    let discoveredFiles = [];
    let visitedFolders = new Set();
    let isDiscovering = false;
    let discoveryLog = [];

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
                    width: 450px;
                    max-height: 80vh;
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
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                #tt-discover-panel .status-badge {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    background: #3B82F6;
                }
                #tt-discover-panel .status-badge.discovering {
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
                    max-height: 50vh;
                    overflow-y: auto;
                }
                #tt-discover-panel .stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
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
                    max-height: 200px;
                    overflow-y: auto;
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
                #tt-discover-panel .btn-primary:disabled {
                    background: #475569;
                    cursor: not-allowed;
                }
                #tt-discover-panel .btn-success {
                    background: #10B981;
                    color: white;
                }
                #tt-discover-panel .btn-secondary {
                    background: #475569;
                    color: white;
                }
                #tt-discover-panel .file-list {
                    margin-top: 16px;
                }
                #tt-discover-panel .file-item {
                    background: #334155;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    font-size: 11px;
                }
                #tt-discover-panel .file-item .train-num {
                    color: #3B82F6;
                    font-weight: 700;
                    font-size: 14px;
                }
                #tt-discover-panel .file-item .path {
                    color: #94a3b8;
                    font-size: 10px;
                    word-break: break-all;
                }
                #tt-discover-panel .file-item .units {
                    color: #10B981;
                }
                #tt-discover-panel .instructions {
                    background: #334155;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    margin-bottom: 16px;
                }
                #tt-discover-panel .instructions ol {
                    margin: 8px 0 0 16px;
                    padding: 0;
                }
                #tt-discover-panel .instructions li {
                    margin-bottom: 4px;
                }
            </style>
            <div class="header">
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                    </svg>
                    File Discovery
                </h3>
                <span class="status-badge" id="tt-status">Ready</span>
            </div>
            <div class="body">
                <div class="instructions">
                    <strong>How to use:</strong>
                    <ol>
                        <li>Navigate to the <strong>Train Records</strong> folder in SharePoint</li>
                        <li>Click <strong>Start Discovery</strong> to begin scanning</li>
                        <li>The script will traverse all Phase folders automatically</li>
                        <li>Once complete, copy the file list to save it</li>
                    </ol>
                </div>
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-value" id="tt-files-count">0</div>
                        <div class="stat-label">Files Found</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" id="tt-folders-count">0</div>
                        <div class="stat-label">Folders Scanned</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" id="tt-phases-count">0</div>
                        <div class="stat-label">Phases</div>
                    </div>
                </div>
                <div class="log" id="tt-log"></div>
                <div class="file-list" id="tt-file-list"></div>
            </div>
            <div class="footer">
                <button class="btn-primary" id="tt-start">Start Discovery</button>
                <button class="btn-success" id="tt-copy" disabled>Copy Results</button>
                <button class="btn-secondary" id="tt-export" disabled>Export JSON</button>
                <button class="btn-secondary" id="tt-load">Load Saved</button>
                <button class="btn-secondary" id="tt-close">Minimize</button>
            </div>
        `;
        document.body.appendChild(panel);

        // Minimized button
        const minBtn = document.createElement('button');
        minBtn.id = 'tt-min-btn';
        minBtn.innerHTML = '🔍';
        minBtn.style.cssText = `
            position: fixed; top: 20px; right: 20px; width: 50px; height: 50px;
            border-radius: 50%; background: #3B82F6; border: none; cursor: pointer;
            font-size: 24px; z-index: 999998; display: none;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        `;
        document.body.appendChild(minBtn);

        // Event listeners
        document.getElementById('tt-start').onclick = startDiscovery;
        document.getElementById('tt-copy').onclick = copyResults;
        document.getElementById('tt-export').onclick = exportJSON;
        document.getElementById('tt-load').onclick = loadSaved;
        document.getElementById('tt-close').onclick = () => {
            panel.style.display = 'none';
            minBtn.style.display = 'block';
        };
        minBtn.onclick = () => {
            panel.style.display = 'block';
            minBtn.style.display = 'none';
        };

        // Load any previously saved data
        loadSaved();
    }

    function log(msg, type = 'info') {
        const logDiv = document.getElementById('tt-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logDiv.insertBefore(entry, logDiv.firstChild);

        // Keep only last 100 entries
        while (logDiv.children.length > 100) {
            logDiv.removeChild(logDiv.lastChild);
        }

        discoveryLog.push({ time: new Date().toISOString(), msg, type });
        console.log(`[Discovery] ${msg}`);
    }

    function updateStats() {
        document.getElementById('tt-files-count').textContent = discoveredFiles.length;
        document.getElementById('tt-folders-count').textContent = visitedFolders.size;

        const phases = new Set(discoveredFiles.map(f => f.phase).filter(Boolean));
        document.getElementById('tt-phases-count').textContent = phases.size;
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

    // Get current folder contents from the page
    function getCurrentFolderItems() {
        const items = [];
        const rows = document.querySelectorAll('[data-automationid^="row-"]:not([data-automationid="row-header"])');

        rows.forEach(row => {
            const nameCell = row.querySelector('[data-automationid="field-LinkFilename"]');
            const nameSpan = nameCell ? nameCell.querySelector('span[title]') : null;
            const nameButton = nameCell ? nameCell.querySelector('button') : null;
            const nameLink = nameCell ? nameCell.querySelector('a') : null;
            const modifiedCell = row.querySelector('[data-automationid="field-Modified"]');
            const iconCell = row.querySelector('[data-automationid="field-DocIcon"]');

            if (nameSpan || nameButton || nameLink) {
                const textEl = nameSpan || nameButton || nameLink;
                const name = textEl.getAttribute('title') || textEl.textContent;
                const modified = modifiedCell ? (modifiedCell.getAttribute('title') || modifiedCell.textContent) : '';

                // Determine if folder or file - check multiple indicators
                const hasFolderIcon = iconCell && (
                    iconCell.querySelector('svg') ||
                    iconCell.querySelector('i[data-icon-name="FabricFolder"]') ||
                    iconCell.querySelector('[data-icon-name*="Folder"]')
                );
                const isExcel = name.toLowerCase().endsWith('.xlsx') ||
                               name.toLowerCase().endsWith('.xlsm') ||
                               (iconCell && iconCell.querySelector('img[alt*="xls"]'));

                // If it's not an Excel file and doesn't have a file extension, treat as folder
                const hasExtension = /\.[a-z]{2,4}$/i.test(name);
                const isFolder = !hasExtension || !!hasFolderIcon;

                // Get the best clickable element - prefer button or link, fallback to span
                const clickElement = nameButton || nameLink || nameSpan;

                items.push({
                    name,
                    modified,
                    isFolder: isFolder && !isExcel,
                    isExcel: !!isExcel,
                    element: clickElement,
                    row: row
                });
            }
        });

        return items;
    }

    // Get current URL path
    function getCurrentPath() {
        const url = new URL(window.location.href);
        // SharePoint paths can be in different formats
        const pathMatch = url.pathname.match(/\/sites\/[^\/]+\/Shared%20Documents\/(.+)/);
        if (pathMatch) {
            return decodeURIComponent(pathMatch[1]).replace(/\//g, ' > ');
        }
        return url.pathname;
    }

    // Navigate to a folder by clicking
    async function navigateToFolder(item) {
        return new Promise((resolve) => {
            const element = item.element;
            const row = item.row;

            try {
                // Method 1: Double-click on the row (most reliable for SharePoint)
                if (row) {
                    const dblClickEvent = document.createEvent('MouseEvents');
                    dblClickEvent.initEvent('dblclick', true, true);
                    row.dispatchEvent(dblClickEvent);
                }

                // Method 2: Also try clicking the element directly after a short delay
                setTimeout(() => {
                    if (element) {
                        element.click();
                        // Try double-click on element too
                        setTimeout(() => element.click(), 50);
                    }
                }, 200);

            } catch (e) {
                console.log('Primary click method failed, trying alternatives', e);

                // Method 3: Focus and Enter key
                try {
                    if (element) {
                        element.focus();
                        const enterEvent = new KeyboardEvent('keypress', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true
                        });
                        element.dispatchEvent(enterEvent);
                    }
                } catch (e2) {
                    console.log('Enter key method also failed', e2);
                }
            }

            // Wait for page to load
            setTimeout(resolve, 3000);
        });
    }

    // Navigate back
    async function navigateBack() {
        return new Promise((resolve) => {
            const backBtn = document.querySelector('[data-automationid="up-button"]') ||
                           document.querySelector('[aria-label="Up"]') ||
                           document.querySelector('.ms-Breadcrumb-item:last-child');

            if (backBtn) {
                backBtn.click();
                setTimeout(resolve, 1500);
            } else {
                window.history.back();
                setTimeout(resolve, 2000);
            }
        });
    }

    // Wait for folder contents to load
    async function waitForContent() {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                const rows = document.querySelectorAll('[data-automationid^="row-"]:not([data-automationid="row-header"])');
                if (rows.length > 0 || attempts > 20) {
                    setTimeout(resolve, 500);
                } else {
                    attempts++;
                    setTimeout(check, 500);
                }
            };
            check();
        });
    }

    // Main discovery function
    async function startDiscovery() {
        if (isDiscovering) {
            log('Discovery already in progress', 'warning');
            return;
        }

        isDiscovering = true;
        discoveredFiles = [];
        visitedFolders = new Set();
        discoveryLog = [];

        document.getElementById('tt-status').textContent = 'Discovering...';
        document.getElementById('tt-status').className = 'status-badge discovering';
        document.getElementById('tt-start').disabled = true;
        document.getElementById('tt-copy').disabled = true;
        document.getElementById('tt-export').disabled = true;

        log('Starting discovery...', 'info');

        // Check if we're in Train Records or need to navigate there
        const currentPath = getCurrentPath();
        log(`Current path: ${currentPath}`, 'info');

        try {
            await scanCurrentFolder(currentPath, 0);
        } catch (error) {
            log(`Error during discovery: ${error.message}`, 'error');
        }

        // Complete
        isDiscovering = false;
        document.getElementById('tt-status').textContent = 'Complete';
        document.getElementById('tt-status').className = 'status-badge complete';
        document.getElementById('tt-start').disabled = false;
        document.getElementById('tt-copy').disabled = false;
        document.getElementById('tt-export').disabled = false;

        log(`Discovery complete! Found ${discoveredFiles.length} files`, 'success');
        updateStats();
        displayFiles();
        saveResults();
    }

    // Recursive folder scanner
    async function scanCurrentFolder(path, depth) {
        if (depth > 5) {
            log(`Max depth reached at: ${path}`, 'warning');
            return;
        }

        const folderKey = window.location.href;
        if (visitedFolders.has(folderKey)) {
            return;
        }
        visitedFolders.add(folderKey);

        await waitForContent();
        const items = getCurrentFolderItems();
        log(`Scanning: ${path} (${items.length} items)`, 'info');
        updateStats();

        // Process files first
        for (const item of items) {
            if (!item.isFolder && FILE_PATTERN.test(item.name)) {
                const fileInfo = {
                    name: item.name,
                    path: path,
                    url: window.location.href,
                    modified: item.modified,
                    trainNumber: extractTrainNumber(item.name) || extractTrainNumber(path),
                    units: extractUnitNumbers(item.name),
                    phase: extractPhase(path),
                    discoveredAt: new Date().toISOString()
                };

                discoveredFiles.push(fileInfo);
                log(`Found: T${fileInfo.trainNumber || '?'} - ${item.name}`, 'success');
                updateStats();
            }
        }

        // Then process folders
        const foldersToVisit = items.filter(item => {
            if (!item.isFolder) return false;
            const name = item.name.toLowerCase();

            // Priority folders to visit
            if (name.includes('phase')) return true;
            if (/^t\d+/.test(name)) return true;
            if (WORK_SHEETS_FOLDER_PATTERN.test(name)) return true;

            return false;
        });

        for (const folder of foldersToVisit) {
            log(`Entering folder: ${folder.name}`, 'info');

            // Click to navigate - pass the whole folder item
            await navigateToFolder(folder);
            await waitForContent();

            // Scan this folder
            const newPath = path ? `${path} > ${folder.name}` : folder.name;
            await scanCurrentFolder(newPath, depth + 1);

            // Navigate back
            await navigateBack();
            await waitForContent();
        }
    }

    function displayFiles() {
        const container = document.getElementById('tt-file-list');
        if (discoveredFiles.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No files discovered yet</p>';
            return;
        }

        // Sort by train number
        const sorted = [...discoveredFiles].sort((a, b) => {
            if (a.trainNumber && b.trainNumber) return a.trainNumber - b.trainNumber;
            if (a.trainNumber) return -1;
            if (b.trainNumber) return 1;
            return a.name.localeCompare(b.name);
        });

        container.innerHTML = sorted.map(f => `
            <div class="file-item">
                <span class="train-num">T${f.trainNumber || '?'}</span>
                <span class="units">${f.units.join(' + ') || 'Unknown units'}</span>
                ${f.phase ? `<span style="color: #94a3b8; margin-left: 8px;">${f.phase}</span>` : ''}
                <div class="path">${f.path}</div>
                <div style="color: #64748b; font-size: 10px;">Modified: ${f.modified}</div>
            </div>
        `).join('');
    }

    function saveResults() {
        const data = {
            files: discoveredFiles,
            discoveredAt: new Date().toISOString(),
            folderCount: visitedFolders.size
        };
        GM_setValue('discoveredFiles', JSON.stringify(data));
        log('Results saved to storage', 'success');
    }

    function loadSaved() {
        try {
            const saved = GM_getValue('discoveredFiles', null);
            if (saved) {
                const data = JSON.parse(saved);
                discoveredFiles = data.files || [];
                log(`Loaded ${discoveredFiles.length} saved files from ${new Date(data.discoveredAt).toLocaleString()}`, 'info');
                updateStats();
                displayFiles();

                if (discoveredFiles.length > 0) {
                    document.getElementById('tt-copy').disabled = false;
                    document.getElementById('tt-export').disabled = false;
                }
            }
        } catch (e) {
            log('No saved data found', 'info');
        }
    }

    function copyResults() {
        const text = discoveredFiles.map(f =>
            `T${f.trainNumber || '?'}\t${f.units.join(' + ')}\t${f.phase || ''}\t${f.name}\t${f.url}`
        ).join('\n');

        const header = 'Train\tUnits\tPhase\tFilename\tURL\n';
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
        a.download = `worktosheets_locations_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        log('Exported to JSON file', 'success');
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        setTimeout(createUI, 1000);
    }
})();

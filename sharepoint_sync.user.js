// ==UserScript==
// @name         Train Tracker - SharePoint Sync
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitor SharePoint for WorktoSheets changes and sync to Train Tracker
// @author       Train Tracker
// @match        https://*.sharepoint.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @connect      fsubmqjevlfpcirgsbhi.supabase.co
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Supabase configuration
    const SUPABASE_URL = 'https://fsubmqjevlfpcirgsbhi.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE';

    // Sheet to car type mapping
    const SHEET_TO_CAR_TYPE = {
        'DM 3 CAR': 'DM 3 CAR',
        'Trailer 3 Car': 'Trailer 3 Car',
        'UNDM 3 CAR': 'UNDM 3 CAR',
        'DM 4 Car': 'DM 4 Car',
        'Trailer 4 Car': 'Trailer 4 Car',
        'Special Trailer 4 Car': 'Special Trailer 4 Car',
        'UNDM 4 Car': 'UNDM 4 Car'
    };

    // Create floating UI panel
    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'train-tracker-panel';
        panel.innerHTML = `
            <style>
                #train-tracker-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 350px;
                    max-height: 500px;
                    background: #1e293b;
                    border: 1px solid #475569;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #f1f5f9;
                    overflow: hidden;
                }
                #train-tracker-panel .header {
                    background: #0f172a;
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #475569;
                }
                #train-tracker-panel .header h3 {
                    margin: 0;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                #train-tracker-panel .header .status {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    background: #10B981;
                }
                #train-tracker-panel .body {
                    padding: 16px;
                    max-height: 350px;
                    overflow-y: auto;
                }
                #train-tracker-panel .file-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                #train-tracker-panel .file-item {
                    padding: 10px;
                    margin-bottom: 8px;
                    background: #334155;
                    border-radius: 8px;
                    font-size: 12px;
                }
                #train-tracker-panel .file-item .name {
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                #train-tracker-panel .file-item .meta {
                    color: #94a3b8;
                    font-size: 11px;
                }
                #train-tracker-panel .file-item .meta .train-num {
                    color: #3B82F6;
                    font-weight: 600;
                }
                #train-tracker-panel .file-item .actions {
                    margin-top: 8px;
                    display: flex;
                    gap: 8px;
                }
                #train-tracker-panel button {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: 500;
                }
                #train-tracker-panel .btn-primary {
                    background: #3B82F6;
                    color: white;
                }
                #train-tracker-panel .btn-primary:hover {
                    background: #2563EB;
                }
                #train-tracker-panel .btn-success {
                    background: #10B981;
                    color: white;
                }
                #train-tracker-panel .btn-secondary {
                    background: #475569;
                    color: white;
                }
                #train-tracker-panel .footer {
                    padding: 12px 16px;
                    border-top: 1px solid #475569;
                    display: flex;
                    gap: 8px;
                }
                #train-tracker-panel .toggle-btn {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: #3B82F6;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                    z-index: 999998;
                }
                #train-tracker-panel .toggle-btn:hover {
                    background: #2563EB;
                }
                #train-tracker-panel .hidden {
                    display: none !important;
                }
                #train-tracker-panel .log {
                    font-size: 11px;
                    color: #94a3b8;
                    background: #0f172a;
                    padding: 8px;
                    border-radius: 6px;
                    max-height: 100px;
                    overflow-y: auto;
                    margin-top: 10px;
                }
                #train-tracker-panel .log-entry {
                    margin-bottom: 4px;
                }
                #train-tracker-panel .log-entry.error {
                    color: #EF4444;
                }
                #train-tracker-panel .log-entry.success {
                    color: #10B981;
                }
            </style>
            <div class="header">
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 6h8M6 12h12M8 18h8"/>
                    </svg>
                    Train Tracker Sync
                </h3>
                <span class="status" id="tt-status">Ready</span>
            </div>
            <div class="body">
                <div id="tt-file-list">
                    <p style="color: #94a3b8; font-size: 12px;">Scanning for WorktoSheets files...</p>
                </div>
                <div class="log" id="tt-log"></div>
            </div>
            <div class="footer">
                <button class="btn-primary" id="tt-scan">Scan Files</button>
                <button class="btn-success" id="tt-sync-all">Sync All</button>
                <button class="btn-secondary" id="tt-close">Minimize</button>
            </div>
        `;
        document.body.appendChild(panel);

        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-btn hidden';
        toggleBtn.id = 'tt-toggle';
        toggleBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M8 6h8M6 12h12M8 18h8"/>
            </svg>
        `;
        document.body.appendChild(toggleBtn);

        // Event listeners
        document.getElementById('tt-scan').onclick = () => scanForFiles();
        document.getElementById('tt-sync-all').onclick = () => syncAllFiles();
        document.getElementById('tt-close').onclick = () => {
            panel.classList.add('hidden');
            toggleBtn.classList.remove('hidden');
        };
        toggleBtn.onclick = () => {
            panel.classList.remove('hidden');
            toggleBtn.classList.add('hidden');
        };
    }

    // Log message to panel
    function log(msg, type = 'info') {
        const logDiv = document.getElementById('tt-log');
        if (logDiv) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logDiv.insertBefore(entry, logDiv.firstChild);
        }
        console.log(`[TrainTracker] ${msg}`);
    }

    // Extract train number from filename or path
    function extractTrainNumber(filename, path = '') {
        // Patterns: "T33", "T1", "T01", etc.
        const patterns = [
            /T(\d+)\s*-/i,                    // "T33 -" or "T1 -"
            /Train\s*(\d+)/i,                  // "Train 33"
            /T(\d+)\s*\(/i,                    // "T33 ("
        ];

        for (const pattern of patterns) {
            const match = filename.match(pattern) || path.match(pattern);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        return null;
    }

    // Extract unit numbers from filename
    function extractUnitNumbers(filename) {
        // Patterns: "96021 & 96094", "067&122", "(Units 96021 & 96094)"
        const units = [];
        const patterns = [
            /(\d{5})\s*[&,]\s*(\d{5})/g,       // 96021 & 96094
            /(\d{3})\s*[&,]\s*(\d{3})/g,       // 067&122 (short form)
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(filename)) !== null) {
                let unit1 = match[1];
                let unit2 = match[2];
                // Normalize short unit numbers
                if (unit1.length === 3) unit1 = '96' + unit1;
                if (unit2.length === 3) unit2 = '96' + unit2;
                if (!units.includes(unit1)) units.push(unit1);
                if (!units.includes(unit2)) units.push(unit2);
            }
        }
        return units;
    }

    // Scan SharePoint page for WorktoSheets files
    function scanForFiles() {
        log('Scanning for WorktoSheets files...');
        const files = [];

        // Find all file rows in the SharePoint list
        const rows = document.querySelectorAll('[data-automationid^="row-"]');

        rows.forEach(row => {
            const nameCell = row.querySelector('[data-automationid="field-LinkFilename"] span[title]');
            const modifiedCell = row.querySelector('[data-automationid="field-Modified"]');

            if (nameCell) {
                const filename = nameCell.getAttribute('title') || nameCell.textContent;

                // Check if it's a WorktoSheets file
                if (filename.toLowerCase().includes('worktosheet') &&
                    (filename.endsWith('.xlsm') || filename.endsWith('.xlsx'))) {

                    const trainNum = extractTrainNumber(filename);
                    const units = extractUnitNumbers(filename);
                    const modified = modifiedCell ? modifiedCell.getAttribute('title') || modifiedCell.textContent : 'Unknown';

                    files.push({
                        filename,
                        trainNumber: trainNum,
                        units,
                        modified,
                        element: nameCell
                    });
                }
            }
        });

        log(`Found ${files.length} WorktoSheets file(s)`, files.length > 0 ? 'success' : 'info');
        displayFiles(files);
        return files;
    }

    // Display found files in UI
    function displayFiles(files) {
        const container = document.getElementById('tt-file-list');
        if (!container) return;

        if (files.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; font-size: 12px;">No WorktoSheets files found on this page. Navigate to a Phase folder containing .xlsm files.</p>';
            return;
        }

        const html = `
            <ul class="file-list">
                ${files.map((file, idx) => `
                    <li class="file-item" data-idx="${idx}">
                        <div class="name">${file.filename}</div>
                        <div class="meta">
                            ${file.trainNumber ? `<span class="train-num">Train ${file.trainNumber}</span> | ` : ''}
                            Units: ${file.units.join(', ') || 'Unknown'}<br>
                            Modified: ${file.modified}
                        </div>
                        <div class="actions">
                            <button class="btn-primary" onclick="window.ttSyncFile(${idx})">Sync to Tracker</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
        container.innerHTML = html;

        // Store files globally for sync actions
        window.ttFoundFiles = files;
    }

    // Sync a single file
    window.ttSyncFile = async function(idx) {
        const file = window.ttFoundFiles[idx];
        if (!file) return;

        log(`Opening ${file.filename}...`);

        // Click the file to open it (this will trigger SharePoint's file download/open)
        file.element.click();

        // Show instructions
        alert(`To sync "${file.filename}" to Train Tracker:

1. The file will open in Excel Online
2. Download it to your computer (File > Save As > Download a Copy)
3. Go to https://jubileetraintracker.netlify.app
4. Click "Upload Excel" and select the downloaded file

Train Number: ${file.trainNumber || 'Unknown'}
Units: ${file.units.join(', ') || 'Unknown'}`);
    };

    // Sync all files (shows instructions)
    function syncAllFiles() {
        const files = window.ttFoundFiles || [];
        if (files.length === 0) {
            alert('No files found to sync. Click "Scan Files" first.');
            return;
        }

        const summary = files.map(f =>
            `- ${f.filename} (Train ${f.trainNumber || '?'}, Units: ${f.units.join(', ') || '?'})`
        ).join('\n');

        alert(`Found ${files.length} WorktoSheets file(s) to sync:

${summary}

To sync these files:
1. Download each file from SharePoint
2. Go to https://jubileetraintracker.netlify.app
3. Upload each file using the "Upload Excel" button

The tracker will automatically:
- Parse the task completion data
- Group units into trains (3 CAR + 4 CAR = 7 cars)
- Update existing data if the same units are uploaded again`);
    }

    // Check if it's time to auto-sync (7am or 7pm)
    function checkAutoSync() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // Check at 7:00 AM or 7:00 PM (with 5 minute window)
        if ((hour === 7 || hour === 19) && minute < 5) {
            const lastSync = GM_getValue('lastAutoSync', 0);
            const hourAgo = Date.now() - (60 * 60 * 1000);

            if (lastSync < hourAgo) {
                GM_setValue('lastAutoSync', Date.now());
                log('Auto-sync triggered (scheduled time)', 'success');
                GM_notification({
                    title: 'Train Tracker Sync',
                    text: 'Scheduled sync time! Click to scan for updates.',
                    timeout: 10000
                });
                scanForFiles();
            }
        }
    }

    // Initialize
    function init() {
        // Wait for page to fully load
        setTimeout(() => {
            createUI();
            log('Train Tracker Sync initialized');

            // Initial scan
            setTimeout(() => scanForFiles(), 1000);

            // Check for auto-sync every minute
            setInterval(checkAutoSync, 60000);
        }, 2000);
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

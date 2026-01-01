// ==UserScript==
// @name         Train Tracker - Extract Train Mappings
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Simple extraction of train folder names from SharePoint
// @author       Train Tracker
// @match        https://*.sharepoint.com/*
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // All discovered train mappings
    let trainMappings = {};

    // Create simple UI
    function createUI() {
        const btn = document.createElement('button');
        btn.id = 'tt-extract-btn';
        btn.innerHTML = '🚂 Extract Trains';
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: #3B82F6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        `;
        btn.onclick = extractTrains;
        document.body.appendChild(btn);

        // Results panel
        const panel = document.createElement('div');
        panel.id = 'tt-results';
        panel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            width: 400px;
            max-height: 80vh;
            background: #1e293b;
            border: 1px solid #475569;
            border-radius: 12px;
            padding: 16px;
            color: white;
            font-family: monospace;
            font-size: 12px;
            z-index: 999999;
            display: none;
            overflow-y: auto;
        `;
        document.body.appendChild(panel);
    }

    function extractTrains() {
        const results = [];
        const rows = document.querySelectorAll('[data-automationid^="row-"]:not([data-automationid="row-header"])');

        rows.forEach(row => {
            const nameCell = row.querySelector('[data-automationid="field-LinkFilename"]');
            if (!nameCell) return;

            const nameSpan = nameCell.querySelector('span[title]');
            if (!nameSpan) return;

            const name = nameSpan.getAttribute('title') || nameSpan.textContent;

            // Extract train info: "T01 - (Units 96067 and 96122)"
            const trainMatch = name.match(/^T(\d+)\s*[-–]\s*\(Units?\s*(\d+)\s*(?:and|&)\s*(\d+)/i);
            if (trainMatch) {
                const trainNum = parseInt(trainMatch[1], 10);
                const unit1 = trainMatch[2];
                const unit2 = trainMatch[3];

                results.push({
                    train: `T${trainNum.toString().padStart(2, '0')}`,
                    trainNum: trainNum,
                    unit1: unit1,
                    unit2: unit2,
                    folderName: name
                });

                trainMappings[`T${trainNum.toString().padStart(2, '0')}`] = [unit1, unit2];
            }
        });

        // Sort by train number
        results.sort((a, b) => a.trainNum - b.trainNum);

        // Display results
        const panel = document.getElementById('tt-results');
        panel.style.display = 'block';

        if (results.length === 0) {
            panel.innerHTML = `
                <h3 style="margin: 0 0 10px; color: #F59E0B;">No trains found on this page</h3>
                <p style="color: #94a3b8;">Navigate to a Phase folder containing T## folders</p>
            `;
            return;
        }

        // Format output
        let output = `<h3 style="margin: 0 0 10px; color: #10B981;">Found ${results.length} trains</h3>`;
        output += `<div style="background: #0f172a; padding: 10px; border-radius: 6px; margin-bottom: 10px;">`;

        results.forEach(r => {
            output += `<div style="margin-bottom: 4px;">"${r.train}": ("${r.unit1}", "${r.unit2}"),</div>`;
        });

        output += `</div>`;

        // Add copy buttons
        output += `
            <button id="tt-copy-py" style="padding: 8px 16px; background: #10B981; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px;">Copy Python</button>
            <button id="tt-copy-json" style="padding: 8px 16px; background: #3B82F6; color: white; border: none; border-radius: 6px; cursor: pointer;">Copy JSON</button>
            <button id="tt-close" style="padding: 8px 16px; background: #475569; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px;">Close</button>
        `;

        // Total count
        const allTrains = Object.keys(trainMappings).length;
        output += `<div style="margin-top: 12px; color: #94a3b8;">Total trains collected: ${allTrains}</div>`;

        panel.innerHTML = output;

        // Event handlers
        document.getElementById('tt-copy-py').onclick = () => {
            const pyCode = results.map(r => `    "${r.train}": ("${r.unit1}", "${r.unit2}"),`).join('\n');
            GM_setClipboard(pyCode);
            alert('Copied Python dict format!');
        };

        document.getElementById('tt-copy-json').onclick = () => {
            const jsonObj = {};
            results.forEach(r => {
                jsonObj[r.train] = [r.unit1, r.unit2];
            });
            GM_setClipboard(JSON.stringify(jsonObj, null, 2));
            alert('Copied JSON format!');
        };

        document.getElementById('tt-close').onclick = () => {
            panel.style.display = 'none';
        };

        console.log('Train mappings extracted:', results);
    }

    // Initialize
    setTimeout(createUI, 1000);
})();

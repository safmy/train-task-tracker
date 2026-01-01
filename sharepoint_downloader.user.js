// ==UserScript==
// @name         Train Tracker - Batch File Downloader
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Download all 62 WorktoSheets files from SharePoint - with resume and selection
// @author       Train Tracker
// @match        https://*.sharepoint.com/*
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    // Complete list of all 62 WorktoSheets file URLs - extracted from Work2Sheets Masters.xlsx
    // These are the actual SharePoint file paths from the external links in the Master file
    const FILES = [
        // Phase 1: T01-T06
        { train: "T01", units: ["96067", "96122"], phase: 1, filename: "WorktosheetsV3.1 T1 - 067&122.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%201%20-%20T01-T06%20-%20Program%20Lift%20(Bogies,%20Line%20Contactors%20&%20Catch%20Back)%20)/T01%20-%20(Units%2096067%20and%2096122)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3.1%20T1%20-%20067&122.xlsm" },
        { train: "T02", units: ["96051", "96062"], phase: 1, filename: "New Work to sheets T2 051 062.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%201%20-%20T01-T06%20-%20Program%20Lift%20(Bogies,%20Line%20Contactors%20&%20Catch%20Back)%20)/T02%20-%20%20(Units%2096051%20and%2096062)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/New%20Work%20to%20sheets%20T2%20051%20062.xlsm" },
        { train: "T03", units: ["96099", "96104"], phase: 1, filename: "WorktosheetsV3 T3 - (Units 96099 & 96104).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%201%20-%20T01-T06%20-%20Program%20Lift%20(Bogies,%20Line%20Contactors%20&%20Catch%20Back)%20)/T03%20-%20(Units%2096099%20and%2096104)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T3%20-%20(Units%2096099%20&%2096104).xlsm" },
        { train: "T04", units: ["96075", "96118"], phase: 1, filename: "WorktosheetsV3.2 T4 - (Units 96075 & 96118).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%201%20-%20T01-T06%20-%20Program%20Lift%20(Bogies,%20Line%20Contactors%20&%20Catch%20Back)%20)/T04%20-%20(Units%2096075%20and%2096118)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3.2%20T4%20-%20(Units%2096075%20&%2096118).xlsm" },
        { train: "T05", units: ["96113", "96018"], phase: 1, filename: "WorktosheetsV3.1 T5 - 018&113.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%201%20-%20T01-T06%20-%20Program%20Lift%20(Bogies,%20Line%20Contactors%20&%20Catch%20Back)%20)/T05%20-%20(Units%2096113%20and%2096018)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3.1%20T5%20-%20018&113.xlsm" },
        { train: "T06", units: ["96017", "96078"], phase: 1, filename: "WorktosheetsV3.1 T6 - 017&078.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%201%20-%20T01-T06%20-%20Program%20Lift%20(Bogies,%20Line%20Contactors%20&%20Catch%20Back)%20)/T06%20-%20(Units%2096017%20and%2096078)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3.1%20T6%20-%20017&078.xlsm" },

        // Phase 2: T07-T31
        { train: "T07", units: ["96011", "96040"], phase: 2, filename: "WorktosheetsV3 T7 - 011&040.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T07%20-%20(Units%2096011%20and%2096040)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T7%20-%20011&040.xlsm" },
        { train: "T08", units: ["96097", "96086"], phase: 2, filename: "WorktosheetsV3 T8 - (Units 96097 & 96086).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T08%20-%20(Units%2096097%20and%2096086)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T8%20-%20(Units%2096097%20&%2096086).xlsm" },
        { train: "T09", units: ["96043", "96022"], phase: 2, filename: "WorktosheetsV3 T9 - 043&022.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T09%20-%20(Units%2096043%20and%2096022)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T9%20-%20043&022.xlsm" },
        { train: "T10", units: ["96109", "96110"], phase: 2, filename: "WorktosheetsV3 T10 - (Units 96109 & 96110).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T10%20-%20%20(Units%2096109%20and%2096110)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T10%20-%20(Units%2096109%20&%2096110).xlsm" },
        { train: "T11", units: ["96019", "96066"], phase: 2, filename: "WorktosheetsV3 T11 - 019&066.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T11%20-%20(Units%2096019%20and%2096066)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T11%20-%20019&066.xlsm" },
        { train: "T12", units: ["96101", "96058"], phase: 2, filename: "WorktosheetsV3 T12 - 101&058.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T12%20-%20(Units%2096101%20and%2096058)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T12%20-%20101&058.xlsm" },
        { train: "T13", units: ["96039", "96034"], phase: 2, filename: "WorktosheetsV3 T13 - 039&034.xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T13%20-%20(Units%2096039%20and%2096034)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T13%20-%20039&034.xlsm" },
        { train: "T14", units: ["96055", "96044"], phase: 2, filename: "WorktosheetsV3 T14 - (Units 96055 & 96044).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T14%20-%20(Units%2096055%20and%2096044)/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20Two/WorktosheetsV3%20T14%20-%20(Units%2096055%20&%2096044).xlsm" },
        { train: "T15", units: ["96007", "96096"], phase: 2, filename: "WorktosheetsV3 T15 - (Units 96007 & 96096).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T15%20-%20(Units%2096007%20and%2096096)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS%20-%20Phase%20One%20A/WorktosheetsV3%20T15%20-%20(Units%2096007%20&%2096096).xlsm" },
        { train: "T16", units: ["96057", "96090"], phase: 2, filename: "WorktosheetsV3 T16 - (Units 96057 & 96090).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T16%20-%20(Units%2096057%20and%2096090)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T16%20-%20(Units%2096057%20&%2096090).xlsm" },
        { train: "T17", units: ["96031", "96032"], phase: 2, filename: "WorktosheetsV3 T17 - (Units 96031 & 96032).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T17%20-%20(Units%2096031%20and%2096032)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T17%20-%20(Units%2096031%20&%2096032).xlsm" },
        { train: "T18", units: ["96084", "96083"], phase: 2, filename: "WorktosheetsV3 T18 - (Units 96084 & 96083).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T18%20-%20(Units%2096084%20and%2096083)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T18%20-%20(Units%2096084%20&%2096083).xlsm" },
        { train: "T19", units: ["96015", "96082"], phase: 2, filename: "WorktosheetsV3 T19 - (Units 96015 & 96082).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T19%20-%20(Units%2096015%20and%2096082)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T19%20-%20(Units%2096015%20&%2096082).xlsm" },
        { train: "T20", units: ["96070", "96061"], phase: 2, filename: "WorktosheetsV3 T20 (Units 96070 & 96061).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T20%20-%20(Units%2096070%20and%2096061)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T20%20(Units%2096070%20&%2096061).xlsm" },
        { train: "T21", units: ["96063", "96020"], phase: 2, filename: "WorktosheetsV3 T21 - (Units 96063 & 96020).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T21%20-%20(Units%2096063%20and%2096020)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T21%20-%20(Units%2096063%20&%2096020).xlsm" },
        { train: "T22", units: ["96013", "96076"], phase: 2, filename: "WorktosheetsV3 T22 - (Units 96013 & 96076).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T22%20-%20(Units%2096013%20and%2096076)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T22%20-%20(Units%2096013%20&%2096076).xlsm" },
        { train: "T23", units: ["96103", "96100"], phase: 2, filename: "WorktosheetsV3 T23 - (Units 96103 & 96100).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T23%20-%20(Units%2096103%20and%2096100)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T23%20-%20(Units%2096103%20&%2096100).xlsm" },
        { train: "T24", units: ["96085", "96106"], phase: 2, filename: "WorktosheetsV3 T24 - (Units 96085 & 96106).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T24%20-%20(Units%2096085%20and%2096106)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T24%20-%20(Units%2096085%20&%2096106).xlsm" },
        { train: "T25", units: ["96081", "96012"], phase: 2, filename: "WorktosheetsV3 T25 - (Units 96081 & 96012).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T25%20-%20(Units%2096081%20and%2096012)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T25%20-%20(Units%2096081%20&%2096012).xlsm" },
        { train: "T26", units: ["96005", "96008"], phase: 2, filename: "WorktosheetsV3 T26 - (Units 96005 & 96008).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T26%20-%20(Units%2096005%20and%2096008)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T26%20-%20(Units%2096005%20&%2096008).xlsm" },
        { train: "T27", units: ["96093", "96054"], phase: 2, filename: "WorktosheetsV3 T27 - (Units 96093 & 96054).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T27%20-%20(Units%2096093%20and%2096054)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T27%20-%20(Units%2096093%20&%2096054).xlsm" },
        { train: "T28", units: ["96038", "96003"], phase: 2, filename: "WorktosheetsV3 T28 - (Units 96038 & 96003).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T28%20-%20(Units%2096038%20and%2096003)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T28%20-%20(Units%2096038%20&%2096003).xlsm" },
        { train: "T29", units: ["96053", "96072"], phase: 2, filename: "WorktosheetsV3 T29 - (Units 96053 & 96072).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T29%20-%20(Units%2096053%20and%2096072)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T29%20-%20(Units%2096053%20&%2096072).xlsm" },
        { train: "T30", units: ["96041", "96006"], phase: 2, filename: "WorktosheetsV3 T30 - (Units 96041 & 96006).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T30%20-%20(Units%2096041%20and%2096006)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T30%20-%20(Units%2096041%20&%2096006).xlsm" },
        { train: "T31", units: ["96047", "96048"], phase: 2, filename: "WorktosheetsV3 T31 - (Units 96047 & 96048).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%202%20-%20T07%20-%20T31%20-%20Program%20Lift%20(P1,%20P2%20&%20Catch%20Back)/T31%20-%20(Units%2096047%20and%2096048)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T31%20-%20(Units%2096047%20&%2096048).xlsm" },

        // Phase 3: T32-T62
        { train: "T32", units: ["96123", "96004"], phase: 3, filename: "WorktosheetsV3 T32 - (Units 96123 & 96004).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T32%20-%20(Units%2096123%20and%2096004)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T32%20-%20(Units%2096123%20&%2096004).xlsm" },
        { train: "T33", units: ["96021", "96094"], phase: 3, filename: "WorktosheetsV3 T33 - (Units 96021 & 96094).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T33%20-%20(Units%2096021%20and%2096094)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T33%20-%20(Units%2096021%20&%2096094).xlsm" },
        { train: "T34", units: ["96025", "96026"], phase: 3, filename: "WorktosheetsV3 T34 - (Units 96025 & 96026).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T34%20-%20(Units%2096025%20and%2096026)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T34%20-%20(Units%2096025%20&%2096026).xlsm" },
        { train: "T35", units: ["96030", "96029"], phase: 3, filename: "WorktosheetsV3 T35 - (Units 96030 & 96029).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T35%20-%20(Units%2096030%20and%2096029)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T35%20-%20(Units%2096030%20&%2096029).xlsm" },
        { train: "T36", units: ["96037", "96064"], phase: 3, filename: "WorktosheetsV3 T36 - (96037 & 96064).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T36%20-%20(Units%2096037%20and%2096064)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T36%20-%20(96037%20&%2096064).xlsm" },
        { train: "T37", units: ["96102", "96089"], phase: 3, filename: "WorktosheetsV3 T37 - (Units 96102 & 96089).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T37%20-%20(Units%2096102%20and%2096089)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T37%20-%20(Units%2096102%20&%2096089).xlsm" },
        { train: "T38", units: ["96027", "96060"], phase: 3, filename: "WorktosheetsV3 T38 - (Units 96027 & 96060).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T38%20-%20(Units%2096027%20and%2096060)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T38%20-%20(Units%2096027%20&%2096060).xlsm" },
        { train: "T39", units: ["96024", "96079"], phase: 3, filename: "WorktosheetsV3 T39 - (Units 96024 & 96079).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T39%20-%20(Units%2096024%20and%2096079)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T39%20-%20(Units%2096024%20&%2096079).xlsm" },
        { train: "T40", units: ["96087", "96098"], phase: 3, filename: "WorktosheetsV3 T40 - (Units 96087 & 96098).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T40%20-%20(Units%2096087%20and%2096098)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T40%20-%20(Units%2096087%20&%2096098).xlsm" },
        { train: "T41", units: ["96119", "96120"], phase: 3, filename: "WorktosheetsV3 T41 - (Units 96119 & 96120).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T41%20-%20(Units%2096119%20and%2096120)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T41%20-%20(Units%2096119%20&%2096120).xlsm" },
        { train: "T42", units: ["96071", "96116"], phase: 3, filename: "WorktosheetsV3 T42 - (Units 96071 & 96116).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T42%20-%20(Units%2096071%20and%2096116)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T42%20-%20(Units%2096071%20&%2096116).xlsm" },
        { train: "T43", units: ["96073", "96074"], phase: 3, filename: "WorktosheetsV3 T43 - (Units 96073 & 96074).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T43%20-%20(Units%2096073%20and%2096074)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T43%20-%20(Units%2096073%20&%2096074).xlsm" },
        { train: "T44", units: ["96115", "96124"], phase: 3, filename: "WorktosheetsV3 T44 - (Units 96115 & 96124).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T44%20-%20(Units%2096115%20and%2096124)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T44%20-%20(Units%2096115%20&%2096124).xlsm" },
        { train: "T45", units: ["96068", "96069"], phase: 3, filename: "WorktosheetsV3 T45 - (Units 96068 & 96069).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T45%20-%20(Units%2096068%20and%2096069)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T45%20-%20(Units%2096068%20&%2096069).xlsm" },
        { train: "T46", units: ["96016", "96117"], phase: 3, filename: "WorktosheetsV3 T46 - (Units 96016 & 96117).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T46%20-%20(Units%2096016%20and%2096117)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T46%20-%20(Units%2096016%20&%2096117).xlsm" },
        { train: "T47", units: ["96052", "96077"], phase: 3, filename: "WorktosheetsV3 T47 - (Units 96052 & 96077).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T47%20-%20(Units%2096052%20and%2096077)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T47%20-%20(Units%2096052%20&%2096077).xlsm" },
        { train: "T48", units: ["96105", "96114"], phase: 3, filename: "WorktosheetsV3 T48 - (Units 96105 & 96114).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T48%20-%20(Units%2096105%20and%2096114)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T48%20-%20(Units%2096105%20&%2096114).xlsm" },
        { train: "T49", units: ["96050", "96125"], phase: 3, filename: "WorktosheetsV3 T49 - (Units 96050 & 96125).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T49%20-%20(Units%2096050%20and%2096125)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T49%20-%20(Units%2096050%20&%2096125).xlsm" },
        { train: "T50", units: ["96010", "96009"], phase: 3, filename: "WorktosheetsV3 T50 - (Units 96010 & 96009).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T50%20-%20(Units%2096010%20and%2096009)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T50%20-%20(Units%2096010%20&%2096009).xlsm" },
        { train: "T51", units: ["96042", "96107"], phase: 3, filename: "WorktosheetsV3 T51 - (Units 96042 & 96107).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T51%20-%20(Units%2096042%20and%2096107)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T51%20-%20(Units%2096042%20&%2096107).xlsm" },
        { train: "T52", units: ["96028", "96059"], phase: 3, filename: "WorktoSheetsV3 T52 - (Units 96028 & 96059).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T52%20-%20(Units%2096028%20and%2096059)/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T52%20-%20(Units%2096028%20&%2096059).xlsm" },
        { train: "T53", units: ["96046", "96045"], phase: 3, filename: "WorktoSheetsV3 T53 - (Units 96046 & 96045).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T53%20-%20(Units%2096046%20and%2096045)/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T53%20-%20(Units%2096046%20&%2096045).xlsm" },
        { train: "T54", units: ["96092", "96023"], phase: 3, filename: "WorktoSheetsV3 T54 - (Units 96092 & 96023).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T54%20-%20(Units%2096092%20and%2096023)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T54%20-%20(Units%2096092%20&%2096023).xlsm" },
        { train: "T55", units: ["96002", "96001"], phase: 3, filename: "WorktoSheetsV3 T55 - (Units 96002 & 96001).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T55%20-%20(Units%2096002%20and%2096001)/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T55%20-%20(Units%2096002%20&%2096001).xlsm" },
        { train: "T56", units: ["96111", "96112"], phase: 3, filename: "WorktoSheetsV3 T56 - (Units 96111 & 96112).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T56%20-%20(Units%2096111%20and%2096112)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T56%20-%20(Units%2096111%20&%2096112).xlsm" },
        { train: "T57", units: ["96014", "96121"], phase: 3, filename: "WorktoSheetsV3 T57 - (Units 96014 & 96121).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T57%20-%20(Units%2096014%20and%2096121)/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T57%20-%20(Units%2096014%20&%2096121).xlsm" },
        { train: "T58", units: ["96108", "96095"], phase: 3, filename: "WorktoSheetsV3 T58 - (Units 96108 & 96095).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T58%20-%20(Units%2096108%20and%2096095)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T58%20-%20(Units%2096108%20&%2096095).xlsm" },
        { train: "T59", units: ["96088", "96065"], phase: 3, filename: "WorktoSheetsV3 T59 - (Units 96088 & 96065).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T59%20-%20(Units%2096088%20and%2096065)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T59%20-%20(Units%2096088%20&%2096065).xlsm" },
        { train: "T60", units: ["96080", "96091"], phase: 3, filename: "WorktoSheetsV3 T60 - (Units 96080 & 96091).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T60%20-%20(Units%2096080%20and%2096091)%20-%20DeIcer/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T60%20-%20(Units%2096080%20&%2096091).xlsm" },
        { train: "T61", units: ["96036", "96035"], phase: 3, filename: "WorktosheetsV3 T61 - (Units 96036 & 96035).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T61%20-%20(Units%2096036%20and%2096035)/05%20Work%20To%20Sheets%20TFOS/WorktosheetsV3%20T61%20-%20(Units%2096036%20&%2096035).xlsm" },
        { train: "T62", units: ["96056", "96033"], phase: 3, filename: "WorktoSheetsV3 T62 - (Units 96056 & 96033).xlsm", url: "https://transportforlondon.sharepoint.com/sites/jllew/Shared%20Documents/Train%20Records/Phase%203%20-%20T32%20-%20T62%20-%20Program%20Lift%20(P1,%20P2,%20P3,%20P3.1,%20P3.2%20P3.3%20&%20Catch%20Back))/T62%20-%20(Units%2096056%20and%2096033)/05%20Work%20To%20Sheets%20TFOS/WorktoSheetsV3%20T62%20-%20(Units%2096056%20&%2096033).xlsm" }
    ];

    // Already downloaded trains (57 of 62 done - only 5 missing)
    const ALREADY_DOWNLOADED = [
        "T01", "T02", "T06", "T07", "T08", "T09", "T10", "T11", "T12", "T13",
        "T14", "T15", "T16", "T17", "T18", "T19", "T20", "T21", "T22", "T23",
        "T24", "T26", "T28", "T29", "T30", "T31", "T32", "T33", "T34", "T35",
        "T36", "T37", "T38", "T39", "T40", "T41", "T42", "T43", "T44", "T45",
        "T46", "T47", "T48", "T49", "T50", "T51", "T52", "T53", "T54", "T55",
        "T56", "T57", "T58", "T59", "T60", "T61", "T62"
    ];
    // Missing: T03, T04, T05, T25, T27

    // State
    let currentIndex = 0;
    let downloadedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let isDownloading = false;
    let isPaused = false;
    let downloadMode = 'navigate'; // 'navigate' or 'direct'
    let downloadDelay = 6000; // 6 seconds between downloads (more reliable)
    let startFromTrain = "T03"; // Resume from first missing train
    let skipDownloaded = true; // Skip already downloaded trains

    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'tt-downloader';
        panel.innerHTML = `
            <style>
                #tt-downloader {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 450px;
                    background: #1e293b;
                    border: 1px solid #475569;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    color: #f1f5f9;
                }
                #tt-downloader .header {
                    background: linear-gradient(135deg, #0f172a, #1e3a5f);
                    padding: 14px 18px;
                    border-radius: 12px 12px 0 0;
                    border-bottom: 1px solid #475569;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #tt-downloader .header h3 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
                #tt-downloader .header h3::before { content: "🚇"; }
                #tt-downloader .body { padding: 18px; max-height: 65vh; overflow-y: auto; }
                #tt-downloader .stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 18px;
                }
                #tt-downloader .stat {
                    background: #334155;
                    padding: 12px 8px;
                    border-radius: 8px;
                    text-align: center;
                }
                #tt-downloader .stat-value {
                    font-size: 22px;
                    font-weight: 700;
                    color: #3B82F6;
                }
                #tt-downloader .stat.success .stat-value { color: #10B981; }
                #tt-downloader .stat.error .stat-value { color: #EF4444; }
                #tt-downloader .stat-label {
                    font-size: 9px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    margin-top: 4px;
                }
                #tt-downloader .progress {
                    background: #334155;
                    border-radius: 8px;
                    height: 10px;
                    margin-bottom: 16px;
                    overflow: hidden;
                }
                #tt-downloader .progress-bar {
                    background: linear-gradient(90deg, #10B981, #3B82F6);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s;
                }
                #tt-downloader .log {
                    background: #0f172a;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-family: 'SF Mono', monospace;
                    max-height: 180px;
                    overflow-y: auto;
                }
                #tt-downloader .log-entry { margin-bottom: 4px; color: #94a3b8; }
                #tt-downloader .log-entry.success { color: #10B981; }
                #tt-downloader .log-entry.error { color: #EF4444; }
                #tt-downloader .log-entry.info { color: #3B82F6; }
                #tt-downloader .log-entry.warn { color: #F59E0B; }
                #tt-downloader .footer {
                    padding: 14px 18px;
                    border-top: 1px solid #475569;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                #tt-downloader button {
                    padding: 10px 18px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #tt-downloader button:hover { transform: translateY(-1px); }
                #tt-downloader .btn-primary { background: #3B82F6; color: white; }
                #tt-downloader .btn-success { background: #10B981; color: white; }
                #tt-downloader .btn-secondary { background: #475569; color: white; }
                #tt-downloader .btn-warning { background: #F59E0B; color: white; }
                #tt-downloader button:disabled { background: #475569; cursor: not-allowed; transform: none; opacity: 0.7; }
                #tt-downloader .current-file {
                    background: linear-gradient(135deg, #334155, #3d4f6e);
                    padding: 14px;
                    border-radius: 8px;
                    margin-bottom: 14px;
                    border-left: 4px solid #3B82F6;
                }
                #tt-downloader .current-file .train {
                    color: #3B82F6;
                    font-weight: 700;
                    font-size: 18px;
                }
                #tt-downloader .current-file .phase {
                    display: inline-block;
                    background: #10B981;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    margin-left: 8px;
                }
                #tt-downloader .mode-switch {
                    background: #334155;
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 14px;
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                #tt-downloader .mode-switch label {
                    font-size: 11px;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                #tt-downloader .mode-switch input[type="radio"] {
                    accent-color: #3B82F6;
                }
            </style>
            <div class="header">
                <h3>Jubilee Line WorktoSheets Downloader</h3>
                <span style="font-size: 11px; color: #64748b;">v3.1</span>
            </div>
            <div class="body">
                <div class="stats" style="grid-template-columns: repeat(5, 1fr);">
                    <div class="stat">
                        <div class="stat-value">${FILES.length}</div>
                        <div class="stat-label">Total</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="tt-current-num">0</div>
                        <div class="stat-label">Current</div>
                    </div>
                    <div class="stat success">
                        <div class="stat-value" id="tt-downloaded">0</div>
                        <div class="stat-label">Done</div>
                    </div>
                    <div class="stat" style="background: #4a3f2a;">
                        <div class="stat-value" style="color: #F59E0B;" id="tt-skipped">0</div>
                        <div class="stat-label">Skipped</div>
                    </div>
                    <div class="stat error">
                        <div class="stat-value" id="tt-failed">0</div>
                        <div class="stat-label">Failed</div>
                    </div>
                </div>
                <div class="progress">
                    <div class="progress-bar" id="tt-progress"></div>
                </div>
                <div class="mode-switch" style="flex-direction: column; align-items: flex-start;">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 11px; color: #f1f5f9; font-weight: 600;">Start from:</span>
                        <select id="tt-start-train" style="background: #1e293b; color: #f1f5f9; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 11px;">
                            ${FILES.map(f => `<option value="${f.train}" ${f.train === 'T03' ? 'selected' : ''}>${f.train} (${f.units.join(' & ')})${ALREADY_DOWNLOADED.includes(f.train) ? ' ✓' : ''}</option>`).join('')}
                        </select>
                        <label style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" id="tt-skip-downloaded" checked style="accent-color: #10B981;">
                            Skip ${ALREADY_DOWNLOADED.length} already downloaded
                        </label>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span style="font-size: 11px; color: #f1f5f9; font-weight: 600;">Delay:</span>
                        <input type="range" id="tt-delay" min="3" max="15" value="6" style="width: 100px;">
                        <span id="tt-delay-val" style="font-size: 11px; color: #10B981; min-width: 30px;">6s</span>
                        <span style="font-size: 10px; color: #64748b;">(longer = more reliable)</span>
                    </div>
                </div>
                <div class="current-file" id="tt-current">
                    <span class="train">Ready</span>
                    <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Select a mode and click "Start Download" to begin</div>
                </div>
                <div class="log" id="tt-log">
                    <div class="log-entry info">[System] Loaded ${FILES.length} train files from Master Excel</div>
                </div>
            </div>
            <div class="footer">
                <button class="btn-primary" id="tt-start">Start Download</button>
                <button class="btn-success" id="tt-pause" disabled>Pause</button>
                <button class="btn-warning" id="tt-skip" disabled>Skip</button>
                <button class="btn-secondary" id="tt-stop" disabled>Stop</button>
                <button class="btn-secondary" id="tt-close">Close</button>
            </div>
        `;
        document.body.appendChild(panel);

        // Delay slider handler
        document.getElementById('tt-delay').addEventListener('input', (e) => {
            downloadDelay = parseInt(e.target.value) * 1000;
            document.getElementById('tt-delay-val').textContent = e.target.value + 's';
        });

        // Start train selector
        document.getElementById('tt-start-train').addEventListener('change', (e) => {
            startFromTrain = e.target.value;
            log(`Will start from ${startFromTrain}`, 'info');
        });

        // Skip downloaded checkbox
        document.getElementById('tt-skip-downloaded').addEventListener('change', (e) => {
            skipDownloaded = e.target.checked;
            log(`Skip downloaded: ${skipDownloaded}`, 'info');
        });

        document.getElementById('tt-start').onclick = startDownload;
        document.getElementById('tt-pause').onclick = togglePause;
        document.getElementById('tt-stop').onclick = stopDownload;
        document.getElementById('tt-skip').onclick = skipCurrent;
        document.getElementById('tt-close').onclick = () => panel.remove();

        // Log already downloaded
        log(`Already downloaded: ${ALREADY_DOWNLOADED.join(', ')}`, 'success');
        log(`Remaining: ${FILES.length - ALREADY_DOWNLOADED.length} trains`, 'info');
    }

    function log(msg, type = 'info') {
        const logDiv = document.getElementById('tt-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.textContent = `[${time}] ${msg}`;
        logDiv.insertBefore(entry, logDiv.firstChild);
        console.log(`[Train Downloader] ${msg}`);
    }

    function updateProgress() {
        const total = FILES.length;
        const done = downloadedCount + failedCount + skippedCount;
        const pct = Math.round((done / total) * 100);

        document.getElementById('tt-downloaded').textContent = downloadedCount;
        document.getElementById('tt-skipped').textContent = skippedCount;
        document.getElementById('tt-failed').textContent = failedCount;
        document.getElementById('tt-current-num').textContent = currentIndex + 1;
        document.getElementById('tt-progress').style.width = pct + '%';
    }

    function startDownload() {
        if (isDownloading) return;

        // Find starting index
        startFromTrain = document.getElementById('tt-start-train').value;
        currentIndex = FILES.findIndex(f => f.train === startFromTrain);
        if (currentIndex === -1) currentIndex = 0;

        isDownloading = true;
        isPaused = false;
        downloadedCount = 0;
        failedCount = 0;
        skippedCount = 0;

        document.getElementById('tt-start').disabled = true;
        document.getElementById('tt-pause').disabled = false;
        document.getElementById('tt-stop').disabled = false;
        document.getElementById('tt-skip').disabled = false;

        log(`Starting from ${FILES[currentIndex].train} with ${downloadDelay/1000}s delay...`, 'info');
        downloadNext();
    }

    function togglePause() {
        isPaused = !isPaused;
        document.getElementById('tt-pause').textContent = isPaused ? 'Resume' : 'Pause';
        document.getElementById('tt-pause').className = isPaused ? 'btn-primary' : 'btn-success';

        if (isPaused) {
            log('Paused - click Resume to continue', 'warn');
        } else {
            log('Resuming download...', 'info');
            downloadNext();
        }
    }

    function stopDownload() {
        isDownloading = false;
        isPaused = false;
        document.getElementById('tt-start').disabled = false;
        document.getElementById('tt-pause').disabled = true;
        document.getElementById('tt-pause').textContent = 'Pause';
        document.getElementById('tt-stop').disabled = true;
        document.getElementById('tt-skip').disabled = true;
        log(`Stopped. Downloaded: ${downloadedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`, 'warn');
    }

    function skipCurrent() {
        if (!isDownloading || currentIndex >= FILES.length) return;
        log(`Skipping ${FILES[currentIndex].train}...`, 'warn');
        failedCount++;
        currentIndex++;
        updateProgress();
        if (!isPaused) downloadNext();
    }

    function downloadNext() {
        // Check if paused
        if (isPaused) return;

        // Check completion
        if (!isDownloading || currentIndex >= FILES.length) {
            isDownloading = false;
            document.getElementById('tt-start').disabled = false;
            document.getElementById('tt-pause').disabled = true;
            document.getElementById('tt-stop').disabled = true;
            document.getElementById('tt-skip').disabled = true;
            log(`Complete! Downloaded: ${downloadedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`, 'success');

            GM_notification({
                title: 'Download Complete',
                text: `Downloaded ${downloadedCount}, Skipped ${skippedCount}, Failed ${failedCount}`,
                timeout: 5000
            });
            return;
        }

        const file = FILES[currentIndex];

        // Check if already downloaded
        if (skipDownloaded && ALREADY_DOWNLOADED.includes(file.train)) {
            log(`Skipping ${file.train} (already downloaded)`, 'warn');
            skippedCount++;
            currentIndex++;
            updateProgress();
            setTimeout(downloadNext, 500); // Quick skip
            return;
        }

        const localFilename = `WorktoSheets_${file.train}_${file.units.join('-')}.xlsm`;

        document.getElementById('tt-current').innerHTML = `
            <span class="train">${file.train}</span>
            <span class="phase">Phase ${file.phase}</span>
            <div style="color: #e2e8f0; font-size: 12px; margin-top: 6px;">Units ${file.units.join(' & ')}</div>
            <div style="color: #94a3b8; font-size: 10px; margin-top: 4px;">${file.filename}</div>
            <div style="color: #64748b; font-size: 10px; margin-top: 4px;">Next in ${downloadDelay/1000}s...</div>
        `;

        updateProgress();
        log(`Downloading ${file.train} (${currentIndex + 1}/${FILES.length})...`, 'info');

        // Use iframe method to avoid tab focus issues
        const downloadUrl = file.url + '?download=1';

        // Create hidden iframe for download
        let iframe = document.getElementById('tt-download-frame');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'tt-download-frame';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }

        // Trigger download via iframe
        iframe.src = downloadUrl;

        // Also open in new tab as backup (with focus)
        const newTab = window.open(downloadUrl, '_blank');
        if (newTab) {
            // Try to focus the new tab
            newTab.focus();
            // Close it after a delay to clean up
            setTimeout(() => {
                try { newTab.close(); } catch(e) {}
            }, 3000);
        }

        // Auto-advance after configured delay
        downloadedCount++;
        updateProgress();
        currentIndex++;
        setTimeout(downloadNext, downloadDelay);
    }

    // Initialize on SharePoint pages
    if (window.location.hostname.includes('sharepoint.com')) {
        setTimeout(createUI, 1500);
        console.log('[Train Downloader] Initialized with', FILES.length, 'files');
    }
})();

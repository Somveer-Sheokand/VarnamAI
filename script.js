// DOM Elements
const dropzone = document.getElementById('dropzone');
const csvInput = document.getElementById('csvInput');
const csvPreview = document.getElementById('csvPreview');
const fileBadge = document.getElementById('fileBadge');
const nameColumn = document.getElementById('nameColumn');
const dataPreview = document.getElementById('dataPreview');
const changeFileBtn = document.getElementById('changeFileBtn');
const nextStep0 = document.getElementById('nextStep0');
const backStep1 = document.getElementById('backStep1');
const nextStep1 = document.getElementById('nextStep1');
const backStep2 = document.getElementById('backStep2');
const nextStep2 = document.getElementById('nextStep2');
const resetBtn = document.getElementById('resetBtn');
const stopBtn = document.getElementById('stopBtn');
const engineCards = document.querySelectorAll('.engine-card');
const groqConfig = document.getElementById('groqConfig');
const ai4bharatConfig = document.getElementById('ai4bharatConfig');
const configTitle = document.getElementById('configTitle');
const configDesc = document.getElementById('configDesc');
const apiKey = document.getElementById('apiKey');
const testKeyBtn = document.getElementById('testKeyBtn');
const instructions = document.getElementById('instructions');
const modelCards = document.querySelectorAll('.model-card');
const batchSize = document.getElementById('batchSize');
const workers = document.getElementById('workers');
const delayMs = document.getElementById('delayMs');
const retryCount = document.getElementById('retryCount');
const langCards = document.querySelectorAll('.lang-card');
const selectedLangsBadge = document.getElementById('selectedLangsBadge');
const startBtn = document.getElementById('nextStep2');
const progressFill = document.getElementById('progressFill');
const progressPct = document.getElementById('progressPct');
const totalStat = document.getElementById('totalStat');
const processedStat = document.getElementById('processedStat');
const successStat = document.getElementById('successStat');
const failStat = document.getElementById('failStat');
const logContent = document.getElementById('logContent');
const resultsContainer = document.getElementById('resultsContainer');
const resultsHead = document.getElementById('resultsHead');
const resultsBody = document.getElementById('resultsBody');
const exportAllBtn = document.getElementById('exportAllBtn');
const exportSuccessBtn = document.getElementById('exportSuccessBtn');
const exportFailBtn = document.getElementById('exportFailBtn');
const backendStatus = document.getElementById('backendStatus');
const toast = document.getElementById('toast');
const clearLogBtn = document.getElementById('clearLogBtn');
const batchDetailsContainer = document.getElementById('batchDetailsContainer');
const batchDetailsSection = document.getElementById('batchDetailsSection');
const etaText = document.getElementById('etaText');

// State
let csvData = null;
let csvHeaders = [];
let selectedEngine = null;
let selectedModel = 'llama-3.3-70b-versatile';
let selectedLangs = new Set(['hi']);
let nameItems = [];
let resultsMap = new Map();
let totalNames = 0, processed = 0, succeeded = 0, failed = 0;
let stopFlag = false;
let currentStep = 0;
let startTime = null;
let consecutiveRateLimits = 0;
let currentDelay = 4700;
let batchDetails = new Map();

// Cache for repeated names
let translationCache = new Map();

// Language mapping
const LANG_NAMES = {
    hi: { name: 'Hindi', script: 'Devanagari' },
    ta: { name: 'Tamil', script: 'Tamil' },
    te: { name: 'Telugu', script: 'Telugu' },
    mr: { name: 'Marathi', script: 'Devanagari' }
};

// Helper Functions
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContent.appendChild(logEntry);

    const isNearBottom = logContent.scrollHeight - logContent.clientHeight <= logContent.scrollTop + 100;
    if (isNearBottom) {
        logEntry.scrollIntoView({ behavior: 'smooth' });
    }

    while (logContent.children.length > 200) {
        logContent.removeChild(logContent.children[0]);
    }
}

// Clear log
if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
        logContent.innerHTML = '<div class="log-entry info">✨ Log cleared</div>';
        addLog('Log cleared by user', 'info');
    });
}

// Add batch detail
function addBatchDetail(batchNum, totalNames, successCount, failCount, duration, fromCache = 0) {
    batchDetails.set(batchNum, {
        totalNames,
        successCount,
        failCount,
        duration,
        fromCache,
        timestamp: Date.now()
    });

    if (batchDetailsContainer && batchDetailsSection) {
        batchDetailsSection.style.display = 'block';

        const batchCard = document.createElement('div');
        batchCard.className = 'batch-card';
        batchCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <strong>Batch #${batchNum}</strong>
                <span>⏱️ ${duration.toFixed(1)}s</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
                <span style="color: #10b981;">✓ ${successCount}</span>
                <span style="color: #ef4444;">✗ ${failCount}</span>
                ${fromCache > 0 ? `<span style="color: #ff9f4a;">💾 ${fromCache} cached</span>` : ''}
            </div>
            <div style="width: 100%; height: 3px; background: #2a2548; margin-top: 6px; border-radius: 2px;">
                <div style="width: ${(successCount/totalNames)*100}%; height: 100%; background: #10b981; border-radius: 2px;"></div>
            </div>
        `;

        while (batchDetailsContainer.children.length > 20) {
            batchDetailsContainer.removeChild(batchDetailsContainer.children[0]);
        }
        batchDetailsContainer.appendChild(batchCard);
        batchDetailsContainer.scrollTop = batchDetailsContainer.scrollHeight;
    }
}

function updateProgress() {
    totalStat.textContent = totalNames.toLocaleString();
    processedStat.textContent = processed.toLocaleString();
    successStat.textContent = succeeded.toLocaleString();
    failStat.textContent = failed.toLocaleString();
    const pct = totalNames ? Math.round((processed / totalNames) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressPct.textContent = `${pct}%`;

    if (startTime && processed > 0 && !stopFlag) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (totalNames - processed) / rate;
        if (isFinite(remaining) && remaining > 0) {
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = Math.floor(remaining % 60);
            if (etaText) {
                if (hours > 0) {
                    etaText.textContent = `ETA: ${hours}h ${minutes}m`;
                } else if (minutes > 0) {
                    etaText.textContent = `ETA: ${minutes}m ${seconds}s`;
                } else {
                    etaText.textContent = `ETA: ${seconds}s`;
                }
            }
        }
    }
}

function escapeHtml(str) {
    if (!str) return '—';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

function updateSelectedLangsBadge() {
    const langNames = Array.from(selectedLangs).map(l => LANG_NAMES[l]?.name || l);
    selectedLangsBadge.textContent = `Selected: ${langNames.join(', ')}`;
}

function renderResultsTable() {
    if (!resultsMap) return;

    const langsArray = Array.from(selectedLangs);
    resultsHead.innerHTML = `<tr><th>#</th><th>English Name</th>${langsArray.map(l => `<th>${LANG_NAMES[l]?.name || l.toUpperCase()}</th>`).join('')}<th>Status</th></tr>`;
    resultsBody.innerHTML = '';

    const displayItems = nameItems.slice(0, 100);
    displayItems.forEach((item, idx) => {
        const res = resultsMap.get(item.name) || {};
        const hasSuccess = langsArray.some(l => res[l] && res[l].length > 0);
        const status = hasSuccess ? '<span style="color:#10b981;">✓ SUCCESS</span>' : '<span style="color:#ef4444;">✗ FAILED</span>';
        const cells = langsArray.map(l => `<td style="font-family:'Noto Sans Devanagari','Noto Sans Tamil','Noto Sans Telugu';">${escapeHtml(res[l] || '—')}</td>`).join('');
        resultsBody.innerHTML += `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            ${cells}
            <td>${status}</td>
        </tr>`;
    });

    if (nameItems.length > 100) {
        const moreRow = document.createElement('tr');
        moreRow.innerHTML = `<td colspan="${langsArray.length + 3}" style="text-align:center; color:#888;">... and ${nameItems.length - 100} more rows. Export CSV to see all.</td>`;
        resultsBody.appendChild(moreRow);
    }
}

function showStep(step) {
    document.querySelectorAll('.step-content').forEach((el, idx) => {
        el.classList.toggle('active', idx === step);
    });
    document.querySelectorAll('.step').forEach((el, idx) => {
        el.classList.toggle('active', idx === step);
        if (idx < step) el.classList.add('completed');
        else el.classList.remove('completed');
    });
    currentStep = step;

    if (stopBtn) {
        stopBtn.style.display = step === 3 ? 'inline-block' : 'none';
    }
}

// CSV Handling
dropzone.addEventListener('click', () => csvInput.click());
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#ff6b2b';
    dropzone.style.background = 'rgba(255, 107, 43, 0.05)';
});
dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'rgba(255, 107, 43, 0.4)';
    dropzone.style.background = 'rgba(0, 0, 0, 0.2)';
});
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'rgba(255, 107, 43, 0.4)';
    dropzone.style.background = 'rgba(0, 0, 0, 0.2)';
    if (e.dataTransfer.files[0]) handleCSV(e.dataTransfer.files[0]);
});
csvInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleCSV(e.target.files[0]);
});

function handleCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
            csvData = result.data;
            csvHeaders = Object.keys(csvData[0]);
            nameColumn.innerHTML = csvHeaders.map(h => `<option value="${h}">${h}</option>`).join('');
            const guess = csvHeaders.find(h => h.toLowerCase().includes('name'));
            if (guess) nameColumn.value = guess;

            fileBadge.textContent = `✅ ${file.name} — ${csvData.length.toLocaleString()} rows`;

            const previewRows = csvData.slice(0, 5);
            dataPreview.innerHTML = previewRows.map(row => {
                const display = Object.values(row).slice(0, 3).join(' | ');
                return `<div style="padding: 4px 0;">${escapeHtml(display.substring(0, 100))}</div>`;
            }).join('');

            csvPreview.style.display = 'block';
            addLog(`Loaded ${csvData.length.toLocaleString()} rows from ${file.name}`, 'success');
            showToast(`CSV loaded: ${csvData.length.toLocaleString()} rows`, 'success');
        },
        error: (err) => {
            addLog(`CSV parse error: ${err.message}`, 'error');
            showToast('Failed to parse CSV', 'error');
        }
    });
}

changeFileBtn.addEventListener('click', () => {
    csvData = null;
    csvPreview.style.display = 'none';
    csvInput.value = '';
    translationCache.clear();
    addLog('File cleared, upload new CSV', 'info');
});

nextStep0.addEventListener('click', () => {
    if (!csvData) {
        showToast('Please upload a CSV file first', 'error');
        return;
    }
    if (!nameColumn.value) {
        showToast('Please select a name column', 'error');
        return;
    }
    showStep(1);
});

// Engine Selection
engineCards.forEach(card => {
    card.addEventListener('click', () => {
        engineCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedEngine = card.dataset.engine;
        nextStep1.disabled = false;
    });
});

nextStep1.addEventListener('click', () => {
    if (selectedEngine === 'groq') {
        groqConfig.style.display = 'block';
        ai4bharatConfig.style.display = 'none';
        configTitle.textContent = '☁️ Groq Configuration';
        configDesc.textContent = 'Enter your Groq API key and customize settings';
    } else {
        groqConfig.style.display = 'none';
        ai4bharatConfig.style.display = 'block';
        configTitle.textContent = '🔒 ai4bharat';
        configDesc.textContent = 'Local transliteration, no configuration needed';
    }
    showStep(2);
});

backStep1.addEventListener('click', () => showStep(0));
backStep2.addEventListener('click', () => showStep(1));

// Model Selection
modelCards.forEach(card => {
    card.addEventListener('click', () => {
        modelCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedModel = card.dataset.model;
    });
});

// Language Selection
langCards.forEach(card => {
    card.addEventListener('click', () => {
        const lang = card.dataset.lang;
        if (selectedLangs.has(lang)) {
            if (selectedLangs.size === 1) {
                showToast('At least one language must be selected', 'error');
                return;
            }
            selectedLangs.delete(lang);
            card.classList.remove('selected');
        } else {
            selectedLangs.add(lang);
            card.classList.add('selected');
        }
        updateSelectedLangsBadge();
    });
});

// Test Groq API Key
testKeyBtn.addEventListener('click', async () => {
    const key = apiKey.value.trim();
    if (!key) {
        showToast('Enter API key first', 'error');
        return;
    }
    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
            showToast('✅ API key valid!', 'success');
            addLog('Groq API key validated', 'success');
        } else {
            showToast('❌ Invalid API key', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
});

function collectNames() {
    const col = nameColumn.value;
    const names = csvData.map(row => row[col]).filter(n => n && n.trim()).map(n => n.trim());
    return [...new Set(names)];
}

// Groq Transliterate Batch
async function groqTransliterateBatch(namesBatch, langs, batchNum, totalBatches, retries) {
    const key = apiKey.value.trim();
    if (!key) throw new Error('No API key');
    const batchStartTime = Date.now();

    const uncachedNames = [];
    const cachedResults = new Map();

    for (const name of namesBatch) {
        const cacheKey = `${name}|${langs.join(',')}`;
        if (translationCache.has(cacheKey)) {
            cachedResults.set(name, translationCache.get(cacheKey));
        } else {
            uncachedNames.push(name);
        }
    }

    if (uncachedNames.length === 0) {
        addLog(`🎯 Batch ${batchNum}: All ${namesBatch.length} names from cache!`, 'success');
        const duration = (Date.now() - batchStartTime) / 1000;
        addBatchDetail(batchNum, namesBatch.length, namesBatch.length, 0, duration, namesBatch.length);
        return cachedResults;
    }

    const userInstr = instructions.value.trim();
    let prompt = `You are a precise phonetic transliterator. For each name, return JSON with the original name as key and an object containing transliterations for ${langs.join(', ')}.

Rules:
- Transcribe phonetically based on SOUND, not spelling
- For multi-word names, transliterate each word separately
- Return ONLY valid JSON, no markdown

Names to transliterate:
${JSON.stringify(uncachedNames)}`;

    if (userInstr) prompt += `\n\nAdditional instructions: ${userInstr}`;

    let delay = currentDelay;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        { role: 'system', content: 'You are a precise transliterator. Return only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 4096,
                    response_format: { type: 'json_object' }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (resp.status === 429) {
                consecutiveRateLimits++;
                const waitTime = Math.min(delay * Math.pow(2, consecutiveRateLimits), 64000);
                addLog(`⚠️ Rate limit! Waiting ${Math.ceil(waitTime/1000)}s...`, 'warning');
                await new Promise(r => setTimeout(r, waitTime));
                delay = waitTime;
                continue;
            }

            if (!resp.ok) throw new Error(`API ${resp.status}`);

            const data = await resp.json();
            let content = data.choices[0].message.content;
            content = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(content);

            const resultMap = new Map();
            for (const name of uncachedNames) {
                const entry = parsed[name] || {};
                const langRes = {};
                langs.forEach(l => langRes[l] = entry[l] || '');
                resultMap.set(name, langRes);
                translationCache.set(`${name}|${langs.join(',')}`, langRes);
            }

            for (const [name, res] of cachedResults) resultMap.set(name, res);

            consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1);
            const batchSuccess = uncachedNames.filter(name => {
                const res = resultMap.get(name);
                return res && Object.values(res).some(v => v && v.length > 0);
            }).length;

            const duration = (Date.now() - batchStartTime) / 1000;
            addBatchDetail(batchNum, namesBatch.length, batchSuccess + cachedResults.size, namesBatch.length - (batchSuccess + cachedResults.size), duration, cachedResults.size);

            return resultMap;

        } catch (err) {
            if (attempt === retries) {
                addLog(`❌ Batch ${batchNum} failed`, 'error');
                const resultMap = new Map();
                for (const name of namesBatch) {
                    const empty = {};
                    langs.forEach(l => empty[l] = '');
                    resultMap.set(name, empty);
                }
                const duration = (Date.now() - batchStartTime) / 1000;
                addBatchDetail(batchNum, namesBatch.length, 0, namesBatch.length, duration, 0);
                return resultMap;
            }
            await new Promise(r => setTimeout(r, delay * Math.pow(2, attempt - 1)));
        }
    }
}

// ai4bharat Transliteration
async function localTransliterateAll(namesList, langs) {
    const response = await fetch('/transliterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: namesList, langs: langs })
    });
    if (!response.ok) throw new Error(`Backend error: ${response.status}`);
    const data = await response.json();
    return data.results;
}

// Main Transliteration
async function startTransliteration() {
    if (selectedEngine === 'groq' && !apiKey.value.trim()) {
        showToast('Groq API key required', 'error');
        return;
    }
    if (selectedLangs.size === 0) {
        showToast('Select at least one language', 'error');
        return;
    }

    const namesArray = collectNames();
    if (namesArray.length === 0) {
        showToast('No names found in CSV', 'error');
        return;
    }

    const batchSizeVal = parseInt(batchSize.value) || 12;
    const parallel = Math.min(parseInt(workers.value) || 2, 3);
    const retriesVal = parseInt(retryCount.value) || 5;
    const delayBetweenBatches = parseInt(delayMs.value) || 4700;

    stopFlag = false;
    startBtn.disabled = true;
    if (stopBtn) stopBtn.style.display = 'inline-block';

    if (batchDetailsContainer) batchDetailsContainer.innerHTML = '';
    batchDetails.clear();
    if (batchDetailsSection) batchDetailsSection.style.display = 'none';

    nameItems = namesArray.map(n => ({ name: n }));
    totalNames = namesArray.length;
    processed = 0;
    succeeded = 0;
    failed = 0;
    resultsMap = new Map();
    consecutiveRateLimits = 0;
    currentDelay = 4700;

    updateProgress();
    resultsContainer.style.display = 'none';
    logContent.innerHTML = '<div class="log-entry info">✨ Starting transliteration...</div>';

    addLog(`🚀 Starting with ${selectedEngine.toUpperCase()} engine`, 'success');
    addLog(`📊 Total names: ${totalNames.toLocaleString()}`, 'info');
    addLog(`🌐 Languages: ${Array.from(selectedLangs).map(l => LANG_NAMES[l]?.name).join(', ')}`, 'info');

    showStep(3);
    startTime = Date.now();
    const langsList = Array.from(selectedLangs);

    try {
        if (selectedEngine === 'groq') {
            const batches = [];
            for (let i = 0; i < namesArray.length; i += batchSizeVal)
                batches.push(namesArray.slice(i, i + batchSizeVal));

            addLog(`📦 Created ${batches.length} batches`, 'info');

            let activePromises = [];
            let idx = 0;

            while (idx < batches.length && !stopFlag) {
                while (activePromises.length < parallel && idx < batches.length && !stopFlag) {
                    const batch = batches[idx];
                    const batchNum = idx + 1;

                    const promise = groqTransliterateBatch(batch, langsList, batchNum, batches.length, retriesVal)
                        .then(resMap => {
                            if (!resultsMap) resultsMap = new Map();
                            for (let name of batch) {
                                const translit = resMap.get(name) || {};
                                resultsMap.set(name, translit);
                                if (Object.values(translit).some(v => v && v.length > 0)) succeeded++;
                                else failed++;
                                processed++;
                                updateProgress();
                            }
                            renderResultsTable();
                        })
                        .catch(err => {
                            addLog(`❌ Batch ${batchNum} failed: ${err.message}`, 'error');
                            for (let name of batch) {
                                const empty = {};
                                langsList.forEach(l => empty[l] = '');
                                resultsMap.set(name, empty);
                                failed++;
                                processed++;
                                updateProgress();
                            }
                            renderResultsTable();
                        })
                        .finally(() => {
                            activePromises = activePromises.filter(p => p !== promise);
                        });

                    activePromises.push(promise);
                    idx++;
                    if (idx < batches.length && !stopFlag) {
                        await new Promise(r => setTimeout(r, delayBetweenBatches));
                    }
                }
                if (activePromises.length >= parallel && !stopFlag) {
                    await Promise.race(activePromises);
                } else if (!stopFlag && idx < batches.length) {
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            await Promise.allSettled(activePromises);

        } else {
            const batchSizeLocal = 100;
            const batches = [];
            for (let i = 0; i < namesArray.length; i += batchSizeLocal)
                batches.push(namesArray.slice(i, i + batchSizeLocal));

            for (let i = 0; i < batches.length && !stopFlag; i++) {
                const batch = batches[i];
                const batchNum = i + 1;
                const batchStartTime = Date.now();

                try {
                    const resultObj = await localTransliterateAll(batch, langsList);
                    let batchSuccess = 0;
                    for (let name of batch) {
                        const translit = resultObj[name] || {};
                        resultsMap.set(name, translit);
                        if (Object.values(translit).some(v => v && v.length > 0)) {
                            succeeded++;
                            batchSuccess++;
                        } else failed++;
                        processed++;
                        updateProgress();
                    }
                    const duration = (Date.now() - batchStartTime) / 1000;
                    addBatchDetail(batchNum, batch.length, batchSuccess, batch.length - batchSuccess, duration, 0);
                    renderResultsTable();
                    await new Promise(r => setTimeout(r, 10));
                } catch (err) {
                    addLog(`❌ Batch ${batchNum} failed: ${err.message}`, 'error');
                    for (let name of batch) {
                        const empty = {};
                        langsList.forEach(l => empty[l] = '');
                        resultsMap.set(name, empty);
                        failed++;
                        processed++;
                        updateProgress();
                    }
                }
            }
        }
    } catch (err) {
        addLog(`💥 Fatal error: ${err.message}`, 'error');
        showToast('Transliteration failed', 'error');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const successRate = totalNames > 0 ? ((succeeded / totalNames) * 100).toFixed(1) : 0;

    startBtn.disabled = false;
    if (stopBtn) stopBtn.style.display = 'none';

    if (!stopFlag) {
        addLog(`🎉 Completed in ${minutes}m ${seconds}s! ${successRate}% success rate`, 'success');
        addLog(`💾 Cache size: ${translationCache.size} unique transliterations`, 'info');
        showToast(`Complete! ${successRate}% success rate`, 'success');
    } else {
        addLog(`🛑 Stopped at ${processed.toLocaleString()}/${totalNames.toLocaleString()}`, 'warning');
        showToast(`Stopped at ${processed} names`, 'info');
    }

    renderResultsTable();
    resultsContainer.style.display = 'block';
}

// Stop button
if (stopBtn) {
    stopBtn.addEventListener('click', () => {
        if (confirm('Stop processing?')) {
            stopFlag = true;
            addLog('🛑 Stopped by user', 'warning');
        }
    });
}

startBtn.addEventListener('click', startTransliteration);

// ============ NEW SESSION BUTTON WITH WARNING ============
resetBtn.addEventListener('click', () => {
    let warningMessage = '⚠️ Start a new session? All current data will be lost.';

    if (processed > 0 && processed < totalNames) {
        warningMessage = `⚠️ WARNING: You have processed ${processed}/${totalNames} names (${Math.round((processed/totalNames)*100)}% complete)!\n\nStarting a new session will permanently delete all current progress and data.\n\nThis action cannot be undone!\n\nAre you sure you want to continue?`;
    } else if (csvData && csvData.length > 0) {
        warningMessage = `⚠️ You have loaded data but haven't started processing.\n\nStarting a new session will clear all uploaded data and settings.\n\nAre you sure you want to reset?`;
    }

    if (confirm(warningMessage)) {
        location.reload();
    }
});

// ============ PAGE REFRESH WARNING ============
let isProcessingActive = false;

// Track processing state
setInterval(() => {
    isProcessingActive = (processed > 0 && !stopFlag && processed < totalNames);
}, 1000);

window.addEventListener('beforeunload', (e) => {
    if (isProcessingActive || (processed > 0 && processed < totalNames)) {
        e.preventDefault();
        e.returnValue = `⚠️ WARNING: You have processing in progress!\n\nCompleted: ${processed}/${totalNames} names (${Math.round((processed/totalNames)*100)}%)\n\nIf you refresh or leave now, you will lose all progress.\n\nAre you sure you want to leave?`;
        return e.returnValue;
    }
});

// Export Functions
function exportCSV(type) {
    const langsArray = Array.from(selectedLangs);
    if (!resultsMap || resultsMap.size === 0) {
        showToast('No data to export', 'error');
        return;
    }

    let dataToExport = nameItems.map(item => ({
        name: item.name,
        ...(resultsMap.get(item.name) || {}),
        status: (() => {
            const translit = resultsMap.get(item.name) || {};
            return langsArray.some(l => translit[l] && translit[l].length > 0) ? 'SUCCESS' : 'FAILED';
        })()
    }));

    if (type === 'success') dataToExport = dataToExport.filter(d => d.status === 'SUCCESS');
    if (type === 'fail') dataToExport = dataToExport.filter(d => d.status === 'FAILED');

    const headers = ['English Name', ...langsArray.map(l => `${LANG_NAMES[l]?.name || l.toUpperCase()}_Transliteration`), 'Status'];
    const csvRows = [headers];
    for (const row of dataToExport) {
        csvRows.push([row.name, ...langsArray.map(l => row[l] || ''), row.status]);
    }
    const csvString = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `varnamai_${type}_${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addLog(`📥 Exported ${dataToExport.length.toLocaleString()} records`, 'success');
    showToast(`Exported ${dataToExport.length.toLocaleString()} records`, 'success');
}

exportAllBtn.addEventListener('click', () => exportCSV('all'));
exportSuccessBtn.addEventListener('click', () => exportCSV('success'));
exportFailBtn.addEventListener('click', () => exportCSV('fail'));

// Backend Health Check
async function checkBackend() {
    try {
        const res = await fetch('/health');
        if (res.ok) {
            const dot = document.querySelector('.status-dot');
            if (dot) {
                dot.style.background = '#10b981';
                dot.classList.add('connected');
            }
            if (backendStatus) {
                backendStatus.innerHTML = '<span class="status-dot connected" style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span><span style="margin-left:8px;">Backend: Connected</span>';
            }
        } else throw new Error();
    } catch (e) {
        if (backendStatus) {
            backendStatus.innerHTML = '<span class="status-dot" style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;"></span><span style="margin-left:8px;">Backend: Offline (run python app.py)</span>';
        }
    }
}

// Initialize
updateSelectedLangsBadge();
checkBackend();
setInterval(checkBackend, 30000);
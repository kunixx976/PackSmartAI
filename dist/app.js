const app = {
    currentCommodity: null,
    currentResults: null,
    lang: 'en',
    mode: 'simple',
    init: function () {
        this.applyTranslations();
    },
    toggleLang: function () {
        this.lang = this.lang === 'en' ? 'hi' : 'en';
        const btn = document.getElementById('lang-toggle');
        btn.classList.toggle('active', this.lang === 'hi');
        this.applyTranslations();
        // Re-render results if available to update text
        if (this.currentResults) {
            this.renderResults();
        }
    },
    toggleMode: function () {
        this.mode = this.mode === 'expert' ? 'simple' : 'expert';
        const btn = document.getElementById('mode-toggle');
        if (this.mode === 'simple') {
            document.body.classList.remove('mode-expert');
            document.body.classList.add('mode-simple');
            btn.classList.remove('active');
            btn.innerText = this.lang === 'hi' ? 'सरल मोड' : 'Basic Mode';
            this.syncBasicDefaults();
        }
        else {
            document.body.classList.add('mode-expert');
            document.body.classList.remove('mode-simple');
            btn.classList.add('active');
            btn.innerText = this.lang === 'hi' ? 'विशेषज्ञ मोड' : 'Expert Mode';
        }
        if (this.currentResults) {
            this.renderResults();
        }
    },
    syncBasicDefaults: function () {
        const product = document.getElementById('basic-product')?.value || 'rice';
        const state = document.getElementById('basic-state')?.value || 'dry';
        const shelf = parseInt(document.getElementById('basic-shelf')?.value || '30', 10);
        const storage = document.getElementById('basic-storage')?.value || 'room';
        const transport = document.getElementById('basic-transport')?.value || 'local';
        const presets = {
            rice: { name: 'Rice (Basmati)', category: 'grain', moisture: 12, fat: 0.5, ph: 6.5, aw: 0.6, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 4 : 25, rh: 65 },
            flour: { name: 'Wheat Flour', category: 'grain', moisture: 14, fat: 1.5, ph: 6.0, aw: 0.65, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 4 : 25, rh: 60 },
            mango: { name: 'Fresh Mango', category: 'fruit', moisture: 80, fat: 0.3, ph: 4.5, aw: 0.95, respiration: 40, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 8 : 12, rh: 90 },
            tomato: { name: 'Fresh Tomato', category: 'veg', moisture: 94, fat: 0.2, ph: 4.3, aw: 0.99, respiration: 15, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 8 : 10, rh: 90 },
            milk: { name: 'Pasteurized Milk', category: 'dairy', moisture: 87, fat: 3.5, ph: 6.7, aw: 0.99, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 4 : 25, rh: 50 },
            paneer: { name: 'Paneer', category: 'dairy', moisture: 55, fat: 25, ph: 5.5, aw: 0.97, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 4 : 25, rh: 90 },
            chicken: { name: 'Fresh Raw Chicken', category: 'meat', moisture: 75, fat: 15, ph: 6.2, aw: 0.99, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 2 : 25, rh: 95 },
            biscuits: { name: 'Biscuits', category: 'processed', moisture: 4, fat: 18, ph: 6.8, aw: 0.45, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 10 : 25, rh: 50 },
            spices: { name: 'Spices', category: 'processed', moisture: 8, fat: 1, ph: 5.5, aw: 0.6, respiration: 0, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 10 : 25, rh: 50 },
            other: { name: 'Other Product', category: 'processed', moisture: 50, fat: 5, ph: 6.5, aw: 0.75, respiration: 5, targetShelfLife: shelf, temp: storage === 'freezer' ? -18 : storage === 'refrigerator' ? 4 : 25, rh: 65 }
        };
        const data = presets[product] || presets.rice;
        const input = (id) => document.getElementById(id);
        input('commodityName').value = data.name;
        input('category').value = data.category;
        input('moisture').value = String(data.moisture);
        input('fat').value = String(data.fat);
        input('ph').value = String(data.ph);
        input('aw').value = String(data.aw);
        input('respiration').value = String(data.respiration);
        input('targetShelfLife').value = String(data.targetShelfLife);
        input('temp').value = String(data.temp);
        input('rh').value = String(data.rh);
        if (state === 'fresh' || state === 'chilled' || state === 'frozen') {
            input('category').value = product === 'mango' || product === 'tomato' ? 'fruit' : product === 'milk' || product === 'paneer' || product === 'chicken' ? 'dairy' : product === 'rice' || product === 'flour' ? 'grain' : 'processed';
        }
        if (transport === 'cold-chain' && data.temp > 4) {
            input('temp').value = '4';
        }
        if (transport === 'long-distance' && product === 'mango') {
            input('temp').value = '12';
        }
    },
    onBasicProductChange: function () {
        this.syncBasicDefaults();
    },
    applyTranslations: function () {
        const dict = DB.translations[this.lang];
        const modeBtn = document.getElementById('mode-toggle');
        if (modeBtn)
            modeBtn.innerText = this.mode === 'simple' ? (this.lang === 'hi' ? 'सरल मोड' : 'Basic Mode') : (this.lang === 'hi' ? 'विशेषज्ञ मोड' : 'Expert Mode');
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerHTML = dict[key];
            }
        });
        // Update preset dropdown text
        const presetSelect = document.getElementById('preset-select');
        Array.from(presetSelect.options).forEach(opt => {
            if (opt.value && DB.presets[opt.value]) {
                opt.text = this.lang === 'hi' ? DB.presets[opt.value].hi_name : DB.presets[opt.value].name;
            }
        });
    },
    navigate: function (sectionId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`sec-${sectionId}`).classList.add('active');
        window.scrollTo(0, 0);
    },
    loadPreset: function (presetKey) {
        if (!presetKey || !DB.presets[presetKey]) {
            // Document might be partially cleared, don't fully reset
            return;
        }
        const data = DB.presets[presetKey];
        const input = (id) => document.getElementById(id);
        input('commodityName').value = this.lang === 'hi' ? data.hi_name : data.name;
        input('category').value = data.category;
        input('moisture').value = String(data.moisture);
        input('fat').value = String(data.fat);
        input('ph').value = String(data.ph);
        input('aw').value = String(data.aw);
        input('respiration').value = String(data.respiration);
        input('targetShelfLife').value = String(data.targetShelfLife);
        input('temp').value = String(data.temp);
        input('rh').value = String(data.rh);
    },
    runAnalysis: async function (e) {
        e.preventDefault();
        // Collect data
        const input = (id) => document.getElementById(id);
        this.currentCommodity = {
            name: input('commodityName').value,
            category: input('category').value,
            moisture: parseFloat(input('moisture').value),
            fat: parseFloat(input('fat').value),
            ph: parseFloat(input('ph').value),
            aw: parseFloat(input('aw').value),
            respiration: parseFloat(input('respiration').value),
            targetShelfLife: parseInt(input('targetShelfLife').value),
            temp: parseFloat(input('temp').value),
            rh: parseFloat(input('rh').value),
            packageWeight: 1,
            pkgArea: parseFloat(input('pkgArea').value) || null,
            budget: parseFloat(input('budget').value) || null,
            priority: document.getElementById('basic-priority')?.value || 'balanced'
        };
        // Prefer the Python decision service, but keep the browser engine available offline.
        const engineRes = await this.requestRecommendation(this.currentCommodity);
        // Proceed only if there are recommendations
        if (engineRes.recommendations.length > 0) {
            const topMat = engineRes.recommendations[0];
            // Run Shelf Life
            const shelfLifeRes = ShelfLife.predict(this.currentCommodity, topMat);
            // Run MAP
            const mapRes = MAP.analyze(this.currentCommodity, topMat);
            this.currentResults = {
                recommendations: engineRes.recommendations,
                weights: engineRes.weights || Engine.getWeights(this.currentCommodity.priority),
                rejections: engineRes.rejections,
                explanation: engineRes.explanation,
                shelfLifeRes,
                mapRes
            };
            const saved = await this.saveAnalysis();
            if (saved) {
                this.currentResults.analysisId = saved.analysisId;
                this.currentResults.batchId = saved.batchId;
            }
            this.renderResults();
        }
        else {
            // Handle edge case where no material passes hard filter
            alert(engineRes.explanation);
            return;
        }
        this.navigate('results');
    },
    requestRecommendation: async function (commodity) {
        try {
            const requestId = crypto.randomUUID();
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
                cache: 'no-store',
                body: JSON.stringify(commodity)
            });
            if (!response.ok)
                throw new Error('Recommendation API unavailable');
            return await response.json();
        }
        catch (error) {
            return Engine.recommend(commodity, this.lang);
        }
    },
    saveAnalysis: async function () {
        if (!this.currentCommodity || !this.currentResults)
            return null;
        const topMat = this.currentResults.recommendations[0];
        const now = new Date();
        const packDate = now.toISOString().split('T')[0];
        const expiryDate = new Date(now.getTime() + this.currentResults.shelfLifeRes.predictedDays * 86400000).toISOString().split('T')[0];
        const sustainabilityScore = Sustainability.calculateScore(topMat);
        const record = {
            commodity: this.currentCommodity,
            candidates: this.currentResults.debug?.candidates || this.currentResults.recommendations.map(material => ({ id: material.id, name: material.name, status: 'eligible', rawScores: material.metrics, topsisScore: material.topsisScore })),
            topRecommendation: topMat,
            shelfLife: { ...this.currentResults.shelfLifeRes, packDate, expiryDate },
            sustainability: { recyclability: topMat.recyclable ? 40 : 0, biodegradability: topMat.biodegradable ? 30 : 0, carbon: Math.max(0, Math.round(30 - (topMat.carbonFootprint / 10) * 30)), total: sustainabilityScore },
            materialSpec: topMat,
            map: this.currentResults.mapRes,
            explanation: this.currentResults.explanation,
            engineVersion: 'browser-topsis-1.2',
            databaseVersion: 'materials-12-physical-v1',
            packageFormat: 'Flexible film or pouch',
            packageGeometry: { surfaceAreaM2: this.currentCommodity.pkgArea || 0.05, packageWeightKg: this.currentCommodity.packageWeight || 1 },
            confidence: { level: 'Screening confidence', score: topMat.topsisScore, uncertainty: 'Heuristic material properties; laboratory validation required.' },
            reviewStatus: 'Preliminary screening - pending technical review',
            laboratoryValidationChecklist: [
                'Confirm OTR and WVTR at actual temperature and relative humidity',
                'Validate seal integrity and package geometry',
                'Run product-specific shelf-life and microbiological studies',
                'Review migration, recyclability, and regulatory requirements'
            ],
            testConditions: { temperatureC: this.currentCommodity.temp, relativeHumidityPercent: this.currentCommodity.rh, method: 'Screening values; verify against supplier test reports' }
        };
        try {
            const response = await fetch('/api/analysis', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-ID': crypto.randomUUID() }, body: JSON.stringify(record), cache: 'no-store' });
            return response.ok ? await response.json() : null;
        }
        catch (error) {
            console.error('Unable to persist analysis record', error);
            return null;
        }
    },
    renderResults: function () {
        const { recommendations, rejections, explanation, shelfLifeRes, mapRes, debug, weights } = this.currentResults;
        const isHi = this.lang === 'hi';
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel && new URLSearchParams(window.location.search).get('dev') === '1' && debug) {
            debugPanel.style.display = 'block';
            debugPanel.innerHTML = `<h3>Development Diagnostics</h3><p><strong>Request:</strong> ${debug.requestId}</p><pre>${JSON.stringify(debug, null, 2)}</pre>`;
        }
        // Render Top Materials
        const listDiv = document.getElementById('recommendations-list');
        listDiv.innerHTML = '';
        const topMat = recommendations[0];
        const commodity = this.currentCommodity;
        const topName = isHi ? (topMat.hi_name || topMat.name) : topMat.name;
        const storage = commodity.temp <= 8 ? 'Chilled' : commodity.temp < 0 ? 'Frozen' : 'Ambient';
        const isProduce = commodity.category === 'fruit' || commodity.category === 'veg';
        const format = isProduce ? 'Ventilated pouch / produce bag' : commodity.category === 'meat' ? 'Sealed barrier pouch' : 'Flexible film or pouch';
        const mapStatus = mapRes.applicable ? (mapRes.specs.microPerf.startsWith('Required') ? 'Suitable with micro-perforation' : 'Suitable') : 'Consider MAP';
        const otrCond = topMat.testConditions?.otr;
        const wvtrCond = topMat.testConditions?.wvtr;
        const thickness = otrCond?.thicknessUm || wvtrCond?.thicknessUm || '30–50';
        const otrText = `${topMat.otr} cc/m²/day${otrCond ? ` @ ${otrCond.temperatureC}°C / ${otrCond.relativeHumidityPercent}% RH` : ''}`;
        const wvtrText = `${topMat.wvtr} g/m²/day${wvtrCond ? ` @ ${wvtrCond.temperatureC}°C / ${wvtrCond.relativeHumidityPercent}% RH` : ''}`;
        const sustainabilityScore = Sustainability.calculateScore(topMat);
        const packageArea = Math.max(0.01, parseFloat(commodity.pkgArea) || 0.05);
        const materialCostPerPack = topMat.costPerM2 * packageArea;
        const compatibility = topMat.topsisScore >= 0.7 ? 'High' : topMat.topsisScore >= 0.45 ? 'Medium' : 'Low';
        const scoreDisplay = this.mode === 'simple'
            ? `<span class="recommendation-compatibility">Overall compatibility: ${compatibility}</span>`
            : `<span class="recommendation-score">${(topMat.topsisScore * 100).toFixed(0)}<small>/100 TOPSIS</small></span>`;
        const activeWeights = weights || topMat.weights || { barrier: 0.3, cost: 0.2, sustainability: 0.25, mechanical: 0.25 };
        const whyItems = [
            isProduce ? 'Fresh produce continues to respire' : 'The material passes the product constraints',
            commodity.aw > 0.6 ? 'High moisture requires moisture management' : 'Barrier properties match the product profile',
            isProduce ? 'Gas exchange is required' : 'The selected barrier protects product quality',
            `Selected material provides suitable ${isProduce ? 'gas permeability' : 'barrier performance'}`,
            `Suitable for ${storage.toLowerCase()} storage conditions`
        ];
        const simplifyReason = (reason) => {
            if (reason.includes('temperature'))
                return 'Storage temperature is outside this material range.';
            if (reason.includes('moisture') || reason.includes('WVTR'))
                return 'Insufficient moisture protection for this product.';
            if (reason.includes('fat') || reason.includes('grease'))
                return 'Not enough grease resistance for this product.';
            if (reason.includes('frozen') || reason.includes('low-temperature'))
                return 'Not flexible enough for frozen storage.';
            if (reason.includes('OTR') || reason.includes('respiration'))
                return 'Gas permeability does not match respiration demand.';
            if (reason.includes('budget') || reason.includes('cost'))
                return 'Higher cost than the available budget.';
            return 'Did not pass all product requirements.';
        };
        const rejectedAlternatives = Object.entries(rejections || {}).slice(0, 3).map(([id, reason]) => {
            const material = DB.materials.find(item => item.id === id);
            return {
                name: isHi ? (material?.hi_name || material?.name || id) : (material?.name || id),
                simpleReason: simplifyReason(reason),
                technicalReason: reason
            };
        });
        const whyNotHtml = rejectedAlternatives.length > 0
            ? rejectedAlternatives.map(item => `<div class="recommendation-alternative"><strong>${item.name}</strong><span>⚠ ${item.simpleReason}</span></div>`).join('')
            : '<p class="recommendation-muted">All screened alternatives passed the initial filter; this material ranked highest overall.</p>';
        const technicalReasons = rejectedAlternatives.length > 0
            ? rejectedAlternatives.map(item => `<li><strong>${item.name}:</strong> ${item.technicalReason}</li>`).join('')
            : '<li>No materials were rejected by the hard filter.</li>';
        listDiv.innerHTML = `
            <article class="recommendation-card">
                <div class="recommendation-kicker">${isHi ? 'सुझाई गई पैकेजिंग' : 'RECOMMENDED PACKAGING'}</div>
                <div class="recommendation-heading">
                    <div>
                        <span class="recommendation-commodity">${commodity.name}</span>
                        <h4>${topName}</h4>
                    </div>
                    ${scoreDisplay}
                </div>
                <div class="recommendation-facts">
                    <div><span>Suggested format</span><strong>${format}</strong></div>
                    <div><span>Storage</span><strong>${storage}</strong></div>
                    <div><span>MAP</span><strong>${mapStatus}</strong></div>
                </div>
                <div class="recommendation-section">
                    <h5>Why this packaging?</h5>
                    <ul class="recommendation-reasons">${whyItems.map(item => `<li>${item}</li>`).join('')}</ul>
                </div>
                <div class="recommendation-section recommendation-why-not">
                    <h5>Why not the alternatives?</h5>
                    <div class="recommendation-alternatives">${whyNotHtml}</div>
                </div>
                <details class="technical-reasoning expert-only">
                    <summary>Show technical reasoning</summary>
                    <div class="technical-reasoning-content">
                        <p>${explanation}</p>
                        <p><strong>TOPSIS score:</strong> ${(topMat.topsisScore * 100).toFixed(1)}% · <strong>Barrier:</strong> ${topMat.metrics?.barrier ?? 'N/A'} · <strong>Cost:</strong> ${topMat.metrics?.cost ?? 'N/A'} · <strong>Sustainability:</strong> ${topMat.metrics?.sustainability ?? 'N/A'} · <strong>Mechanical:</strong> ${topMat.metrics?.mechanical ?? 'N/A'}</p>
                        <p><strong>Weights:</strong> Barrier ${Math.round(activeWeights.barrier * 100)}% · Cost ${Math.round(activeWeights.cost * 100)}% · Sustainability ${Math.round(activeWeights.sustainability * 100)}% · Mechanical ${Math.round(activeWeights.mechanical * 100)}% (total ${Math.round((activeWeights.barrier + activeWeights.cost + activeWeights.sustainability + activeWeights.mechanical) * 100)}%)</p>
                        <p><strong>Filter decisions:</strong></p>
                        <ul>${technicalReasons}</ul>
                    </div>
                </details>
                <div class="recommendation-section">
                    <h5>Technical requirements</h5>
                    <div class="recommendation-specs">
                        <div><span>OTR</span><strong>${otrText}</strong></div>
                        <div><span>WVTR</span><strong>${wvtrText}</strong></div>
                        <div><span>Thickness</span><strong>${thickness} µm</strong></div>
                        <div><span>Sealability</span><strong>Suitable</strong></div>
                        <div><span>Mechanical protection</span><strong>${commodity.category === 'meat' || commodity.category === 'grain' ? 'High' : 'Medium'}</strong></div>
                    </div>
                </div>
                <div class="recommendation-footer">
                    <div><span>Estimated material cost per pack</span><strong>₹${materialCostPerPack.toFixed(2)}</strong></div>
                    <div><span>Estimated total packaging cost per pack</span><strong>₹${materialCostPerPack.toFixed(2)} <small>(Material-only estimate)</small></strong></div>
                    <div><span>Sustainability</span><strong>Recyclability: ${topMat.recyclable ? 'Yes' : 'No'} · Screening: ${sustainabilityScore}/100</strong></div>
                </div>
                <p class="recommendation-warning">⚠ This is a screening recommendation and should be validated with product-specific testing before commercial use.</p>
            </article>
        `;
        recommendations.forEach((mat, idx) => {
            if (idx === 0)
                return;
            let costStr = mat.costPerM2 ? `₹${(mat.costPerM2 * packageArea).toFixed(2)}/pack material-only` : 'N/A';
            let name = isHi ? (mat.hi_name || mat.name) : mat.name;
            let desc = isHi ? (mat.hi_desc || mat.desc) : mat.desc;
            const sourceText = mat.dataSource || 'Screening estimate — supplier values pending formal validation';
            const otrCond = mat.testConditions?.otr;
            const wvtrCond = mat.testConditions?.wvtr;
            const otrText = otrCond ? `${mat.otr} @ ${otrCond.temperatureC}°C / ${otrCond.relativeHumidityPercent}% RH / ${otrCond.thicknessUm} µm` : `${mat.otr} cc/m²/d`;
            const wvtrText = wvtrCond ? `${mat.wvtr} @ ${wvtrCond.temperatureC}°C / ${wvtrCond.relativeHumidityPercent}% RH / ${wvtrCond.thicknessUm} µm` : `${mat.wvtr} g/m²/d`;
            listDiv.innerHTML += `
                <div class="reco-item">
                    <div class="reco-rank">#${idx + 1}</div>
                    <div class="reco-details">
                        <h4>${name}</h4>
                        <p>${desc}</p>
                        <div class="simple-badges">
                            <span>${mat.recyclable ? '♻ Recyclable' : '⚠ Difficult to recycle'}</span>
                            <span>${mat.greaseResistance ? '✓ Grease resistant' : '○ Standard grease resistance'}</span>
                        </div>
                        <div class="spec-grid expert-only">
                            <div class="spec-item"><span class="spec-label">OTR</span><strong>${otrText}</strong></div>
                            <div class="spec-item"><span class="spec-label">WVTR</span><strong>${wvtrText}</strong></div>
                            <div class="spec-item"><span class="spec-label">Cost</span><strong>${costStr}</strong></div>
                            <div class="spec-item"><span class="spec-label">TOPSIS Score</span><strong>${(mat.topsisScore * 100).toFixed(1)}%</strong></div>
                        </div>
                        <div class="material-source">
                            <strong>Data source:</strong> ${sourceText}
                        </div>
                    </div>
                </div>
            `;
        });
        // Render Charts (if expert)
        Charts.renderRadar('radarChart', recommendations);
        Charts.renderShelfLife('shelfLifeChart', shelfLifeRes.timelineData, shelfLifeRes.unpackagedDays);
        // Render Sustainability
        document.getElementById('eco-score-display').innerHTML = Sustainability.getWidgetHTML(topMat, this.lang);
        // Render MAP
        const mapCard = document.getElementById('map-results-card');
        if (mapRes.applicable) {
            mapCard.style.display = 'block';
            document.getElementById('map-specs').innerHTML = mapRes.getHTML(this.lang);
        }
        else {
            mapCard.style.display = 'none';
        }
    },
    showQR: function () {
        const modal = document.getElementById('qr-modal');
        if (!this.currentResults || !this.currentCommodity) {
            alert(this.lang === 'hi' ? 'पहले विश्लेषण चलाएँ।' : 'Run an analysis before generating a traceability QR.');
            return;
        }
        if (!this.currentResults.analysisId) {
            alert(this.lang === 'hi' ? 'ट्रेस रिकॉर्ड सेव नहीं हो सका।' : 'The traceability record could not be saved. Run the analysis again.');
            return;
        }
        const topMat = this.currentResults.recommendations[0];
        const data = {
            commodityName: this.currentCommodity.name,
            materialName: topMat.name,
            shelfLife: this.currentResults.shelfLifeRes.predictedDays,
            temp: this.currentCommodity.temp,
            rh: this.currentCommodity.rh,
            traceUrl: `${window.location.origin}/p/q/${this.currentResults.analysisId}`
        };
        modal.style.display = "block";
        QR.generate('qrcode-container', data, this.lang);
    },
    closeQR: function () {
        document.getElementById('qr-modal').style.display = "none";
    },
    printReport: function () {
        Export.print();
    }
};
// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('qr-modal');
    if (event.target == modal) {
        app.closeQR();
    }
};
// Init on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

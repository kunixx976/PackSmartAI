const app = {
    currentCommodity: null,
    currentResults: null,
    lang: 'en',
    mode: 'expert',
    
    init: function() {
        this.applyTranslations();
    },

    toggleLang: function() {
        this.lang = this.lang === 'en' ? 'hi' : 'en';
        const btn = document.getElementById('lang-toggle');
        btn.classList.toggle('active', this.lang === 'hi');
        this.applyTranslations();
        
        // Re-render results if available to update text
        if (this.currentResults) {
            this.renderResults();
        }
    },

    toggleMode: function() {
        this.mode = this.mode === 'expert' ? 'simple' : 'expert';
        const btn = document.getElementById('mode-toggle');
        
        if (this.mode === 'simple') {
            document.body.classList.remove('mode-expert');
            document.body.classList.add('mode-simple');
            btn.classList.remove('active');
            btn.innerText = this.lang === 'hi' ? 'सरल मोड' : 'Simple Mode';
        } else {
            document.body.classList.add('mode-expert');
            document.body.classList.remove('mode-simple');
            btn.classList.add('active');
            btn.innerText = this.lang === 'hi' ? 'विशेषज्ञ मोड' : 'Expert Mode';
        }
    },

    applyTranslations: function() {
        const dict = DB.translations[this.lang];
        const modeBtn = document.getElementById('mode-toggle');
        if (modeBtn) modeBtn.innerText = this.mode === 'simple' ? (this.lang === 'hi' ? 'सरल मोड' : 'Simple Mode') : (this.lang === 'hi' ? 'विशेषज्ञ मोड' : 'Expert Mode');
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerHTML = dict[key];
            }
        });

        // Update preset dropdown text
        const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
        Array.from(presetSelect.options).forEach(opt => {
            if (opt.value && DB.presets[opt.value]) {
                opt.text = this.lang === 'hi' ? DB.presets[opt.value].hi_name : DB.presets[opt.value].name;
            }
        });
    },

    navigate: function(sectionId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`sec-${sectionId}`).classList.add('active');
        window.scrollTo(0,0);
    },

    loadPreset: function(presetKey) {
        if (!presetKey || !DB.presets[presetKey]) {
            // Document might be partially cleared, don't fully reset
            return;
        }
        
        const data = DB.presets[presetKey];
        const input = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
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

    runAnalysis: async function(e) {
        e.preventDefault();
        
        // Collect data
        const input = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
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
            budget: parseFloat(input('budget').value) || null
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
                rejections: engineRes.rejections,
                explanation: engineRes.explanation,
                shelfLifeRes, 
                mapRes 
            };
            
            this.renderResults();
        } else {
            // Handle edge case where no material passes hard filter
            alert(engineRes.explanation);
            return;
        }

        this.navigate('results');
    },

    requestRecommendation: async function(commodity) {
        try {
            const requestId = crypto.randomUUID();
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
                cache: 'no-store',
                body: JSON.stringify(commodity)
            });
            if (!response.ok) throw new Error('Recommendation API unavailable');
            return await response.json();
        } catch (error) {
            return Engine.recommend(commodity, this.lang);
        }
    },

    renderResults: function() {
        const { recommendations, explanation, shelfLifeRes, mapRes, debug } = this.currentResults;
        const isHi = this.lang === 'hi';
        
        // Explainability Text
        document.getElementById('explainability-text').innerHTML = explanation;
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel && new URLSearchParams(window.location.search).get('dev') === '1' && debug) {
            debugPanel.style.display = 'block';
            debugPanel.innerHTML = `<h3>Development Diagnostics</h3><p><strong>Request:</strong> ${debug.requestId}</p><pre>${JSON.stringify(debug, null, 2)}</pre>`;
        }

        // Render Top Materials
        const listDiv = document.getElementById('recommendations-list');
        listDiv.innerHTML = '';
        recommendations.forEach((mat, idx) => {
            let costStr = mat.costPerM2 ? `₹${mat.costPerM2}/m²` : 'N/A';
            let name = isHi ? (mat.hi_name || mat.name) : mat.name;
            let desc = isHi ? (mat.hi_desc || mat.desc) : mat.desc;

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
                            <div class="spec-item"><span class="spec-label">OTR</span><strong>${mat.otr}</strong> cc/m²/d</div>
                            <div class="spec-item"><span class="spec-label">WVTR</span><strong>${mat.wvtr}</strong> g/m²/d</div>
                            <div class="spec-item"><span class="spec-label">Cost</span><strong>${costStr}</strong></div>
                            <div class="spec-item"><span class="spec-label">TOPSIS Score</span><strong>${(mat.topsisScore*100).toFixed(1)}%</strong></div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Render Charts (if expert)
        Charts.renderRadar('radarChart', recommendations);
        Charts.renderShelfLife('shelfLifeChart', shelfLifeRes.timelineData, shelfLifeRes.unpackagedDays);

        // Render Sustainability
        const topMat = recommendations[0];
        document.getElementById('eco-score-display').innerHTML = Sustainability.getWidgetHTML(topMat, this.lang);

        // Render MAP
        const mapCard = document.getElementById('map-results-card');
        if (mapRes.applicable) {
            mapCard.style.display = 'block';
            document.getElementById('map-specs').innerHTML = mapRes.getHTML(this.lang);
        } else {
            mapCard.style.display = 'none';
        }
    },

    showQR: function() {
        const modal = document.getElementById('qr-modal');
        if (!this.currentResults || !this.currentCommodity) {
            alert(this.lang === 'hi' ? 'पहले विश्लेषण चलाएँ।' : 'Run an analysis before generating a traceability QR.');
            return;
        }
        const topMat = this.currentResults.recommendations[0];
        const data = {
            commodityName: this.currentCommodity.name,
            materialName: topMat.name,
            shelfLife: this.currentResults.shelfLifeRes.predictedDays,
            temp: this.currentCommodity.temp,
            rh: this.currentCommodity.rh
        };
        
        modal.style.display = "block";
        QR.generate('qrcode-container', data, this.lang);
    },

    closeQR: function() {
        document.getElementById('qr-modal').style.display = "none";
    },

    printReport: function() {
        Export.print();
    }
};

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('qr-modal');
    if (event.target == modal) {
        app.closeQR();
    }
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

const Sustainability = {
    calculateScore: function(material) {
        let score = 0;
        
        // Recyclability (0-40 points)
        if (material.recyclable) {
            // Mono-materials get full 40, multi-layers get less
            score += (material.id === 'met_pet' || material.id === 'evoh') ? 20 : 40;
        }
        
        // Biodegradability (0-30 points)
        if (material.biodegradable) score += 30;
        
        // Carbon Footprint Penalty (Starts at 30, subtracts based on footprint)
        // Assume worst carbon footprint is around 10 kg CO2/kg.
        let carbonPenalty = (material.carbonFootprint / 10) * 30;
        let carbonScore = Math.max(0, 30 - carbonPenalty);
        
        score += carbonScore;

        return Math.round(score); // Max 100
    },

    getGrade: function(score) {
        if (score >= 80) return 'A';
        if (score >= 60) return 'B';
        if (score >= 40) return 'C';
        if (score >= 20) return 'D';
        return 'E';
    },

    getGradeDesc: function(grade, lang = 'en') {
        const isHi = lang === 'hi';
        const descriptions = {
            'A': isHi ? 'उत्कृष्ट - अत्यधिक टिकाऊ, कम कार्बन पदचिह्न।' : 'Excellent - Highly sustainable, low carbon footprint.',
            'B': isHi ? 'अच्छा - मजबूत टिकाऊ विशेषताएं हैं।' : 'Good - Has strong sustainable characteristics.',
            'C': isHi ? 'औसत - औसत पर्यावरणीय प्रभाव वाली मानक सामग्री।' : 'Average - Standard material with average environmental impact.',
            'D': isHi ? 'खराब - रीसायकल करना मुश्किल या उच्च पर्यावरणीय पदचिह्न।' : 'Poor - Difficult to recycle or high environmental footprint.',
            'E': isHi ? 'बहुत खराब - उच्च पर्यावरणीय प्रभाव, गैर-पुनर्नवीनीकरण योग्य।' : 'Very Poor - High environmental impact, non-recyclable.'
        };
        return descriptions[grade];
    },
    
    getWidgetHTML: function(material, lang = 'en') {
        const isHi = lang === 'hi';
        const score = this.calculateScore(material);
        const grade = this.getGrade(score);
        
        return `
            <div class="eco-grade ${grade}">${grade}</div>
            <p>${isHi ? 'स्कोर' : 'Score'}: <strong>${score}/100</strong></p>
            <p class="qr-hint mt-2">${this.getGradeDesc(grade, lang)}</p>
            <div class="spec-grid" style="text-align:left;">
                <div class="spec-item">
                    <span class="spec-label">${isHi ? 'पुनर्चक्रण योग्य' : 'Recyclable'}</span>
                    <strong>${material.recyclable ? '✅' : '❌'}</strong>
                </div>
                <div class="spec-item">
                    <span class="spec-label">${isHi ? 'बायोडिग्रेडेबल' : 'Biodegradable'}</span>
                    <strong>${material.biodegradable ? '✅' : '❌'}</strong>
                </div>
                <div class="spec-item" style="grid-column: span 2;">
                    <span class="spec-label">${isHi ? 'कार्बन पदचिह्न' : 'Carbon Footprint'}</span>
                    <strong>${material.carbonFootprint} kg CO₂eq/kg</strong>
                </div>
            </div>
        `;
    }
};

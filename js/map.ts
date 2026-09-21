const MAP = {
    // Calculates Modified Atmosphere Packaging specs for respiring produce
    analyze: function(commodity, material) {
        if (commodity.category !== 'fruit' && commodity.category !== 'veg') {
            return { applicable: false };
        }

        let respRate = parseFloat(commodity.respiration) || 0;
        
        if (respRate <= 0) {
            return { applicable: false };
        }

        // Steady-State O2/CO2 Calculation
        // In steady state: Permeation Rate = Respiration Rate
        // P_O2 * A * (0.21 - y_O2) / L = R_O2 * W
        // We approximate internal steady state based on film OTR vs Respiration
        
        let ambientO2 = 21.0;
        let ambientCO2 = 0.04;
        
        const packageArea = Math.max(0.01, parseFloat(commodity.pkgArea) || 0.05);
        const packageWeight = Math.max(0.1, parseFloat(commodity.packageWeight) || 1);
        let filmOTR = material.otr; // cc/m2/day
        
        // Required flux = Respiration (mL/kg/hr) * 24 hrs
        let reqFlux = respRate * 24 * packageWeight; // cc/day
        
        // Provided flux at max gradient = OTR * 0.1 * 0.21
        let maxProvidedFlux = filmOTR * packageArea * 0.21;
        
        let steadyStateO2 = 21.0;
        let steadyStateCO2 = 0.04;
        let microPerfRequired = false;
        
        if (maxProvidedFlux < reqFlux) {
            // Material is too much of a barrier, will go anaerobic
            steadyStateO2 = 0.1; // Anaerobic
            steadyStateCO2 = 25.0; // High CO2
            microPerfRequired = true; // Needs micro-perforations to increase OTR
        } else {
            // Calculate equilibrium
            // (21 - SS_O2) / 21 = reqFlux / maxProvidedFlux
            let oxygenDeficit = (reqFlux / maxProvidedFlux) * 21;
            steadyStateO2 = Math.max(1, 21 - oxygenDeficit);
            
            // Assume Respiratory Quotient (RQ) = 1, so CO2 produced = O2 consumed
            steadyStateCO2 = Math.min(20, 0.04 + oxygenDeficit);
        }

        let recoPermeability = reqFlux / (packageArea * (0.21 - 0.05)); // Target 5% O2
        const respirationLevel = respRate >= 30 ? 'HIGH' : respRate >= 10 ? 'MEDIUM' : 'LOW';
        const packagingRecommendation = microPerfRequired
            ? 'Micro-perforated film'
            : filmOTR >= 10000 ? 'High-permeability film' : 'Breathable film';

        return {
            applicable: true,
            specs: {
                steadyStateO2: steadyStateO2.toFixed(1) + '%',
                steadyStateCO2: steadyStateCO2.toFixed(1) + '%',
                respirationLevel,
                packagingRecommendation,
                balanceGas: 'Nitrogen (N2)',
                recoPermeability: Math.round(recoPermeability) + ' cc/m2/day',
                microPerf: microPerfRequired ? 'Required to prevent anaerobic decay' : 'Not required'
            },
            getHTML: function(lang = 'en') {
                const isHi = lang === 'hi';
                return `
                    <div class="map-screening-panel">
                        <div class="map-facts">
                            <div class="spec-item"><span class="spec-label">Respiration</span><strong>${this.specs.respirationLevel}</strong></div>
                            <div class="spec-item"><span class="spec-label">Recommended packaging</span><strong>${this.specs.packagingRecommendation}</strong></div>
                            <div class="spec-item"><span class="spec-label">Estimated O₂</span><strong>${this.specs.steadyStateO2}</strong></div>
                            <div class="spec-item"><span class="spec-label">Estimated CO₂</span><strong>${this.specs.steadyStateCO2}</strong></div>
                            <div class="spec-item"><span class="spec-label">Recommended OTR</span><strong>${this.specs.recoPermeability}</strong></div>
                            <div class="spec-item"><span class="spec-label">Micro-perforation</span><strong>${this.specs.microPerf.startsWith('Required') ? 'Required' : 'Not required'}</strong></div>
                        </div>
                        <p class="map-screening-note"><strong>Screening estimate:</strong> MAP values are screening estimates. Actual equilibrium gas composition depends on product respiration, package geometry, temperature, film properties and perforation characteristics.</p>
                    </div>
                `;
            }
        };
    }
};

const ShelfLife = {
    // Physics-Based Shelf Life Prediction
    // Uses Fick's Law of Permeation and First-Order Quality Decay Kinetics
    predict: function (commodity, material) {
        let baseDays = parseInt(commodity.targetShelfLife) || 7;
        // 1. Temperature Impact (Arrhenius/Q10 approximation)
        let tempDiff = 25 - commodity.temp;
        let k_temp = Math.pow(2, tempDiff / 10); // Decay rate modifier based on temp
        // 2. Permeation Impact (Fick's Law proxy)
        // Flux = P * A * dP / L. We use OTR/WVTR as proxy for P/L.
        // We calculate an environmental stress factor.
        const packageArea = Math.max(0.01, parseFloat(commodity.pkgArea) || 0.05);
        const ambientRH = Math.max(0, Math.min(100, parseFloat(commodity.rh) || 65));
        let stressFactor = 1.0;
        if (commodity.category === 'fruit' || commodity.category === 'veg') {
            // Produce: Needs gas exchange. 
            // If OTR is too low, anaerobic decay accelerates.
            const oxygenDemand = (parseFloat(commodity.respiration) || 0) * 24;
            const oxygenSupply = material.otr * packageArea * 0.21;
            const respirationStress = oxygenDemand > 0 ? oxygenDemand / Math.max(oxygenSupply, 0.001) : 0;
            stressFactor = Math.max(0.5, 0.8 + respirationStress);
        }
        else {
            // Dry/Processed/Meat: Decay driven by moisture ingress and oxidation.
            // Moisture ingress rate ~ WVTR * (ambient_RH - internal_aw*100)
            let moistureGradient = Math.abs(ambientRH - (commodity.aw * 100));
            let moistureIngress = (material.wvtr * packageArea * moistureGradient) / 1000;
            // Gas ingress rate ~ OTR
            let oxygenIngress = (material.otr * packageArea) / 1000;
            // Combine ingress into a decay accelerator (stress factor)
            stressFactor = 0.5 + (moistureIngress * 0.5) + (oxygenIngress * 0.5);
            if (stressFactor < 0.2)
                stressFactor = 0.2;
        }
        // 3. First-Order Decay Kinetics: Q(t) = Q0 * exp(-k * t)
        // We want to find t where Q(t) = 50% (End of Shelf Life)
        // Let base k = ln(2) / (baseDays * k_temp)
        // Effective k = base k * stressFactor
        let base_k = Math.LN2 / (baseDays * k_temp);
        let effective_k = base_k * stressFactor;
        // Predicted days = ln(2) / effective_k
        const isPerishable = ['fruit', 'veg', 'dairy', 'meat'].includes(commodity.category);
        const rawPredictedDays = Math.round(Math.LN2 / effective_k);
        const maximumPerishableDays = Math.max(baseDays, Math.round(baseDays * 2));
        const predictedDays = isPerishable ? Math.min(rawPredictedDays, maximumPerishableDays) : rawPredictedDays;
        if (predictedDays !== rawPredictedDays) {
            effective_k = Math.LN2 / predictedDays;
        }
        // Unpackaged days (simulated with very high stress factor)
        let unpackaged_k = base_k * 5.0;
        let unpackagedDays = Math.round(Math.LN2 / unpackaged_k);
        // Generate decay curve Q(t) = 100 * exp(-k * t)
        let timelineData = [];
        let maxDays = Math.round(predictedDays * 1.5);
        let step = Math.max(1, Math.round(maxDays / 10));
        for (let d = 0; d <= maxDays; d += step) {
            let q = 100 * Math.exp(-effective_k * d);
            timelineData.push({ day: d, quality: Math.round(q) });
        }
        return {
            predictedDays: predictedDays,
            unpackagedDays: unpackagedDays,
            modelNote: predictedDays !== rawPredictedDays ? 'Perishable shelf-life bounded to twice the target to avoid overstating heuristic kinetics.' : undefined,
            timelineData: timelineData
        };
    }
};

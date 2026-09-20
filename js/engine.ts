const Engine = {
    // Hard Constraints Filter
    hardFilter: function(commodity, materials) {
        let survivors = [];
        let rejections = {}; // Store reasons for explainability

        materials.forEach(mat => {
            let passed = true;
            let reason = '';

            // Every independent constraint is evaluated so one failure cannot hide another.
            if (commodity.temp < mat.tempRange[0] || commodity.temp > mat.tempRange[1]) {
                passed = false;
                reason = `Material temperature range (${mat.tempRange[0]}°C to ${mat.tempRange[1]}°C) cannot support storage at ${commodity.temp}°C.`;
            } else if ((commodity.aw > 0.6 || commodity.respiration > 0) && mat.id === 'paper') {
                passed = false;
                reason = 'High moisture/respiration commodities cannot use uncoated paper due to lack of barrier.';
            } else if (commodity.fat > 5 && !mat.greaseResistance) {
                passed = false;
                reason = 'Commodity has high fat content, but material lacks grease resistance.';
            } else if (commodity.temp < 0 && !mat.lowTempFlex) {
                passed = false;
                reason = 'Frozen storage requires low-temperature flexibility which this material lacks.';
            } else if ((commodity.category === 'fruit' || commodity.category === 'veg') && commodity.respiration > 0 && commodity.pkgArea) {
                const requiredOTR = (commodity.respiration * 24) / (commodity.pkgArea * 0.16);
                if (mat.otr < requiredOTR * 0.25) {
                    passed = false;
                    reason = `Film OTR (${mat.otr} cc/m²/day) is too low for the calculated respiration demand (${Math.round(requiredOTR)} cc/m²/day).`;
                }
            } else if (commodity.aw > 0.6 && mat.wvtr > 50) {
                passed = false;
                reason = `Film WVTR (${mat.wvtr} g/m²/day) is too high for a high-water-activity product.`;
            } else if (commodity.budget && mat.costPerM2 > commodity.budget) {
                passed = false;
                reason = `Material cost (₹${mat.costPerM2}/m²) exceeds budget (₹${commodity.budget}/m²).`;
            }

            if (passed) {
                survivors.push(mat);
            } else {
                rejections[mat.id] = reason;
            }
        });

        return { survivors, rejections };
    },

    // TOPSIS Implementation
    runTOPSIS: function(commodity, candidates) {
        if (candidates.length === 0) return [];
        if (candidates.length === 1) {
            candidates[0].topsisScore = 1;
            candidates[0].topsisRank = 1;
            candidates[0].metrics = {
                barrier: 100,
                cost: candidates[0].costPerM2,
                sustainability: Sustainability.calculateScore(candidates[0]),
                mechanical: 100
            };
            return candidates;
        }

        // 1. Create Decision Matrix (Rows: candidates, Cols: criteria)
        // Criteria: Barrier Match, Cost, Sustainability, Mechanical Suitability
        // We will define weights and whether they are cost (minimize) or benefit (maximize) attributes.
        const criteria = [
            { name: 'barrier', weight: 0.30, type: 'benefit' }, // We'll compute a barrier suitability score (higher is better)
            { name: 'cost', weight: 0.20, type: 'cost' }, // Cost per m2 (lower is better)
            { name: 'sustainability', weight: 0.25, type: 'benefit' }, // Sustainability score (higher is better)
            { name: 'mechanical', weight: 0.25, type: 'benefit' } // Suitability score (higher is better)
        ];

        let matrix = candidates.map(mat => {
            // Barrier suitability proxy
            let barrierVal = 50; 
            if (commodity.category === 'fruit' || commodity.category === 'veg') {
                // Prefers high OTR
                barrierVal = mat.otr > 1000 ? 100 : (mat.otr < 100 ? 10 : 50);
            } else {
                // Prefers low WVTR and low OTR
                let wvtrScore = mat.wvtr < 10 ? 100 : (mat.wvtr < 50 ? 50 : 10);
                let otrScore = mat.otr < 100 ? 100 : (mat.otr < 1000 ? 50 : 10);
                barrierVal = (wvtrScore + otrScore) / 2;
            }

            // Mechanical suitability proxy
            let mechVal = 50;
            if (commodity.category === 'dairy' && mat.id === 'pet') mechVal = 100;
            if (commodity.category === 'grain' && (mat.id === 'bopp' || mat.id === 'ldpe')) mechVal = 100;
            if (commodity.category === 'meat' && mat.id === 'nylon') mechVal = 100;

            let sustainabilityVal = Sustainability.calculateScore(mat);

            return [barrierVal, mat.costPerM2, sustainabilityVal, mechVal];
        });

        // 2. Normalize the Matrix
        let normalized = [];
        for (let i = 0; i < matrix.length; i++) {
            let row = [];
            for (let j = 0; j < criteria.length; j++) {
                let sumSq = 0;
                for (let k = 0; k < matrix.length; k++) {
                    sumSq += Math.pow(matrix[k][j], 2);
                }
                let denom = Math.sqrt(sumSq) || 1;
                row.push(matrix[i][j] / denom);
            }
            normalized.push(row);
        }

        // 3. Weighted Normalized Matrix
        let weighted = normalized.map(row => {
            return row.map((val, j) => val * criteria[j].weight);
        });

        // 4. Determine Ideal Best (V+) and Ideal Worst (V-)
        let idealBest = [];
        let idealWorst = [];
        for (let j = 0; j < criteria.length; j++) {
            let col = weighted.map(row => row[j]);
            if (criteria[j].type === 'benefit') {
                idealBest.push(Math.max(...col));
                idealWorst.push(Math.min(...col));
            } else { // cost
                idealBest.push(Math.min(...col));
                idealWorst.push(Math.max(...col));
            }
        }

        // 5. Calculate Distances
        let distances = weighted.map(row => {
            let dPlus = 0;
            let dMinus = 0;
            for (let j = 0; j < criteria.length; j++) {
                dPlus += Math.pow(row[j] - idealBest[j], 2);
                dMinus += Math.pow(row[j] - idealWorst[j], 2);
            }
            dPlus = Math.sqrt(dPlus);
            dMinus = Math.sqrt(dMinus);
            return { dPlus, dMinus };
        });

        // 6. Calculate Relative Closeness (Score)
        candidates.forEach((mat, i) => {
            let dP = distances[i].dPlus;
            let dM = distances[i].dMinus;
            // TOPSIS score = dMinus / (dPlus + dMinus)
            mat.topsisScore = (dP + dM === 0) ? 0 : dM / (dP + dM);
            
            // Store specific metric values for explainability panel
            mat.metrics = {
                barrier: matrix[i][0],
                cost: matrix[i][1],
                sustainability: matrix[i][2],
                mechanical: matrix[i][3]
            };
        });

        // 7. Rank
        candidates.sort((a, b) => b.topsisScore - a.topsisScore);
        candidates.forEach((mat, i) => mat.topsisRank = i + 1);

        return candidates;
    },

    // Generates Natural Language Explanation
    generateExplanation: function(topMat, commodity, rejections, lang = 'en') {
        const isHi = lang === 'hi';
        let text = "";

        // Part 1: Why it passed the hard filter
        if (isHi) {
            text += `<strong>${topMat.hi_name}</strong> को चुना गया क्योंकि यह आपके उत्पाद की भौतिक बाधाओं को पूरी तरह से पार करता है। `;
            if (commodity.temp < 0) text += `इसमें निम्न-तापमान लचीलापन (फ्रोजन भंडारण के लिए आवश्यक) है। `;
            if (commodity.fat > 5) text += `यह वसायुक्त खाद्य पदार्थों के लिए आवश्यक ग्रीस प्रतिरोध प्रदान करता है। `;
        } else {
            text += `<strong>${topMat.name}</strong> was selected because it perfectly passes the physical constraints of your product. `;
            if (commodity.temp < 0) text += `It has excellent low-temperature flexibility required for frozen storage. `;
            if (commodity.fat > 5) text += `It provides the necessary grease resistance for high-fat foods. `;
        }

        // Part 2: Why it ranked #1 in TOPSIS
        if (isHi) {
            text += `एमसीडीए (TOPSIS) विश्लेषण में, इसने इष्टतम संतुलन हासिल किया: `;
            text += `₹${topMat.costPerM2}/m² की लागत दक्षता के साथ, `;
            text += `और एक स्थिरता स्कोर ${topMat.metrics.sustainability}/100। `;
        } else {
            text += `In the MCDA (TOPSIS) analysis, it achieved the optimal balance: `;
            text += `delivering high barrier performance while maintaining a cost efficiency of ₹${topMat.costPerM2}/m², `;
            text += `and a sustainability score of ${topMat.metrics.sustainability}/100. `;
        }

        // Part 3: Mention a rejected material for contrast
        let rejectedIds = Object.keys(rejections);
        if (rejectedIds.length > 0) {
            let exampleId = rejectedIds[0];
            let exampleMat = DB.materials.find(m => m.id === exampleId);
            if (exampleMat) {
                if (isHi) {
                    text += `<br><br><em>तुलना के लिए:</em> ${exampleMat.hi_name} को समाप्त कर दिया गया था क्योंकि: ${rejections[exampleId]}`;
                } else {
                    text += `<br><br><em>For contrast:</em> ${exampleMat.name} was eliminated early because: ${rejections[exampleId]}`;
                }
            }
        }

        return text;
    },

    // Main recommendation wrapper
    recommend: function(commodity, lang = 'en') {
        let filterResult = this.hardFilter(commodity, DB.materials);
        let ranked = this.runTOPSIS(commodity, filterResult.survivors);
        
        let explanation = "";
        if (ranked.length > 0) {
            explanation = this.generateExplanation(ranked[0], commodity, filterResult.rejections, lang);
        } else {
            explanation = (lang === 'hi') ? "कोई सामग्री सभी भौतिक बाधाओं को पार नहीं कर पाई।" : "No materials passed all physical constraints.";
        }

        return {
            recommendations: ranked.slice(0, 3), // Return top 3
            rejections: filterResult.rejections,
            explanation: explanation
        };
    }
};

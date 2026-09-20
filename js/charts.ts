const Charts = {
    radarInstance: null,
    shelfLifeInstance: null,

    validateRadarData: function(datasets) {
        const invalid = datasets.some(dataset => dataset.data.length !== 5 || dataset.data.some(value => !Number.isFinite(value) || value < 0 || value > 10));
        if (invalid) {
            throw new Error('Radar chart received invalid normalized scores. Expected five finite values from 0 to 10 per material.');
        }
    },

    renderRadar: function(canvasId, materials) {
        const ctx = (document.getElementById(canvasId) as HTMLCanvasElement).getContext('2d');
        
        if (this.radarInstance) {
            this.radarInstance.destroy();
        }

        const maxCost = Math.max(...materials.map(mat => mat.metrics?.cost || mat.costPerM2 || 1));
        const datasets = materials.map((mat, index) => {
            const metrics = mat.metrics || {};
            const barrier = Math.min(10, Math.max(0, (metrics.barrier ?? 50) / 10));
            const cost = Math.min(10, Math.max(0, 10 * (1 - ((metrics.cost ?? mat.costPerM2 ?? maxCost) / maxCost))));
            const sustainability = Math.min(10, Math.max(0, (metrics.sustainability ?? 50) / 10));
            const tempRange = Math.min(10, Math.max(0, ((mat.tempRange[1] - mat.tempRange[0]) / 60) * 10));
            const suitability = Math.min(10, Math.max(0, (mat.topsisScore ?? 0) * 10));

            return {
                label: mat.name,
                data: [barrier, cost, sustainability, tempRange, suitability],
                backgroundColor: [
                    'rgba(24, 56, 71, 0.7)',
                    'rgba(95, 145, 136, 0.7)',
                    'rgba(184, 134, 76, 0.7)'
                ][index],
                borderColor: ['#183847', '#5f9188', '#b8864c'][index],
                borderWidth: 2,
                pointBackgroundColor: ['#183847', '#5f9188', '#b8864c'][index],
                fill: true
            };
        });

        this.validateRadarData(datasets);

        const data = {
            labels: ['Barrier', 'Cost Efficiency', 'Sustainability', 'Temp Range', 'Suitability'],
            datasets
        };

        this.radarInstance = new Chart(ctx, {
            type: 'radar',
            data: data,
            options: {
                responsive: true,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(24, 56, 71, 0.14)' },
                        grid: { color: 'rgba(24, 56, 71, 0.14)' },
                        pointLabels: { color: '#66808a', font: { family: 'Inter', size: 12 } },
                        min: 0,
                        max: 10,
                        ticks: { display: false }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#183847', font: { family: 'Inter' } } }
                }
            }
        });
    },

    renderShelfLife: function(canvasId, timelineData, unpackagedDays) {
        const ctx = (document.getElementById(canvasId) as HTMLCanvasElement).getContext('2d');
        
        if (this.shelfLifeInstance) {
            this.shelfLifeInstance.destroy();
        }

        const labels = timelineData.map(d => `Day ${d.day}`);
        const dataVals = timelineData.map(d => d.quality);

        this.shelfLifeInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Quality with Recommended Packaging',
                    data: dataVals,
                    borderColor: '#5f9188',
                    backgroundColor: 'rgba(95, 145, 136, 0.12)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Threshold (50%)',
                    data: Array(labels.length).fill(50),
                    borderColor: 'rgba(182, 95, 95, 0.5)',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(24, 56, 71, 0.14)' },
                        ticks: { color: '#66808a' },
                        title: { display: true, text: 'Quality Index (%)', color: '#66808a' }
                    },
                    x: {
                        grid: { color: 'rgba(24, 56, 71, 0.14)' },
                        ticks: { color: '#66808a' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#183847' } },
                    annotation: {
                        annotations: {
                            line1: {
                                type: 'line',
                                xMin: `Day ${unpackagedDays}`,
                                xMax: `Day ${unpackagedDays}`,
                                borderColor: '#f59e0b',
                                borderWidth: 2,
                                label: {
                                    content: 'Unpackaged End',
                                    enabled: true,
                                    position: 'top'
                                }
                            }
                        }
                    }
                }
            }
        });
    }
};

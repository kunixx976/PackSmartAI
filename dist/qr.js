const QR = {
    generate: function (containerId, data, lang = 'en') {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('QR container was not found.');
        }
        container.innerHTML = ''; // Clear previous
        // Generate structured JSON payload
        const packDate = new Date();
        const expiryDate = new Date(packDate.getTime() + data.shelfLife * 24 * 60 * 60 * 1000);
        const payload = {
            batchId: data.batchId || 'BCH-' + packDate.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
            commodity: data.commodityName,
            material: data.materialName,
            packDate: packDate.toISOString().split('T')[0],
            expiryDate: expiryDate.toISOString().split('T')[0],
            storageInstructions: `Keep at ${data.temp}°C and ${data.rh}% RH or below.`
        };
        const encodedPayload = JSON.stringify(payload);
        const qrLibrary = window.QRCode;
        if (typeof qrLibrary === 'function') {
            new qrLibrary(container, {
                text: encodedPayload,
                width: 200,
                height: 200,
                colorDark: '#183847',
                colorLight: '#ffffff',
                correctLevel: qrLibrary.CorrectLevel?.L
            });
            return payload;
        }
        // Keep traceability usable when the optional CDN library is unavailable.
        container.innerHTML = `<p class="qr-error">QR generator unavailable. Scan payload manually or reload with internet access.</p><pre class="qr-payload">${encodedPayload}</pre>`;
        return payload;
    }
};

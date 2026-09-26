const QR = {
    generate: function (containerId, data, lang = 'en') {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('QR container was not found.');
        }
        container.innerHTML = ''; // Clear previous
        const encodedPayload = String(data.traceUrl);
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
            return encodedPayload;
        }
        // Keep traceability usable when the optional CDN library is unavailable.
        container.innerHTML = `<p class="qr-error">QR generator unavailable. Scan payload manually or reload with internet access.</p><pre class="qr-payload">${encodedPayload}</pre>`;
        return encodedPayload;
    }
};

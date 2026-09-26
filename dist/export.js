"use strict";
const Export = {
    print: function () {
        // A simple prototype print functionality using window.print()
        // In a real app, you might use jsPDF to generate a stylized PDF.
        window.print();
    }
};
// Add print-specific CSS dynamically
const printStyle = document.createElement('style');
printStyle.textContent = `
    @media print {
        body { background: white !important; color: black !important; }
        .navbar, .form-container, .action-buttons, .hero { display: none !important; }
        .page-section { display: block !important; }
        #sec-home, #sec-analyze { display: none !important; }
        #sec-results { display: block !important; }
        .glass-card { 
            background: white !important; 
            border: 1px solid #ccc !important; 
            box-shadow: none !important; 
            page-break-inside: avoid;
            color: black !important;
        }
        .reco-rank { color: black !important; }
        .reco-details h4, .reco-details p { color: black !important; }
        canvas { max-width: 100% !important; }
        .gradient-text, .highlight { color: black !important; -webkit-text-fill-color: black !important; }
    }
`;
document.head.appendChild(printStyle);

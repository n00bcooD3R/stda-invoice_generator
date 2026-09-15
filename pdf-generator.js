/**
 * PDF Generator for Quotation Maker
 * Generates a Tally-style tax invoice/quotation PDF with STDA branding
 * Matches the layout from Geltec.pdf reference with header/footer from headerfooter_format.pdf
 */

// STDA Logo as base64 - will be loaded from the image file
let stda_logo_base64 = null;

// Pre-load the logo
(function loadLogo() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        stda_logo_base64 = canvas.toDataURL('image/png');
    };
    img.src = 'header_img_0_0.png';
})();

/**
 * Main PDF generation function
 * @param {Object} data - Collected form data
 * @param {boolean} preview - If true, opens in new tab; if false, downloads
 */
function generateQuotationPDF(data, preview = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const navy = [31, 83, 121];        // #1F5379
    const black = [0, 0, 0];
    const gray = [100, 100, 100];
    const lightGray = [200, 200, 200];
    const white = [255, 255, 255];
    const tableBorder = [0, 0, 0];

    let y = margin;

    // ===================== HELPER FUNCTIONS =====================

    function setFont(style = 'normal', size = 10) {
        doc.setFontSize(size);
        if (style === 'bold') {
            doc.setFont('helvetica', 'bold');
        } else if (style === 'italic') {
            doc.setFont('helvetica', 'italic');
        } else if (style === 'bolditalic') {
            doc.setFont('helvetica', 'bolditalic');
        } else {
            doc.setFont('helvetica', 'normal');
        }
    }

    function setColor(rgb) {
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    }

    function drawLine(x1, y1, x2, y2, width = 0.3) {
        doc.setLineWidth(width);
        doc.setDrawColor(0, 0, 0);
        doc.line(x1, y1, x2, y2);
    }

    function drawRect(x, y, w, h, fill = null, border = true) {
        if (fill) {
            doc.setFillColor(fill[0], fill[1], fill[2]);
            doc.rect(x, y, w, h, border ? 'FD' : 'F');
        }
        if (border) {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.rect(x, y, w, h, fill ? undefined : 'S');
        }
    }

    function addText(text, x, yPos, options = {}) {
        const { align = 'left', maxWidth = null } = options;
        if (maxWidth) {
            doc.text(text || '', x, yPos, { maxWidth, align });
        } else {
            doc.text(text || '', x, yPos, { align });
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const mon = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${mon}-${year}`;
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(d.getDate()).padStart(2, '0');
        return `${day}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    }

    function fmtNum(num) {
        if (isNaN(num) || num === 0) return '0.00';
        const parts = num.toFixed(2).split('.');
        let intPart = parts[0];
        const decPart = parts[1];
        let sign = '';
        if (intPart.startsWith('-')) {
            sign = '-';
            intPart = intPart.substring(1);
        }
        if (intPart.length > 3) {
            const last3 = intPart.slice(-3);
            const rest = intPart.slice(0, -3);
            const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
            intPart = formatted + ',' + last3;
        }
        return sign + intPart + '.' + decPart;
    }

    // Quantity formatting (total qty with unit)
    function totalQty(items) {
        const total = items.reduce((sum, item) => sum + item.quantity, 0);
        return `${total} ${items.length > 0 ? items[0].unit : 'nos'}`;
    }

    // ===================== DRAW HEADER (STDA branding) =====================
    function drawHeader() {
        // Logo
        if (stda_logo_base64) {
            doc.addImage(stda_logo_base64, 'PNG', margin, y, 16, 14);
        }

        // Company name
        setFont('bold', 14);
        setColor(navy);
        addText('SENSOTECH DESIGN AND AUTOMATION', margin + 19, y + 6);

        // Address line 1
        setFont('normal', 8);
        setColor(black);
        addText('Suprabhath Nagara, Karihobanahalli, Thigalarapalya Main Road, Peenya Industrial Area', margin + 19, y + 11);

        // Address line 2
        addText('Bengaluru-560058', margin + 19, y + 15);

        // Contact
        setFont('normal', 8);
        setColor(navy);
        addText('Tel: +91 8884676895     Email: sales@stda.in', margin + 19, y + 19);

        y += 24;

        // Horizontal line under header
        drawLine(margin, y, pageWidth - margin, y, 0.5);
        y += 3;
    }

    // ===================== DRAW TITLE =====================
    function drawTitle() {
        setFont('bold', 14);
        setColor(black);
        addText('Quotation', pageWidth / 2, y + 4, { align: 'center' });
        y += 10;
    }

    // ===================== DRAW CONSIGNEE & BUYER SECTION =====================
    function drawBuyerConsignee() {
        const boxHeight = 38;
        const halfWidth = contentWidth / 2;

        // Outer border
        drawRect(margin, y, contentWidth, boxHeight);

        // Vertical divider
        drawLine(margin + halfWidth, y, margin + halfWidth, y + boxHeight);

        // Consignee (Ship to) - Left
        const cx = margin + 2;
        let cy = y + 4;
        setFont('bold', 8);
        setColor(black);
        addText('Consignee (Ship to)', cx, cy);
        cy += 4;
        setFont('bold', 9);
        addText(data.consignee.name || '', cx, cy);
        cy += 4;
        setFont('normal', 7.5);
        setColor(gray);
        const consAddr = doc.splitTextToSize(data.consignee.address || '', halfWidth - 6);
        consAddr.forEach(line => {
            addText(line, cx, cy);
            cy += 3.2;
        });
        if (data.consignee.state) {
            addText(`${data.consignee.state}${data.consignee.stateCode ? ' - ' + data.consignee.stateCode : ''}, India`, cx, cy);
            cy += 3.5;
        }
        setFont('normal', 7.5);
        setColor(black);
        if (data.consignee.gstin) {
            addText(`GSTIN/UIN`, cx, cy);
            addText(`: ${data.consignee.gstin}`, cx + 22, cy);
            cy += 3.5;
        }
        if (data.consignee.state) {
            addText(`State Name`, cx, cy);
            addText(`: ${data.consignee.state}, Code : ${data.consignee.stateCode || ''}`, cx + 22, cy);
        }

        // Buyer (Bill to) - Right
        const bx = margin + halfWidth + 2;
        let by = y + 4;
        setFont('bold', 8);
        setColor(black);
        addText('Buyer (Bill to)', bx, by);
        by += 4;
        setFont('bold', 9);
        addText(data.buyer.name || '', bx, by);
        by += 4;
        setFont('normal', 7.5);
        setColor(gray);
        const buyAddr = doc.splitTextToSize(data.buyer.address || '', halfWidth - 6);
        buyAddr.forEach(line => {
            addText(line, bx, by);
            by += 3.2;
        });
        if (data.buyer.state) {
            addText(`${data.buyer.state}${data.buyer.stateCode ? ' - ' + data.buyer.stateCode : ''}, India`, bx, by);
            by += 3.5;
        }
        setFont('normal', 7.5);
        setColor(black);
        if (data.buyer.gstin) {
            addText(`GSTIN/UIN`, bx, by);
            addText(`: ${data.buyer.gstin}`, bx + 22, by);
            by += 3.5;
        }
        if (data.buyer.state) {
            addText(`State Name`, bx, by);
            addText(`: ${data.buyer.state}, Code : ${data.buyer.stateCode || ''}`, bx + 22, by);
        }

        y += boxHeight;
    }

    // ===================== DRAW DETAILS GRID =====================
    function drawDetailsGrid() {
        const rowH = 8;
        const halfWidth = contentWidth / 2;
        const thirdWidth = contentWidth / 3;

        // Row 1: Quotation No. | Delivery Note | Reference No. & Date
        drawRect(margin, y, thirdWidth, rowH);
        drawRect(margin + thirdWidth, y, thirdWidth, rowH);
        drawRect(margin + thirdWidth * 2, y, thirdWidth, rowH);

        setFont('normal', 7);
        setColor(gray);
        addText('Quotation No.', margin + 2, y + 3);
        addText('Delivery Note', margin + thirdWidth + 2, y + 3);
        addText('Reference No. & Date.', margin + thirdWidth * 2 + 2, y + 3);

        setFont('bold', 7.5);
        setColor(black);
        addText(data.quotationNo, margin + 2, y + 7);
        addText(data.deliveryNote, margin + thirdWidth + 2, y + 7);
        addText(data.referenceNo, margin + thirdWidth * 2 + 2, y + 7);

        y += rowH;

        // Row 2: Buyer's Order No. | Dispatch Doc No. | Dispatched through
        drawRect(margin, y, thirdWidth, rowH);
        drawRect(margin + thirdWidth, y, thirdWidth, rowH);
        drawRect(margin + thirdWidth * 2, y, thirdWidth, rowH);

        setFont('normal', 7);
        setColor(gray);
        addText("Buyer's Order No.", margin + 2, y + 3);
        addText('Dispatch Doc No.', margin + thirdWidth + 2, y + 3);
        addText('Dispatched through', margin + thirdWidth * 2 + 2, y + 3);

        setFont('bold', 7.5);
        setColor(black);
        addText(data.buyerOrderNo, margin + 2, y + 7);
        addText(data.dispatchDocNo, margin + thirdWidth + 2, y + 7);
        addText(data.dispatchedThrough, margin + thirdWidth * 2 + 2, y + 7);

        y += rowH;

        // Row 3: Dated | Mode/Terms of Payment | Dated (buyer order)
        drawRect(margin, y, thirdWidth, rowH);
        drawRect(margin + thirdWidth, y, thirdWidth, rowH);
        drawRect(margin + thirdWidth * 2, y, thirdWidth, rowH);

        setFont('normal', 7);
        setColor(gray);
        addText('Dated', margin + 2, y + 3);
        addText('Mode/Terms of Payment', margin + thirdWidth + 2, y + 3);
        addText('Other References', margin + thirdWidth * 2 + 2, y + 3);

        setFont('bold', 7.5);
        setColor(black);
        addText(formatDateShort(data.date), margin + 2, y + 7);
        setFont('normal', 7);
        addText(data.paymentTerms, margin + thirdWidth + 2, y + 7);
        addText(data.otherReferences, margin + thirdWidth * 2 + 2, y + 7);

        y += rowH;

        // Row 4: Dated (buyer order) | Delivery Note Date | Destination | Terms of Delivery
        const qtrWidth = contentWidth / 4;
        drawRect(margin, y, qtrWidth, rowH);
        drawRect(margin + qtrWidth, y, qtrWidth, rowH);
        drawRect(margin + qtrWidth * 2, y, qtrWidth, rowH);
        drawRect(margin + qtrWidth * 3, y, qtrWidth, rowH);

        setFont('normal', 7);
        setColor(gray);
        addText('Dated', margin + 2, y + 3);
        addText('Delivery Note Date', margin + qtrWidth + 2, y + 3);
        addText('Destination', margin + qtrWidth * 2 + 2, y + 3);
        addText('Terms of Delivery', margin + qtrWidth * 3 + 2, y + 3);

        setFont('bold', 7.5);
        setColor(black);
        addText(formatDateShort(data.buyerOrderDate), margin + 2, y + 7);
        addText(formatDateShort(data.deliveryNoteDate), margin + qtrWidth + 2, y + 7);
        addText(data.destination, margin + qtrWidth * 2 + 2, y + 7);
        addText(data.termsDelivery, margin + qtrWidth * 3 + 2, y + 7);

        y += rowH;
    }

    // ===================== DRAW ITEMS TABLE =====================
    function drawItemsTable() {
        // Column positions (from left)
        const cols = {
            sl: { x: margin, w: 10 },
            desc: { x: margin + 10, w: 65 },
            hsn: { x: margin + 75, w: 20 },
            qty: { x: margin + 95, w: 18 },
            rate: { x: margin + 113, w: 25 },
            per: { x: margin + 138, w: 12 },
            disc: { x: margin + 150, w: 16 },
            amount: { x: margin + 166, w: contentWidth - 166 }
        };

        const headerH = 8;

        // Table header
        drawRect(margin, y, contentWidth, headerH);
        setFont('bold', 7);
        setColor(black);

        const headerY = y + 3;
        addText('Sl', cols.sl.x + cols.sl.w / 2, headerY, { align: 'center' });
        addText('No.', cols.sl.x + cols.sl.w / 2, headerY + 3, { align: 'center' });
        addText('Description of', cols.desc.x + 2, headerY);
        addText('Services', cols.desc.x + 2, headerY + 3);
        addText('HSN/SAC', cols.hsn.x + 2, headerY + 1.5);
        addText('Quantity', cols.qty.x + 2, headerY + 1.5);
        addText('Rate', cols.rate.x + 2, headerY + 1.5);
        addText('per', cols.per.x + 2, headerY + 1.5);
        addText('Disc. %', cols.disc.x + 2, headerY + 1.5);
        addText('Amount', cols.amount.x + 2, headerY + 1.5);

        // Column separator lines in header
        Object.values(cols).forEach(col => {
            drawLine(col.x, y, col.x, y + headerH);
        });
        drawLine(margin + contentWidth, y, margin + contentWidth, y + headerH);

        y += headerH;

        // Items rows
        const itemStartY = y;
        data.items.forEach((item, idx) => {
            const descLines = doc.splitTextToSize(item.description || '', cols.desc.w - 4);
            const rowH = Math.max(8, descLines.length * 3.5 + 4);

            // Check page break
            if (y + rowH > pageHeight - 80) {
                // Draw borders for remaining space
                const remainingH = pageHeight - 80 - y;
                if (remainingH > 0) {
                    drawRect(margin, y, contentWidth, remainingH);
                    Object.values(cols).forEach(col => {
                        drawLine(col.x, y, col.x, y + remainingH);
                    });
                    drawLine(margin + contentWidth, y, margin + contentWidth, y + remainingH);
                }
                drawFooter();
                doc.addPage();
                y = margin;
                drawHeader();
                y += 2;
            }

            // Row background for alternating (subtle)
            // Draw row
            setFont('normal', 8);
            setColor(black);

            const rowY = y + 5;

            // Sl No.
            addText(String(idx + 1), cols.sl.x + cols.sl.w / 2, rowY, { align: 'center' });

            // Description (multi-line)
            setFont('normal', 8);
            let descY = y + 4;
            descLines.forEach(line => {
                addText(line, cols.desc.x + 2, descY);
                descY += 3.5;
            });

            // HSN/SAC
            addText(item.hsn, cols.hsn.x + 2, rowY);

            // Quantity
            addText(`${item.quantity} ${item.unit}`, cols.qty.x + 2, rowY);

            // Rate
            addText(fmtNum(item.rate), cols.rate.x + cols.rate.w - 2, rowY, { align: 'right' });

            // Per
            addText(item.unit, cols.per.x + 2, rowY);

            // Discount
            if (item.discount > 0) {
                addText(`${item.discount}%`, cols.disc.x + 2, rowY);
            }

            // Amount
            setFont('bold', 8);
            addText(fmtNum(item.amount), margin + contentWidth - 2, rowY, { align: 'right' });

            // Row bottom line
            drawLine(margin, y + rowH, margin + contentWidth, y + rowH);

            // Column lines
            Object.values(cols).forEach(col => {
                drawLine(col.x, y, col.x, y + rowH);
            });
            drawLine(margin + contentWidth, y, margin + contentWidth, y + rowH);

            y += rowH;
        });

        // GST rows
        const gstRowH = 7;
        const gstRate = data.gstRate;

        if (data.gstType === 'intra') {
            // CGST row
            drawLine(margin, y + gstRowH, margin + contentWidth, y + gstRowH);
            Object.values(cols).forEach(col => drawLine(col.x, y, col.x, y + gstRowH));
            drawLine(margin + contentWidth, y, margin + contentWidth, y + gstRowH);

            setFont('normal', 8);
            setColor(black);
            addText(`CGST Output Tax  @ ${gstRate / 2}%`, cols.desc.x + 2, y + 5);
            addText(String(gstRate / 2), cols.disc.x + 2, y + 5);
            addText('%', cols.per.x + 2, y + 5);
            setFont('bold', 8);
            addText(fmtNum(data.cgst), margin + contentWidth - 2, y + 5, { align: 'right' });
            y += gstRowH;

            // SGST row
            drawLine(margin, y + gstRowH, margin + contentWidth, y + gstRowH);
            Object.values(cols).forEach(col => drawLine(col.x, y, col.x, y + gstRowH));
            drawLine(margin + contentWidth, y, margin + contentWidth, y + gstRowH);

            setFont('normal', 8);
            setColor(black);
            addText(`SGST Output Tax  @ ${gstRate / 2}%`, cols.desc.x + 2, y + 5);
            addText(String(gstRate / 2), cols.disc.x + 2, y + 5);
            addText('%', cols.per.x + 2, y + 5);
            setFont('bold', 8);
            addText(fmtNum(data.sgst), margin + contentWidth - 2, y + 5, { align: 'right' });
            y += gstRowH;
        } else {
            // IGST row
            drawLine(margin, y + gstRowH, margin + contentWidth, y + gstRowH);
            Object.values(cols).forEach(col => drawLine(col.x, y, col.x, y + gstRowH));
            drawLine(margin + contentWidth, y, margin + contentWidth, y + gstRowH);

            setFont('normal', 8);
            setColor(black);
            addText(`IGST Output Tax  @ ${gstRate}%`, cols.desc.x + 2, y + 5);
            addText(String(gstRate), cols.disc.x + 2, y + 5);
            addText('%', cols.per.x + 2, y + 5);
            setFont('bold', 8);
            addText(fmtNum(data.igst), margin + contentWidth - 2, y + 5, { align: 'right' });
            y += gstRowH;
        }

        // Total row
        const totalRowH = 9;
        drawRect(margin, y, contentWidth, totalRowH);
        Object.values(cols).forEach(col => drawLine(col.x, y, col.x, y + totalRowH));
        drawLine(margin + contentWidth, y, margin + contentWidth, y + totalRowH);

        setFont('bold', 9);
        setColor(black);
        addText('Total', cols.desc.x + cols.desc.w - 2, y + 6, { align: 'right' });

        // Total quantity
        setFont('normal', 8);
        addText(totalQty(data.items), cols.qty.x + 2, y + 6);

        // Grand total with rupee symbol
        setFont('bold', 9);
        addText(`Rs. ${fmtNum(data.grandTotal)}`, margin + contentWidth - 2, y + 6, { align: 'right' });

        y += totalRowH;
    }

    // ===================== DRAW AMOUNT IN WORDS =====================
    function drawAmountInWords() {
        const rowH = 8;
        drawRect(margin, y, contentWidth, rowH);

        setFont('normal', 7);
        setColor(black);
        addText('Amount Chargeable (in words)', margin + 2, y + 3);

        setFont('bold', 8);
        addText(`INR ${numberToWords(data.grandTotal)} Only`, margin + 2, y + 7);

        // E. & O.E
        setFont('italic', 7);
        setColor(gray);
        addText('E. & O.E', margin + contentWidth - 2, y + 7, { align: 'right' });

        y += rowH;
    }

    // ===================== DRAW HSN SUMMARY TABLE =====================
    function drawHSNSummary() {
        // Group by HSN
        const hsnMap = {};
        data.items.forEach(item => {
            const hsn = item.hsn || 'N/A';
            if (!hsnMap[hsn]) {
                hsnMap[hsn] = { taxableValue: 0 };
            }
            hsnMap[hsn].taxableValue += item.amount;
        });

        const headerH = 8;
        const hsnCols = {
            hsn: { x: margin, w: 30 },
            taxable: { x: margin + 30, w: 30 },
            centralRate: { x: margin + 60, w: 20 },
            centralAmt: { x: margin + 80, w: 25 },
            stateRate: { x: margin + 105, w: 20 },
            stateAmt: { x: margin + 125, w: 25 },
            total: { x: margin + 150, w: contentWidth - 150 }
        };

        // Header row
        drawRect(margin, y, contentWidth, headerH);

        setFont('bold', 7);
        setColor(black);

        addText('HSN/SAC', hsnCols.hsn.x + 2, y + 3);
        addText('Taxable', hsnCols.taxable.x + 2, y + 3);
        addText('Value', hsnCols.taxable.x + 2, y + 6.5);

        if (data.gstType === 'intra') {
            addText('Central Tax', hsnCols.centralRate.x + 2, y + 3);
            addText('Rate', hsnCols.centralRate.x + 2, y + 6.5);
            addText('Amount', hsnCols.centralAmt.x + 2, y + 6.5);
            addText('State Tax', hsnCols.stateRate.x + 2, y + 3);
            addText('Rate', hsnCols.stateRate.x + 2, y + 6.5);
            addText('Amount', hsnCols.stateAmt.x + 2, y + 6.5);
        } else {
            addText('Integrated Tax', hsnCols.centralRate.x + 2, y + 3);
            addText('Rate', hsnCols.centralRate.x + 2, y + 6.5);
            addText('Amount', hsnCols.centralAmt.x + 2, y + 6.5);
        }
        addText('Total', hsnCols.total.x + 2, y + 3);
        addText('Tax Amount', hsnCols.total.x + 2, y + 6.5);

        // Column lines
        Object.values(hsnCols).forEach(col => drawLine(col.x, y, col.x, y + headerH));
        drawLine(margin + contentWidth, y, margin + contentWidth, y + headerH);

        y += headerH;

        // Data rows
        const halfRate = data.gstRate / 2;
        let totalTaxable = 0;
        let totalCentral = 0;
        let totalState = 0;
        let totalTax = 0;

        Object.entries(hsnMap).forEach(([hsn, val]) => {
            const rowH = 7;
            drawRect(margin, y, contentWidth, rowH);
            Object.values(hsnCols).forEach(col => drawLine(col.x, y, col.x, y + rowH));
            drawLine(margin + contentWidth, y, margin + contentWidth, y + rowH);

            const taxable = val.taxableValue;
            let central, state, tax;

            if (data.gstType === 'intra') {
                central = taxable * halfRate / 100;
                state = taxable * halfRate / 100;
                tax = central + state;
            } else {
                central = taxable * data.gstRate / 100;
                state = 0;
                tax = central;
            }

            totalTaxable += taxable;
            totalCentral += central;
            totalState += state;
            totalTax += tax;

            setFont('normal', 7.5);
            setColor(black);
            addText(hsn, hsnCols.hsn.x + 2, y + 5);
            addText(fmtNum(taxable), hsnCols.taxable.x + hsnCols.taxable.w - 2, y + 5, { align: 'right' });
            addText(`${data.gstType === 'intra' ? halfRate : data.gstRate}%`, hsnCols.centralRate.x + 2, y + 5);
            addText(fmtNum(central), hsnCols.centralAmt.x + hsnCols.centralAmt.w - 2, y + 5, { align: 'right' });

            if (data.gstType === 'intra') {
                addText(`${halfRate}%`, hsnCols.stateRate.x + 2, y + 5);
                addText(fmtNum(state), hsnCols.stateAmt.x + hsnCols.stateAmt.w - 2, y + 5, { align: 'right' });
            }

            addText(fmtNum(tax), hsnCols.total.x + hsnCols.total.w - 2, y + 5, { align: 'right' });

            y += rowH;
        });

        // Total row
        const totRowH = 7;
        drawRect(margin, y, contentWidth, totRowH);
        Object.values(hsnCols).forEach(col => drawLine(col.x, y, col.x, y + totRowH));
        drawLine(margin + contentWidth, y, margin + contentWidth, y + totRowH);

        setFont('bold', 7.5);
        setColor(black);
        addText('Total', hsnCols.hsn.x + 2, y + 5);
        addText(fmtNum(totalTaxable), hsnCols.taxable.x + hsnCols.taxable.w - 2, y + 5, { align: 'right' });
        addText(fmtNum(totalCentral), hsnCols.centralAmt.x + hsnCols.centralAmt.w - 2, y + 5, { align: 'right' });
        if (data.gstType === 'intra') {
            addText(fmtNum(totalState), hsnCols.stateAmt.x + hsnCols.stateAmt.w - 2, y + 5, { align: 'right' });
        }
        addText(fmtNum(totalTax), hsnCols.total.x + hsnCols.total.w - 2, y + 5, { align: 'right' });

        y += totRowH;

        // Tax amount in words
        const wordsRowH = 7;
        drawRect(margin, y, contentWidth, wordsRowH);
        setFont('normal', 7);
        setColor(black);
        addText(`Tax Amount (in words)  : INR ${numberToWords(Math.round(totalTax))} Only`, margin + 2, y + 5);
        y += wordsRowH;
    }

    // ===================== DRAW BANK DETAILS & DECLARATION =====================
    function drawBankAndDeclaration() {
        const boxH = 36;
        const halfWidth = contentWidth / 2;

        drawRect(margin, y, contentWidth, boxH);
        drawLine(margin + halfWidth, y, margin + halfWidth, y + boxH);

        // Left side: Declaration + Bank Details
        let lx = margin + 2;
        let ly = y + 4;

        setFont('bold', 7);
        setColor(black);
        addText('Declaration', lx, ly);
        ly += 3.5;
        setFont('normal', 7);
        setColor(gray);
        const declLines = doc.splitTextToSize(data.declaration || '', halfWidth - 6);
        declLines.forEach(line => {
            addText(line, lx, ly);
            ly += 3;
        });

        ly += 2;
        setFont('bold', 7);
        setColor(black);
        addText("Company's Bank Details", lx, ly);
        ly += 4;

        setFont('normal', 7);
        setColor(black);
        if (data.bankHolder) {
            addText("A/c Holder's Name", lx, ly);
            addText(`: ${data.bankHolder}`, lx + 30, ly);
            ly += 3.5;
        }
        if (data.bankName) {
            addText('Bank Name', lx, ly);
            addText(`: ${data.bankName}`, lx + 30, ly);
            ly += 3.5;
        }
        if (data.bankAccount) {
            addText('A/c No.', lx, ly);
            addText(`: ${data.bankAccount}`, lx + 30, ly);
            ly += 3.5;
        }
        if (data.bankIFSC) {
            addText('Branch & IFS Code', lx, ly);
            addText(`: ${data.bankIFSC}`, lx + 30, ly);
            ly += 3.5;
        }
        if (data.bankSwift) {
            addText('SWIFT Code', lx, ly);
            addText(`: ${data.bankSwift}`, lx + 30, ly);
        }

        // Right side: Signatures
        const rx = margin + halfWidth + 2;
        let ry = y + 4;

        setFont('bold', 7.5);
        setColor(black);
        addText("Customer's Seal and Signature", rx, ry);

        // Bottom right - Authorized signatory
        ry = y + boxH - 10;
        addText('for SensoTech Design & Automation', rx, ry);
        ry += 6;
        setFont('normal', 7);
        addText('Authorised Signatory', rx, ry);

        y += boxH;
    }

    // ===================== DRAW FOOTER =====================
    function drawFooter() {
        const footerY = pageHeight - 12;

        // Footer line
        drawLine(margin, footerY - 2, pageWidth - margin, footerY - 2, 0.3);

        setFont('normal', 7);
        setColor([90, 90, 90]);
        addText('SENSOTECH DESIGN AND AUTOMATION  |  Suprabhath Nagara, Karihobanahalli, Peenya Industrial Area, Bangalore - 560058',
            pageWidth / 2, footerY, { align: 'center' });
        addText('Tel: +91 8884676895   Email: sales@stda.in', pageWidth / 2, footerY + 4, { align: 'center' });

        // Page number
        const pageNum = doc.internal.getNumberOfPages();
        addText(`Page ${pageNum}`, pageWidth - margin, footerY + 4, { align: 'right' });

        // Computer generated note
        setFont('italic', 6.5);
        setColor(gray);
        addText('This is a Computer Generated Quotation', pageWidth / 2, footerY + 8, { align: 'center' });
    }

    // ===================== GENERATE PDF =====================

    drawHeader();
    drawTitle();
    drawBuyerConsignee();
    drawDetailsGrid();
    drawItemsTable();
    drawAmountInWords();

    // Check if we need a page break before HSN summary
    if (y + 50 > pageHeight - 20) {
        drawFooter();
        doc.addPage();
        y = margin;
        drawHeader();
        y += 5;
    }

    drawHSNSummary();

    // Check if we need a page break before bank details
    if (y + 40 > pageHeight - 20) {
        drawFooter();
        doc.addPage();
        y = margin;
        drawHeader();
        y += 5;
    }

    drawBankAndDeclaration();
    drawFooter();

    // ===================== OUTPUT =====================
    if (preview) {
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        window.open(url, '_blank');
    } else {
        const filename = `Quotation_${data.quotationNo.replace(/[\/\\]/g, '_')}_${formatDate(data.date)}.pdf`;
        doc.save(filename);
    }
}

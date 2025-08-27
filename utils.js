const COMPANY_TAX_RATE = 0.30;

export function formatWithCommas(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
    const str = value.toString();
    if (!/^[-+]?\d*(\.\d+)?$/.test(str)) return value; // not a plain number string
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

export function formatMoney(val, opts = {}) {
    const { hideZero = false, decimals } = opts; // if decimals supplied explicitly, override adaptive logic
    if (val === null || val === undefined) return '';
    const n = Number(val);
    if (!isFinite(n)) return '';
    if (hideZero && n === 0) return '';
    // Adaptive decimals: < 1 cent show 3 decimals (e.g., $0.005), otherwise 2.
    const useDecimals = (typeof decimals === 'number') ? decimals : (Math.abs(n) < 0.01 && n !== 0 ? 3 : 2);
    const fixed = n.toFixed(useDecimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + parts.join('.');
}

export function formatPercent(val, opts = {}) {
    const { maxDecimals = 2 } = opts; // allow specifying maximum decimals
    if (val === null || val === undefined) return '';
    const n = Number(val);
    if (!isFinite(n)) return '';
    // Show whole number when no fractional component (e.g., 100 instead of 100.00)
    if (Math.abs(n % 1) < 1e-9) return n.toFixed(0) + '%';
    return n.toFixed(maxDecimals) + '%';
}

export function formatAdaptivePrice(value, opts = {}) {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    const n = Number(value);
    if (opts.force2) return n.toFixed(2);
    if (opts.userRaw) {
        const m = String(opts.userRaw).trim().match(/^[-+]?\d+(?:\.(\d{1,3}))?$/);
        if (m && m[1] && m[1].length > 2) return n.toFixed(Math.min(3, m[1].length));
    }
    return n.toFixed(2);
}

export function formatAdaptivePercent(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return '0.00';
    const n = Number(pct);
    const abs = Math.abs(n);
    // Use 3 decimals for very small magnitudes (under 0.1%), else 2
    const decimals = (abs > 0 && abs < 0.1) ? 3 : 2;
    return n.toFixed(decimals);
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function calculateUnfrankedYield(dividendAmount, currentPrice) {
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount < 0) { return 0; }
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return 0; }
    return (dividendAmount / currentPrice) * 100;
}

export function calculateFrankedYield(dividendAmount, currentPrice, frankingCreditsPercentage) {
    if (typeof dividendAmount !== 'number' || isNaN(dividendAmount) || dividendAmount < 0) { return 0; }
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) { return 0; }
    if (typeof frankingCreditsPercentage !== 'number' || isNaN(frankingCreditsPercentage) || frankingCreditsPercentage < 0 || frankingCreditsPercentage > 100) { return 0; }
    const unfrankedYield = calculateUnfrankedYield(dividendAmount, currentPrice);
    if (unfrankedYield === 0) return 0;
    const frankingRatio = frankingCreditsPercentage / 100;
    const frankingCreditPerShare = dividendAmount * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE)) * frankingRatio;
    const grossedUpDividend = dividendAmount + frankingCreditPerShare;
    return (grossedUpDividend / currentPrice) * 100;
}

export function isAsxMarketOpen() {
    try {
        const override = localStorage.getItem('marketStatusOverride');
        if (override === 'open') return true;
        if (override === 'closed') return false;
    } catch (e) { /* ignore */ }
    return true;
}

export function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }
    return stringValue;
}
  

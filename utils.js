const COMPANY_TAX_RATE = 0.30;

export function formatMoney(amount, options = {}) {
    const { hideZero = false, force2 = false } = options;
    if (amount === null || amount === undefined || isNaN(Number(amount))) return '';
    if (hideZero && Number(amount) === 0) return '';
    const num = Number(amount);
    if (force2) return num.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
    return num.toLocaleString('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function formatPercent(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toFixed(2);
}

export function formatAdaptivePrice(value, options = {}) {
    if (typeof value !== 'number' || isNaN(value)) return '';
    const { force2 = false } = options;
    const absValue = Math.abs(value);
    if (force2) return value.toFixed(2);
    if (absValue > 1000) return value.toFixed(0);
    if (absValue > 100) return value.toFixed(1);
    if (absValue < 1 && absValue > 0) return value.toFixed(3);
    return value.toFixed(2);
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

export function calculateFrankedYield(dividendAmount, currentPrice, frankingCredits) {
    if (typeof dividendAmount !== 'number' || typeof currentPrice !== 'number' || typeof frankingCredits !== 'number' ||
        isNaN(dividendAmount) || isNaN(currentPrice) || isNaN(frankingCredits) || currentPrice === 0) {
        return null;
    }

    if (frankingCredits === 0) {
        return calculateUnfrankedYield(dividendAmount, currentPrice);
    }

    const companyTaxRate = 0.30;
    const frankedDividend = dividendAmount / (1 - companyTaxRate);
    const frankingCreditAmount = frankedDividend - dividendAmount;
    const grossedUpDividend = dividendAmount + (frankingCreditAmount * (frankingCredits / 100));

    const frankedYield = (grossedUpDividend / currentPrice) * 100;

    return frankedYield;
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

export function formatWithCommas(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
    const str = value.toString();
    if (!/^[-+]?\d*(\.\d+)?$/.test(str)) return value; // not a plain number string
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

export function estimateDividendIncome(investmentValue, dividendAmountPerShare, currentPricePerShare) {
    if (typeof investmentValue !== 'number' || isNaN(investmentValue) || investmentValue <= 0) { return null; }
    if (typeof dividendAmountPerShare !== 'number' || isNaN(dividendAmountPerShare) || dividendAmountPerShare <= 0) { return null; }
    if (typeof currentPricePerShare !== 'number' || isNaN(currentPricePerShare) || currentPricePerShare <= 0) { return null; }
    const numberOfShares = investmentValue / currentPricePerShare;
    return numberOfShares * dividendAmountPerShare;
}

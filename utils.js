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

export function formatAdaptivePercent(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    const absValue = Math.abs(value);
    if (absValue < 0.01 && absValue > 0) return value.toFixed(4);
    if (absValue > 1000) return value.toFixed(0);
    return value.toFixed(2);
}

export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

export function calculateUnfrankedYield(dividendAmount, currentPrice) {
    if (!dividendAmount || !currentPrice) return null;
    return (dividendAmount / currentPrice) * 100;
}

export function calculateFrankedYield(dividendAmount, currentPrice, frankingCredits) {
    console.log('[Calc] Franked Yield Input:', { dividendAmount, currentPrice, frankingCredits });
    if (typeof dividendAmount !== 'number' || typeof currentPrice !== 'number' || typeof frankingCredits !== 'number' ||
        isNaN(dividendAmount) || isNaN(currentPrice) || isNaN(frankingCredits) || currentPrice === 0) {
        console.log('[Calc] Franked Yield: Invalid or missing input, returning null.');
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

    console.log('[Calc] Franked Yield Result:', { grossedUpDividend, frankedYield });
    return frankedYield;
}

export function isAsxMarketOpen() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    if (day >= 1 && day <= 5) {
        if (hour >= 10 && hour < 16) {
            return true;
        }
    }
    return false;
}

export function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    let stringValue = String(value);
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
        stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

export function formatWithCommas(value) {
    if (typeof value !== 'number' || isNaN(value)) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function estimateDividendIncome(investmentValue, dividendAmountPerShare, currentPricePerShare) {
    if (typeof investmentValue !== 'number' || isNaN(investmentValue) || investmentValue <= 0) { return null; }
    if (typeof dividendAmountPerShare !== 'number' || isNaN(dividendAmountPerShare) || dividendAmountPerShare <= 0) { return null; }
    if (typeof currentPricePerShare !== 'number' || isNaN(currentPricePerShare) || currentPricePerShare <= 0) { return null; }
    const numberOfShares = investmentValue / currentPricePerShare;
    return numberOfShares * dividendAmountPerShare;
}

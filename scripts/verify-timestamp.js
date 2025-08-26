const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const indexPath = path.join(repoRoot, 'index.html');
const cssPath = path.join(repoRoot, 'style.css');

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 2; }
function pass(msg) { console.log('PASS:', msg); }

try {
    if (!fs.existsSync(indexPath)) return fail('index.html not found at ' + indexPath);
    if (!fs.existsSync(cssPath)) return fail('style.css not found at ' + cssPath);

    const html = fs.readFileSync(indexPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Check for livePriceTimestampContainer with expected class
    const containerRegex = /<[^>]*id=["']livePriceTimestampContainer["'][^>]*class=["']([^"']*)["'][^>]*>/i;
    const contMatch = html.match(containerRegex);
    if (!contMatch) return fail('Element with id="livePriceTimestampContainer" not found in index.html');
    const classAttr = contMatch[1] || '';
    if (!/live-price-inside-sort-left/.test(classAttr)) {
        console.warn('WARN: livePriceTimestampContainer found but missing class "live-price-inside-sort-left" (found:', classAttr, ')');
    } else {
        pass('Found #livePriceTimestampContainer with class live-price-inside-sort-left');
    }

    // Check for inner livePriceTimestamp element
    if (!/id=["']livePriceTimestamp["']/.test(html)) return fail('Element with id="livePriceTimestamp" not found in index.html');
    pass('Found #livePriceTimestamp element');

    // Check CSS for selector and left-alignment rules
    const selectorBlockRegex = /\.live-price-inside-sort-left\s*\{([\s\S]*?)\}/i;
    const blockMatch = css.match(selectorBlockRegex);
    if (!blockMatch) {
        console.warn('WARN: .live-price-inside-sort-left selector not found in style.css');
    } else {
        const block = blockMatch[1];
        const hasJustify = /justify-content\s*:\s*flex-start/i.test(block);
        const hasTextAlign = /text-align\s*:\s*left/i.test(block);
        const hasTabular = /font-variant-numeric\s*:\s*tabular-nums/i.test(block);
        if (hasJustify || hasTextAlign) {
            pass('CSS .live-price-inside-sort-left contains left-alignment (justify-content or text-align)');
        } else {
            console.warn('WARN: .live-price-inside-sort-left found but no justify-content:flex-start or text-align:left in its block');
        }
        if (hasTabular) pass('CSS uses font-variant-numeric: tabular-nums for #livePriceTimestamp (good for numeric alignment)');
    }

    // Also check for a fallback rule targeting the timestamp itself inside that selector
    const timestampRuleRegex = /\.live-price-inside-sort-left\s+[^{]*#livePriceTimestamp\s*\{([\s\S]*?)\}/i;
    const tsMatch = css.match(timestampRuleRegex);
    if (tsMatch) {
        pass('Found rule targeting #livePriceTimestamp inside .live-price-inside-sort-left');
    }

    // Summary
    console.log('\nSUMMARY:');
    if (process.exitCode && process.exitCode !== 0) {
        console.log('One or more checks failed. See FAIL messages above.');
        process.exit(process.exitCode);
    } else {
        console.log('All automatable checks passed or returned warnings only. Manual browser QA recommended for visual confirmation.');
        process.exit(0);
    }
} catch (e) {
    console.error('ERROR:', e && e.message ? e.message : String(e));
    process.exitCode = 3;
}

// --- Test Setup: Mocking DOM elements and functions ---
const assert = require('assert');

// Mock DOM elements that the functions interact with
let calculatorResult = { textContent: '0' };
let calculatorInput = { textContent: '' };

// Mock showCustomAlert
function showCustomAlert(message) {
    console.log(`ALERT: ${message}`);
}

// --- Copied from script.js: State Variables ---
let currentCalculatorInput = '';
let operator = null;
let previousCalculatorInput = '';
let resultDisplayed = false;

// --- Copied from script.js: Core Logic Functions ---

function updateCalculatorDisplay() {
    // This function is just for display, so we can simplify it for the test
    const displayText = previousCalculatorInput + (operator ? ' ' + getOperatorSymbol(operator) + ' ' : '') + currentCalculatorInput;
    calculatorInput.textContent = displayText;
    if (!resultDisplayed) {
        calculatorResult.textContent = currentCalculatorInput === '' ? '0' : currentCalculatorInput;
    }
    console.log(`[Debug] Display updated: Input='${calculatorInput.textContent}', Result='${calculatorResult.textContent}'`);
}

function calculateResult() {
    console.log(`[Debug] Calculating: prev='${previousCalculatorInput}', op='${operator}', current='${currentCalculatorInput}'`);
    let prev = parseFloat(previousCalculatorInput);
    let current = parseFloat(currentCalculatorInput);
    if (isNaN(prev) || isNaN(current)) {
        console.log('[Debug] Calculation aborted: NaN input');
        return;
    }
    let res;
    switch (operator) {
        case 'add': res = prev + current; break;
        case 'subtract': res = prev - current; break;
        case 'multiply': res = prev * current; break;
        case 'divide':
            if (current === 0) { showCustomAlert('Cannot divide by zero!'); res = 'Error'; }
            else { res = prev / current; }
            break;
        default: return;
    }
    if (typeof res === 'number' && !isNaN(res)) { res = parseFloat(res.toFixed(10)); }

    console.log(`[Debug] Raw result: ${res}`);
    calculatorResult.textContent = res.toString();
    previousCalculatorInput = res.toString();
    currentCalculatorInput = ''; // This was the bug! It should be reset.
    // The original code was missing this line, causing the next operation to fail.
}


function getOperatorSymbol(op) {
    switch (op) {
        case 'add': return '+'; case 'subtract': return '-';
        case 'multiply': return '×'; case 'divide': return '÷';
        default: return '';
    }
}

function resetCalculator() {
    currentCalculatorInput = '';
    operator = null;
    previousCalculatorInput = '';
    resultDisplayed = false;
    calculatorInput.textContent = '';
    calculatorResult.textContent = '0';
    console.log('[Debug] Calculator reset.');
}

function appendNumber(num) {
    console.log(`[Debug] Appending number: '${num}'. Current state: current='${currentCalculatorInput}', resultDisplayed=${resultDisplayed}`);
    if (resultDisplayed) {
        currentCalculatorInput = num;
        resultDisplayed = false;
    } else {
        if (num === '.' && currentCalculatorInput.includes('.')) return;
        currentCalculatorInput += num;
    }
    updateCalculatorDisplay();
}

function handleAction(action) {
    console.log(`[Debug] Handling action: '${action}'. State: prev='${previousCalculatorInput}', current='${currentCalculatorInput}', op='${operator}'`);
    if (action === 'clear') {
        resetCalculator();
        return;
    }
    if (action === 'percentage') {
        // Logic for percentage... (not needed for this test)
        return;
    }
    if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
        if (currentCalculatorInput === '' && previousCalculatorInput === '') return;
        if (currentCalculatorInput !== '') {
            if (previousCalculatorInput !== '') {
                calculateResult();
                previousCalculatorInput = calculatorResult.textContent;
            }
            else {
                previousCalculatorInput = currentCalculatorInput;
            }
        }
        operator = action;
        currentCalculatorInput = '';
        resultDisplayed = false;
        updateCalculatorDisplay();
        return;
    }
    if (action === 'calculate') {
        if (previousCalculatorInput === '' || currentCalculatorInput === '' || operator === null) {
            return;
        }
        calculateResult();
        operator = null;
        resultDisplayed = true;
        console.log(`[Debug] Post-calculation state: prev='${previousCalculatorInput}', result='${calculatorResult.textContent}'`);
    }
}


// --- Test Execution ---
console.log('--- Running Calculator Logic Test ---');
resetCalculator();

// Simulate 8 * 5
console.log('\nStep 1: Pressing 8');
appendNumber('8');
assert.strictEqual(currentCalculatorInput, '8', 'Test Failed: current input should be 8');

console.log('\nStep 2: Pressing *');
handleAction('multiply');
assert.strictEqual(operator, 'multiply', 'Test Failed: operator should be multiply');
assert.strictEqual(previousCalculatorInput, '8', 'Test Failed: previous input should be 8');
assert.strictEqual(currentCalculatorInput, '', 'Test Failed: current input should be empty');

console.log('\nStep 3: Pressing 5');
appendNumber('5');
assert.strictEqual(currentCalculatorInput, '5', 'Test Failed: current input should be 5');

console.log('\nStep 4: Pressing =');
handleAction('calculate');

console.log(`\n--- Test Complete ---`);
console.log(`Final Result: ${calculatorResult.textContent}`);
assert.strictEqual(calculatorResult.textContent, '40', 'Final Test Assertion Failed: Result should be 40');
console.log('✅ Test Passed!');

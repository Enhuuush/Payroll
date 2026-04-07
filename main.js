const MIN_WAGE = 792000;
const SHI_RATE = 0.115;
const SHI_CAP_BASE = MIN_WAGE * 10; // Обновлено до 10х согласно правилам 2026 года

const PIT_CREDIT_TABLE = [
    { limit: 500000, credit: 20000 },
    { limit: 1000000, credit: 18000 },
    { limit: 1500000, credit: 16000 },
    { limit: 2000000, credit: 14000 },
    { limit: 2500000, credit: 12000 },
    { limit: 3000000, credit: 10000 },
    { limit: Infinity, credit: 0 }
];

function getPITCredit(gross) {
    for (const entry of PIT_CREDIT_TABLE) {
        if (gross <= entry.limit) {
            return entry.credit;
        }
    }
    return 0;
}

// Помощники форматирования
function formatWithCommas(value, isInput = false) {
    if (value === null || value === undefined || isNaN(value) || value === 0) return "";
    
    const options = isInput ? { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
    } : { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    };

    return value.toLocaleString('en-US', options);
}

function parseRaw(value) {
    if (typeof value !== 'string') return value || 0;
    return parseFloat(value.replace(/,/g, "")) || 0;
}

function handleInputFormatting(input, callback) {
    const originalValue = input.value;
    const cursorPosition = input.selectionStart;
    
    // Вычисляем смещение курсора от конца
    const offsetFromEnd = originalValue.length - cursorPosition;
    
    const rawValue = parseRaw(originalValue);
    callback(rawValue); 
    
    // Форматируем текущий ввод - не принуждаем к .00 во время набора
    const formattedValue = formatWithCommas(rawValue, true);
    input.value = formattedValue;
    
    // Восстанавливаем позицию курсора относительно конца
    const newCursorPosition = Math.max(0, formattedValue.length - offsetFromEnd);
    input.setSelectionRange(newCursorPosition, newCursorPosition);
}

function calculateDeductions(gross) {
    if (!gross || gross < 0) return { shi: 0, pit: 0, credit: 0, net: 0 };

    // 1. Соц. взносы (НДШ)
    const shiBase = Math.min(gross, SHI_CAP_BASE);
    const shi = Math.round(shiBase * SHI_RATE);

    // 2. Налогооблагаемый доход
    const taxableIncome = gross - shi;

    // 3. Подоходный налог (ХХОАТ)
    let pit = 0;
    if (taxableIncome <= 10000000) {
        pit = taxableIncome * 0.1;
    } else if (taxableIncome <= 15000000) {
        pit = 1000000 + (taxableIncome - 10000000) * 0.15;
    } else {
        pit = 1750000 + (taxableIncome - 15000000) * 0.2;
    }
    pit = Math.round(pit);

    // 4. Налоговый вычет (Хөнгөлөлт)
    const credit = getPITCredit(gross);

    // Итоговый налог
    const finalPit = Math.max(0, pit - credit);

    // Зарплата на руки
    const net = gross - shi - finalPit;

    return {
        shi,
        pit: finalPit,
        credit,
        net
    };
}

// Решатель для перехода от "на руки" к "грязными"
function solveGrossFromNet(targetNet) {
    if (!targetNet || targetNet <= 0) return 0;
    
    let low = 0;
    let high = targetNet * 2 + 1000000; 
    let gross = 0;

    for (let i = 0; i < 60; i++) {
        gross = (low + high) / 2;
        const result = calculateDeductions(gross);
        if (result.net < targetNet) {
            low = gross;
        } else {
            high = gross;
        }
    }
    return Math.round(high);
}

// Обработка UI
const grossInput = document.getElementById('gross-input');
const bonusInput = document.getElementById('bonus-input');
const netInput = document.getElementById('net-input');
const shiDisplay = document.getElementById('shi-value');
const pitDisplay = document.getElementById('pit-value');
const creditDisplay = document.getElementById('credit-value');
const totalGrossDisplay = document.getElementById('total-gross-value');
const totalDeductionDisplay = document.getElementById('total-deduction');
const bonusPercentInput = document.getElementById('bonus-percent');


let isUpdating = false;
let bonusPercent = 50;

if (bonusPercentInput) {
    bonusPercentInput.addEventListener('input', (e) => {
        bonusPercent = parseFloat(e.target.value) || 0;
        if (isUpdating) return;
        
        const gross = parseRaw(grossInput.value);
        if (gross > 0) {
            isUpdating = true;
            const bonus = gross * (bonusPercent / 100);
            const totalGross = gross + bonus;
            const results = calculateDeductions(totalGross);
            
            bonusInput.value = bonus > 0 ? formatWithCommas(bonus) : '';
            netInput.value = results.net > 0 ? formatWithCommas(results.net) : '';
            updateDisplay(results);
            isUpdating = false;
        }
    });
}

function updateDisplay(results) {
    shiDisplay.textContent = `${results.shi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₮`;
    pitDisplay.textContent = `${results.pit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₮`;
    creditDisplay.textContent = `${results.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₮`;
    totalGrossDisplay.textContent = `${(results.shi + results.pit + results.net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₮`;
    totalDeductionDisplay.textContent = `${(results.shi + results.pit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₮`;
}

grossInput.addEventListener('input', (e) => {
    if (isUpdating) return;
    handleInputFormatting(e.target, (gross) => {
        isUpdating = true;
        const bonus = gross * (bonusPercent / 100);
        const totalGross = gross + bonus;
        
        const results = calculateDeductions(totalGross);
        
        bonusInput.value = bonus > 0 ? formatWithCommas(bonus) : '';
        netInput.value = results.net > 0 ? formatWithCommas(results.net) : '';
        updateDisplay(results);
        isUpdating = false;
    });
});

bonusInput.addEventListener('input', (e) => {
    if (isUpdating) return;
    handleInputFormatting(e.target, (bonus) => {
        isUpdating = true;
        
        let gross = 0;
        if (bonusPercent > 0) {
            gross = bonus / (bonusPercent / 100);
        } else {
            gross = parseRaw(grossInput.value);
        }
        
        const totalGross = gross + bonus;
        const results = calculateDeductions(totalGross);
        
        grossInput.value = gross > 0 ? formatWithCommas(gross) : '';
        netInput.value = results.net > 0 ? formatWithCommas(results.net) : '';
        updateDisplay(results);
        isUpdating = false;
    });
});

netInput.addEventListener('input', (e) => {
    if (isUpdating) return;
    handleInputFormatting(e.target, (net) => {
        isUpdating = true;
        const totalGross = solveGrossFromNet(net);
        const gross = totalGross / (1 + bonusPercent / 100);
        const bonus = gross * (bonusPercent / 100);
        
        grossInput.value = gross > 0 ? formatWithCommas(gross) : '';
        bonusInput.value = bonus > 0 ? formatWithCommas(bonus) : '';
        
        const results = calculateDeductions(totalGross);
        updateDisplay(results);
        isUpdating = false;
    });
});

const inputs = [grossInput, bonusInput, netInput];
inputs.forEach(input => {
    input.addEventListener('blur', (e) => {
        const value = parseRaw(e.target.value);
        if (value > 0) {
            e.target.value = formatWithCommas(value, false);
        }
    });
});

// Инициализация
updateDisplay({ shi: 0, pit: 0, credit: 0, net: 0 });

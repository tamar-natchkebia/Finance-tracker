const form = document.getElementById('transaction-form');
const list = document.getElementById('ledger-list');
const monthFilter = document.getElementById('month-filter');
const currencySelect = document.getElementById('currency-select');
const searchField = document.getElementById('search-field');
const modal = document.getElementById('custom-modal');

let transactions = JSON.parse(localStorage.getItem('apple_finance_v1')) || [];
let currentType = 'expense';
let deleteId = null;
let myChart = null;

document.getElementById('date').valueAsDate = new Date();

function setTransactionType(type) {
    currentType = type;
    document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
    document.getElementById('btn-saving').classList.toggle('active', type === 'saving');
}

function populateMonthFilter() {
    const months = [...new Set(transactions.map(t => t.date.substring(0, 7)))].sort().reverse();
    monthFilter.innerHTML = '<option value="all">All Time</option>';
    months.forEach(m => {
        const date = new Date(m + "-01");
        const label = date.toLocaleString('default', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        monthFilter.innerHTML += `<option value="${m}">${label}</option>`;
    });
}

function formatMoney(num, curr) {
    const syms = { USD: '$', EUR: '€', CAD: 'C$' };
    const sym = syms[curr] || '$';
    // Math.abs is removed here to allow negative balances to show correctly as -$50.00
    const formatted = Math.abs(num).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return num < 0 ? `-${sym}${formatted}` : `${sym}${formatted}`;
}

function updateChart(filteredData) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const expenseData = filteredData.filter(t => t.type === 'expense');
    const categories = [...new Set(expenseData.map(t => t.category))];
    const totals = categories.map(cat => 
        expenseData.filter(t => t.category === cat).reduce((sum, t) => sum + t.amount, 0)
    );
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: totals,
                backgroundColor: ['#111111', '#B9F53D', '#7ED957', '#D9F99D', '#E9FEC8', '#333333', '#555555'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { font: { family: 'Josefin Sans' } } } }
        }
    });
}

function updateDashboard() {
    const filter = monthFilter.value;
    const searchTerm = searchField.value.toLowerCase();
    const curr = currencySelect.value;
    
    const currencyTransactions = transactions.filter(t => t.currency === curr);
    
    let filtered = filter === 'all' 
        ? currencyTransactions 
        : currencyTransactions.filter(t => t.date.startsWith(filter));
    
    if (searchTerm) {
        filtered = filtered.filter(t => 
            t.text.toLowerCase().includes(searchTerm) || 
            (t.category && t.category.toLowerCase().includes(searchTerm)) ||
            t.amount.toString().includes(searchTerm)
        );
    }
    
    // --- THE FIX IS HERE ---
    // 1. Calculate the raw total of all 'saving' entries
    const totalIncome = currencyTransactions
        .filter(t => t.type === 'saving')
        .reduce((sum, t) => sum + t.amount, 0);

    // 2. Calculate the raw total of all 'expense' entries
    const totalSpent = currencyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    // 3. Subtract Spent from Income (e.g., 1000 - 123 = 877)
    const netBalance = totalIncome - totalSpent;

    // Period calculations (for the boxes on the left)
    const periodIncome = filtered.filter(t => t.type === 'saving').reduce((a, t) => a + t.amount, 0);
    const periodSpent = filtered.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

    // Update the UI
    document.getElementById('net-balance').innerText = formatMoney(netBalance, curr);
    document.getElementById('total-saved').innerText = formatMoney(netBalance, curr); 
    document.getElementById('total-spent').innerText = formatMoney(totalSpent, curr);
    document.getElementById('month-saved').innerText = formatMoney(periodIncome, curr);
    document.getElementById('month-spent').innerText = formatMoney(periodSpent, curr);

    renderList(filtered);
    updateChart(filtered);
}

function renderList(data) {
    list.innerHTML = data.length ? '' : '<li style="color:#aaa; border:none; background:transparent">No items found</li>';
    data.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        const li = document.createElement('li');
        li.className = t.type === 'expense' ? 'expense-item' : 'saving-item';
        li.innerHTML = `
            <div>
                <strong>${t.text}</strong>
                <div style="display:flex; gap:8px; align-items:center;">
                    <small style="color:#888;">${t.date}</small>
                    <span class="tag-badge">${t.category || 'General'}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center">
                <span class="item-amt ${t.type === 'expense' ? 'expense' : 'savings'}">
                    ${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount, t.currency)}
                </span>
                <button class="delete-btn" onclick="openDeleteModal(${t.id})"><i class="fas fa-times-circle"></i></button>
            </div>`;
        list.appendChild(li);
    });
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amountVal = document.getElementById('amount').value;
    const amount = parseFloat(amountVal.replace(/[^0-9.]/g, ''));
    if (isNaN(amount)) return;

    transactions.push({
        id: Date.now(),
        text: document.getElementById('desc').value,
        category: document.getElementById('category').value,
        amount: amount, // Logic: Always store as a positive number
        currency: currencySelect.value,
        date: document.getElementById('date').value,
        type: currentType
    });

    localStorage.setItem('apple_finance_v1', JSON.stringify(transactions));
    form.reset();
    document.getElementById('date').valueAsDate = new Date();
    setTransactionType('expense');
    populateMonthFilter();
    updateDashboard();
});

window.openDeleteModal = (id) => { deleteId = id; modal.style.display = 'flex'; };
document.getElementById('modal-cancel').onclick = () => { modal.style.display = 'none'; };
document.getElementById('modal-confirm').onclick = () => {
    transactions = transactions.filter(t => t.id !== deleteId);
    localStorage.setItem('apple_finance_v1', JSON.stringify(transactions));
    modal.style.display = 'none';
    populateMonthFilter();
    updateDashboard();
};

monthFilter.onchange = updateDashboard;
currencySelect.onchange = updateDashboard;
searchField.oninput = updateDashboard;

populateMonthFilter();
updateDashboard();
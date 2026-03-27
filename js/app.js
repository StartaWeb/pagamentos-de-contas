// Constants
const STORAGE_KEY = 'startweb_pagamentos_contas';

// State
let bills = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let editingBillId = null;

// DOM Elements - Navigation
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

// DOM Elements - Buttons
const btnHeaderNewBill = document.getElementById('btn-header-new-bill');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const btnClearFilter = document.getElementById('btn-clear-filter');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnClearAllData = document.getElementById('btn-clear-all-data');

// DOM Elements - Forms & Inputs
const addBillForm = document.getElementById('add-bill-form');
const filterKeyword = document.getElementById('search-keyword');
const filterDateStart = document.getElementById('filter-date-start');
const filterDateEnd = document.getElementById('filter-date-end');

// DOM Elements - Containers
const tableBody = document.getElementById('bills-table-body');
const emptyState = document.getElementById('empty-state');
const statTotalCount = document.getElementById('stat-total-count');
const statUpcomingCount = document.getElementById('stat-upcoming-count');
const statTotalValue = document.getElementById('stat-total-value');
const weeklyReportContainer = document.getElementById('weekly-report-container');

// Stat Cards
const statCardTotal = document.getElementById('stat-card-total');
const statCardUpcoming = document.getElementById('stat-card-upcoming');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    initExtra();
    renderDashboard();
});

// --- Navigation Logic ---
function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            if (target) switchView(target);
        });
    });

    btnHeaderNewBill.addEventListener('click', () => {
        editingBillId = null;
        addBillForm.reset();
        const headerTitle = document.querySelector('#view-add-bill .panel-header h2');
        if (headerTitle) headerTitle.innerHTML = '<i class="ph ph-plus-circle"></i>Cadastrar Nova Conta';
        switchView('add-bill');
    });

    btnCancelAdd.addEventListener('click', () => {
        editingBillId = null;
        addBillForm.reset();
        const headerTitle = document.querySelector('#view-add-bill .panel-header h2');
        if (headerTitle) headerTitle.innerHTML = '<i class="ph ph-plus-circle"></i>Cadastrar Nova Conta';
        switchView('dashboard');
    });
}

function switchView(viewId) {
    // Update active nav
    navItems.forEach(item => {
        if (item.getAttribute('data-target') === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update active view
    views.forEach(view => {
        if (view.id === `view-${viewId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    // Extra logic per view
    if (viewId === 'dashboard') {
        renderDashboard();
    } else if (viewId === 'reports') {
        renderReports();
    }
}

// --- Data Operations ---
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format Currency
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Format Date
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Filter Logic
function initFilters() {
    const applyFilter = () => renderTable(getFilteredBills());

    filterKeyword.addEventListener('input', applyFilter);
    filterDateStart.addEventListener('change', applyFilter);
    filterDateEnd.addEventListener('change', applyFilter);

    btnClearFilter.addEventListener('click', () => {
        filterKeyword.value = '';
        filterDateStart.value = '';
        filterDateEnd.value = '';
        applyFilter();
    });
}

function initExtra() {
    if (statCardTotal) {
        statCardTotal.addEventListener('click', () => {
            filterKeyword.value = '';
            filterDateStart.value = '';
            filterDateEnd.value = '';
            renderTable(getFilteredBills());
        });
    }

    if (statCardUpcoming) {
        statCardUpcoming.addEventListener('click', () => {
            filterKeyword.value = '';
            const in7Days = new Date();
            in7Days.setDate(in7Days.getDate() + 7);
            filterDateStart.value = '';
            filterDateEnd.value = in7Days.toISOString().split('T')[0];
            renderTable(getFilteredBills());
        });
    }

    if (btnExportPdf) btnExportPdf.addEventListener('click', exportToPDF);
    if (btnExportExcel) btnExportExcel.addEventListener('click', exportToExcel);

    if (btnClearAllData) btnClearAllData.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja apagar TODAS as contas? Isso não pode ser desfeito!')) {
            bills = [];
            saveToStorage();
            showToast('Todos os dados foram apagados', 'success');
            renderDashboard();
        }
    });
}

function getFilteredBills() {
    return bills.filter(bill => {
        const query = filterKeyword.value.toLowerCase();
        const start = filterDateStart.value;
        const end = filterDateEnd.value;

        // Keyword Match (Description, Barcode, or Value)
        const matchesKeyword = !query ||
            bill.description.toLowerCase().includes(query) ||
            bill.barcode.includes(query) ||
            bill.value.toString().includes(query);

        // Date Match
        let matchesDate = true;
        if (start && end) {
            matchesDate = bill.date >= start && bill.date <= end;
        } else if (start) {
            matchesDate = bill.date >= start;
        } else if (end) {
            matchesDate = bill.date <= end;
        }

        return matchesKeyword && matchesDate;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending
}

// --- Render Logic ---
function renderDashboard() {
    const filtered = getFilteredBills();
    renderTable(filtered);
    updateStats();
}

function renderTable(data) {
    tableBody.innerHTML = '';

    if (data.length === 0) {
        emptyState.style.display = 'flex';
        tableBody.parentElement.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    tableBody.parentElement.style.display = 'table';

    data.forEach(bill => {
        const tr = document.createElement('tr');

        // Check if date is passed
        const isLate = new Date(bill.date) < new Date(new Date().toDateString()) && bill.status !== 'paid';
        const dateSpan = isLate ? `<span style="color: var(--danger); font-weight: bold;">${formatDate(bill.date)} (Vencida)</span>` : formatDate(bill.date);

        const statusHtml = bill.status === 'paid'
            ? `<span style="background: var(--success); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Entregue</span>`
            : `<span style="background: var(--warning); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Pendente</span>`;

        const payAction = bill.status === 'paid'
            ? `<button class="btn-warning-sm" onclick="undoPayBill('${bill.id}')" title="Retornar para Pendente" style="background: rgba(255, 209, 102, 0.2); color: #d4a017; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;"><i class="ph ph-arrow-u-up-left"></i></button>`
            : `<button class="btn-success-sm" onclick="payBill('${bill.id}')" title="Confirmar Pagamento" style="background: rgba(6, 214, 160, 0.1); color: var(--success); border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;"><i class="ph ph-check-circle"></i></button>`;

        const editAction = `<button class="btn-secondary btn-sm" onclick="editBill('${bill.id}')" style="border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; color: var(--primary); background: rgba(67, 97, 238, 0.1);" title="Editar Conta"><i class="ph ph-pencil-simple"></i></button>`;

        tr.innerHTML = `
            <td><strong>${bill.description}</strong></td>
            <td style="font-family: monospace; color: var(--text-muted);">${bill.barcode}</td>
            <td>${dateSpan}</td>
            <td style="font-weight: bold; color: var(--success);">${formatCurrency(bill.value)}</td>
            <td>${statusHtml}</td>
            <td style="display: flex; gap: 8px;">
                ${payAction}
                ${editAction}
                <button class="btn-danger-sm" onclick="deleteBill('${bill.id}')" title="Excluir">
                    <i class="ph ph-trash"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    let totalValue = 0;
    let upcomingCount = 0;

    bills.forEach(bill => {
        totalValue += bill.value;
        const bDate = new Date(bill.date + 'T00:00:00');
        if (bDate >= today && bDate <= in7Days) {
            upcomingCount++;
        }
    });

    statTotalCount.textContent = bills.length;
    statUpcomingCount.textContent = upcomingCount;
    statTotalValue.textContent = formatCurrency(totalValue);
}

// --- Add Bill Logic ---
addBillForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (editingBillId) {
        // Edit existing
        const index = bills.findIndex(b => b.id === editingBillId);
        if (index !== -1) {
            bills[index].description = document.getElementById('bill-description').value;
            bills[index].barcode = document.getElementById('bill-barcode').value;
            bills[index].date = document.getElementById('bill-date').value;
            bills[index].value = parseFloat(document.getElementById('bill-value').value);
        }
        showToast('Conta atualizada com sucesso!', 'success');
        editingBillId = null;

        const headerTitle = document.querySelector('#view-add-bill .panel-header h2');
        if (headerTitle) headerTitle.innerHTML = '<i class="ph ph-plus-circle"></i>Cadastrar Nova Conta';
    } else {
        // Create new
        const newBill = {
            id: generateId(),
            description: document.getElementById('bill-description').value,
            barcode: document.getElementById('bill-barcode').value,
            date: document.getElementById('bill-date').value,
            value: parseFloat(document.getElementById('bill-value').value),
            status: 'pending'
        };
        bills.push(newBill);
        showToast('Conta cadastrada com sucesso!', 'success');
    }

    saveToStorage();

    // Reset Form
    addBillForm.reset();

    // Switch back to dashboard
    switchView('dashboard');
});

// --- Delete, Pay & Edit Logic ---
window.deleteBill = function (id) {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
        bills = bills.filter(b => b.id !== id);
        saveToStorage();
        renderDashboard();
        if (document.getElementById('view-reports').classList.contains('active')) {
            renderReports();
        }
        showToast('Conta removida.', 'success');
    }
}

window.editBill = function (id) {
    const bill = bills.find(b => b.id === id);
    if (bill) {
        document.getElementById('bill-description').value = bill.description;
        document.getElementById('bill-barcode').value = bill.barcode;
        document.getElementById('bill-date').value = bill.date;
        document.getElementById('bill-value').value = bill.value;

        editingBillId = id;

        const headerTitle = document.querySelector('#view-add-bill .panel-header h2');
        if (headerTitle) headerTitle.innerHTML = '<i class="ph ph-pencil-simple"></i>Editar Conta';

        switchView('add-bill');
    }
}

window.payBill = function (id) {
    if (confirm('Confirmar o pagamento desta conta?')) {
        const bill = bills.find(b => b.id === id);
        if (bill) {
            bill.status = 'paid';
            saveToStorage();
            renderDashboard();
            showToast('Pagamento confirmado!', 'success');
        }
    }
}

window.undoPayBill = function (id) {
    if (confirm('Deseja retornar esta conta para o status pendente?')) {
        const bill = bills.find(b => b.id === id);
        if (bill) {
            bill.status = 'pending';
            saveToStorage();
            renderDashboard();
            showToast('A conta agora está pendente.', 'success');
        }
    }
}

// --- Export Logic ---
function getFilterDatesText() {
    let text = "";
    if (filterDateStart.value && filterDateEnd.value) {
        text = `Período: ${formatDate(filterDateStart.value)} a ${formatDate(filterDateEnd.value)}`;
    } else if (filterDateStart.value) {
        text = `A partir de: ${formatDate(filterDateStart.value)}`;
    } else if (filterDateEnd.value) {
        text = `Até: ${formatDate(filterDateEnd.value)}`;
    } else {
        text = `Ebenezer Startweb`;
    }
    return text;
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = getFilteredBills();

    if (data.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }

    const totalCount = data.length;
    const totalValue = data.reduce((acc, bill) => acc + bill.value, 0);

    doc.setFontSize(18);
    doc.text('Relatório de Contas a Pagar', 14, 22);

    doc.setFontSize(11);
    doc.text(getFilterDatesText(), 14, 30);
    doc.text(`Total de Contas: ${totalCount} - Valor Total: ${formatCurrency(totalValue)}`, 14, 38);

    const tableColumn = ["Descrição", "Cód. Barras", "Vencimento", "Valor", "Status"];
    const tableRows = [];

    data.forEach(bill => {
        tableRows.push([
            bill.description,
            bill.barcode,
            formatDate(bill.date),
            formatCurrency(bill.value),
            bill.status === 'paid' ? 'Entregue' : 'Pendente'
        ]);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 44,
        theme: 'striped',
        styles: { fontSize: 9 }
    });

    // Adiciona marca d'agua e rodapé em todas as páginas


    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Watermark Startweb com opacidade reduzida
        const gState = doc.GState({ opacity: 0.4 }); // bem transparente
        doc.setGState(gState);

        doc.setFontSize(80);
        doc.setTextColor(230, 230, 230); // Very light gray
        doc.text('Startweb', 105, 150, { angle: 45, align: 'center' });

        // volta ao normal para o rodapé
        doc.setGState(new doc.GState({ opacity: 1 }));

        // Footer Dev Info & Date
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const printDate = new Date().toLocaleString('pt-BR');
        const footerText = `Startweb — Transformando dados em resultados com inovação e confiança Responsável técnico: Roberto Ursine
| Impresso em: ${printDate} | Pág. ${i} / ${totalPages}`;
        doc.text(footerText, 105, 290, { align: 'center' });
    }

    doc.save(`Contas_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportToExcel() {
    const data = getFilteredBills();
    if (data.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }

    const totalCount = data.length;
    const totalValue = data.reduce((acc, bill) => acc + bill.value, 0);

    const header = [
        ["Relatório de Contas a Pagar"],
        [getFilterDatesText()],
        [`Total de Contas: ${totalCount} - Valor Total: ${formatCurrency(totalValue)}`],
        [],
        ["Descrição", "Cód. Barras", "Vencimento", "Valor", "Status"]
    ];
    const rows = data.map(bill => [
        bill.description,
        bill.barcode,
        formatDate(bill.date),
        bill.value,
        bill.status === 'paid' ? 'Entregue' : 'Pendente'
    ]);

    const worksheetData = [...header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas");
    XLSX.writeFile(wb, `Contas_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// --- Weekly Reports Logic ---
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
}

function renderReports() {
    weeklyReportContainer.innerHTML = '';

    if (bills.length === 0) {
        weeklyReportContainer.innerHTML = '<p class="report-desc text-center">Nenhuma conta cadastrada para gerar relatórios.</p>';
        return;
    }

    // Group bills by week
    const groups = {};
    bills.forEach(bill => {
        const date = new Date(bill.date + 'T00:00:00');
        const [year, week] = getWeekNumber(date);
        const key = `${year}-W${String(week).padStart(2, '0')}`;

        if (!groups[key]) {
            groups[key] = {
                label: `Ano ${year}`,
                total: 0,
                items: []
            };
        }

        groups[key].items.push(bill);
        groups[key].total += bill.value;
    });

    // Sort keys descending
    const sortedKeys = Object.keys(groups).sort().reverse();

    sortedKeys.forEach(key => {
        const group = groups[key];

        // Sort items by date ascending within week
        group.items.sort((a, b) => new Date(a.date) - new Date(b.date));

        const wkDiv = document.createElement('div');
        wkDiv.className = 'week-group';
        let rowsHtml = group.items.map(b => `
    <tr>
        <td>${b.description}</td>
        <td class="barcode">${b.barcode}</td>
        <td>${formatDate(b.date)}</td>
        <td style="text-align: right; font-weight: 500;">${formatCurrency(b.value)}</td>
    </tr>
`).join('');

        wkDiv.innerHTML = `
            <div class="week-header">
                <div class="week-title"><i class="ph ph-calendar-blank"></i> ${group.label}</div>
                <div class="week-total">${formatCurrency(group.total)}</div>
            </div>
            <table class="data-table" style="font-size: 0.9rem;">
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        weeklyReportContainer.appendChild(wkDiv);
    });
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';

    toast.innerHTML = `
        <i class="ph ${icon}" style="font-size: 1.5rem;"></i>
        <p>${message}</p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

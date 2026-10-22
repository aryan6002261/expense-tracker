/**
 * ExpenseAI - Smart Expense Tracker Application Logic
 * Full functionality:
 * - User Authentication (Sign In, Sign Up, Sign Out, Demo Login, LocalStorage persistence)
 * - UPI Integration & Automated Bank Feed Sync (with UTR reference numbers)
 * - Gmail Reminders, Automated Budget Alerts & High-Fidelity Email Preview Simulator
 * - Dynamic Dashboard Calculations & Chart.js Visualizations
 * - Full Expenses CRUD, Live Search & Category Filtering
 * - Budgets Management & Smart AI Insights Engine
 */

(function () {
    'use strict';

    // ==========================================
    // 1. STORAGE KEYS & CONSTANTS
    // ==========================================

    const STORAGE_USERS_KEY = 'EXPENSEAI_USERS_V2';
    const STORAGE_CURRENT_USER_ID_KEY = 'EXPENSEAI_CURRENT_USER_ID_V2';

    const CATEGORIES = {
        food: {
            name: 'Food',
            icon: '🍔',
            badgeClass: 'badge-food',
            defaultBudget: 5000
        },
        transport: {
            name: 'Transport',
            icon: '🚗',
            badgeClass: 'badge-transport',
            defaultBudget: 3000
        },
        shopping: {
            name: 'Shopping',
            icon: '🛍️',
            badgeClass: 'badge-shopping',
            defaultBudget: 4000
        },
        entertainment: {
            name: 'Entertainment',
            icon: '🎮',
            badgeClass: 'badge-entertainment',
            defaultBudget: 2500
        },
        other: {
            name: 'Other',
            icon: '📦',
            badgeClass: 'badge-other',
            defaultBudget: 2000
        }
    };

    const PAYMENT_METHODS = {
        upi: 'UPI',
        cash: 'Cash',
        card: 'Card',
        'net-banking': 'Net Banking'
    };

    const DEMO_EXPENSES = [
        {
            id: 'exp_1',
            date: '2026-08-22',
            description: 'Lunch at Subway',
            category: 'food',
            payment: 'upi',
            amount: 350
        },
        {
            id: 'exp_2',
            date: '2026-08-21',
            description: 'Uber to college',
            category: 'transport',
            payment: 'upi',
            amount: 220
        },
        {
            id: 'exp_3',
            date: '2026-08-20',
            description: 'Amazon Purchase',
            category: 'shopping',
            payment: 'card',
            amount: 1200
        },
        {
            id: 'exp_4',
            date: '2026-08-19',
            description: 'Dinner with friends',
            category: 'food',
            payment: 'upi',
            amount: 1450
        },
        {
            id: 'exp_5',
            date: '2026-08-18',
            description: 'Petrol fill-up',
            category: 'transport',
            payment: 'card',
            amount: 1100
        },
        {
            id: 'exp_6',
            date: '2026-08-17',
            description: 'Movie ticket & popcorn',
            category: 'entertainment',
            payment: 'upi',
            amount: 650
        },
        {
            id: 'exp_7',
            date: '2026-08-16',
            description: 'Weekly grocery basket',
            category: 'food',
            payment: 'net-banking',
            amount: 1850
        },
        {
            id: 'exp_8',
            date: '2026-08-15',
            description: 'Running shoes on sale',
            category: 'shopping',
            payment: 'card',
            amount: 2300
        },
        {
            id: 'exp_9',
            date: '2026-08-14',
            description: 'Monthly Cloud & App Subscriptions',
            category: 'other',
            payment: 'card',
            amount: 799
        },
        {
            id: 'exp_10',
            date: '2026-08-12',
            description: 'Metro smart card recharge',
            category: 'transport',
            payment: 'upi',
            amount: 500
        },
        {
            id: 'exp_11',
            date: '2026-08-10',
            description: 'Cafe coffee & snacks',
            category: 'food',
            payment: 'cash',
            amount: 600
        },
        {
            id: 'exp_12',
            date: '2026-08-08',
            description: 'Steam summer game',
            category: 'entertainment',
            payment: 'card',
            amount: 550
        },
        {
            id: 'exp_13',
            date: '2026-08-05',
            description: 'Stationery & notebook supplies',
            category: 'other',
            payment: 'cash',
            amount: 601
        },
        {
            id: 'exp_14',
            date: '2026-08-02',
            description: 'Local cab ride',
            category: 'transport',
            payment: 'upi',
            amount: 280
        }
    ];

    // ==========================================
    // 2. APPLICATION STATE
    // ==========================================

    const state = {
        users: {},
        currentUserId: null,
        filters: {
            search: '',
            category: 'all',
            date: ''
        },
        chartPeriod: 'month',
        editingId: null,
        deletingId: null,
        chartInstance: null
    };

    // Helper to get active user
    function getCurrentUser() {
        if (!state.currentUserId || !state.users[state.currentUserId]) {
            return null;
        }
        return state.users[state.currentUserId];
    }

    // ==========================================
    // 3. STORAGE & STATE PERSISTENCE
    // ==========================================

    function loadState() {
        try {
            const rawUsers = localStorage.getItem(STORAGE_USERS_KEY);
            const rawCurrentId = localStorage.getItem(STORAGE_CURRENT_USER_ID_KEY);

            if (rawUsers) {
                state.users = JSON.parse(rawUsers);
            }

            // Ensure at least one default user exists for immediate access
            if (!state.users || Object.keys(state.users).length === 0) {
                initDefaultUser();
            }

            if (rawCurrentId && state.users[rawCurrentId]) {
                state.currentUserId = rawCurrentId;
            } else {
                state.currentUserId = Object.keys(state.users)[0];
            }
        } catch (err) {
            console.warn('Error reading user state from localStorage:', err);
            initDefaultUser();
        }
    }

    function initDefaultUser() {
        const defaultUser = {
            id: 'user_aryan',
            name: 'Aryan Sharma',
            email: 'aryan@gmail.com',
            password: 'password123',
            currency: '₹',
            monthlyBudget: 20000,
            upi: {
                linked: true,
                vpa: 'aryan@okaxis',
                bank: 'HDFC Bank (••4128)',
                autoSync: true,
                lastSynced: '2026-08-22'
            },
            gmail: {
                linked: true,
                email: 'aryan@gmail.com',
                frequency: 'weekly',
                alertBudgetWarning: true,
                alertAiInsights: true,
                alertWeeklyDigest: true,
                alertMonthlyReport: true,
                lastDispatched: null
            },
            budgets: {
                food: 5000,
                transport: 3000,
                shopping: 4000,
                entertainment: 2500,
                other: 2000
            },
            expenses: [...DEMO_EXPENSES]
        };

        state.users = {
            [defaultUser.id]: defaultUser
        };
        state.currentUserId = defaultUser.id;
        saveState();
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(state.users));
            if (state.currentUserId) {
                localStorage.setItem(STORAGE_CURRENT_USER_ID_KEY, state.currentUserId);
            } else {
                localStorage.removeItem(STORAGE_CURRENT_USER_ID_KEY);
            }
        } catch (err) {
            console.error('Failed to save state to localStorage:', err);
        }
    }

    // ==========================================
    // 4. FORMATTING & TOAST UTILITIES
    // ==========================================

    function formatCurrency(amount) {
        const user = getCurrentUser();
        const currency = user ? user.currency : '₹';
        const num = Number(amount) || 0;
        const formatted = num.toLocaleString('en-IN', {
            minimumFractionDigits: num % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        });
        return `${currency}${formatted}`;
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const monthIndex = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${day} ${months[monthIndex] || ''} ${year}`;
        }
        return dateString;
    }

    function showToast(message, type = 'primary') {
        const toastEl = document.getElementById('liveToast');
        const messageEl = document.getElementById('toastMessage');
        if (!toastEl || !messageEl) return;

        let icon = '<i class="bi bi-check-circle-fill"></i>';
        if (type === 'danger') icon = '<i class="bi bi-exclamation-octagon-fill"></i>';
        if (type === 'warning') icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
        if (type === 'info') icon = '<i class="bi bi-info-circle-fill"></i>';

        messageEl.innerHTML = `${icon} <span>${message}</span>`;
        toastEl.className = `toast align-items-center text-bg-${type} border-0 custom-toast`;

        if (window.bootstrap && window.bootstrap.Toast) {
            const toast = window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3500 });
            toast.show();
        }
    }

    function getMonthName(monthNumber) {
        const names = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return names[monthNumber - 1] || '';
    }

    function getActivePeriod() {
        const user = getCurrentUser();
        if (user && user.expenses.length > 0) {
            const sorted = [...user.expenses].sort((a, b) => b.date.localeCompare(a.date));
            const latest = sorted[0].date.split('-');
            return {
                year: parseInt(latest[0], 10),
                month: parseInt(latest[1], 10)
            };
        }
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1
        };
    }

    function getCurrentMonthExpenses() {
        const user = getCurrentUser();
        if (!user) return [];
        const period = getActivePeriod();
        const prefix = `${period.year}-${String(period.month).padStart(2, '0')}`;
        return user.expenses.filter(e => e.date && e.date.startsWith(prefix));
    }

    // ==========================================
    // 5. USER AUTHENTICATION LOGIC
    // ==========================================

    function handleSignIn(e) {
        e.preventDefault();
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        const foundUser = Object.values(state.users).find(
            u => u.email.toLowerCase() === email && u.password === password
        );

        if (!foundUser) {
            showToast('Invalid email or password. Please try again or use Demo Login.', 'danger');
            return;
        }

        state.currentUserId = foundUser.id;
        saveState();

        const authModalEl = document.getElementById('authModal');
        if (authModalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(authModalEl);
            if (modal) modal.hide();
        }

        showToast(`Welcome back, ${foundUser.name}!`, 'success');
        refreshAllViews();
    }

    function handleSignUp(e) {
        e.preventDefault();
        const nameInput = document.getElementById('signupName');
        const emailInput = document.getElementById('signupEmail');
        const passInput = document.getElementById('signupPassword');
        const confirmPassInput = document.getElementById('signupConfirmPassword');
        const budgetInput = document.getElementById('signupBudget');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const password = passInput.value;
        const confirmPass = confirmPassInput.value;
        const budget = parseFloat(budgetInput.value) || 20000;

        if (password !== confirmPass) {
            showToast('Passwords do not match. Please re-enter.', 'danger');
            confirmPassInput.focus();
            return;
        }

        // Check if email already registered
        const exists = Object.values(state.users).some(u => u.email.toLowerCase() === email);
        if (exists) {
            showToast('An account with this email already exists. Please Sign In.', 'warning');
            return;
        }

        // Create new user account
        const newUserId = 'user_' + Date.now();
        const newUser = {
            id: newUserId,
            name: name,
            email: email,
            password: password,
            currency: '₹',
            monthlyBudget: budget,
            upi: {
                linked: true,
                vpa: email.split('@')[0] + '@okaxis',
                bank: 'Bank Account Linked',
                autoSync: true,
                lastSynced: new Date().toISOString().split('T')[0]
            },
            gmail: {
                linked: true,
                email: email,
                frequency: 'weekly',
                alertBudgetWarning: true,
                alertAiInsights: true,
                alertWeeklyDigest: true,
                alertMonthlyReport: true,
                lastDispatched: null
            },
            budgets: {
                food: Math.round(budget * 0.25),
                transport: Math.round(budget * 0.15),
                shopping: Math.round(budget * 0.20),
                entertainment: Math.round(budget * 0.15),
                other: Math.round(budget * 0.10)
            },
            expenses: [...DEMO_EXPENSES]
        };

        state.users[newUserId] = newUser;
        state.currentUserId = newUserId;
        saveState();

        const authModalEl = document.getElementById('authModal');
        if (authModalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(authModalEl);
            if (modal) modal.hide();
        }

        showToast(`Account created! Welcome to ExpenseAI, ${name}.`, 'success');
        refreshAllViews();
    }

    function handleDemoLogin() {
        initDefaultUser();
        state.currentUserId = 'user_aryan';
        saveState();

        const authModalEl = document.getElementById('authModal');
        if (authModalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(authModalEl);
            if (modal) modal.hide();
        }

        showToast('Logged in with Demo Account (Aryan Sharma)', 'info');
        refreshAllViews();
    }

    function handleSignOut() {
        if (!confirm('Are you sure you want to sign out?')) {
            return;
        }
        state.currentUserId = null;
        saveState();
        refreshAllViews();
        showToast('You have been signed out.', 'info');
    }

    // ==========================================
    // 6. UPI INTEGRATION & TRANSACTION SYNC
    // ==========================================

    function renderUpiModal() {
        const user = getCurrentUser();
        const connectedView = document.getElementById('upiConnectedView');
        const setupView = document.getElementById('upiSetupView');
        if (!user) return;

        const isLinked = user.upi && user.upi.linked;
        if (isLinked) {
            if (connectedView) connectedView.style.display = 'block';
            if (setupView) setupView.style.display = 'none';

            // Populate UPI card
            const bankEl = document.getElementById('upiBankName');
            const vpaEl = document.getElementById('upiVpaDisplay');
            const outflowEl = document.getElementById('upiTotalOutflow');
            const autoSyncBadge = document.getElementById('upiAutoSyncBadge');

            if (bankEl) bankEl.textContent = user.upi.bank || 'UPI Bank Account';
            if (vpaEl) vpaEl.textContent = user.upi.vpa || 'username@upi';

            // Calculate total UPI outflow in current month
            const monthExpenses = getCurrentMonthExpenses();
            const upiTotal = monthExpenses
                .filter(e => e.payment === 'upi')
                .reduce((s, i) => s + (Number(i.amount) || 0), 0);

            if (outflowEl) outflowEl.textContent = formatCurrency(upiTotal);
            if (autoSyncBadge) {
                autoSyncBadge.textContent = user.upi.autoSync ? 'Auto-Categorize: ON' : 'Auto-Categorize: OFF';
            }
        } else {
            if (connectedView) connectedView.style.display = 'none';
            if (setupView) setupView.style.display = 'block';

            // Pre-fill default suggested VPA
            const vpaInput = document.getElementById('upiIdInput');
            if (vpaInput) {
                vpaInput.value = (user.email ? user.email.split('@')[0] : 'user') + '@okaxis';
            }
        }
    }

    function handleSaveUpi(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            showToast('Please sign in to link your UPI account.', 'warning');
            return;
        }

        const vpaInput = document.getElementById('upiIdInput');
        const bankInput = document.getElementById('upiBankInput');
        const autoSyncSwitch = document.getElementById('upiAutoSyncSwitch');

        const vpa = vpaInput.value.trim();
        const bank = bankInput.value.trim() || 'Bank Account Linked';
        const autoSync = autoSyncSwitch ? autoSyncSwitch.checked : true;

        if (!vpa || !vpa.includes('@')) {
            showToast('Please enter a valid UPI VPA (e.g. name@okaxis)', 'danger');
            vpaInput.focus();
            return;
        }

        user.upi = {
            linked: true,
            vpa: vpa,
            bank: bank,
            autoSync: autoSync,
            lastSynced: new Date().toISOString().split('T')[0]
        };

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('upiModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast(`UPI ID ${vpa} successfully verified and linked!`, 'success');
    }

    function handleUnlinkUpi() {
        const user = getCurrentUser();
        if (!user) return;

        if (!confirm('Are you sure you want to unlink your UPI account? Automated transaction import will be paused.')) {
            return;
        }

        user.upi = {
            linked: false,
            vpa: '',
            bank: '',
            autoSync: false,
            lastSynced: null
        };

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('upiModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast('UPI account unlinked.', 'info');
    }

    function syncUpiTransactions() {
        const user = getCurrentUser();
        if (!user) {
            showToast('Please sign in first.', 'warning');
            return;
        }

        if (!user.upi || !user.upi.linked) {
            showToast('Please link your UPI account first to enable live sync!', 'warning');
            const modalEl = document.getElementById('upiModal');
            if (modalEl && window.bootstrap) {
                const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
            return;
        }

        // Generate 3 simulated recent bank UPI transactions
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayIso = `${yyyy}-${mm}-${dd}`;

        const simulatedUpiItems = [
            {
                id: 'upi_' + Date.now() + '_1',
                date: todayIso,
                description: `Zomato: Food Order [UPI-UTR: ${Math.floor(10000000 + Math.random() * 90000000)}]`,
                category: 'food',
                payment: 'upi',
                amount: 380
            },
            {
                id: 'upi_' + Date.now() + '_2',
                date: todayIso,
                description: `Blinkit Instant Groceries [UPI-UTR: ${Math.floor(10000000 + Math.random() * 90000000)}]`,
                category: 'food',
                payment: 'upi',
                amount: 540
            },
            {
                id: 'upi_' + Date.now() + '_3',
                date: todayIso,
                description: `HPCL Auto Fuel Pump [UPI-UTR: ${Math.floor(10000000 + Math.random() * 90000000)}]`,
                category: 'transport',
                payment: 'upi',
                amount: 850
            }
        ];

        // Prepend to expenses
        simulatedUpiItems.forEach(item => user.expenses.unshift(item));
        user.upi.lastSynced = todayIso;

        saveState();
        refreshAllViews();

        showToast(`Synced 3 new verified UPI transactions from ${user.upi.bank}!`, 'success');
    }

    // ==========================================
    // 7. GMAIL REMINDERS, DIGESTS & WARNINGS
    // ==========================================

    function renderGmailModal() {
        const user = getCurrentUser();
        if (!user) return;

        const emailInput = document.getElementById('gmailEmailInput');
        const freqSelect = document.getElementById('gmailFrequencySelect');
        const statusBadge = document.getElementById('gmailConnectionStatus');

        if (emailInput) emailInput.value = (user.gmail && user.gmail.email) ? user.gmail.email : user.email;
        if (freqSelect && user.gmail) freqSelect.value = user.gmail.frequency || 'weekly';

        if (statusBadge) {
            const isLinked = user.gmail && user.gmail.linked;
            statusBadge.className = isLinked ? 'badge bg-success-subtle text-success' : 'badge bg-secondary-subtle text-secondary';
            statusBadge.textContent = isLinked ? 'Connected & Scheduled' : 'Not Configured';
        }

        if (user.gmail) {
            const wBox = document.getElementById('alertBudgetWarning');
            const aiBox = document.getElementById('alertAiInsights');
            const wkBox = document.getElementById('alertWeeklyDigest');
            const moBox = document.getElementById('alertMonthlyReport');

            if (wBox) wBox.checked = !!user.gmail.alertBudgetWarning;
            if (aiBox) aiBox.checked = !!user.gmail.alertAiInsights;
            if (wkBox) wkBox.checked = !!user.gmail.alertWeeklyDigest;
            if (moBox) moBox.checked = !!user.gmail.alertMonthlyReport;
        }
    }

    function handleSaveGmailSettings(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            showToast('Please sign in to configure Gmail alerts.', 'warning');
            return;
        }

        const emailInput = document.getElementById('gmailEmailInput');
        const freqSelect = document.getElementById('gmailFrequencySelect');
        const wBox = document.getElementById('alertBudgetWarning');
        const aiBox = document.getElementById('alertAiInsights');
        const wkBox = document.getElementById('alertWeeklyDigest');
        const moBox = document.getElementById('alertMonthlyReport');

        const email = emailInput.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            showToast('Please enter a valid Gmail address.', 'danger');
            emailInput.focus();
            return;
        }

        user.gmail = {
            linked: true,
            email: email,
            frequency: freqSelect.value,
            alertBudgetWarning: wBox ? wBox.checked : true,
            alertAiInsights: aiBox ? aiBox.checked : true,
            alertWeeklyDigest: wkBox ? wkBox.checked : true,
            alertMonthlyReport: moBox ? moBox.checked : true,
            lastDispatched: new Date().toISOString()
        };

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('gmailModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast(`Gmail reminders and spending warnings enabled for ${email}!`, 'success');
    }

    function openEmailPreviewModal() {
        const user = getCurrentUser();
        if (!user) {
            showToast('Please sign in to preview email digests.', 'warning');
            return;
        }

        const period = getActivePeriod();
        const monthName = getMonthName(period.month);
        const monthExpenses = getCurrentMonthExpenses();
        const totalSpent = monthExpenses.reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const monthlyBudget = Number(user.monthlyBudget) || 20000;
        const remaining = monthlyBudget - totalSpent;

        // Recipient and metadata
        const userEmail = (user.gmail && user.gmail.email) ? user.gmail.email : user.email;
        document.getElementById('emailRecipientDisplay').textContent = userEmail;
        document.getElementById('emailFooterAddress').textContent = userEmail;
        document.getElementById('emailUserName').textContent = user.name;
        document.getElementById('emailTimestamp').textContent = `Today at 9:00 AM`;

        document.getElementById('emailTotalSpent').textContent = formatCurrency(totalSpent);
        document.getElementById('emailMonthlyBudget').textContent = formatCurrency(monthlyBudget);

        const remainingEl = document.getElementById('emailRemainingBudget');
        if (remainingEl) {
            remainingEl.textContent = formatCurrency(Math.abs(remaining));
            remainingEl.className = remaining >= 0 ? 'fs-5 text-success' : 'fs-5 text-danger';
        }

        // Warning logic
        const categoryTotals = {};
        Object.keys(CATEGORIES).forEach(k => categoryTotals[k] = 0);
        monthExpenses.forEach(e => {
            const cat = e.category || 'other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
        });

        const overCategories = Object.keys(CATEGORIES).filter(k => {
            const limit = user.budgets[k] || CATEGORIES[k].defaultBudget;
            return categoryTotals[k] >= limit;
        });

        const warningBox = document.getElementById('emailWarningBox');
        const warningText = document.getElementById('emailWarningText');
        const subjectLine = document.getElementById('emailSubjectLine');

        if (overCategories.length > 0) {
            warningBox.className = 'alert alert-danger py-2 px-3 mb-3 small';
            warningText.innerHTML = `<strong>⚠️ CRITICAL OVERRUN:</strong> You have exceeded the allocated budget limit in <strong>${overCategories.map(c => CATEGORIES[c].name).join(', ')}</strong>. Please review your non-essential spending.`;
            subjectLine.textContent = `🚨 URGENT: Budget Limit Exceeded in ${overCategories.map(c => CATEGORIES[c].name).join(', ')} | ExpenseAI Alert`;
        } else if (remaining < monthlyBudget * 0.25) {
            warningBox.className = 'alert alert-warning py-2 px-3 mb-3 small';
            warningText.innerHTML = `<strong>⚡ Budget Warning:</strong> Over 75% of your monthly budget is spent with ${30 - new Date().getDate()} days remaining.`;
            subjectLine.textContent = `⚠️ ExpenseAI Reminder: 75% of Monthly Budget Utilized`;
        } else {
            warningBox.className = 'alert alert-success py-2 px-3 mb-3 small';
            warningText.innerHTML = `<strong>✅ Financial Health Good:</strong> All categories are currently well within their safety margins. Keep it up!`;
            subjectLine.textContent = `📊 ExpenseAI ${monthName} Spending Digest: On Track with Your Budget`;
        }

        // Category breakdown list
        const catListContainer = document.getElementById('emailCategoryList');
        if (catListContainer) {
            let catHtml = '';
            Object.keys(CATEGORIES).forEach(catKey => {
                const meta = CATEGORIES[catKey];
                const amt = categoryTotals[catKey] || 0;
                const limit = user.budgets[catKey] || meta.defaultBudget;
                const pct = limit > 0 ? Math.round((amt / limit) * 100) : 0;

                catHtml += `
                    <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                        <span>${meta.icon} ${meta.name}</span>
                        <span>
                            <strong>${formatCurrency(amt)}</strong> / ${formatCurrency(limit)} 
                            <span class="badge ${pct >= 100 ? 'bg-danger' : (pct >= 75 ? 'bg-warning text-dark' : 'bg-light text-dark')} ms-1">${pct}%</span>
                        </span>
                    </div>
                `;
            });
            catListContainer.innerHTML = catHtml;
        }

        // Personalized AI tip
        const aiTipEl = document.getElementById('emailAiTipText');
        if (aiTipEl) {
            const upiTotal = monthExpenses.filter(e => e.payment === 'upi').reduce((s, i) => s + (Number(i.amount) || 0), 0);
            aiTipEl.textContent = `You've completed ${monthExpenses.filter(e => e.payment === 'upi').length} UPI transactions totaling ${formatCurrency(upiTotal)}. Cutting back on 2 food delivery orders per week can save up to ${formatCurrency(Math.round(totalSpent * 0.15))} monthly!`;
        }

        // Show Modal
        const modalEl = document.getElementById('emailPreviewModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    }

    function dispatchTestEmail() {
        const user = getCurrentUser();
        const userEmail = (user && user.gmail && user.gmail.email) ? user.gmail.email : (user ? user.email : 'you@gmail.com');

        const modalEl = document.getElementById('emailPreviewModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast(`📨 Automated spending digest & alert dispatched to ${userEmail}!`, 'success');
    }

    // ==========================================
    // 8. DASHBOARD STATS & NAVBAR RENDERING
    // ==========================================

    function renderDashboardStats() {
        const user = getCurrentUser();
        const navAuthContainer = document.getElementById('navbarAuthContainer');
        const navSignInBtn = document.getElementById('navSignInBtn');
        const userMenuDropdown = document.getElementById('userMenuDropdown');

        if (!user) {
            // Logged out UI state
            if (navSignInBtn) navSignInBtn.classList.remove('d-none');
            if (userMenuDropdown) userMenuDropdown.classList.add('d-none');

            document.getElementById('welcomeSubtitle').textContent = 'Please sign in to view and manage your expenses.';
            document.getElementById('totalSpentValue').textContent = '₹0';
            document.getElementById('monthlyBudgetValue').textContent = '₹0';
            document.getElementById('budgetRemainingValue').textContent = 'Sign in required';
            document.getElementById('avgDailyValue').textContent = '₹0';
            document.getElementById('transactionsCountValue').textContent = '0';
            return;
        }

        // Logged in UI state
        if (navSignInBtn) navSignInBtn.classList.add('d-none');
        if (userMenuDropdown) userMenuDropdown.classList.remove('d-none');

        // Nav User Avatar & Names
        const navUserAvatar = document.getElementById('navUserAvatar');
        const navUserName = document.getElementById('navUserName');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');

        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        if (navUserAvatar) navUserAvatar.textContent = initials || 'U';
        if (navUserName) navUserName.textContent = user.name.split(' ')[0] || 'User';
        if (dropdownUserName) dropdownUserName.textContent = user.name;
        if (dropdownUserEmail) dropdownUserEmail.textContent = user.email;

        // Nav and Bar Integration Badges
        const isUpiLinked = user.upi && user.upi.linked;
        const navUpiBadge = document.getElementById('navUpiBadge');
        if (navUpiBadge) {
            navUpiBadge.className = isUpiLinked ? 'badge bg-success-subtle text-success ms-auto' : 'badge bg-secondary-subtle text-secondary ms-auto';
            navUpiBadge.textContent = isUpiLinked ? 'Active' : 'Setup';
        }

        const isGmailLinked = user.gmail && user.gmail.linked;
        const navGmailBadge = document.getElementById('navGmailBadge');
        if (navGmailBadge) {
            navGmailBadge.className = isGmailLinked ? 'badge bg-primary-subtle text-primary ms-auto' : 'badge bg-secondary-subtle text-secondary ms-auto';
            navGmailBadge.textContent = isGmailLinked ? (user.gmail.frequency || 'Weekly') : 'Inactive';
        }

        // Integrations Bar on Dashboard
        const upiBarText = document.getElementById('upiBarText');
        const upiBarBadge = document.getElementById('upiBarBadge');
        if (upiBarText) {
            upiBarText.textContent = isUpiLinked ? `UPI: ${user.upi.vpa}` : 'UPI: Not Linked';
        }
        if (upiBarBadge) {
            upiBarBadge.className = isUpiLinked ? 'badge bg-success-subtle text-success' : 'badge bg-secondary-subtle text-secondary';
            upiBarBadge.textContent = isUpiLinked ? 'Active' : 'Setup';
        }

        const gmailBarText = document.getElementById('gmailBarText');
        const gmailBarBadge = document.getElementById('gmailBarBadge');
        if (gmailBarText) {
            gmailBarText.textContent = isGmailLinked ? `Gmail: ${user.gmail.frequency === 'realtime' ? 'Instant Alerts' : user.gmail.frequency + ' Digest'}` : 'Gmail: Inactive';
        }
        if (gmailBarBadge) {
            gmailBarBadge.className = isGmailLinked ? 'badge bg-primary-subtle text-primary' : 'badge bg-secondary-subtle text-secondary';
            gmailBarBadge.textContent = isGmailLinked ? 'Active' : 'Configure';
        }

        // Calculate Stats
        const period = getActivePeriod();
        const monthName = getMonthName(period.month);
        const monthExpenses = getCurrentMonthExpenses();

        const totalSpent = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        document.getElementById('totalSpentValue').textContent = formatCurrency(totalSpent);
        document.getElementById('totalSpentSub').textContent = `${monthName} ${period.year}`;

        const monthlyBudget = Number(user.monthlyBudget) || 20000;
        const budgetRemaining = monthlyBudget - totalSpent;
        document.getElementById('monthlyBudgetValue').textContent = formatCurrency(monthlyBudget);

        const remainingEl = document.getElementById('budgetRemainingValue');
        if (remainingEl) {
            if (budgetRemaining >= 0) {
                remainingEl.textContent = `${formatCurrency(budgetRemaining)} remaining`;
                remainingEl.className = 'text-muted';
            } else {
                remainingEl.textContent = `${formatCurrency(Math.abs(budgetRemaining))} over budget!`;
                remainingEl.className = 'text-danger fw-semibold';
            }
        }

        const daysInMonth = new Date(period.year, period.month, 0).getDate();
        let daysElapsed = 1;
        const now = new Date();
        if (now.getFullYear() === period.year && (now.getMonth() + 1) === period.month) {
            daysElapsed = Math.max(1, now.getDate());
        } else {
            const dayNumbers = monthExpenses.map(e => parseInt(e.date.split('-')[2], 10)).filter(d => !isNaN(d));
            daysElapsed = dayNumbers.length > 0 ? Math.max(...dayNumbers, 1) : daysInMonth;
        }

        const avgDaily = totalSpent / Math.max(1, daysElapsed);
        document.getElementById('avgDailyValue').textContent = formatCurrency(Math.round(avgDaily));
        document.getElementById('avgDailySub').textContent = `Over ${daysElapsed} days`;

        document.getElementById('transactionsCountValue').textContent = monthExpenses.length;
        document.getElementById('transactionsSub').textContent = `In ${monthName}`;

        const welcomeSubtitle = document.getElementById('welcomeSubtitle');
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = `Welcome back, ${user.name.split(' ')[0]}! Here's your spending overview for ${monthName}.`;
        }

        document.querySelectorAll('.currency-prefix').forEach(el => {
            el.textContent = user.currency;
        });
    }

    // ==========================================
    // 9. CATEGORIES BREAKDOWN RENDERING
    // ==========================================

    function renderCategoriesBreakdown() {
        const container = document.getElementById('categoryBreakdownList');
        if (!container) return;

        const user = getCurrentUser();
        if (!user) {
            container.innerHTML = '<div class="text-center py-4 text-muted">Sign in to view categories</div>';
            return;
        }

        const monthExpenses = getCurrentMonthExpenses();
        const totalSpent = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const categoryTotals = {};
        Object.keys(CATEGORIES).forEach(k => categoryTotals[k] = 0);

        monthExpenses.forEach(item => {
            const cat = item.category || 'other';
            if (categoryTotals[cat] !== undefined) {
                categoryTotals[cat] += Number(item.amount) || 0;
            } else {
                categoryTotals['other'] = (categoryTotals['other'] || 0) + (Number(item.amount) || 0);
            }
        });

        let html = '';
        Object.keys(CATEGORIES).forEach(catKey => {
            const meta = CATEGORIES[catKey];
            const amount = categoryTotals[catKey] || 0;
            const percentage = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
            const isFiltered = state.filters.category === catKey;

            html += `
                <div class="category-item d-flex justify-content-between align-items-center ${isFiltered ? 'active-category' : ''}" 
                     data-category="${catKey}" 
                     title="Click to filter expenses by ${meta.name}">
                    <div class="d-flex align-items-center gap-3">
                        <div class="category-icon">
                            ${meta.icon}
                        </div>
                        <div>
                            <span class="fw-semibold">${meta.name}</span>
                            <div class="small text-muted">${percentage}% of spend</div>
                        </div>
                    </div>
                    <div class="text-end">
                        <strong>${formatCurrency(amount)}</strong>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                const cat = item.getAttribute('data-category');
                const categorySelect = document.getElementById('filter-category');
                if (state.filters.category === cat) {
                    state.filters.category = 'all';
                    if (categorySelect) categorySelect.value = 'all';
                } else {
                    state.filters.category = cat;
                    if (categorySelect) categorySelect.value = cat;
                }
                renderExpensesTable();
                renderCategoriesBreakdown();

                const expensesSection = document.getElementById('expenses');
                if (expensesSection) expensesSection.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    // ==========================================
    // 10. CHART.JS VISUALIZATION
    // ==========================================

    function renderSpendingChart() {
        const canvas = document.getElementById('spendingChart');
        if (!canvas) return;

        if (typeof Chart === 'undefined') {
            return;
        }

        const user = getCurrentUser();
        const ctx = canvas.getContext('2d');

        if (state.chartInstance) {
            state.chartInstance.destroy();
            state.chartInstance = null;
        }

        if (!user) {
            return;
        }

        const period = state.chartPeriod || 'month';
        let labels = [];
        let dataPoints = [];

        if (period === 'week') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const last7Days = [];
            const dayTotals = {};

            let refDate = new Date();
            if (user.expenses.length > 0) {
                const sorted = [...user.expenses].sort((a, b) => b.date.localeCompare(a.date));
                refDate = new Date(sorted[0].date);
            }

            for (let i = 6; i >= 0; i--) {
                const d = new Date(refDate);
                d.setDate(d.getDate() - i);
                const iso = d.toISOString().split('T')[0];
                const dayLabel = `${days[d.getDay()]} (${d.getDate()})`;
                last7Days.push(iso);
                labels.push(dayLabel);
                dayTotals[iso] = 0;
            }

            user.expenses.forEach(e => {
                if (dayTotals[e.date] !== undefined) {
                    dayTotals[e.date] += Number(e.amount) || 0;
                }
            });

            dataPoints = last7Days.map(iso => dayTotals[iso] || 0);

        } else if (period === 'year') {
            const activePeriod = getActivePeriod();
            const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            labels = [...monthNamesShort];
            dataPoints = new Array(12).fill(0);

            user.expenses.forEach(e => {
                if (e.date && e.date.startsWith(`${activePeriod.year}-`)) {
                    const monthIndex = parseInt(e.date.split('-')[1], 10) - 1;
                    if (monthIndex >= 0 && monthIndex < 12) {
                        dataPoints[monthIndex] += Number(e.amount) || 0;
                    }
                }
            });

        } else {
            const activePeriod = getActivePeriod();
            const prefix = `${activePeriod.year}-${String(activePeriod.month).padStart(2, '0')}`;
            labels = ['Week 1 (1-7)', 'Week 2 (8-14)', 'Week 3 (15-21)', 'Week 4+ (22-end)'];
            dataPoints = [0, 0, 0, 0];

            user.expenses.forEach(e => {
                if (e.date && e.date.startsWith(prefix)) {
                    const day = parseInt(e.date.split('-')[2], 10);
                    const amount = Number(e.amount) || 0;
                    if (day <= 7) dataPoints[0] += amount;
                    else if (day <= 14) dataPoints[1] += amount;
                    else if (day <= 21) dataPoints[2] += amount;
                    else dataPoints[3] += amount;
                }
            });
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.85)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0.15)');

        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Spending',
                    data: dataPoints,
                    backgroundColor: gradient,
                    borderColor: '#4f46e5',
                    borderWidth: 1.5,
                    borderRadius: 8,
                    maxBarThickness: 45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 13 },
                        callbacks: {
                            label: function (context) {
                                return ` Spent: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 12 }, color: '#6b7280' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' },
                        ticks: {
                            font: { size: 11 },
                            color: '#9ca3af',
                            callback: function (val) {
                                return (user ? user.currency : '₹') + val;
                            }
                        }
                    }
                }
            }
        });
    }

    // ==========================================
    // 11. EXPENSES TABLE CRUD & FILTERS
    // ==========================================

    function getFilteredExpenses() {
        const user = getCurrentUser();
        if (!user) return [];

        let list = [...user.expenses];

        if (state.filters.search.trim()) {
            const query = state.filters.search.toLowerCase().trim();
            list = list.filter(item => {
                const descMatch = (item.description || '').toLowerCase().includes(query);
                const catMeta = CATEGORIES[item.category] || { name: item.category || '' };
                const catMatch = catMeta.name.toLowerCase().includes(query);
                const paymentMatch = (PAYMENT_METHODS[item.payment] || item.payment || '').toLowerCase().includes(query);
                const amountMatch = String(item.amount).includes(query);
                return descMatch || catMatch || paymentMatch || amountMatch;
            });
        }

        if (state.filters.category && state.filters.category !== 'all') {
            list = list.filter(item => item.category === state.filters.category);
        }

        if (state.filters.date) {
            list = list.filter(item => item.date === state.filters.date);
        }

        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return list;
    }

    function renderExpensesTable() {
        const tbody = document.getElementById('expensesTableBody');
        if (!tbody) return;

        const user = getCurrentUser();
        if (!user) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-muted">
                        Please sign in to view and manage expenses.
                    </td>
                </tr>
            `;
            return;
        }

        const filteredList = getFilteredExpenses();
        const totalAmount = filteredList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const countText = document.getElementById('tableCountText');
        if (countText) {
            const totalCount = user.expenses.length;
            countText.textContent = filteredList.length === totalCount
                ? `Showing all ${totalCount} transactions`
                : `Showing ${filteredList.length} of ${totalCount} transactions`;
        }

        const totalText = document.getElementById('tableTotalText');
        if (totalText) totalText.textContent = `Filtered Total: ${formatCurrency(totalAmount)}`;

        if (filteredList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <i class="bi bi-inbox"></i>
                            </div>
                            <h5 class="fw-bold mb-1">No expenses found</h5>
                            <p class="text-muted mb-3">
                                ${user.expenses.length === 0
                    ? "You haven't recorded any expenses yet. Click 'Add Expense' to get started!"
                    : "No transactions match your current search and filter criteria."}
                            </p>
                            ${user.expenses.length === 0 ? `
                                <button class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#addExpenseModal">
                                    <i class="bi bi-plus-lg me-1"></i> Add First Expense
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-outline-secondary" id="emptyStateResetBtn">
                                    <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;

            const resetBtn = document.getElementById('emptyStateResetBtn');
            if (resetBtn) resetBtn.addEventListener('click', resetFilters);
            return;
        }

        let html = '';
        filteredList.forEach(item => {
            const catMeta = CATEGORIES[item.category] || { name: item.category || 'Other', icon: '📦', badgeClass: 'badge-other' };
            const isUpi = item.payment === 'upi';
            const paymentName = PAYMENT_METHODS[item.payment] || item.payment || 'UPI';

            html += `
                <tr data-id="${item.id}">
                    <td>
                        <span class="text-secondary">${formatDate(item.date)}</span>
                    </td>
                    <td>
                        <span class="fw-medium text-dark">${escapeHtml(item.description)}</span>
                    </td>
                    <td>
                        <span class="category-badge ${catMeta.badgeClass}">
                            <span>${catMeta.icon}</span> ${catMeta.name}
                        </span>
                    </td>
                    <td>
                        <span class="badge-payment ${isUpi ? 'badge-upi-verified' : ''}">
                            ${isUpi ? '<i class="bi bi-patch-check-fill text-success me-1"></i>' : ''}${paymentName}
                        </span>
                    </td>
                    <td class="fw-bold text-dark">
                        ${formatCurrency(item.amount)}
                    </td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-secondary btn-action edit-expense-btn me-1" 
                                data-id="${item.id}" 
                                title="Edit this transaction">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-action delete-expense-btn" 
                                data-id="${item.id}" 
                                title="Delete this transaction">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        tbody.querySelectorAll('.edit-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                openEditExpenseModal(id);
            });
        });

        tbody.querySelectorAll('.delete-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                openDeleteConfirmModal(id);
            });
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function resetFilters() {
        state.filters.search = '';
        state.filters.category = 'all';
        state.filters.date = '';

        const s = document.getElementById('search-expenses');
        const c = document.getElementById('filter-category');
        const d = document.getElementById('filter-date');
        if (s) s.value = '';
        if (c) c.value = 'all';
        if (d) d.value = '';

        renderExpensesTable();
        renderCategoriesBreakdown();
    }

    // ==========================================
    // 12. ADD / EDIT EXPENSE MODAL LOGIC
    // ==========================================

    function openAddExpenseModal() {
        state.editingId = null;
        const form = document.getElementById('expense-form');
        if (form) form.reset();

        document.getElementById('expense-id').value = '';
        document.getElementById('addExpenseModalLabel').textContent = 'Add Expense';
        const submitBtn = document.getElementById('saveExpenseSubmitBtn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="bi bi-plus-lg me-1"></i> Add Expense';
        }

        const dateInput = document.getElementById('expense-date');
        if (dateInput) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }
    }

    function openEditExpenseModal(id) {
        const user = getCurrentUser();
        if (!user) return;
        const item = user.expenses.find(e => e.id === id);
        if (!item) return;

        state.editingId = id;
        document.getElementById('expense-id').value = item.id;
        document.getElementById('amount').value = item.amount;
        document.getElementById('description').value = item.description;
        document.getElementById('category').value = item.category;
        document.getElementById('expense-date').value = item.date;
        document.getElementById('payment-method').value = item.payment;

        document.getElementById('addExpenseModalLabel').textContent = 'Edit Expense';
        const submitBtn = document.getElementById('saveExpenseSubmitBtn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Update Expense';
        }

        const modalEl = document.getElementById('addExpenseModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    }

    function handleExpenseFormSubmit(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            showToast('Please sign in first.', 'warning');
            return;
        }

        const amountInput = document.getElementById('amount');
        const descInput = document.getElementById('description');
        const catSelect = document.getElementById('category');
        const dateInput = document.getElementById('expense-date');
        const paymentSelect = document.getElementById('payment-method');

        const amount = parseFloat(amountInput.value);
        const description = descInput.value.trim();
        const category = catSelect.value;
        const date = dateInput.value;
        const payment = paymentSelect.value;

        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount greater than 0', 'danger');
            amountInput.focus();
            return;
        }

        if (!description || !category || !date || !payment) {
            showToast('Please fill out all required fields.', 'danger');
            return;
        }

        if (state.editingId) {
            const idx = user.expenses.findIndex(e => e.id === state.editingId);
            if (idx !== -1) {
                user.expenses[idx] = {
                    ...user.expenses[idx],
                    amount,
                    description,
                    category,
                    date,
                    payment
                };
                showToast('Expense updated successfully!', 'success');
            }
        } else {
            const newExpense = {
                id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                amount,
                description,
                category,
                date,
                payment
            };
            user.expenses.unshift(newExpense);
            showToast('Expense added successfully!', 'success');
        }

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('addExpenseModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
    }

    function openDeleteConfirmModal(id) {
        const user = getCurrentUser();
        if (!user) return;
        const item = user.expenses.find(e => e.id === id);
        if (!item) return;

        state.deletingId = id;
        const detailsEl = document.getElementById('deleteExpenseDetails');
        if (detailsEl) {
            detailsEl.textContent = `"${item.description}" - ${formatCurrency(item.amount)} on ${formatDate(item.date)}`;
        }

        const modalEl = document.getElementById('deleteConfirmModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    }

    function handleConfirmDelete() {
        const user = getCurrentUser();
        if (!user || !state.deletingId) return;

        const id = state.deletingId;
        user.expenses = user.expenses.filter(e => e.id !== id);
        state.deletingId = null;

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('deleteConfirmModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast('Expense removed', 'warning');
    }

    // ==========================================
    // 13. BUDGET SECTION & MANAGEMENT
    // ==========================================

    function renderBudgets() {
        const container = document.getElementById('budgetCardsContainer');
        if (!container) return;

        const user = getCurrentUser();
        if (!user) {
            container.innerHTML = '<div class="col-12 text-center py-4 text-muted">Sign in to view budgets</div>';
            return;
        }

        const monthExpenses = getCurrentMonthExpenses();
        const spentByCategory = {};
        Object.keys(CATEGORIES).forEach(k => spentByCategory[k] = 0);

        monthExpenses.forEach(item => {
            const cat = item.category || 'other';
            if (spentByCategory[cat] !== undefined) {
                spentByCategory[cat] += Number(item.amount) || 0;
            } else {
                spentByCategory['other'] = (spentByCategory['other'] || 0) + (Number(item.amount) || 0);
            }
        });

        let html = '';
        Object.keys(CATEGORIES).forEach(catKey => {
            const meta = CATEGORIES[catKey];
            const spent = spentByCategory[catKey] || 0;
            const limit = Number(user.budgets[catKey]) || meta.defaultBudget;
            const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;

            let barColorClass = 'bg-primary';
            let statusBadge = '';
            if (percentage >= 100) {
                barColorClass = 'bg-danger';
                statusBadge = `<span class="badge bg-danger-subtle text-danger ms-2"><i class="bi bi-exclamation-triangle-fill"></i> Exceeded</span>`;
            } else if (percentage >= 75) {
                barColorClass = 'bg-warning';
                statusBadge = `<span class="badge bg-warning-subtle text-warning-emphasis ms-2">Near Limit</span>`;
            }

            const clampedWidth = Math.min(percentage, 100);

            html += `
                <div class="col-md-4 col-sm-6">
                    <div class="card dashboard-card h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h5 class="mb-0 fw-semibold d-flex align-items-center">
                                    <span class="me-2">${meta.icon}</span>
                                    <span>${meta.name}</span>
                                    ${statusBadge}
                                </h5>
                                <span class="fw-bold ${percentage >= 100 ? 'text-danger' : 'text-muted'}">
                                    ${percentage}%
                                </span>
                            </div>

                            <p class="text-muted mb-3 small d-flex justify-content-between">
                                <span>Spent: <strong>${formatCurrency(spent)}</strong></span>
                                <span>Limit: ${formatCurrency(limit)}</span>
                            </p>

                            <div class="progress" role="progressbar" aria-label="${meta.name} budget" aria-valuenow="${clampedWidth}" aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar ${barColorClass}" style="width: ${clampedWidth}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function openManageBudgetModal() {
        const user = getCurrentUser();
        if (!user) return;

        const totalBudgetInput = document.getElementById('budget-total');
        if (totalBudgetInput) totalBudgetInput.value = user.monthlyBudget || 20000;

        Object.keys(CATEGORIES).forEach(k => {
            const input = document.getElementById(`budget-${k}`);
            if (input) input.value = user.budgets[k] || CATEGORIES[k].defaultBudget;
        });
    }

    function handleSaveBudgets(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const totalInput = document.getElementById('budget-total');
        if (totalInput) {
            const newTotal = parseFloat(totalInput.value);
            if (!isNaN(newTotal) && newTotal > 0) user.monthlyBudget = newTotal;
        }

        Object.keys(CATEGORIES).forEach(k => {
            const input = document.getElementById(`budget-${k}`);
            if (input) {
                const val = parseFloat(input.value);
                if (!isNaN(val) && val >= 0) user.budgets[k] = val;
            }
        });

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('manageBudgetModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast('Budgets updated successfully!', 'success');
    }

    // ==========================================
    // 14. AI INSIGHTS & SMART ADVISOR
    // ==========================================

    function generateAiInsights() {
        const cardsContainer = document.getElementById('aiInsightsCards');
        if (!cardsContainer) return;

        const user = getCurrentUser();
        if (!user) {
            cardsContainer.innerHTML = '<div class="col-12 text-center py-4 text-muted">Sign in to view AI Insights</div>';
            return;
        }

        const period = getActivePeriod();
        const monthName = getMonthName(period.month);
        const monthExpenses = getCurrentMonthExpenses();
        const totalSpent = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const monthlyBudget = Number(user.monthlyBudget) || 20000;

        const daysInMonth = new Date(period.year, period.month, 0).getDate();
        let daysElapsed = 1;
        const now = new Date();
        if (now.getFullYear() === period.year && (now.getMonth() + 1) === period.month) {
            daysElapsed = Math.max(1, now.getDate());
        } else {
            const dayNumbers = monthExpenses.map(e => parseInt(e.date.split('-')[2], 10)).filter(d => !isNaN(d));
            daysElapsed = dayNumbers.length > 0 ? Math.max(...dayNumbers, 1) : 22;
        }

        const avgDaily = totalSpent / Math.max(1, daysElapsed);
        const projectedTotal = Math.round(avgDaily * daysInMonth);
        const isProjectedOverBudget = projectedTotal > monthlyBudget;

        const categoryTotals = {};
        Object.keys(CATEGORIES).forEach(k => categoryTotals[k] = 0);
        monthExpenses.forEach(e => {
            const cat = e.category || 'other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
        });

        let topCategory = 'food';
        let topCategoryAmount = 0;
        Object.keys(categoryTotals).forEach(cat => {
            if (categoryTotals[cat] > topCategoryAmount) {
                topCategoryAmount = categoryTotals[cat];
                topCategory = cat;
            }
        });
        const topCatMeta = CATEGORIES[topCategory] || CATEGORIES.food;
        const topCatPercentage = totalSpent > 0 ? Math.round((topCategoryAmount / totalSpent) * 100) : 0;

        let highestUtilCategory = 'food';
        let highestUtilRatio = 0;
        Object.keys(CATEGORIES).forEach(cat => {
            const limit = user.budgets[cat] || CATEGORIES[cat].defaultBudget;
            const ratio = limit > 0 ? (categoryTotals[cat] / limit) : 0;
            if (ratio > highestUtilRatio) {
                highestUtilRatio = ratio;
                highestUtilCategory = cat;
            }
        });
        const highestUtilMeta = CATEGORIES[highestUtilCategory] || CATEGORIES.food;
        const highestUtilPercent = Math.round(highestUtilRatio * 100);

        const upiTotal = monthExpenses.filter(e => e.payment === 'upi').reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const upiPercentage = totalSpent > 0 ? Math.round((upiTotal / totalSpent) * 100) : 0;

        cardsContainer.innerHTML = `
            <div class="col-md-6 col-lg-3">
                <div class="ai-stat-card">
                    <span class="ai-badge bg-primary-subtle text-primary">
                        <i class="bi bi-speedometer2"></i> Velocity
                    </span>
                    <h6 class="fw-bold mb-1">Month-End Forecast</h6>
                    <p class="mb-2 text-dark fs-5 fw-bold">${formatCurrency(projectedTotal)}</p>
                    <p class="small text-muted mb-0">
                        At ${formatCurrency(Math.round(avgDaily))}/day, you are projected to 
                        <span class="${isProjectedOverBudget ? 'text-danger fw-semibold' : 'text-success fw-semibold'}">
                            ${isProjectedOverBudget ? 'exceed budget by ' + formatCurrency(projectedTotal - monthlyBudget) : 'stay within budget'}
                        </span>.
                    </p>
                </div>
            </div>

            <div class="col-md-6 col-lg-3">
                <div class="ai-stat-card">
                    <span class="ai-badge bg-warning-subtle text-warning-emphasis">
                        <i class="bi bi-pie-chart-fill"></i> Top Driver
                    </span>
                    <h6 class="fw-bold mb-1">${topCatMeta.icon} ${topCatMeta.name} (${topCatPercentage}%)</h6>
                    <p class="mb-2 text-dark fs-5 fw-bold">${formatCurrency(topCategoryAmount)}</p>
                    <p class="small text-muted mb-0">
                        ${topCatMeta.name} is your highest expense area in ${monthName}, accounting for ${topCatPercentage}% of total outflow.
                    </p>
                </div>
            </div>

            <div class="col-md-6 col-lg-3">
                <div class="ai-stat-card">
                    <span class="ai-badge ${highestUtilPercent >= 90 ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info-emphasis'}">
                        <i class="bi bi-shield-check"></i> Budget Health
                    </span>
                    <h6 class="fw-bold mb-1">${highestUtilMeta.icon} ${highestUtilMeta.name} at ${highestUtilPercent}%</h6>
                    <p class="mb-2 text-dark fs-5 fw-bold">
                        ${highestUtilPercent >= 100 ? 'Over limit!' : formatCurrency(Math.max(0, (user.budgets[highestUtilCategory] || 3000) - categoryTotals[highestUtilCategory])) + ' left'}
                    </p>
                    <p class="small text-muted mb-0">
                        ${highestUtilPercent >= 80 ? '⚠️ Consider throttling spending in this category.' : 'All category budgets are currently under safe control.'}
                    </p>
                </div>
            </div>

            <div class="col-md-6 col-lg-3">
                <div class="ai-stat-card">
                    <span class="ai-badge bg-success-subtle text-success">
                        <i class="bi bi-lightbulb-fill"></i> Smart Tip
                    </span>
                    <h6 class="fw-bold mb-1">UPI & Micro Spends</h6>
                    <p class="mb-2 text-dark fs-5 fw-bold">${upiPercentage}% via UPI</p>
                    <p class="small text-muted mb-0">
                        Frequent digital payments add up quickly. Setting a daily digital allowance could save ~${formatCurrency(Math.round(totalSpent * 0.12))} this month!
                    </p>
                </div>
            </div>
        `;
    }

    function handleAiQuestion(questionText) {
        const query = (questionText || '').trim().toLowerCase();
        if (!query) return;

        const responseBox = document.getElementById('aiResponseContainer');
        const contentBox = document.getElementById('aiResponseContent');
        const timeBox = document.getElementById('aiResponseTime');
        if (!responseBox || !contentBox) return;

        responseBox.style.display = 'block';
        contentBox.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-muted py-2">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span>ExpenseAI is analyzing your transaction history...</span>
            </div>
        `;
        if (timeBox) timeBox.textContent = 'Just now';

        setTimeout(() => {
            const user = getCurrentUser();
            if (!user) {
                contentBox.innerHTML = '<p class="text-danger">Please sign in to ask questions about your finances.</p>';
                return;
            }

            const period = getActivePeriod();
            const monthExpenses = getCurrentMonthExpenses();
            const totalSpent = monthExpenses.reduce((s, i) => s + (Number(i.amount) || 0), 0);
            const monthlyBudget = Number(user.monthlyBudget) || 20000;

            const categoryTotals = {};
            Object.keys(CATEGORIES).forEach(k => categoryTotals[k] = 0);
            monthExpenses.forEach(e => {
                const cat = e.category || 'other';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
            });

            let answerHtml = '';

            if (query.includes('save') || query.includes('saving') || query.includes('save-more')) {
                const highest = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a])[0] || 'food';
                const potentialSavings = Math.round(categoryTotals[highest] * 0.25);
                answerHtml = `
                    <p class="mb-2"><strong>Smart Savings Plan for ${getMonthName(period.month)}:</strong></p>
                    <ul class="mb-2 ps-3">
                        <li><strong>Reduce ${CATEGORIES[highest].name} by 25%:</strong> You have spent <strong>${formatCurrency(categoryTotals[highest])}</strong> on ${CATEGORIES[highest].name}. Preparing meals/cutting back slightly here frees up <strong>${formatCurrency(potentialSavings)}</strong> immediately.</li>
                        <li><strong>Audit UPI Micro-Transactions:</strong> Small transactions under ₹300 represent frequent impulse purchases. Consolidating these saves approximately <strong>${formatCurrency(Math.round(totalSpent * 0.08))}</strong> monthly.</li>
                        <li><strong>Target Buffer:</strong> If you maintain your current remaining balance of <strong>${formatCurrency(Math.max(0, monthlyBudget - totalSpent))}</strong>, you will finish the month comfortably in the green!</li>
                    </ul>
                `;
            } else if (query.includes('food') || query.includes('lunch') || query.includes('dinner')) {
                const foodSpent = categoryTotals['food'] || 0;
                const foodLimit = user.budgets['food'] || 5000;
                const foodItems = monthExpenses.filter(e => e.category === 'food');
                answerHtml = `
                    <p class="mb-2"><strong>🍔 Food & Dining Breakdown:</strong></p>
                    <p class="mb-2">You have logged <strong>${foodItems.length} food transactions</strong> totaling <strong>${formatCurrency(foodSpent)}</strong> out of your <strong>${formatCurrency(foodLimit)}</strong> budget (${Math.round((foodSpent / foodLimit) * 100)}% utilized).</p>
                    <p class="mb-0 text-muted small">Top food expense: ${foodItems.length > 0 ? `<strong>${foodItems[0].description}</strong> (${formatCurrency(foodItems[0].amount)})` : 'None'}.</p>
                `;
            } else if (query.includes('top') || query.includes('category') || query.includes('top-expense')) {
                const sortedCats = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);
                const topCat = sortedCats[0];
                const topMeta = CATEGORIES[topCat];
                answerHtml = `
                    <p class="mb-2"><strong>📊 Top Spending Category:</strong></p>
                    <p class="mb-2">Your highest outflow is in <strong>${topMeta.icon} ${topMeta.name}</strong> with <strong>${formatCurrency(categoryTotals[topCat])}</strong> (${Math.round((categoryTotals[topCat] / Math.max(1, totalSpent)) * 100)}% of all spending).</p>
                    <div class="p-2 bg-light rounded small">
                        <strong>Runner-up categories:</strong> ${CATEGORIES[sortedCats[1]].name} (${formatCurrency(categoryTotals[sortedCats[1]])}), ${CATEGORIES[sortedCats[2]].name} (${formatCurrency(categoryTotals[sortedCats[2]])}).
                    </div>
                `;
            } else if (query.includes('risk') || query.includes('budget') || query.includes('budget-risk') || query.includes('over')) {
                const overBudgetCats = Object.keys(CATEGORIES).filter(k => {
                    const limit = user.budgets[k] || CATEGORIES[k].defaultBudget;
                    return categoryTotals[k] >= limit;
                });
                const nearBudgetCats = Object.keys(CATEGORIES).filter(k => {
                    const limit = user.budgets[k] || CATEGORIES[k].defaultBudget;
                    return categoryTotals[k] >= (limit * 0.75) && categoryTotals[k] < limit;
                });

                if (overBudgetCats.length > 0) {
                    answerHtml = `
                        <p class="text-danger fw-bold mb-1">⚠️ Budget Overrun Detected:</p>
                        <p class="mb-2">You have exceeded your limit in <strong>${overBudgetCats.map(c => CATEGORIES[c].name).join(', ')}</strong>.</p>
                        <p class="small text-muted mb-0">Recommendation: Freeze optional purchases in these categories for the next 7 days.</p>
                    `;
                } else if (nearBudgetCats.length > 0) {
                    answerHtml = `
                        <p class="text-warning-emphasis fw-bold mb-1">⚡ Budget Caution Alert:</p>
                        <p class="mb-2"><strong>${nearBudgetCats.map(c => CATEGORIES[c].name).join(', ')}</strong> is approaching its threshold (>75% allocated).</p>
                        <p class="small text-muted mb-0">Total remaining across all budgets is <strong>${formatCurrency(Math.max(0, monthlyBudget - totalSpent))}</strong>.</p>
                    `;
                } else {
                    answerHtml = `
                        <p class="text-success fw-bold mb-1">✅ Excellent Financial Health!</p>
                        <p class="mb-1">All of your spending categories are currently well within their safety margins.</p>
                        <p class="small text-muted mb-0">Total remaining budget for ${getMonthName(period.month)}: <strong>${formatCurrency(monthlyBudget - totalSpent)}</strong>.</p>
                    `;
                }
            } else {
                answerHtml = `
                    <p class="mb-2"><strong>Analysis for "${escapeHtml(questionText)}":</strong></p>
                    <p class="mb-2">In ${getMonthName(period.month)}, your total outflow is <strong>${formatCurrency(totalSpent)}</strong> across <strong>${monthExpenses.length} transactions</strong>.</p>
                    <div class="row g-2 small text-muted">
                        <div class="col-6">🍔 Food: <strong>${formatCurrency(categoryTotals.food)}</strong></div>
                        <div class="col-6">🚗 Transport: <strong>${formatCurrency(categoryTotals.transport)}</strong></div>
                        <div class="col-6">🛍️ Shopping: <strong>${formatCurrency(categoryTotals.shopping)}</strong></div>
                        <div class="col-6">🎮 Entertainment: <strong>${formatCurrency(categoryTotals.entertainment)}</strong></div>
                    </div>
                `;
            }

            contentBox.innerHTML = answerHtml;
        }, 450);
    }

    // ==========================================
    // 15. PROFILE, SETTINGS & CSV EXPORT
    // ==========================================

    function openProfileModal() {
        const user = getCurrentUser();
        if (!user) return;

        const nameInput = document.getElementById('userNameInput');
        const emailInput = document.getElementById('userEmailInput');
        const currSelect = document.getElementById('currencySelect');

        if (nameInput) nameInput.value = user.name;
        if (emailInput) emailInput.value = user.email;
        if (currSelect) currSelect.value = user.currency;
    }

    function handleSaveProfile(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const nameInput = document.getElementById('userNameInput');
        const currSelect = document.getElementById('currencySelect');

        if (nameInput && nameInput.value.trim()) user.name = nameInput.value.trim();
        if (currSelect && currSelect.value) user.currency = currSelect.value;

        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('profileModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast('Profile settings saved!', 'success');
    }

    function exportExpensesAsCsv() {
        const user = getCurrentUser();
        if (!user || user.expenses.length === 0) {
            showToast('No expenses to export!', 'warning');
            return;
        }

        const headers = ['ID', 'Date', 'Description', 'Category', 'Payment Method', `Amount (${user.currency})`];
        const rows = user.expenses.map(e => [
            `"${e.id}"`,
            `"${e.date}"`,
            `"${(e.description || '').replace(/"/g, '""')}"`,
            `"${(CATEGORIES[e.category] ? CATEGORIES[e.category].name : e.category)}"`,
            `"${PAYMENT_METHODS[e.payment] || e.payment}"`,
            Number(e.amount) || 0
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `ExpenseAI_${user.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Expenses exported as CSV file!', 'success');
    }

    function resetToSampleDemoData() {
        const user = getCurrentUser();
        if (!user) return;

        if (!confirm('Are you sure you want to restore the sample demo transactions? Your custom changes will be replaced.')) {
            return;
        }

        user.expenses = [...DEMO_EXPENSES];
        user.budgets = {
            food: 5000,
            transport: 3000,
            shopping: 4000,
            entertainment: 2500,
            other: 2000
        };
        user.monthlyBudget = 20000;
        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('profileModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast('Restored sample demo data successfully!', 'info');
    }

    function clearAllExpenses() {
        const user = getCurrentUser();
        if (!user) return;

        if (!confirm('⚠️ WARNING: This will permanently erase ALL expenses for your account! Continue?')) {
            return;
        }
        user.expenses = [];
        saveState();
        refreshAllViews();

        const modalEl = document.getElementById('profileModal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast('All transactions cleared.', 'warning');
    }

    // ==========================================
    // 16. GLOBAL REFRESH & EVENT LISTENERS
    // ==========================================

    function refreshAllViews() {
        renderDashboardStats();
        renderCategoriesBreakdown();
        renderSpendingChart();
        renderExpensesTable();
        renderBudgets();
        generateAiInsights();
        renderUpiModal();
        renderGmailModal();
    }

    function setupEventListeners() {
        // Auth Forms & Actions
        const signInForm = document.getElementById('signInForm');
        if (signInForm) signInForm.addEventListener('submit', handleSignIn);

        const signUpForm = document.getElementById('signUpForm');
        if (signUpForm) signUpForm.addEventListener('submit', handleSignUp);

        const demoBtn = document.getElementById('quickDemoLoginBtn');
        if (demoBtn) demoBtn.addEventListener('click', handleDemoLogin);

        const signOutBtn = document.getElementById('menuSignOutBtn');
        if (signOutBtn) signOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleSignOut();
        });

        // UPI Forms & Actions
        const upiForm = document.getElementById('upiForm');
        if (upiForm) upiForm.addEventListener('submit', handleSaveUpi);

        const unlinkUpiBtn = document.getElementById('unlinkUpiBtn');
        if (unlinkUpiBtn) unlinkUpiBtn.addEventListener('click', handleUnlinkUpi);

        const syncUpiNowBtn = document.getElementById('syncUpiNowBtn');
        if (syncUpiNowBtn) syncUpiNowBtn.addEventListener('click', syncUpiTransactions);

        const syncUpiTransactionsBtn = document.getElementById('syncUpiTransactionsBtn');
        if (syncUpiTransactionsBtn) syncUpiTransactionsBtn.addEventListener('click', syncUpiTransactions);

        const menuLinkUpiBtn = document.getElementById('menuLinkUpiBtn');
        if (menuLinkUpiBtn) {
            menuLinkUpiBtn.addEventListener('click', (e) => {
                e.preventDefault();
                renderUpiModal();
                const m = document.getElementById('upiModal');
                if (m && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(m).show();
            });
        }

        // Gmail Forms & Actions
        const gmailForm = document.getElementById('gmailSettingsForm');
        if (gmailForm) gmailForm.addEventListener('submit', handleSaveGmailSettings);

        const menuLinkGmailBtn = document.getElementById('menuLinkGmailBtn');
        if (menuLinkGmailBtn) {
            menuLinkGmailBtn.addEventListener('click', (e) => {
                e.preventDefault();
                renderGmailModal();
                const m = document.getElementById('gmailModal');
                if (m && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(m).show();
            });
        }

        const previewEmailModalBtn = document.getElementById('previewEmailModalBtn');
        if (previewEmailModalBtn) previewEmailModalBtn.addEventListener('click', openEmailPreviewModal);

        const previewEmailQuickBtn = document.getElementById('previewEmailQuickBtn');
        if (previewEmailQuickBtn) previewEmailQuickBtn.addEventListener('click', openEmailPreviewModal);

        const sendEmailReportBtn = document.getElementById('sendEmailReportBtn');
        if (sendEmailReportBtn) sendEmailReportBtn.addEventListener('click', openEmailPreviewModal);

        const confirmDispatchEmailBtn = document.getElementById('confirmDispatchEmailBtn');
        if (confirmDispatchEmailBtn) confirmDispatchEmailBtn.addEventListener('click', dispatchTestEmail);

        // Expense Forms & CRUD
        const expenseForm = document.getElementById('expense-form');
        if (expenseForm) expenseForm.addEventListener('submit', handleExpenseFormSubmit);

        const addBtn1 = document.getElementById('dashboardAddExpenseBtn');
        if (addBtn1) addBtn1.addEventListener('click', openAddExpenseModal);

        const addBtn2 = document.getElementById('expensesSectionAddBtn');
        if (addBtn2) addBtn2.addEventListener('click', openAddExpenseModal);

        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

        // Budgets Form
        const budgetForm = document.getElementById('budget-form');
        if (budgetForm) budgetForm.addEventListener('submit', handleSaveBudgets);

        const manageBudgetBtn = document.getElementById('manageBudgetBtn');
        if (manageBudgetBtn) manageBudgetBtn.addEventListener('click', openManageBudgetModal);

        // Profile Form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) profileForm.addEventListener('submit', handleSaveProfile);

        const menuProfileBtn = document.getElementById('menuProfileBtn');
        if (menuProfileBtn) {
            menuProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openProfileModal();
                const m = document.getElementById('profileModal');
                if (m && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(m).show();
            });
        }

        // Table filters
        const searchInput = document.getElementById('search-expenses');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.filters.search = e.target.value;
                renderExpensesTable();
            });
        }

        const categorySelect = document.getElementById('filter-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                state.filters.category = e.target.value;
                renderExpensesTable();
                renderCategoriesBreakdown();
            });
        }

        const dateInput = document.getElementById('filter-date');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                state.filters.date = e.target.value;
                renderExpensesTable();
            });
        }

        const resetBtn = document.getElementById('resetFiltersBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetFilters);

        // Chart period select
        const chartSelect = document.getElementById('time-period');
        if (chartSelect) {
            chartSelect.addEventListener('change', (e) => {
                state.chartPeriod = e.target.value;
                renderSpendingChart();
            });
        }

        // CSV export
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportExpensesAsCsv);

        const profileExportBtn = document.getElementById('profileExportCsvBtn');
        if (profileExportBtn) profileExportBtn.addEventListener('click', exportExpensesAsCsv);

        // Demo data & clear buttons
        const resetDemoBtn = document.getElementById('resetDemoDataBtn');
        if (resetDemoBtn) resetDemoBtn.addEventListener('click', resetToSampleDemoData);

        const clearBtn = document.getElementById('clearAllDataBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearAllExpenses);

        // AI Assistant
        const refreshAiBtn = document.getElementById('refreshAiBtn');
        if (refreshAiBtn) {
            refreshAiBtn.addEventListener('click', () => {
                generateAiInsights();
                showToast('AI Insights refreshed with latest data!', 'info');
            });
        }

        const askAiBtn = document.getElementById('askAiBtn');
        const aiInput = document.getElementById('aiQuestionInput');
        if (askAiBtn && aiInput) {
            askAiBtn.addEventListener('click', () => handleAiQuestion(aiInput.value));
            aiInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAiQuestion(aiInput.value);
                }
            });
        }

        document.querySelectorAll('#aiPromptChips .ai-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                handleAiQuestion(prompt);
                if (aiInput) aiInput.value = chip.textContent.trim();
            });
        });

        // UPI Provider Dropdown Sync
        const providerSelect = document.getElementById('upiProviderSelect');
        const upiIdInput = document.getElementById('upiIdInput');
        if (providerSelect && upiIdInput) {
            providerSelect.addEventListener('change', () => {
                const val = providerSelect.value;
                if (val !== 'custom') {
                    const currentPrefix = upiIdInput.value.split('@')[0] || 'username';
                    upiIdInput.value = `${currentPrefix}${val}`;
                }
            });
        }

        // ScrollSpy
        setupNavbarScrollSpy();
    }

    function setupNavbarScrollSpy() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('#mainNav .nav-link');

        function onScroll() {
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            sections.forEach(current => {
                const sectionHeight = current.offsetHeight;
                const sectionTop = current.offsetTop - 120;
                const sectionId = current.getAttribute('id');

                if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${sectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const navbarCollapse = document.getElementById('navbarContent');
                if (navbarCollapse && navbarCollapse.classList.contains('show') && window.bootstrap) {
                    const bsCollapse = window.bootstrap.Collapse.getInstance(navbarCollapse);
                    if (bsCollapse) bsCollapse.hide();
                }
            });
        });
    }

    // ==========================================
    // 17. INITIALIZATION
    // ==========================================

    document.addEventListener('DOMContentLoaded', () => {
        loadState();
        setupEventListeners();
        refreshAllViews();
        console.log('ExpenseAI initialized with Authentication, UPI Sync, and Gmail Alerts.');
    });

})();

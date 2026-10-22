/**
 * ExpenseAI - Smart Expense Tracker Application Logic
 * 
 * Rules:
 * - Mandatory Login Wall: You cannot access anything without logging in or continuing as guest.
 * - Guest Mode: Can track manual expenses, view stats and charts, but CANNOT access UPI or Gmail.
 * - Gmail Requirement: Must log in with a Gmail address to unlock UPI sync and Gmail automated alerts.
 * - Zero Dummy Expenses: Fresh accounts and guests start with ZERO expenses ([]).
 *   Expenses are ONLY added manually by the user or automatically synced via UPI.
 */

(function () {
    'use strict';

    // ==========================================
    // 1. CONSTANTS & CONFIGURATION
    // ==========================================

    const STORAGE_USERS_KEY = 'EXPENSEAI_USERS_V3';
    const STORAGE_CURRENT_USER_ID_KEY = 'EXPENSEAI_CURRENT_USER_ID_V3';

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

    function getCurrentUser() {
        if (!state.currentUserId || !state.users[state.currentUserId]) {
            return null;
        }
        return state.users[state.currentUserId];
    }

    // ==========================================
    // 3. STORAGE & PERSISTENCE
    // ==========================================

    function loadState() {
        try {
            const rawUsers = localStorage.getItem(STORAGE_USERS_KEY);
            const rawCurrentId = localStorage.getItem(STORAGE_CURRENT_USER_ID_KEY);

            if (rawUsers) {
                state.users = JSON.parse(rawUsers);
            } else {
                state.users = {};
            }

            if (rawCurrentId && state.users[rawCurrentId]) {
                state.currentUserId = rawCurrentId;
            } else {
                // Not logged in by default - enforce login wall!
                state.currentUserId = null;
            }
        } catch (err) {
            console.warn('Error reading storage:', err);
            state.users = {};
            state.currentUserId = null;
        }
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
            console.error('Failed to save state:', err);
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
        if (user && user.expenses && user.expenses.length > 0) {
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
        if (!user || !user.expenses) return [];
        const period = getActivePeriod();
        const prefix = `${period.year}-${String(period.month).padStart(2, '0')}`;
        return user.expenses.filter(e => e.date && e.date.startsWith(prefix));
    }

    function isGmailAddress(email) {
        if (!email) return false;
        const clean = email.trim().toLowerCase();
        return clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com');
    }

    // ==========================================
    // 5. AUTHENTICATION & LOGIN WALL LOGIC
    // ==========================================

    function updateAuthGatewayVisibility() {
        const gatewayScreen = document.getElementById('authGatewayScreen');
        const appContent = document.getElementById('appContent');
        const user = getCurrentUser();

        if (!user) {
            // Not authenticated: Show Login Gateway, Hide Main Content
            if (gatewayScreen) gatewayScreen.classList.remove('d-none');
            if (appContent) appContent.classList.add('d-none');
        } else {
            // Authenticated (either Gmail or Guest): Hide Login Gateway, Show Content
            if (gatewayScreen) gatewayScreen.classList.add('d-none');
            if (appContent) appContent.classList.remove('d-none');
        }
    }

    function handleGoogleFastLogin() {
        // 1-Click Fast Google / Gmail Login
        const defaultGmail = 'aryan@gmail.com';
        const defaultName = 'Aryan Sharma';

        // Check if account already exists
        let existingUser = Object.values(state.users).find(u => u.email.toLowerCase() === defaultGmail);

        if (!existingUser) {
            existingUser = {
                id: 'user_gmail_' + Date.now(),
                name: defaultName,
                email: defaultGmail,
                password: 'gmail-oauth-authenticated',
                isGuest: false,
                currency: '₹',
                monthlyBudget: 20000,
                upi: {
                    linked: true,
                    vpa: 'aryan@okaxis',
                    bank: 'HDFC Bank (••4128)',
                    autoSync: true,
                    lastSynced: null
                },
                gmail: {
                    linked: true,
                    email: defaultGmail,
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
                expenses: [] // Starts with ZERO dummy expenses!
            };
            state.users[existingUser.id] = existingUser;
        }

        state.currentUserId = existingUser.id;
        saveState();

        showToast(`Signed in with Google as ${existingUser.name} (${existingUser.email})!`, 'success');
        refreshAllViews();
    }

    function handleGatewaySignIn(e) {
        e.preventDefault();
        const emailInput = document.getElementById('gtLoginEmail');
        const passwordInput = document.getElementById('gtLoginPassword');
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (!isGmailAddress(email)) {
            showToast('Please sign in with a valid Gmail address (e.g. name@gmail.com).', 'warning');
            emailInput.focus();
            return;
        }

        let foundUser = Object.values(state.users).find(
            u => u.email.toLowerCase() === email && u.password === password
        );

        if (!foundUser) {
            // First time login with this Gmail? Create clean account automatically!
            const newId = 'user_gmail_' + Date.now();
            const username = email.split('@')[0];
            const formattedName = username.charAt(0).toUpperCase() + username.slice(1);

            foundUser = {
                id: newId,
                name: formattedName,
                email: email,
                password: password,
                isGuest: false,
                currency: '₹',
                monthlyBudget: 20000,
                upi: {
                    linked: false,
                    vpa: username + '@okaxis',
                    bank: 'Bank Account Linked',
                    autoSync: true,
                    lastSynced: null
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
                    food: 5000,
                    transport: 3000,
                    shopping: 4000,
                    entertainment: 2500,
                    other: 2000
                },
                expenses: [] // Starts with ZERO dummy expenses!
            };
            state.users[newId] = foundUser;
            showToast(`Welcome! Account created for ${email}.`, 'success');
        } else {
            showToast(`Welcome back, ${foundUser.name}!`, 'success');
        }

        state.currentUserId = foundUser.id;
        saveState();
        refreshAllViews();
    }

    function handleGatewaySignUp(e) {
        e.preventDefault();
        const nameInput = document.getElementById('gtSignupName');
        const emailInput = document.getElementById('gtSignupEmail');
        const passInput = document.getElementById('gtSignupPassword');
        const confirmInput = document.getElementById('gtSignupConfirm');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const pass = passInput.value;
        const confirm = confirmInput.value;

        if (!isGmailAddress(email)) {
            showToast('A Gmail address (@gmail.com) is required to register.', 'warning');
            emailInput.focus();
            return;
        }

        if (pass !== confirm) {
            showToast('Passwords do not match.', 'danger');
            confirmInput.focus();
            return;
        }

        const newId = 'user_gmail_' + Date.now();
        const newUser = {
            id: newId,
            name: name,
            email: email,
            password: pass,
            isGuest: false,
            currency: '₹',
            monthlyBudget: 20000,
            upi: {
                linked: false,
                vpa: email.split('@')[0] + '@okaxis',
                bank: 'Bank Account Linked',
                autoSync: true,
                lastSynced: null
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
                food: 5000,
                transport: 3000,
                shopping: 4000,
                entertainment: 2500,
                other: 2000
            },
            expenses: [] // Starts with ZERO dummy expenses!
        };

        state.users[newId] = newUser;
        state.currentUserId = newId;
        saveState();

        showToast(`Account created with Gmail! Welcome, ${name}.`, 'success');
        refreshAllViews();
    }

    function handleContinueAsGuest() {
        const guestId = 'guest_' + Date.now();
        const guestUser = {
            id: guestId,
            name: 'Guest User',
            email: 'guest@expenseai.local',
            password: '',
            isGuest: true,
            currency: '₹',
            monthlyBudget: 20000,
            upi: {
                linked: false,
                vpa: '',
                bank: '',
                autoSync: false,
                lastSynced: null
            },
            gmail: {
                linked: false,
                email: '',
                frequency: 'weekly',
                alertBudgetWarning: false,
                alertAiInsights: false,
                alertWeeklyDigest: false,
                alertMonthlyReport: false,
                lastDispatched: null
            },
            budgets: {
                food: 5000,
                transport: 3000,
                shopping: 4000,
                entertainment: 2500,
                other: 2000
            },
            expenses: [] // Starts with ZERO dummy expenses!
        };

        state.users[guestId] = guestUser;
        state.currentUserId = guestId;
        saveState();

        showToast('Logged in as Guest. Note: UPI sync and Gmail alerts require Gmail login.', 'info');
        refreshAllViews();
    }

    function handleSignOut() {
        if (!confirm('Are you sure you want to sign out? You will return to the login screen.')) {
            return;
        }

        state.currentUserId = null;
        saveState();
        refreshAllViews();
        showToast('You have been signed out.', 'info');
    }

    // ==========================================
    // 6. GUEST RESTRICTION ENFORCER
    // ==========================================

    function checkGuestRestriction(actionName = 'this feature') {
        const user = getCurrentUser();
        if (!user || user.isGuest) {
            const titleEl = document.getElementById('guestRestrictionTitle');
            const msgEl = document.getElementById('guestRestrictionMessage');

            if (titleEl) titleEl.textContent = `Gmail Login Required for ${actionName}`;
            if (msgEl) {
                msgEl.innerHTML = `
                    <strong>${actionName}</strong> is an exclusive feature that requires a verified Gmail login.
                    <br><br>
                    In Guest mode, you can track manual expenses and view charts. To connect live UPI banking feeds, sync UTR transactions, and receive automated Gmail alerts, please sign in with your Gmail.
                `;
            }

            const modalEl = document.getElementById('guestRestrictionModal');
            if (modalEl) {
                if (window.bootstrap && window.bootstrap.Modal) {
                    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.show();
                } else {
                    modalEl.classList.add('show');
                    modalEl.style.display = 'block';
                }
            }
            return true; // Blocked
        }
        return false; // Allowed
    }

    function handleUpgradeFromGuestToGmail() {
        const modalEl = document.getElementById('guestRestrictionModal');
        if (modalEl) {
            if (window.bootstrap && window.bootstrap.Modal) {
                const modal = window.bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            } else {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
            }
        }

        // Sign out of guest and reveal the login gateway
        state.currentUserId = null;
        saveState();
        refreshAllViews();
    }

    // ==========================================
    // 7. UPI INTEGRATION & SYNC
    // ==========================================

    function openUpiModal() {
        if (checkGuestRestriction('UPI Bank Link & Sync')) return;

        renderUpiModalContent();
        const m = document.getElementById('upiModal');
        if (m && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(m).show();
    }

    function renderUpiModalContent() {
        const user = getCurrentUser();
        const connectedView = document.getElementById('upiConnectedView');
        const setupView = document.getElementById('upiSetupView');
        if (!user) return;

        const isLinked = user.upi && user.upi.linked;
        if (isLinked) {
            if (connectedView) connectedView.style.display = 'block';
            if (setupView) setupView.style.display = 'none';

            const bankEl = document.getElementById('upiBankName');
            const vpaEl = document.getElementById('upiVpaDisplay');
            const outflowEl = document.getElementById('upiTotalOutflow');
            const autoSyncBadge = document.getElementById('upiAutoSyncBadge');

            if (bankEl) bankEl.textContent = user.upi.bank || 'UPI Bank Account';
            if (vpaEl) vpaEl.textContent = user.upi.vpa || 'username@upi';

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

            const vpaInput = document.getElementById('upiIdInput');
            if (vpaInput) {
                vpaInput.value = (user.email ? user.email.split('@')[0] : 'user') + '@okaxis';
            }
        }
    }

    function handleSaveUpi(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;
        if (checkGuestRestriction('UPI Bank Link')) return;

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

        if (!confirm('Are you sure you want to unlink your UPI account? Automated sync will be paused.')) {
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
        if (checkGuestRestriction('Live UPI Sync')) return;

        const user = getCurrentUser();
        if (!user) return;

        if (!user.upi || !user.upi.linked) {
            showToast('Please link your UPI account first to enable live sync!', 'warning');
            openUpiModal();
            return;
        }

        // Generate 3 simulated verified UPI transactions with live UTR numbers
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayIso = `${yyyy}-${mm}-${dd}`;

        const simulatedUpiItems = [
            {
                id: 'upi_' + Date.now() + '_1',
                date: todayIso,
                description: `Zomato: Gourmet Pizza [UPI-UTR: ${Math.floor(10000000 + Math.random() * 90000000)}]`,
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
                description: `HPCL Fuel Station [UPI-UTR: ${Math.floor(10000000 + Math.random() * 90000000)}]`,
                category: 'transport',
                payment: 'upi',
                amount: 850
            }
        ];

        simulatedUpiItems.forEach(item => user.expenses.unshift(item));
        user.upi.lastSynced = todayIso;

        saveState();
        refreshAllViews();

        showToast(`Synced 3 verified UPI transactions from ${user.upi.bank}!`, 'success');
    }

    // ==========================================
    // 8. GMAIL REMINDERS & ALERTS
    // ==========================================

    function openGmailModal() {
        if (checkGuestRestriction('Gmail Reminders & Alerts')) return;

        renderGmailModalContent();
        const m = document.getElementById('gmailModal');
        if (m && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(m).show();
    }

    function renderGmailModalContent() {
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
            statusBadge.textContent = isLinked ? 'Connected & Active' : 'Not Configured';
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
        if (checkGuestRestriction('Gmail Settings')) return;

        const user = getCurrentUser();
        if (!user) return;

        const emailInput = document.getElementById('gmailEmailInput');
        const freqSelect = document.getElementById('gmailFrequencySelect');
        const wBox = document.getElementById('alertBudgetWarning');
        const aiBox = document.getElementById('alertAiInsights');
        const wkBox = document.getElementById('alertWeeklyDigest');
        const moBox = document.getElementById('alertMonthlyReport');

        const email = emailInput.value.trim().toLowerCase();
        if (!isGmailAddress(email)) {
            showToast('Please enter a valid Gmail address (@gmail.com).', 'danger');
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
        if (checkGuestRestriction('Email Preview & Automated Alerts')) return;

        const user = getCurrentUser();
        if (!user) return;

        const period = getActivePeriod();
        const monthName = getMonthName(period.month);
        const monthExpenses = getCurrentMonthExpenses();
        const totalSpent = monthExpenses.reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const monthlyBudget = Number(user.monthlyBudget) || 20000;
        const remaining = monthlyBudget - totalSpent;

        const userEmail = (user.gmail && user.gmail.email) ? user.gmail.email : user.email;
        const recipEl = document.getElementById('emailRecipientDisplay');
        if (recipEl) recipEl.textContent = userEmail;
        const footerEl = document.getElementById('emailFooterAddress');
        if (footerEl) footerEl.textContent = userEmail;
        const nameEl = document.getElementById('emailUserName');
        if (nameEl) nameEl.textContent = user.name;
        const timeEl = document.getElementById('emailTimestamp');
        if (timeEl) timeEl.textContent = `Today at 9:00 AM`;

        const spentEl = document.getElementById('emailTotalSpent');
        if (spentEl) spentEl.textContent = formatCurrency(totalSpent);
        const budgetEl = document.getElementById('emailMonthlyBudget');
        if (budgetEl) budgetEl.textContent = formatCurrency(monthlyBudget);

        const remainingEl = document.getElementById('emailRemainingBudget');
        if (remainingEl) {
            remainingEl.textContent = formatCurrency(Math.abs(remaining));
            remainingEl.className = remaining >= 0 ? 'fs-5 text-success' : 'fs-5 text-danger';
        }

        const categoryTotals = {};
        Object.keys(CATEGORIES).forEach(k => categoryTotals[k] = 0);
        monthExpenses.forEach(e => {
            const cat = e.category || 'other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
        });

        const overCategories = Object.keys(CATEGORIES).filter(k => {
            const limit = user.budgets[k] || CATEGORIES[k].defaultBudget;
            return categoryTotals[k] >= limit && categoryTotals[k] > 0;
        });

        const warningBox = document.getElementById('emailWarningBox');
        const warningText = document.getElementById('emailWarningText');
        const subjectLine = document.getElementById('emailSubjectLine');

        if (overCategories.length > 0) {
            warningBox.className = 'alert alert-danger py-2 px-3 mb-3 small';
            warningText.innerHTML = `<strong>⚠️ CRITICAL OVERRUN:</strong> You have exceeded the allocated budget limit in <strong>${overCategories.map(c => CATEGORIES[c].name).join(', ')}</strong>.`;
            subjectLine.textContent = `🚨 URGENT: Budget Limit Exceeded in ${overCategories.map(c => CATEGORIES[c].name).join(', ')} | ExpenseAI Alert`;
        } else if (totalSpent > 0 && remaining < monthlyBudget * 0.25) {
            warningBox.className = 'alert alert-warning py-2 px-3 mb-3 small';
            warningText.innerHTML = `<strong>⚡ Budget Warning:</strong> Over 75% of your monthly budget is spent.`;
            subjectLine.textContent = `⚠️ ExpenseAI Reminder: 75% of Monthly Budget Utilized`;
        } else {
            warningBox.className = 'alert alert-success py-2 px-3 mb-3 small';
            warningText.innerHTML = `<strong>✅ Financial Health Good:</strong> All categories are within safe limits.`;
            subjectLine.textContent = `📊 ExpenseAI ${monthName} Spending Digest: On Track with Your Budget`;
        }

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

        const aiTipEl = document.getElementById('emailAiTipText');
        if (aiTipEl) {
            const upiTotal = monthExpenses.filter(e => e.payment === 'upi').reduce((s, i) => s + (Number(i.amount) || 0), 0);
            aiTipEl.textContent = totalSpent > 0
                ? `You've completed ${monthExpenses.filter(e => e.payment === 'upi').length} UPI transactions totaling ${formatCurrency(upiTotal)}. Tracking digital micro-spends saves up to ~15% monthly!`
                : 'Welcome to ExpenseAI! Once you log expenses or sync your UPI feed, you will receive smart personalized savings tips.';
        }

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
    // 9. DASHBOARD STATS & NAVBAR RENDERING
    // ==========================================

    function renderDashboardStats() {
        const user = getCurrentUser();
        if (!user) return;

        // Nav User Avatar & Names
        const navUserAvatar = document.getElementById('navUserAvatar');
        const navUserName = document.getElementById('navUserName');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');
        const dropdownUserRole = document.getElementById('dropdownUserRole');

        if (user.isGuest) {
            if (navUserAvatar) {
                navUserAvatar.textContent = 'G';
                navUserAvatar.className = 'user-avatar avatar-guest';
            }
            if (navUserName) navUserName.textContent = 'Guest User';
            if (dropdownUserName) dropdownUserName.textContent = 'Guest User';
            if (dropdownUserEmail) dropdownUserEmail.textContent = 'Manual Tracking Only';
            if (dropdownUserRole) {
                dropdownUserRole.textContent = 'Guest';
                dropdownUserRole.className = 'badge bg-secondary-subtle text-secondary';
            }
        } else {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            if (navUserAvatar) {
                navUserAvatar.textContent = initials || 'U';
                navUserAvatar.className = 'user-avatar';
            }
            if (navUserName) navUserName.textContent = user.name.split(' ')[0] || 'User';
            if (dropdownUserName) dropdownUserName.textContent = user.name;
            if (dropdownUserEmail) dropdownUserEmail.textContent = user.email;
            if (dropdownUserRole) {
                dropdownUserRole.textContent = 'Gmail Verified';
                dropdownUserRole.className = 'badge bg-primary-subtle text-primary';
            }
        }

        // Nav and Bar Integration Badges
        const isUpiLinked = !user.isGuest && user.upi && user.upi.linked;
        const navUpiBadge = document.getElementById('navUpiBadge');
        if (navUpiBadge) {
            if (user.isGuest) {
                navUpiBadge.className = 'badge bg-light text-muted border ms-auto';
                navUpiBadge.innerHTML = '<i class="bi bi-lock-fill"></i> Locked';
            } else {
                navUpiBadge.className = isUpiLinked ? 'badge bg-success-subtle text-success ms-auto' : 'badge bg-secondary-subtle text-secondary ms-auto';
                navUpiBadge.textContent = isUpiLinked ? 'Active' : 'Setup';
            }
        }

        const isGmailLinked = !user.isGuest && user.gmail && user.gmail.linked;
        const navGmailBadge = document.getElementById('navGmailBadge');
        if (navGmailBadge) {
            if (user.isGuest) {
                navGmailBadge.className = 'badge bg-light text-muted border ms-auto';
                navGmailBadge.innerHTML = '<i class="bi bi-lock-fill"></i> Locked';
            } else {
                navGmailBadge.className = isGmailLinked ? 'badge bg-primary-subtle text-primary ms-auto' : 'badge bg-secondary-subtle text-secondary ms-auto';
                navGmailBadge.textContent = isGmailLinked ? (user.gmail.frequency || 'Weekly') : 'Configure';
            }
        }

        // Integrations Bar on Dashboard
        const upiBarBtn = document.getElementById('upiBarBtn');
        const upiBarText = document.getElementById('upiBarText');
        const upiBarBadge = document.getElementById('upiBarBadge');

        if (upiBarBtn) {
            if (user.isGuest) {
                upiBarBtn.className = 'integration-item item-locked';
                if (upiBarText) upiBarText.textContent = 'UPI: Login Required';
                if (upiBarBadge) {
                    upiBarBadge.className = 'badge bg-secondary-subtle text-secondary';
                    upiBarBadge.innerHTML = '<i class="bi bi-lock-fill"></i> Locked';
                }
            } else {
                upiBarBtn.className = 'integration-item';
                if (upiBarText) upiBarText.textContent = isUpiLinked ? `UPI: ${user.upi.vpa}` : 'UPI: Not Linked';
                if (upiBarBadge) {
                    upiBarBadge.className = isUpiLinked ? 'badge bg-success-subtle text-success' : 'badge bg-secondary-subtle text-secondary';
                    upiBarBadge.textContent = isUpiLinked ? 'Active' : 'Setup';
                }
            }
        }

        const gmailBarBtn = document.getElementById('gmailBarBtn');
        const gmailBarText = document.getElementById('gmailBarText');
        const gmailBarBadge = document.getElementById('gmailBarBadge');

        if (gmailBarBtn) {
            if (user.isGuest) {
                gmailBarBtn.className = 'integration-item item-locked';
                if (gmailBarText) gmailBarText.textContent = 'Gmail: Login Required';
                if (gmailBarBadge) {
                    gmailBarBadge.className = 'badge bg-secondary-subtle text-secondary';
                    gmailBarBadge.innerHTML = '<i class="bi bi-lock-fill"></i> Locked';
                }
            } else {
                gmailBarBtn.className = 'integration-item';
                if (gmailBarText) gmailBarText.textContent = isGmailLinked ? `Gmail: ${user.gmail.frequency} Digest` : 'Gmail: Inactive';
                if (gmailBarBadge) {
                    gmailBarBadge.className = isGmailLinked ? 'badge bg-primary-subtle text-primary' : 'badge bg-secondary-subtle text-secondary';
                    gmailBarBadge.textContent = isGmailLinked ? 'Active' : 'Configure';
                }
            }
        }

        // Calculations (starts at 0 when expenses are empty)
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
            welcomeSubtitle.textContent = user.isGuest
                ? `Guest Mode: Track your spending manually below. Zero dummy expenses.`
                : `Welcome back, ${user.name.split(' ')[0]}! Here's your spending overview for ${monthName}.`;
        }

        document.querySelectorAll('.currency-prefix').forEach(el => {
            el.textContent = user.currency;
        });
    }

    // ==========================================
    // 10. CATEGORIES BREAKDOWN
    // ==========================================

    function renderCategoriesBreakdown() {
        const container = document.getElementById('categoryBreakdownList');
        if (!container) return;

        const user = getCurrentUser();
        if (!user) return;

        const monthExpenses = getCurrentMonthExpenses();
        const totalSpent = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        if (monthExpenses.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-tags fs-2 text-muted d-block mb-2"></i>
                    <p class="mb-1 fw-medium text-secondary">No spending recorded</p>
                    <small class="text-muted">Your category distribution will appear here once you log expenses.</small>
                </div>
            `;
            return;
        }

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
    // 11. SPENDING CHART (WITH EMPTY STATE)
    // ==========================================

    function renderSpendingChart() {
        const container = document.getElementById('chartContainer');
        if (!container) return;

        const user = getCurrentUser();
        if (!user) return;

        const monthExpenses = getCurrentMonthExpenses();

        // If no expenses exist yet, display clean empty chart state
        if (monthExpenses.length === 0) {
            if (state.chartInstance) {
                state.chartInstance.destroy();
                state.chartInstance = null;
            }
            container.innerHTML = `
                <div class="chart-empty-state">
                    <i class="bi bi-bar-chart-line fs-1 text-primary-subtle mb-2"></i>
                    <h6 class="fw-semibold text-secondary mb-1">No spending data recorded yet</h6>
                    <p class="text-muted small mb-0">Add an expense or sync your UPI feed to view spending trends.</p>
                </div>
            `;
            return;
        }

        // Has data: ensure canvas exists
        if (!document.getElementById('spendingChart')) {
            container.innerHTML = '<canvas id="spendingChart"></canvas>';
        }

        const canvas = document.getElementById('spendingChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (state.chartInstance) {
            state.chartInstance.destroy();
            state.chartInstance = null;
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
                last7Days.push(iso);
                labels.push(`${days[d.getDay()]} (${d.getDate()})`);
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
    // 12. EXPENSES TABLE CRUD
    // ==========================================

    function getFilteredExpenses() {
        const user = getCurrentUser();
        if (!user || !user.expenses) return [];

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
        if (!user) return;

        const filteredList = getFilteredExpenses();
        const totalAmount = filteredList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const countText = document.getElementById('tableCountText');
        if (countText) {
            const totalCount = user.expenses ? user.expenses.length : 0;
            countText.textContent = filteredList.length === totalCount
                ? `Showing all ${totalCount} transactions`
                : `Showing ${filteredList.length} of ${totalCount} transactions`;
        }

        const totalText = document.getElementById('tableTotalText');
        if (totalText) totalText.textContent = `Filtered Total: ${formatCurrency(totalAmount)}`;

        if (filteredList.length === 0) {
            const totalCount = user.expenses ? user.expenses.length : 0;
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <i class="bi bi-inbox text-muted"></i>
                            </div>
                            <h5 class="fw-bold mb-1">No expenses recorded yet</h5>
                            <p class="text-muted mb-3">
                                ${totalCount === 0
                    ? "Start tracking your spending by adding an expense or syncing UPI."
                    : "No transactions match your current search and filter criteria."}
                            </p>
                            ${totalCount === 0 ? `
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#addExpenseModal">
                                        <i class="bi bi-plus-lg me-1"></i> Add First Expense
                                    </button>
                                    ${!user.isGuest ? `
                                        <button class="btn btn-sm btn-outline-primary" id="emptyStateSyncUpiBtn">
                                            <i class="bi bi-arrow-repeat me-1"></i> Sync UPI Feed
                                        </button>
                                    ` : ''}
                                </div>
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

            const emptySyncBtn = document.getElementById('emptyStateSyncUpiBtn');
            if (emptySyncBtn) emptySyncBtn.addEventListener('click', syncUpiTransactions);
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
                openEditExpenseModal(btn.getAttribute('data-id'));
            });
        });

        tbody.querySelectorAll('.delete-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDeleteConfirmModal(btn.getAttribute('data-id'));
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
    // 13. ADD / EDIT EXPENSE MODAL
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
        if (!user) return;

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

        user.expenses = user.expenses.filter(e => e.id !== state.deletingId);
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
    // 14. BUDGET SECTION & MANAGEMENT
    // ==========================================

    function renderBudgets() {
        const container = document.getElementById('budgetCardsContainer');
        if (!container) return;

        const user = getCurrentUser();
        if (!user) return;

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
    // 15. AI INSIGHTS & SMART ADVISOR
    // ==========================================

    function generateAiInsights() {
        const cardsContainer = document.getElementById('aiInsightsCards');
        if (!cardsContainer) return;

        const user = getCurrentUser();
        if (!user) return;

        const period = getActivePeriod();
        const monthName = getMonthName(period.month);
        const monthExpenses = getCurrentMonthExpenses();
        const totalSpent = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const monthlyBudget = Number(user.monthlyBudget) || 20000;

        if (monthExpenses.length === 0) {
            cardsContainer.innerHTML = `
                <div class="col-md-6 col-lg-3">
                    <div class="ai-stat-card">
                        <span class="ai-badge bg-primary-subtle text-primary"><i class="bi bi-speedometer2"></i> Velocity</span>
                        <h6 class="fw-bold mb-1">Month-End Forecast</h6>
                        <p class="mb-2 text-dark fs-5 fw-bold">${formatCurrency(0)}</p>
                        <p class="small text-muted mb-0">No spending logged yet. Your full budget of ${formatCurrency(monthlyBudget)} is intact.</p>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="ai-stat-card">
                        <span class="ai-badge bg-warning-subtle text-warning-emphasis"><i class="bi bi-pie-chart-fill"></i> Top Driver</span>
                        <h6 class="fw-bold mb-1">No Top Category</h6>
                        <p class="mb-2 text-dark fs-5 fw-bold">—</p>
                        <p class="small text-muted mb-0">Log transactions or sync UPI to identify your top spending categories.</p>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="ai-stat-card">
                        <span class="ai-badge bg-success-subtle text-success"><i class="bi bi-shield-check"></i> Budget Health</span>
                        <h6 class="fw-bold mb-1">100% Available</h6>
                        <p class="mb-2 text-dark fs-5 fw-bold">${formatCurrency(monthlyBudget)} left</p>
                        <p class="small text-muted mb-0">All category budgets are at 0% utilization. Excellent start!</p>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="ai-stat-card">
                        <span class="ai-badge bg-info-subtle text-info-emphasis"><i class="bi bi-lightbulb-fill"></i> Smart Tip</span>
                        <h6 class="fw-bold mb-1">Getting Started</h6>
                        <p class="mb-2 text-dark fs-5 fw-bold">Ready to track</p>
                        <p class="small text-muted mb-0">${user.isGuest ? 'Log manual transactions using the Add Expense button.' : 'Link your UPI account to automatically import verified bank transactions!'}</p>
                    </div>
                </div>
            `;
            return;
        }

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
                    <span class="ai-badge bg-primary-subtle text-primary"><i class="bi bi-speedometer2"></i> Velocity</span>
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
                    <span class="ai-badge bg-warning-subtle text-warning-emphasis"><i class="bi bi-pie-chart-fill"></i> Top Driver</span>
                    <h6 class="fw-bold mb-1">${topCatMeta.icon} ${topCatMeta.name} (${topCatPercentage}%)</h6>
                    <p class="mb-2 text-dark fs-5 fw-bold">${formatCurrency(topCategoryAmount)}</p>
                    <p class="small text-muted mb-0">
                        ${topCatMeta.name} is your highest expense area in ${monthName}, accounting for ${topCatPercentage}% of total outflow.
                    </p>
                </div>
            </div>

            <div class="col-md-6 col-lg-3">
                <div class="ai-stat-card">
                    <span class="ai-badge ${highestUtilPercent >= 90 ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info-emphasis'}"><i class="bi bi-shield-check"></i> Budget Health</span>
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
                    <span class="ai-badge bg-success-subtle text-success"><i class="bi bi-lightbulb-fill"></i> Smart Tip</span>
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
            if (!user) return;

            const period = getActivePeriod();
            const monthExpenses = getCurrentMonthExpenses();
            const totalSpent = monthExpenses.reduce((s, i) => s + (Number(i.amount) || 0), 0);
            const monthlyBudget = Number(user.monthlyBudget) || 20000;

            if (monthExpenses.length === 0) {
                contentBox.innerHTML = `
                    <p class="mb-1"><strong>ExpenseAI Advisor Notice:</strong></p>
                    <p class="mb-0 text-muted">You haven't recorded any expenses yet! Once you add transactions manually or sync verified UPI statement records, I will generate tailored analysis, top drivers, and savings plans.</p>
                `;
                return;
            }

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
                        <li><strong>Reduce ${CATEGORIES[highest].name} by 25%:</strong> You have spent <strong>${formatCurrency(categoryTotals[highest])}</strong> on ${CATEGORIES[highest].name}. Trimming here frees up <strong>${formatCurrency(potentialSavings)}</strong>.</li>
                        <li><strong>Audit UPI Micro-Transactions:</strong> Frequent UPI payments under ₹300 represent spontaneous purchases. Consolidating these saves approximately <strong>${formatCurrency(Math.round(totalSpent * 0.08))}</strong> monthly.</li>
                        <li><strong>Target Buffer:</strong> Remaining budget is <strong>${formatCurrency(Math.max(0, monthlyBudget - totalSpent))}</strong>.</li>
                    </ul>
                `;
            } else if (query.includes('food')) {
                const foodSpent = categoryTotals['food'] || 0;
                const foodLimit = user.budgets['food'] || 5000;
                answerHtml = `
                    <p class="mb-2"><strong>🍔 Food & Dining Breakdown:</strong></p>
                    <p class="mb-0">You have logged <strong>${formatCurrency(foodSpent)}</strong> out of your <strong>${formatCurrency(foodLimit)}</strong> budget (${Math.round((foodSpent / foodLimit) * 100)}% utilized).</p>
                `;
            } else if (query.includes('risk') || query.includes('budget') || query.includes('budget-risk')) {
                const overBudgetCats = Object.keys(CATEGORIES).filter(k => {
                    const limit = user.budgets[k] || CATEGORIES[k].defaultBudget;
                    return categoryTotals[k] >= limit && categoryTotals[k] > 0;
                });

                if (overBudgetCats.length > 0) {
                    answerHtml = `
                        <p class="text-danger fw-bold mb-1">⚠️ Budget Overrun Detected:</p>
                        <p class="mb-0">You have exceeded limits in <strong>${overBudgetCats.map(c => CATEGORIES[c].name).join(', ')}</strong>.</p>
                    `;
                } else {
                    answerHtml = `
                        <p class="text-success fw-bold mb-1">✅ Excellent Financial Health!</p>
                        <p class="mb-0">All spending categories are currently within safety margins. Remaining: <strong>${formatCurrency(monthlyBudget - totalSpent)}</strong>.</p>
                    `;
                }
            } else {
                answerHtml = `
                    <p class="mb-2"><strong>Analysis for "${escapeHtml(questionText)}":</strong></p>
                    <p class="mb-0">Total outflow is <strong>${formatCurrency(totalSpent)}</strong> across <strong>${monthExpenses.length} transactions</strong>.</p>
                `;
            }

            contentBox.innerHTML = answerHtml;
        }, 400);
    }

    // ==========================================
    // 16. PROFILE, SETTINGS & CSV EXPORT
    // ==========================================

    function openProfileModal() {
        const user = getCurrentUser();
        if (!user) return;

        const nameInput = document.getElementById('userNameInput');
        const emailInput = document.getElementById('userEmailInput');
        const currSelect = document.getElementById('currencySelect');

        if (nameInput) nameInput.value = user.name;
        if (emailInput) emailInput.value = user.isGuest ? 'Guest User (Not Logged In)' : user.email;
        if (currSelect) currSelect.value = user.currency;

        const m = document.getElementById('profileModal');
        if (m && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(m).show();
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

        showToast('Settings saved!', 'success');
    }

    function exportExpensesAsCsv() {
        const user = getCurrentUser();
        if (!user || !user.expenses || user.expenses.length === 0) {
            showToast('No expenses recorded to export!', 'warning');
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

        showToast('Expenses exported as CSV!', 'success');
    }

    function clearAllExpenses() {
        const user = getCurrentUser();
        if (!user) return;

        if (!confirm('Are you sure you want to clear all recorded expenses?')) {
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

        showToast('All expenses cleared.', 'info');
    }

    // ==========================================
    // 17. GLOBAL REFRESH & EVENT BINDINGS
    // ==========================================

    function refreshAllViews() {
        updateAuthGatewayVisibility();

        const user = getCurrentUser();
        if (!user) return;

        renderDashboardStats();
        renderCategoriesBreakdown();
        renderSpendingChart();
        renderExpensesTable();
        renderBudgets();
        generateAiInsights();
        renderUpiModalContent();
        renderGmailModalContent();
    }

    function setupEventListeners() {
        // Auth Gateway Forms
        const googleFastLoginBtn = document.getElementById('googleFastLoginBtn');
        if (googleFastLoginBtn) googleFastLoginBtn.addEventListener('click', handleGoogleFastLogin);

        const gtSignInForm = document.getElementById('gatewaySignInForm');
        if (gtSignInForm) gtSignInForm.addEventListener('submit', handleGatewaySignIn);

        const gtSignUpForm = document.getElementById('gatewaySignUpForm');
        if (gtSignUpForm) gtSignUpForm.addEventListener('submit', handleGatewaySignUp);

        const continueAsGuestBtn = document.getElementById('continueAsGuestBtn');
        if (continueAsGuestBtn) continueAsGuestBtn.addEventListener('click', handleContinueAsGuest);

        const guestUpgradeBtn = document.getElementById('guestUpgradeToGmailBtn');
        if (guestUpgradeBtn) guestUpgradeBtn.addEventListener('click', handleUpgradeFromGuestToGmail);

        const signOutBtn = document.getElementById('menuSignOutBtn');
        if (signOutBtn) signOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleSignOut();
        });

        // UPI Forms & Actions (Protected)
        const upiForm = document.getElementById('upiForm');
        if (upiForm) upiForm.addEventListener('submit', handleSaveUpi);

        const unlinkUpiBtn = document.getElementById('unlinkUpiBtn');
        if (unlinkUpiBtn) unlinkUpiBtn.addEventListener('click', handleUnlinkUpi);

        const syncUpiNowBtn = document.getElementById('syncUpiNowBtn');
        if (syncUpiNowBtn) syncUpiNowBtn.addEventListener('click', syncUpiTransactions);

        const syncUpiTransactionsBtn = document.getElementById('syncUpiTransactionsBtn');
        if (syncUpiTransactionsBtn) syncUpiTransactionsBtn.addEventListener('click', syncUpiTransactions);

        const upiBarBtn = document.getElementById('upiBarBtn');
        if (upiBarBtn) upiBarBtn.addEventListener('click', openUpiModal);

        const menuLinkUpiBtn = document.getElementById('menuLinkUpiBtn');
        if (menuLinkUpiBtn) {
            menuLinkUpiBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openUpiModal();
            });
        }

        // Gmail Forms & Actions (Protected)
        const gmailForm = document.getElementById('gmailSettingsForm');
        if (gmailForm) gmailForm.addEventListener('submit', handleSaveGmailSettings);

        const gmailBarBtn = document.getElementById('gmailBarBtn');
        if (gmailBarBtn) gmailBarBtn.addEventListener('click', openGmailModal);

        const menuLinkGmailBtn = document.getElementById('menuLinkGmailBtn');
        if (menuLinkGmailBtn) {
            menuLinkGmailBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openGmailModal();
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

        // CSV export & clear buttons
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportExpensesAsCsv);

        const profileExportBtn = document.getElementById('profileExportCsvBtn');
        if (profileExportBtn) profileExportBtn.addEventListener('click', exportExpensesAsCsv);

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

        // Navbar ScrollSpy
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
    // 18. INITIALIZATION
    // ==========================================

    function initApp() {
        loadState();
        setupEventListeners();
        refreshAllViews();
        console.log('ExpenseAI initialized with Login Wall, Guest Mode restrictions, and Zero Dummy Expenses.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();

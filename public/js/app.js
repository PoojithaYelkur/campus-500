// State Management
let currentReferralCode = null;
let currentStudentData = null;
let dailyChartInstance = null;
let sourceChartInstance = null;
let searchDebounceTimeout = null;

// Routing & View Navigation
function navigateTo(viewId) {
  const views = ['landing', 'register', 'success', 'student-dashboard', 'leaderboard', 'admin'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeView = document.getElementById(`view-${viewId}`);
  if (activeView) activeView.classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Handle View-Specific Initializers
  if (viewId === 'landing') refreshCampaignProgress();
  if (viewId === 'leaderboard') loadPublicLeaderboard();
  if (viewId === 'student-dashboard' && currentReferralCode) loadStudentDashboard(currentReferralCode);
  if (viewId === 'admin') checkAdminAuthAndLoad();

  setTimeout(() => lucide.createIcons(), 50);
}

// 1. Initial Page Load & Ref Parameter Attribution
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');

  if (refCode) {
    sessionStorage.setItem('campus500_ref', refCode.toUpperCase());
    // Record click attribution
    API.trackClick(refCode.toUpperCase(), 'web_link');

    // Show on registration form
    const banner = document.getElementById('referred-banner');
    const disp = document.getElementById('referred-code-display');
    if (banner && disp) {
      banner.classList.remove('hidden');
      disp.innerText = refCode.toUpperCase();
    }
  }

  // Check if student was previously registered in this browser session
  const storedCode = localStorage.getItem('campus500_student_code');
  if (storedCode) {
    currentReferralCode = storedCode;
    const myDashBtn = document.getElementById('my-dashboard-btn');
    if (myDashBtn) myDashBtn.classList.remove('hidden');
  }

  // Refresh progress bar and live counters
  await refreshCampaignProgress();
});

// 2. Campaign Progress Bar updater
async function refreshCampaignProgress() {
  try {
    const data = await API.getCampaignProgress();
    const bannerCount = document.getElementById('banner-reg-count');
    const heroCount = document.getElementById('hero-progress-total');
    const heroBar = document.getElementById('hero-progress-bar');
    const heroRem = document.getElementById('hero-remaining-count');

    if (bannerCount) bannerCount.innerText = data.total;
    if (heroCount) heroCount.innerText = data.total;
    if (heroRem) heroRem.innerText = data.remaining;
    if (heroBar) heroBar.style.width = `${data.percentage}%`;
  } catch (err) {
    console.error('Failed to load campaign progress:', err);
  }
}

// 3. Registration Handler
async function handleRegistration(e) {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('btn-submit-reg');
  errorEl.classList.add('hidden');

  btn.disabled = true;
  btn.innerHTML = `<span class="animate-pulse">Registering...</span>`;

  const refCode = sessionStorage.getItem('campus500_ref') || null;

  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    college: document.getElementById('reg-college').value.trim(),
    branch: document.getElementById('reg-branch').value,
    graduation_year: parseInt(document.getElementById('reg-year').value) || 2027,
    ref: refCode
  };

  try {
    const res = await API.registerStudent(payload);

    if (res.error) {
      errorEl.innerText = res.error;
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = `<span>Register & Get My Referral Link</span><i data-lucide="sparkles" class="w-4 h-4"></i>`;
      lucide.createIcons();
      return;
    }

    // Success
    currentReferralCode = res.referral_code;
    localStorage.setItem('campus500_student_code', res.referral_code);

    const myDashBtn = document.getElementById('my-dashboard-btn');
    if (myDashBtn) myDashBtn.classList.remove('hidden');

    displaySuccessScreen(res.referral_code);
    refreshCampaignProgress();
  } catch (err) {
    errorEl.innerText = 'Registration failed. Please check network connection.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = `<span>Register & Get My Referral Link</span>`;
  }
}

// 4. Success Screen Display
function displaySuccessScreen(code) {
  const shareUrl = `${window.location.origin}/?ref=${code}`;
  document.getElementById('succ-ref-code').innerText = code;
  document.getElementById('succ-share-url').value = shareUrl;

  navigateTo('success');

  // Load initial stats
  API.getStudentDashboard(code).then(res => {
    if (res && res.stats) {
      document.getElementById('succ-brought').innerText = res.stats.registrations;
      document.getElementById('succ-rank').innerText = `#${res.stats.rank}`;
      document.getElementById('succ-milestone').innerText = res.stats.nextMilestone;
    }
  });
}

function openStudentDashboard() {
  if (currentReferralCode) {
    navigateTo('student-dashboard');
    loadStudentDashboard(currentReferralCode);
  }
}

// 5. Student Dashboard
async function loadStudentDashboard(code) {
  try {
    const data = await API.getStudentDashboard(code);
    currentStudentData = data;

    document.getElementById('dash-student-name').innerText = data.student.name;
    document.getElementById('dash-student-college').innerText = `${data.student.branch} • ${data.student.college}`;
    document.getElementById('dash-code-badge').innerText = data.student.referral_code;

    document.getElementById('dash-stat-regs').innerText = data.stats.registrations;
    document.getElementById('dash-stat-rank').innerText = `#${data.stats.rank}`;
    document.getElementById('dash-stat-clicks').innerText = data.stats.clicks;
    document.getElementById('dash-stat-conv').innerText = data.stats.conversionRate;

    const shareUrl = `${window.location.origin}/?ref=${data.student.referral_code}`;
    document.getElementById('dash-share-url').value = shareUrl;

    // Milestone highlight
    const hint = document.getElementById('dash-milestone-hint');
    if (data.stats.neededForNext > 0) {
      hint.innerText = `${data.stats.neededForNext} more registrations to reach Tier ${data.stats.nextMilestone}`;
    } else {
      hint.innerText = `Elite milestone unlocked! 🎉`;
    }

    [5, 10, 25, 50].forEach(m => {
      const el = document.getElementById(`mile-${m}`);
      if (data.stats.registrations >= m) {
        el.className = 'p-4 rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-900';
      } else {
        el.className = 'p-4 rounded-xl border border-slate-200 bg-slate-50';
      }
    });

    // Populate embedded leaderboard
    const leaders = await API.getLeaderboard();
    const container = document.getElementById('dash-leaderboard-container');
    let html = `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] border-b">
          <tr>
            <th class="py-2.5 px-3">Rank</th>
            <th class="py-2.5 px-3">Student</th>
            <th class="py-2.5 px-3">College</th>
            <th class="py-2.5 px-3 text-center">Registrations</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
    `;

    leaders.slice(0, 5).forEach(l => {
      const isCurrent = l.referral_code === code;
      html += `
        <tr class="${isCurrent ? 'bg-blue-50/80 font-bold text-blue-900' : ''}">
          <td class="py-2.5 px-3">${l.rank === 1 ? '🥇 1' : l.rank === 2 ? '🥈 2' : l.rank === 3 ? '🥉 3' : '#' + l.rank}</td>
          <td class="py-2.5 px-3">${l.name} ${isCurrent ? '(You)' : ''}</td>
          <td class="py-2.5 px-3 text-slate-500">${l.college}</td>
          <td class="py-2.5 px-3 text-center font-bold text-blue-600">${l.registrations}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

  } catch (err) {
    console.error('Error loading student dashboard:', err);
  }
}

// 6. Public Leaderboard
async function loadPublicLeaderboard() {
  const tbody = document.getElementById('public-leaderboard-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Loading rankings...</td></tr>`;

  try {
    const leaders = await API.getLeaderboard();
    if (leaders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No referrals yet. Be the first ambassador!</td></tr>`;
      return;
    }

    tbody.innerHTML = leaders.map(item => `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-3.5 px-4 sm:px-6 font-bold ${item.rank <= 3 ? 'text-blue-600' : 'text-slate-600'}">
          ${item.rank === 1 ? '🥇 #1' : item.rank === 2 ? '🥈 #2' : item.rank === 3 ? '🥉 #3' : '#' + item.rank}
        </td>
        <td class="py-3.5 px-4 font-bold text-slate-900">${item.name}</td>
        <td class="py-3.5 px-4 text-slate-500">${item.college}</td>
        <td class="py-3.5 px-4 text-center font-mono text-slate-600">${item.clicks}</td>
        <td class="py-3.5 px-4 text-center font-mono font-bold text-blue-600">${item.registrations}</td>
        <td class="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">${item.conversionRate}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-red-500">Failed to load rankings.</td></tr>`;
  }
}

// 7. Sharing & Clipboard helpers
function copyReferralLink(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.select();
  navigator.clipboard.writeText(input.value);
  alert('Referral link copied to clipboard!');
}

function shareOnWhatsApp() {
  const code = currentReferralCode || (currentStudentData && currentStudentData.student.referral_code) || '';
  const shareUrl = `${window.location.origin}/?ref=${code}`;
  const text = encodeURIComponent(`Hey! I'm joining Campus 500 for final-year engineering students. Join through my invite link 👇\n${shareUrl}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

// 8. Admin Portal Logic
function checkAdminAuthAndLoad() {
  const token = sessionStorage.getItem('campus500_admin_token');
  const modal = document.getElementById('admin-login-modal');
  const view = document.getElementById('admin-authenticated-view');

  if (token) {
    modal.classList.add('hidden');
    view.classList.remove('hidden');
    loadAdminDashboardData();
  } else {
    modal.classList.remove('hidden');
    view.classList.add('hidden');
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('admin-login-error');
  errEl.classList.add('hidden');

  try {
    const res = await API.adminLogin(email, password);
    if (res.token) {
      sessionStorage.setItem('campus500_admin_token', res.token);
      checkAdminAuthAndLoad();
    } else {
      errEl.innerText = res.error || 'Login failed';
      errEl.classList.remove('hidden');
    }
  } catch (err) {
    errEl.innerText = 'Unable to reach authentication service.';
    errEl.classList.remove('hidden');
  }
}

function adminLogout() {
  sessionStorage.removeItem('campus500_admin_token');
  checkAdminAuthAndLoad();
}

async function loadAdminDashboardData() {
  try {
    const data = await API.getAdminMetrics();

    // KPIs
    document.getElementById('adm-kpi-total').innerText = `${data.kpis.totalRegistrations} / 500`;
    document.getElementById('adm-kpi-pct').innerText = `${Math.round((data.kpis.totalRegistrations / 500) * 100)}% of sprint goal`;
    document.getElementById('adm-kpi-remaining').innerText = data.kpis.remaining;
    document.getElementById('adm-kpi-today').innerText = data.kpis.todayRegistrations;
    document.getElementById('adm-kpi-ambassadors').innerText = data.kpis.activeAmbassadors;
    document.getElementById('adm-kpi-referral-regs').innerText = data.kpis.referralRegistrations;
    document.getElementById('adm-kpi-virality').innerText = `${Math.round((data.kpis.referralRegistrations / (data.kpis.totalRegistrations || 1)) * 100)}% viral`;

    // Budget
    document.getElementById('bud-spent').innerText = `₹${data.budget.spent.toLocaleString()}`;
    document.getElementById('bud-remaining').innerText = `₹${data.budget.remaining.toLocaleString()}`;
    document.getElementById('bud-cpr').innerText = `₹${data.budget.costPerRegistration}`;

    renderDailyChart(data.dailyRegistrations);
    renderSourceChart(data.sourceBreakdown);
    loadAdminStudents();
    loadExpensesList();
    populateCollegeFilter();
  } catch (err) {
    console.error('Failed to load admin metrics:', err);
  }
}

// Charts
function renderDailyChart(dailyData) {
  const ctx = document.getElementById('chart-daily-registrations');
  if (!ctx) return;

  if (dailyChartInstance) dailyChartInstance.destroy();

  const labels = dailyData.map(d => {
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });
  const values = dailyData.map(d => d.registrations);

  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Registrations',
        data: values,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderSourceChart(sourceData) {
  const ctx = document.getElementById('chart-channel-sources');
  if (!ctx) return;

  if (sourceChartInstance) sourceChartInstance.destroy();

  const labels = sourceData.map(s => s.source.replace('_', ' ').toUpperCase());
  const counts = sourceData.map(s => s.count);

  sourceChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#64748b']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}

// Student Table & Search Filters
function debounceStudentSearch() {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(loadAdminStudents, 250);
}

async function populateCollegeFilter() {
  const students = await API.getAdminStudents();
  const select = document.getElementById('filter-college');
  const colleges = [...new Set(students.map(s => s.college))].filter(Boolean);

  select.innerHTML = '<option value="">All Colleges</option>' + 
    colleges.map(c => `<option value="${c}">${c}</option>`).join('');
}

async function loadAdminStudents() {
  const search = document.getElementById('filter-search').value;
  const college = document.getElementById('filter-college').value;
  const source = document.getElementById('filter-source').value;

  const tbody = document.getElementById('admin-students-tbody');
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-400">Loading student directory...</td></tr>`;

  try {
    const students = await API.getAdminStudents({ search, college, source });
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-400">No student records match filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-2.5 px-4 font-semibold text-slate-900">${s.name}</td>
        <td class="py-2.5 px-4 text-slate-600 font-mono text-[11px]">${s.email}</td>
        <td class="py-2.5 px-4 text-slate-600">${s.college}</td>
        <td class="py-2.5 px-4 text-slate-500">${s.branch}</td>
        <td class="py-2.5 px-4 font-mono font-bold text-blue-600">${s.referral_code}</td>
        <td class="py-2.5 px-4 text-slate-600">${s.referred_by_name ? `⚡ ${s.referred_by_name}` : '<span class="text-slate-300">—</span>'}</td>
        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">${s.source}</span></td>
        <td class="py-2.5 px-4 text-slate-400 text-[10px]">${new Date(s.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load student table.</td></tr>`;
  }
}

// 9. AI Campaign Copilot
async function runCopilotAnalysis() {
  const btn = document.getElementById('btn-run-copilot');
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-pulse">Synthesizing...</span>`;

  try {
    const result = await API.getCopilotAnalysis();
    document.getElementById('copilot-health').innerText = result.health;
    document.getElementById('copilot-obs').innerText = result.observation;
    document.getElementById('copilot-rec').innerText = result.recommendation;
    document.getElementById('copilot-action').innerText = result.suggested_action;
  } catch (err) {
    alert('AI analysis failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="cpu" class="w-4 h-4"></i> Analyze Campaign`;
    lucide.createIcons();
  }
}

// 10. Expenses Management
function toggleExpenseForm() {
  const form = document.getElementById('expense-form-container');
  form.classList.toggle('hidden');
}

async function handleCreateExpense(e) {
  e.preventDefault();
  const category = document.getElementById('exp-category').value;
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const description = document.getElementById('exp-desc').value;

  await API.addExpense({ category, amount, description });
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-desc').value = '';
  toggleExpenseForm();
  loadAdminDashboardData();
}

async function loadExpensesList() {
  const list = document.getElementById('expense-items-list');
  const expenses = await API.getExpenses();

  if (expenses.length === 0) {
    list.innerHTML = `<p class="py-2 text-slate-400">No expenses recorded yet.</p>`;
    return;
  }

  list.innerHTML = expenses.map(e => `
    <div class="py-2 flex justify-between items-center">
      <div>
        <span class="font-bold text-slate-800">${e.category}</span>
        <span class="text-slate-400 text-[10px] ml-2">${e.description || ''}</span>
      </div>
      <div class="font-mono font-bold text-slate-900">₹${e.amount}</div>
    </div>
  `).join('');
}

async function resetDemoData() {
  if (confirm('Reset database with initial 120+ demo student records?')) {
    await API.resetDemoData();
    alert('Demo dataset reseeded!');
    loadAdminDashboardData();
    refreshCampaignProgress();
  }
}
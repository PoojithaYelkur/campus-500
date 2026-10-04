// Front-end API client wrapper
const API = {
  async getCampaignProgress() {
    const res = await fetch('/api/campaign/progress');
    return res.json();
  },

  async registerStudent(data) {
    const res = await fetch('/api/students/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async trackClick(code, channel = 'web') {
    return fetch('/api/referrals/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, channel })
    });
  },

  async getStudentDashboard(code) {
    const res = await fetch(`/api/students/${code}`);
    return res.json();
  },

  async getLeaderboard() {
    const res = await fetch('/api/leaderboard');
    return res.json();
  },

  async adminLogin(email, password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async getAdminMetrics() {
    const res = await fetch('/api/admin/metrics');
    return res.json();
  },

  async getAdminStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/admin/students?${query}`);
    return res.json();
  },

  async getCopilotAnalysis() {
    const res = await fetch('/api/admin/copilot', { method: 'POST' });
    return res.json();
  },

  async getExpenses() {
    const res = await fetch('/api/admin/expenses');
    return res.json();
  },

  async addExpense(data) {
    const res = await fetch('/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async resetDemoData() {
    const res = await fetch('/api/admin/reset-demo', { method: 'POST' });
    return res.json();
  }
};
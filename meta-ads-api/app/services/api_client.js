/**
 * META ADS API CLIENT
 * Drop this into your frontend to connect the dashboard to the FastAPI backend.
 *
 * Usage:
 *   import { MetaAdsAPI } from './api_client.js';
 *   const api = new MetaAdsAPI('http://localhost:8000');
 *   const data = await api.getOverview('last_7d');
 */

class MetaAdsAPI {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('meta_access_token') || null;
    }

    async _fetch(endpoint, params = {}) {
        if (this.token) {
            params.access_token = this.token;
        }

        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== null && v !== undefined) url.searchParams.set(k, v);
        });

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Network error' }));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // ─── Auth ───────────────────────────────────────────────
    login() {
        window.location.href = `${this.baseUrl}/auth/login`;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('meta_access_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('meta_access_token');
    }

    isConnected() {
        return !!this.token;
    }

    async getAdAccounts() {
        return this._fetch('/auth/ad-accounts', { access_token: this.token });
    }

    // ─── Insights ───────────────────────────────────────────
    async getOverview(datePreset = 'last_7d') {
        return this._fetch('/insights/overview', { date_preset: datePreset });
    }

    async getDailyTrend(datePreset = 'last_30d', since = null, until = null) {
        return this._fetch('/insights/daily-trend', { date_preset: datePreset, since, until });
    }

    async getBreakdown(type, datePreset = 'last_30d') {
        return this._fetch(`/insights/breakdowns/${type}`, { date_preset: datePreset });
    }

    async getComparison(datePreset = 'last_7d') {
        return this._fetch('/insights/comparison', { date_preset: datePreset });
    }

    // ─── Campaigns ──────────────────────────────────────────
    async getCampaigns(datePreset = 'last_30d', status = null) {
        return this._fetch('/campaigns/', { date_preset: datePreset, status });
    }

    async getCampaignDetail(campaignId, datePreset = 'last_30d') {
        return this._fetch(`/campaigns/${campaignId}`, { date_preset: datePreset });
    }

    async getCampaignAdSets(campaignId) {
        return this._fetch(`/campaigns/${campaignId}/adsets`);
    }
}

/**
 * INTEGRATION EXAMPLE:
 *
 * // 1. Initialize
 * const api = new MetaAdsAPI('http://localhost:8000');
 *
 * // 2. Check if returning from OAuth
 * const urlParams = new URLSearchParams(window.location.search);
 * if (urlParams.has('token')) {
 *     api.setToken(urlParams.get('token'));
 *     window.history.replaceState({}, '', window.location.pathname);
 * }
 *
 * // 3. Load dashboard data
 * async function loadDashboard(range = 'last_7d') {
 *     if (!api.isConnected()) {
 *         // Show mock data or connection prompt
 *         return;
 *     }
 *
 *     const [overview, campaigns, platformBreakdown, ageBreakdown] = await Promise.all([
 *         api.getOverview(range),
 *         api.getCampaigns(range),
 *         api.getBreakdown('publisher_platform', range),
 *         api.getBreakdown('age', range),
 *     ]);
 *
 *     // overview.kpis => { spend, revenue, roas, cpa, clicks, ctr, impressions, conversions }
 *     // overview.daily_trend => [{ date, spend, revenue, impressions, clicks, conversions }]
 *     // overview.funnel => [{ stage, value, rate }]
 *     // campaigns.campaigns => [{ id, name, status, spend, roas, cpa, ... }]
 *     // platformBreakdown.data => [{ name, spend, percentage }]
 *
 *     renderKPIs(overview.kpis);
 *     renderChart(overview.daily_trend);
 *     renderFunnel(overview.funnel);
 *     renderCampaignTable(campaigns.campaigns);
 *     renderBreakdown('platform', platformBreakdown.data);
 *     renderBreakdown('age', ageBreakdown.data);
 * }
 *
 * // 4. Connect button handler
 * document.getElementById('connectBtn').addEventListener('click', () => api.login());
 */

// Export for ES modules or expose globally
if (typeof module !== 'undefined') {
    module.exports = { MetaAdsAPI };
} else {
    window.MetaAdsAPI = MetaAdsAPI;
}

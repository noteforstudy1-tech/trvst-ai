// TRVST AI Frontend Application Logic
// Team Spider — Intelligent Brand Governance Platform

const state = {
  activeTab: 'workspace',
  activeRole: 'creator', // 'creator', 'brand_lead', 'legal_compliance', 'agency_freelancer'
  roleNameMap: {
    creator: 'Raghav Parashar (Team Lead / Creator)',
    brand_lead: 'Vritika Sheth (Brand & Marketing Lead)',
    legal_compliance: 'Radha Gautam (Legal & Compliance Officer)',
    agency_freelancer: 'Tatvagna Tandel (Agency Freelancer)'
  },
  presets: [],
  selectedPresetId: 'preset-high-risk',
  currentSubmissionId: null,
  currentReview: null,
  findingsFilter: 'all',
  vault: {
    rules: [],
    facts: [],
    terms: [],
    visuals: []
  },
  analytics: null,
  settings: {
    gemini_configured: false,
    masked_key: ''
  },
  isAnalyzing: false,
  charts: {
    violationChart: null,
    severityChart: null
  }
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', async () => {
  await fetchStatus();
  await loadPresets();
  await loadVault();
  selectPreset('preset-high-risk');
  setupEventListeners();
  updateRoleDisplay();
});

// Fetch system health & Gemini status
async function fetchStatus() {
  try {
    const res = await fetch('/api/settings/status');
    const data = await res.json();
    state.settings = data;
    updateStatusBadge();
  } catch (err) {
    console.error('Status fetch error:', err);
  }
}

function updateStatusBadge() {
  const badge = document.getElementById('engine-status-badge');
  const modalInput = document.getElementById('api-key-input');
  if (state.settings.gemini_configured) {
    badge.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        Gemini 2.5 Flash Active (${state.settings.masked_key})
      </span>
    `;
    if (modalInput) modalInput.placeholder = state.settings.masked_key;
  } else {
    badge.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-cyan-300 border border-cyan-500/30">
        <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
        TRVST Semantic Heuristic Engine (Offline Safe)
      </span>
    `;
  }
}

// Load Demo Presets
async function loadPresets() {
  try {
    const res = await fetch('/api/presets');
    state.presets = await res.json();
    renderPresetBar();
  } catch (err) {
    console.error('Error loading presets:', err);
  }
}

function renderPresetBar() {
  const container = document.getElementById('preset-buttons-container');
  if (!container) return;
  container.innerHTML = state.presets.map(p => `
    <button 
      onclick="selectPreset('${p.id}')"
      class="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
        state.selectedPresetId === p.id 
          ? 'bg-teal-500/20 text-teal-300 border-teal-500/60 shadow-sm shadow-teal-500/10' 
          : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:border-slate-500 hover:text-slate-200'
      }">
      ${p.name}
    </button>
  `).join('');
}

function selectPreset(id) {
  state.selectedPresetId = id;
  renderPresetBar();
  const preset = state.presets.find(p => p.id === id);
  if (!preset) return;

  document.getElementById('campaign-title').value = preset.name.replace(/^[^:]+:\s*/, '');
  document.getElementById('content-channel').value = preset.channel.includes('Social') ? 'Social Media' : (preset.channel.includes('Blog') ? 'Blog Post' : 'Press Release');
  document.getElementById('copy-editor').value = preset.content_text;
  updateTextStats();

  // Clear previous review or reset
  state.currentReview = null;
  state.currentSubmissionId = null;
  renderEmptyReviewState(preset.expected_findings_summary);
}

function updateTextStats() {
  const text = document.getElementById('copy-editor').value;
  document.getElementById('char-count').textContent = `${text.length} chars`;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('word-count').textContent = `${words} words`;
}

// Run AI Review
async function runReview() {
  const text = document.getElementById('copy-editor').value.trim();
  if (!text) {
    showToast('Please enter or select copy to review.', 'error');
    return;
  }

  const title = document.getElementById('campaign-title').value.trim() || 'Content Campaign Draft';
  const channel = document.getElementById('content-channel').value;
  const runBtn = document.getElementById('run-review-btn');

  state.isAnalyzing = true;
  runBtn.disabled = true;
  runBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Analyzing Guidelines & Facts...
  `;

  try {
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.currentSubmissionId,
        title: title,
        channel: channel,
        content_text: text,
        author: state.roleNameMap[state.activeRole],
        author_role: state.activeRole
      })
    });

    if (!res.ok) throw new Error(await res.text());
    state.currentReview = await res.json();
    state.currentSubmissionId = state.currentReview.submission_id;
    renderReviewResults();
    showToast('Governance review completed successfully!', 'success');
  } catch (err) {
    console.error('Review error:', err);
    showToast('Review failed: ' + err.message, 'error');
  } finally {
    state.isAnalyzing = false;
    runBtn.disabled = false;
    runBtn.innerHTML = `
      <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      Run TRVST AI Review
    `;
  }
}

// Render Review Results in Right Pane
function renderReviewResults() {
  const container = document.getElementById('review-results-container');
  if (!state.currentReview) return;

  const rev = state.currentReview;
  const isHighRisk = rev.overall_score < 70;
  const isModerate = rev.overall_score >= 70 && rev.overall_score < 90;
  const isCompliant = rev.overall_score >= 90;

  const scoreColor = isCompliant ? 'text-teal-400' : (isModerate ? 'text-amber-400' : 'text-rose-400');
  const ringColor = isCompliant ? '#00bfa5' : (isModerate ? '#f59e0b' : '#f43f5e');
  const strokeDash = 283 - (283 * (rev.overall_score / 100));

  const criticalCount = rev.findings.filter(f => f.severity === 'critical' && f.status === 'open').length;
  const moderateCount = rev.findings.filter(f => f.severity === 'moderate' && f.status === 'open').length;
  const minorCount = rev.findings.filter(f => f.severity === 'minor' && f.status === 'open').length;

  let filteredFindings = rev.findings;
  if (state.findingsFilter !== 'all') {
    filteredFindings = rev.findings.filter(f => f.severity === state.findingsFilter);
  }

  container.innerHTML = `
    <!-- Top Score & Health Card -->
    <div class="glass-card rounded-2xl p-5 mb-5 border-slate-700/60">
      <div class="flex items-center justify-between gap-4">
        <div>
          <span class="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
            isCompliant ? 'bg-teal-900/60 text-teal-300 border border-teal-500/30' : 
            (isModerate ? 'bg-amber-900/60 text-amber-300 border border-amber-500/30' : 'bg-rose-900/60 text-rose-300 border border-rose-500/30')
          }">
            ${rev.risk_level}
          </span>
          <h3 class="text-lg font-bold text-white mt-1">Brand Alignment Assessment</h3>
          <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">${rev.summary}</p>
          <div class="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
            <span>Engine: <span class="text-slate-300 font-medium">${rev.engine_used}</span></span>
            <span>•</span>
            <span>Evaluated: ${rev.evaluated_at}</span>
          </div>
        </div>

        <!-- Animated Score Dial -->
        <div class="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
          <svg class="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r="34" stroke="currentColor" stroke-width="6" class="text-slate-800" fill="transparent"/>
            <circle cx="40" cy="40" r="34" stroke="${ringColor}" stroke-width="6" class="score-circle" fill="transparent"
              stroke-dasharray="213" stroke-dashoffset="${213 - (213 * (rev.overall_score / 100))}" stroke-linecap="round"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-xl font-black ${scoreColor}">${rev.overall_score}</span>
            <span class="text-[9px] uppercase font-bold text-slate-400">Score</span>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Counters -->
      <div class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800">
        <div class="text-center p-2 rounded-lg bg-rose-950/20 border border-rose-500/20">
          <div class="text-lg font-bold text-rose-400">${criticalCount}</div>
          <div class="text-[10px] text-slate-400 uppercase font-medium">Critical Risks</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-amber-950/20 border border-amber-500/20">
          <div class="text-lg font-bold text-amber-400">${moderateCount}</div>
          <div class="text-[10px] text-slate-400 uppercase font-medium">Moderate Flags</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/20">
          <div class="text-lg font-bold text-cyan-400">${minorCount}</div>
          <div class="text-[10px] text-slate-400 uppercase font-medium">Style / Voice</div>
        </div>
      </div>
    </div>

    <!-- Human Decision & Approval Controls -->
    <div class="glass-card rounded-xl p-4 mb-5 border-slate-700/60 bg-gradient-to-r from-slate-900/80 to-slate-800/40">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Human Governance Control Loop
        </span>
        <span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          Status: <strong class="text-white">${rev.status.toUpperCase().replace('_', ' ')}</strong>
        </span>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <button onclick="approveContent()" class="flex-1 min-w-[130px] px-3 py-2 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors shadow-sm flex items-center justify-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          Approve for Publishing
        </button>
        <button onclick="requestChanges()" class="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
          Request Changes
        </button>
        <button onclick="escalateToLegal()" class="px-3 py-2 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 transition-colors flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          Escalate to Legal
        </button>
      </div>
    </div>

    <!-- Filter Pills for Findings -->
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">
        Explainable Findings (${rev.findings.length})
      </h4>
      <div class="flex gap-1 text-[11px]">
        <button onclick="setFindingsFilter('all')" class="px-2.5 py-0.5 rounded ${state.findingsFilter === 'all' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'}">All (${rev.findings.length})</button>
        <button onclick="setFindingsFilter('critical')" class="px-2.5 py-0.5 rounded ${state.findingsFilter === 'critical' ? 'bg-rose-900 text-rose-200 font-semibold' : 'text-slate-400 hover:text-rose-300'}">Critical</button>
        <button onclick="setFindingsFilter('moderate')" class="px-2.5 py-0.5 rounded ${state.findingsFilter === 'moderate' ? 'bg-amber-900 text-amber-200 font-semibold' : 'text-slate-400 hover:text-amber-300'}">Moderate</button>
        <button onclick="setFindingsFilter('minor')" class="px-2.5 py-0.5 rounded ${state.findingsFilter === 'minor' ? 'bg-cyan-900 text-cyan-200 font-semibold' : 'text-slate-400 hover:text-cyan-300'}">Minor</button>
      </div>
    </div>

    <!-- Findings Stream -->
    <div class="space-y-3">
      ${filteredFindings.length === 0 ? `
        <div class="glass-card rounded-xl p-8 text-center text-slate-400">
          <svg class="w-10 h-10 text-teal-400 mx-auto mb-2 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p class="font-semibold text-slate-200">No flags in this category!</p>
          <p class="text-xs text-slate-400 mt-1">Content meets all relevant brand and regulatory criteria.</p>
        </div>
      ` : filteredFindings.map(f => renderFindingCard(f)).join('')}
    </div>
  `;
}

function renderFindingCard(finding) {
  const isApplied = finding.status === 'applied';
  const isDismissed = finding.status === 'dismissed';

  const sevBadge = finding.severity === 'critical' 
    ? 'bg-rose-950/80 text-rose-300 border-rose-500/40' 
    : (finding.severity === 'moderate' ? 'bg-amber-950/80 text-amber-300 border-amber-500/40' : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40');

  return `
    <div class="glass-card rounded-xl p-4 highlight-pill ${finding.severity} ${isApplied ? 'opacity-50' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${sevBadge}">
              ${finding.severity}
            </span>
            <span class="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
              ${finding.rule_citation}
            </span>
            ${isApplied ? '<span class="text-[10px] bg-teal-900/80 text-teal-300 px-2 py-0.5 rounded font-bold">✓ REWRITE APPLIED</span>' : ''}
            ${isDismissed ? '<span class="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">DISMISSED</span>' : ''}
          </div>
          <h5 class="text-sm font-semibold text-white">${finding.title}</h5>
        </div>
      </div>

      <!-- Flagged excerpt quote -->
      <div class="mt-2.5 p-2 rounded bg-slate-900/80 border border-slate-800 text-xs">
        <span class="text-slate-500 font-mono text-[10px] uppercase block mb-0.5">Flagged Excerpt:</span>
        <span class="text-rose-300 font-medium">"${finding.excerpt}"</span>
      </div>

      <!-- Explanation -->
      <p class="text-xs text-slate-300 mt-2 leading-relaxed">
        ${finding.explanation}
      </p>

      <!-- Suggested Rewrite Box -->
      ${finding.suggested_revision ? `
        <div class="mt-3 p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/30">
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="text-teal-300 font-semibold flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              1-Click Compliant Rewrite:
            </span>
          </div>
          <div class="text-xs text-teal-100 font-mono bg-slate-900/60 p-2 rounded border border-teal-500/20 mb-2">
            "${finding.suggested_revision}"
          </div>
          <div class="flex items-center justify-end gap-2">
            ${!isApplied && !isDismissed ? `
              <button onclick="dismissFinding('${finding.id}')" class="px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200">
                Dismiss
              </button>
              <button onclick="applyRewrite('${finding.id}')" class="px-3 py-1 rounded text-[11px] font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Apply Rewrite
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderEmptyReviewState(expectedNote) {
  const container = document.getElementById('review-results-container');
  container.innerHTML = `
    <div class="glass-card rounded-2xl p-8 text-center border-slate-700/60">
      <div class="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto mb-4 text-teal-400">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
      </div>
      <h3 class="text-base font-bold text-white mb-1">Pre-Publication Review Ready</h3>
      <p class="text-xs text-slate-400 max-w-sm mx-auto mb-4">
        Click <strong class="text-teal-300">Run TRVST AI Review</strong> to check this copy against active Knowledge Vault rules, facts, and guidelines.
      </p>
      ${expectedNote ? `
        <div class="inline-block p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-left max-w-sm text-xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-0.5">Scenario Expected Profile:</span>
          <span class="text-slate-300">${expectedNote}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function setFindingsFilter(filter) {
  state.findingsFilter = filter;
  renderReviewResults();
}

// 1-Click Suggestion Application
async function applyRewrite(findingId) {
  if (!state.currentSubmissionId) return;
  try {
    const res = await fetch('/api/workflow/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: state.currentSubmissionId,
        role: state.activeRole,
        action: 'apply_revision',
        reviewer_name: state.roleNameMap[state.activeRole],
        finding_id: findingId
      })
    });
    const result = await res.json();
    if (result.success) {
      // Update editor text with updated text from backend
      document.getElementById('copy-editor').value = result.data.submission.content_text;
      updateTextStats();
      // Re-run review to update scores and resolve findings
      await runReview();
      showToast('1-Click rewrite applied and verified!', 'success');
    }
  } catch (err) {
    console.error('Error applying rewrite:', err);
    showToast('Failed to apply rewrite: ' + err.message, 'error');
  }
}

async function dismissFinding(findingId) {
  if (!state.currentSubmissionId) return;
  try {
    const res = await fetch('/api/workflow/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: state.currentSubmissionId,
        role: state.activeRole,
        action: 'dismiss_finding',
        reviewer_name: state.roleNameMap[state.activeRole],
        finding_id: findingId
      })
    });
    const result = await res.json();
    if (result.success) {
      const f = state.currentReview.findings.find(x => x.id === findingId);
      if (f) f.status = 'dismissed';
      renderReviewResults();
      showToast('Finding marked as dismissed', 'info');
    }
  } catch (err) {
    showToast('Error dismissing finding', 'error');
  }
}

async function approveContent() {
  if (!state.currentSubmissionId) {
    showToast('Please run a review first before approving.', 'error');
    return;
  }
  try {
    const res = await fetch('/api/workflow/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: state.currentSubmissionId,
        role: state.activeRole,
        action: 'approve',
        notes: `Approved for production publishing by ${state.roleNameMap[state.activeRole]}`,
        reviewer_name: state.roleNameMap[state.activeRole]
      })
    });
    const result = await res.json();
    if (result.success) {
      state.currentReview.status = 'approved';
      renderReviewResults();
      showToast('🎉 Content officially APPROVED for publishing!', 'success');
    }
  } catch (err) {
    showToast('Approval failed: ' + err.message, 'error');
  }
}

async function requestChanges() {
  if (!state.currentSubmissionId) return;
  const notes = prompt('Enter feedback / revision requests for creator:', 'Please resolve outstanding compliance flags before approval.');
  if (notes === null) return;

  try {
    const res = await fetch('/api/workflow/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: state.currentSubmissionId,
        role: state.activeRole,
        action: 'request_changes',
        notes: notes,
        reviewer_name: state.roleNameMap[state.activeRole]
      })
    });
    const result = await res.json();
    if (result.success) {
      state.currentReview.status = 'changes_requested';
      renderReviewResults();
      showToast('Returned to creator with feedback', 'info');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function escalateToLegal() {
  if (!state.currentSubmissionId) return;
  const reason = prompt('Specify legal risk rationale:', 'Unverified claims and pricing discrepancy requiring legal qualification.');
  if (reason === null) return;

  try {
    const res = await fetch('/api/workflow/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: state.currentSubmissionId,
        role: state.activeRole,
        action: 'escalate',
        notes: reason,
        reviewer_name: state.roleNameMap[state.activeRole]
      })
    });
    const result = await res.json();
    if (result.success) {
      state.currentReview.status = 'escalated_legal';
      renderReviewResults();
      showToast('Escalated to Legal & Compliance department', 'warning');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// Knowledge Vault Tab Handling
async function loadVault() {
  try {
    const [rulesRes, factsRes, termsRes, visualsRes] = await Promise.all([
      fetch('/api/knowledge-vault/rules'),
      fetch('/api/knowledge-vault/facts'),
      fetch('/api/knowledge-vault/terms'),
      fetch('/api/knowledge-vault/visuals')
    ]);
    state.vault.rules = await rulesRes.json();
    state.vault.facts = await factsRes.json();
    state.vault.terms = await termsRes.json();
    state.vault.visuals = await visualsRes.json();
    renderVaultContent();
  } catch (err) {
    console.error('Error loading vault:', err);
  }
}

function renderVaultContent() {
  const container = document.getElementById('vault-content-container');
  if (!container) return;

  container.innerHTML = `
    <!-- Brand Rules Section -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            Brand Rules & Compliance Policies (${state.vault.rules.length})
          </h3>
          <p class="text-xs text-slate-400">Enforced by TRVST AI across all content channels.</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${state.vault.rules.map(r => `
          <div class="glass-card rounded-xl p-4 border-slate-700/60">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="font-mono text-xs font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">${r.id}</span>
              <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                r.severity_default === 'critical' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                (r.severity_default === 'moderate' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40')
              }">${r.severity_default}</span>
            </div>
            <h5 class="text-sm font-semibold text-white mb-1">${r.title}</h5>
            <p class="text-xs text-slate-300 leading-relaxed mb-2">${r.rule_text}</p>
            <div class="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
              <span class="text-slate-500 font-semibold">Rationale:</span> ${r.rationale}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Approved Facts Section -->
    <div class="mb-8">
      <h3 class="text-base font-bold text-white flex items-center gap-2 mb-4">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
        Verified Facts & Corporate Claims (${state.vault.facts.length})
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${state.vault.facts.map(f => `
          <div class="glass-card rounded-xl p-4 border-slate-700/60">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-mono text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">${f.id}</span>
              <span class="text-[10px] text-slate-400">Valid until ${f.valid_until}</span>
            </div>
            <h5 class="text-sm font-semibold text-white mb-1">${f.topic}</h5>
            <p class="text-xs text-teal-200 font-medium mb-2 leading-relaxed">"${f.claim}"</p>
            <div class="text-[11px] text-slate-400">
              <span class="text-slate-500 font-medium">Source:</span> ${f.verified_source}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Terminology Dictionary -->
    <div class="mb-8">
      <h3 class="text-base font-bold text-white flex items-center gap-2 mb-4">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
        Forbidden & Preferred Terminology (${state.vault.terms.length})
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${state.vault.terms.map(t => `
          <div class="glass-card rounded-xl p-3 border-slate-700/60">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-bold text-rose-300 font-mono">"${t.term}"</span>
              <span class="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 font-bold">Forbidden</span>
            </div>
            <div class="text-[11px] text-teal-300 mt-1">
              <span class="text-slate-400 text-[10px]">Use instead:</span><br/>
              <strong>"${t.suggested_replacement}"</strong>
            </div>
            <p class="text-[10px] text-slate-400 mt-2">${t.context_note}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Governance Insights Tab & Charts
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics/dashboard');
    state.analytics = await res.json();
    renderAnalyticsDashboard();
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function renderAnalyticsDashboard() {
  const container = document.getElementById('insights-content-container');
  if (!container || !state.analytics) return;

  const kpis = state.analytics.kpis;

  container.innerHTML = `
    <!-- Top Hypothesis KPI Cards matching PDF Slide 11 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="glass-card rounded-2xl p-5 border-teal-500/30 bg-gradient-to-b from-teal-950/20 to-transparent">
        <div class="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1">Risk Reduction Rate</div>
        <div class="text-3xl font-black text-white">${kpis.risk_reduction_rate}</div>
        <div class="text-xs text-slate-400 mt-1">${kpis.risk_reduction_subtitle}</div>
      </div>
      <div class="glass-card rounded-2xl p-5 border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-transparent">
        <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Approval Turnaround</div>
        <div class="text-3xl font-black text-white">${kpis.turnaround_velocity}</div>
        <div class="text-xs text-slate-400 mt-1">${kpis.turnaround_subtitle}</div>
      </div>
      <div class="glass-card rounded-2xl p-5 border-rose-500/30 bg-gradient-to-b from-rose-950/20 to-transparent">
        <div class="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1">Risks Intercepted</div>
        <div class="text-3xl font-black text-white">${kpis.critical_risks_intercepted}</div>
        <div class="text-xs text-slate-400 mt-1">${kpis.critical_intercepted_subtitle}</div>
      </div>
      <div class="glass-card rounded-2xl p-5 border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-transparent">
        <div class="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">Total Assets Screened</div>
        <div class="text-3xl font-black text-white">${kpis.total_content_reviewed}</div>
        <div class="text-xs text-slate-400 mt-1">${kpis.total_content_subtitle}</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="glass-card rounded-2xl p-5 border-slate-700/60">
        <h4 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Top Recurring Brand Rule Violations
        </h4>
        <div class="relative h-64">
          <canvas id="violationChartCanvas"></canvas>
        </div>
      </div>
      <div class="glass-card rounded-2xl p-5 border-slate-700/60">
        <h4 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>
          Severity Distribution Across Channels
        </h4>
        <div class="relative h-64 flex items-center justify-center">
          <canvas id="severityChartCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- Live Audit Trail Log -->
    <div class="glass-card rounded-2xl p-5 border-slate-700/60">
      <h4 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Governance Decisions & Human Approval Audit Trail
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-2.5 px-3">Timestamp</th>
              <th class="py-2.5 px-3">Submission</th>
              <th class="py-2.5 px-3">Actor / Role</th>
              <th class="py-2.5 px-3">Action Taken</th>
              <th class="py-2.5 px-3">Details</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${state.analytics.recent_audit_events.map(e => `
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">${e.timestamp}</td>
                <td class="py-2.5 px-3 font-medium text-white">${e.submission_title}</td>
                <td class="py-2.5 px-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-teal-300 border border-slate-700">
                    ${e.user_role} (${e.user_name})
                  </span>
                </td>
                <td class="py-2.5 px-3 font-semibold text-slate-200">${e.action_taken}</td>
                <td class="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate">${e.details}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderCharts();
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  // Bar Chart: Violations
  const vCanvas = document.getElementById('violationChartCanvas');
  if (vCanvas && state.analytics) {
    if (state.charts.violationChart) state.charts.violationChart.destroy();
    const data = state.analytics.rule_violation_breakdown;
    state.charts.violationChart = new Chart(vCanvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.rule),
        datasets: [{
          label: 'Times Flagged',
          data: data.map(d => d.count),
          backgroundColor: '#00bfa5',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } }
        }
      }
    });
  }

  // Doughnut Chart: Severity
  const sCanvas = document.getElementById('severityChartCanvas');
  if (sCanvas && state.analytics) {
    if (state.charts.severityChart) state.charts.severityChart.destroy();
    const dist = state.analytics.severity_distribution;
    state.charts.severityChart = new Chart(sCanvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(dist),
        datasets: [{
          data: Object.values(dist),
          backgroundColor: ['#f43f5e', '#f59e0b', '#38bdf8'],
          borderColor: '#0c192c',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
        }
      }
    });
  }
}

// Tab Switching
function switchTab(tab) {
  state.activeTab = tab;
  ['workspace', 'vault', 'insights', 'team'].forEach(t => {
    const el = document.getElementById(`tab-section-${t}`);
    const btn = document.getElementById(`nav-btn-${t}`);
    if (el) el.classList.toggle('hidden', t !== tab);
    if (btn) {
      if (t === tab) {
        btn.classList.add('text-teal-400', 'border-teal-400');
        btn.classList.remove('text-slate-400', 'border-transparent');
      } else {
        btn.classList.remove('text-teal-400', 'border-teal-400');
        btn.classList.add('text-slate-400', 'border-transparent');
      }
    }
  });

  if (tab === 'vault') loadVault();
  if (tab === 'insights') loadAnalytics();
}

// Role Switching
function setRole(role) {
  state.activeRole = role;
  updateRoleDisplay();
  showToast(`Switched active persona to ${state.roleNameMap[role]}`, 'info');
}

function updateRoleDisplay() {
  const roleDisplay = document.getElementById('current-role-label');
  if (roleDisplay) {
    roleDisplay.textContent = state.roleNameMap[state.activeRole];
  }
  const roleSelect = document.getElementById('role-selector');
  if (roleSelect) roleSelect.value = state.activeRole;
}

// API Key Modal Handling
function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

async function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) {
    showToast('Please enter an API key.', 'error');
    return;
  }
  try {
    const res = await fetch('/api/settings/gemini-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key })
    });
    const data = await res.json();
    if (data.success) {
      state.settings.gemini_configured = true;
      state.settings.masked_key = data.masked_key;
      updateStatusBadge();
      closeSettingsModal();
      showToast('Gemini API key configured and activated!', 'success');
    }
  } catch (err) {
    showToast('Failed to save API key', 'error');
  }
}

// Toast Notifications
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-teal-600' : (type === 'error' ? 'bg-rose-600' : (type === 'warning' ? 'bg-amber-600' : 'bg-slate-800'));
  toast.className = `fixed bottom-5 right-5 z-50 ${bg} text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0`;
  toast.innerHTML = `<span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Setup Event Listeners
function setupEventListeners() {
  const editor = document.getElementById('copy-editor');
  if (editor) {
    editor.addEventListener('input', updateTextStats);
  }
}

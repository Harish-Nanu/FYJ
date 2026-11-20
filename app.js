// For You Job - frontend.
// Loads data/jobs.json and data/stats.json (written daily by the pipeline),
// then shows the jobs with search and filters. No framework, no build step.

const els = {
  search: document.getElementById("search"),
  role: document.getElementById("role"),
  city: document.getElementById("city"),
  type: document.getElementById("type"),
  freshersOnly: document.getElementById("freshers-only"),
  list: document.getElementById("job-list"),
  count: document.getElementById("result-count"),
  status: document.getElementById("status"),
};

let allJobs = [];

// ---------- loading ----------

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function init() {
  try {
    allJobs = await loadJSON("data/jobs.json");
  } catch (err) {
    els.status.textContent = "Could not load jobs.";
    els.list.innerHTML = `<p>Could not load <code>data/jobs.json</code> (${escapeHtml(err.message)}).</p>`;
    return;
  }

  // Newest posts first
  allJobs.sort((a, b) => toTime(b.posted_at) - toTime(a.posted_at));

  const stats = await loadJSON("data/stats.json").catch(() => null);
  renderStatus(stats);

  fillSelect(els.role, uniqueValues("role"));
  fillSelect(els.city, uniqueValues("city"));
  fillSelect(els.type, uniqueValues("job_type"));

  for (const el of [els.search, els.role, els.city, els.type, els.freshersOnly]) {
    el.addEventListener("input", render);
  }
  render();
}

// ---------- filtering ----------

function filteredJobs() {
  const query = els.search.value.trim().toLowerCase();
  const role = els.role.value;
  const city = els.city.value;
  const type = els.type.value;
  const freshersOnly = els.freshersOnly.checked;

  return allJobs.filter((job) => {
    if (role && job.role !== role) return false;
    if (city && job.city !== city) return false;
    if (type && job.job_type !== type) return false;
    if (freshersOnly && !job.is_fresher) return false;
    if (query) {
      const text = `${job.title} ${job.company}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });
}

// ---------- rendering ----------

function render() {
  const jobs = filteredJobs();
  els.count.textContent = `${jobs.length} of ${allJobs.length} jobs`;

  if (jobs.length === 0) {
    els.list.innerHTML = "<p>No jobs match these filters.</p>";
    return;
  }
  els.list.innerHTML = jobs.map(jobCard).join("");
}

function jobCard(job) {
  const tags = [
    isNew(job.posted_at) ? `<span class="tag new">New</span>` : "",
    tag(job.role),
    tag(job.city),
    tag(job.job_type),
    tag(experienceText(job.min_experience_years)),
  ].join("");

  return `
    <article>
      <h3>${escapeHtml(job.title)}</h3>
      <div>${escapeHtml(job.company)}</div>
      <div class="tags">${tags}</div>
      <footer>
        <small>${formatDate(job.posted_at)}</small>
        <a href="${safeUrl(job.url)}" target="_blank" rel="noopener" role="button">Apply →</a>
      </footer>
    </article>`;
}

function renderStatus(stats) {
  if (!stats) {
    els.status.textContent = `${allJobs.length} jobs`;
    return;
  }
  const parts = [
    `Updated ${formatDateTime(stats.updated_at)}`,
    `${stats.total_jobs} jobs`,
    `${stats.sources.length} sources`,
    `${stats.duplicates_removed} duplicates removed`,
  ];
  if (stats.llm_cost_usd != null) parts.push(`LLM cost $${stats.llm_cost_usd.toFixed(4)}`);
  if (stats.note) parts.push(stats.note);
  els.status.textContent = parts.join(" · ");
}

// ---------- helpers ----------

function uniqueValues(field) {
  return [...new Set(allJobs.map((job) => job[field]).filter(Boolean))].sort();
}

function fillSelect(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function tag(text) {
  return text ? `<span class="tag">${escapeHtml(text)}</span>` : "";
}

function experienceText(years) {
  if (years == null) return "Experience not stated";
  if (years === 0) return "No experience needed";
  return `${years}+ yrs`;
}

function toTime(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function isNew(iso) {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  return Date.now() - toTime(iso) < twoDays;
}

function formatDate(iso) {
  if (!toTime(iso)) return "";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}

function formatDateTime(iso) {
  if (!toTime(iso)) return "unknown";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }) + " IST";
}

// Job data comes from other websites, so never put it into the page as raw HTML.
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

// Only allow normal web links (blocks "javascript:" links).
function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? escapeHtml(url) : "#";
}

init();

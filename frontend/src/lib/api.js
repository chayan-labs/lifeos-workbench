// Central API client + route registry for Life OS.
// Every backend route the system exposes (live or planned) is declared here so
// the frontend can both call it AND surface it in the API Explorer. The base URL
// is configurable via VITE_API_URL; it falls back to the local trusted host.

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_URL) || 'http://127.0.0.1:8080';

// status: 'live'  -> implemented in lifeos-api (services/lifeos-api/src/main.rs)
//         'planned'-> route the frontend expects; backend not yet built
export const API_ROUTES = [
  {
    service: 'lifeos-api',
    method: 'GET',
    path: '/api/health',
    status: 'live',
    summary: 'Liveness probe for the canonical API.',
    sample: null,
  },
  {
    service: 'lifeos-api',
    method: 'POST',
    path: '/api/entity',
    status: 'live',
    summary: 'Create an entity (generic workspace + module + type + attrs row).',
    sample: { workspace_id: 'ws_default_0001', module: 'tasks', type: 'task', attrs: { title: 'Ship overhaul' } },
  },
  {
    service: 'lifeos-api',
    method: 'GET',
    path: '/api/entity',
    status: 'live',
    summary: 'Query / list entities by workspace + module + type.',
    sample: null,
  },
  {
    service: 'lifeos-api',
    method: 'POST',
    path: '/api/module-request',
    status: 'live',
    summary: 'Enqueue a self-extension module build for the Mac harness.',
    sample: { workspace_id: 'ws_default_0001', prompt: 'Add a habit-tracking module' },
  },
  {
    service: 'lifeos-api',
    method: 'POST',
    path: '/api/register',
    status: 'live',
    summary: 'Register a new workspace (tenant) and mint its keys.',
    sample: { email: 'me@example.com', password: '••••••••' },
  },
  {
    service: 'lifeos-api',
    method: 'POST',
    path: '/api/llm',
    status: 'planned',
    summary: 'Proxy a prompt to the model lane (Haiku light / Mac heavy). Used by Study AI.',
    sample: { system: 'You are a study assistant.', prompt: 'Explain CAP theorem.' },
  },
  {
    service: 'lifeos-pipelines',
    method: 'POST',
    path: '/api/pipeline/run',
    status: 'planned',
    summary: 'Trigger a Life OS Action / pipeline DAG run.',
    sample: { pipeline: 'social-draft', input: {} },
  },
  {
    service: 'lifeos-ingest',
    method: 'POST',
    path: '/api/ingest',
    status: 'planned',
    summary: 'Transcribe / caption / parse media into timestamped segment entities.',
    sample: { uri: 's3://lifeos-vault/demo-reel.mp4', kind: 'video' },
  },
  {
    service: 'lifeos-vcs',
    method: 'GET',
    path: '/api/vcs/history',
    status: 'planned',
    summary: 'Content-addressed version history for any file type.',
    sample: null,
  },
  {
    service: 'lifeos-vcs',
    method: 'POST',
    path: '/api/vcs/commit',
    status: 'planned',
    summary: 'Commit a new content-addressed version of a tracked file.',
    sample: { path: 'modules/learning/module.js', blake3: 'b3:…' },
  },
  {
    service: 'broker-guard',
    method: 'GET',
    path: '/api/broker/positions',
    status: 'planned',
    summary: 'Read-only broker positions. Order routes are intentionally absent (fail-closed).',
    sample: null,
  },
];

// Thin fetch wrapper. Returns { ok, data, error, offline }.
export async function apiCall(method, path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data?.error || res.statusText), offline: false };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.message, offline: true };
  }
}

// Ping a single route's health-style endpoint. Used by the API Explorer.
export async function pingRoute(route) {
  // Only GET routes with no required body are safely pingable; others report 'unknown'.
  if (route.method !== 'GET') return { reachable: null };
  const { ok, offline } = await apiCall('GET', route.path);
  return { reachable: offline ? false : ok };
}

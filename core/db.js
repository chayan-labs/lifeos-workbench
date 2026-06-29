/**
 * Life OS Local Database Wrapper
 * Coordinates with the Turso local embedded replica (offline: true)
 * and isolates transactions to the active workspace.
 */
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8080";

  const db = {
    workspaceId: "default-personal-workspace",
    keyToken: null, // optional Bearer token (set after register/login)

    headers(json) {
      const h = {};
      if (json) h["Content-Type"] = "application/json";
      h["X-Workspace-Id"] = this.workspaceId;
      if (this.keyToken) h["Authorization"] = `Bearer ${this.keyToken}`;
      return h;
    },

    // POST helper. workspace_id rides in the body too, for routes that read it there.
    async query(endpoint, payload = {}) {
      const response = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ ...payload, workspace_id: this.workspaceId })
      });
      return await response.json();
    },

    // GET helper. Adds workspace_id + any filters as query params.
    async get(endpoint, params = {}) {
      const qs = new URLSearchParams({ workspace_id: this.workspaceId, ...params });
      const response = await fetch(`${API_BASE}/api/${endpoint}?${qs}`, {
        method: "GET",
        headers: this.headers(false)
      });
      return await response.json();
    },

    async createEntity(module, type, title, attrs) {
      console.log(`[Database] Creating entity in '${module}'`);
      return this.query("entity", { module, type, title, attrs });
    },

    // List entities for the active workspace, optionally filtered by module/type/status.
    async listEntities(filters = {}) {
      return this.get("entity", filters);
    }
  };

  window.osDb = db;
  console.log("[Database] Multi-tenant DB interface active.");
})();

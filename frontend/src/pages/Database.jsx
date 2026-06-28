import React, { useState } from 'react';
import { Database as DbIcon, Share2, Type, Tag, HelpCircle, Key, ArrowRight, Play, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function Database() {
  const [selectedEntity, setSelectedEntity] = useState('trade');
  const [jobs, setJobs] = useState([
    { id: 'job_ingest_001', kind: 'ingest', payload: '{"video_url":"https://r2.lifeos.db/clips/session_92.mp4"}', status: 'queued', priority: 2 },
    { id: 'job_build_308', kind: 'module_build', payload: '{"module":"health"}', status: 'running', priority: 5 },
    { id: 'job_eval_122', kind: 'eval', payload: '{"run_id":"run_49a_sonnet"}', status: 'done', priority: 1 },
    { id: 'job_oauth_019', kind: 'pipeline', payload: '{"sync":"figma_tokens"}', status: 'failed', priority: 3 }
  ]);

  const triggerJobRun = (jobId) => {
    setJobs((prevJobs) => 
      prevJobs.map((job) => 
        job.id === jobId ? { ...job, status: 'running' } : job
      )
    );
    setTimeout(() => {
      setJobs((prevJobs) => 
        prevJobs.map((job) => 
          job.id === jobId ? { ...job, status: 'done' } : job
        )
      );
    }, 1500);
  };

  const entitiesSchema = [
    { name: 'id', type: 'TEXT (UUID)', desc: 'Primary Key' },
    { name: 'workspace_id', type: 'TEXT', desc: 'Tenant ID for SaaS scaling' },
    { name: 'module', type: 'TEXT', desc: 'e.g. learning, tasks, trading, social, design' },
    { name: 'type', type: 'TEXT', desc: 'e.g. topic, task, project, trade, post, campaign' },
    { name: 'parent_id', type: 'TEXT (Nullable)', desc: 'Self-referencing parent ID for hierarchies' },
    { name: 'status', type: 'TEXT', desc: 'Lifecycle state per module manifest' },
    { name: 'ts', type: 'TIMESTAMP', desc: 'Creation/modification time' },
    { name: 'attrs', type: 'JSON', desc: 'Flexible key-value storage for domain-specific fields' },
  ];

  const edgeTypes = [
    { type: 'depends_on', desc: 'Prerequisite mapping (e.g., Topic A depends on Topic B)' },
    { type: 'derived_from', desc: 'Visual models built from code/briefs' },
    { type: 'publishes_to', desc: 'Marketing campaign link to social accounts' },
    { type: 'uses_asset', desc: 'Figma mockups referenced in a blog post' },
    { type: 'owns', desc: 'Parent workspace ownership structure' },
  ];

  const entityDefinitions = {
    trade: {
      title: 'Trading Entity',
      module: 'trading',
      type: 'trade',
      status: 'completed',
      attrs: {
        ticker: 'AAPL',
        entry: 172.50,
        exit: 181.20,
        stop_loss: 169.00,
        pnl: 8.70,
        r_multiple: 2.48,
        thesis: 'Double bottom bounce on daily chart backed by volume spike.'
      },
      edges: [
        { label: 'depends_on', target: 'Topic: Technical Analysis' },
        { label: 'uses_asset', target: 'Asset: AAPL Daily Chart Screenshot' }
      ]
    },
    task: {
      title: 'Task Entity',
      module: 'tasks',
      type: 'task',
      status: 'review',
      attrs: {
        title: 'Migrate knowledge atlas data',
        due: '2026-06-30',
        priority: 'high',
        assigned_to: 'chayan-aggarwal',
        notes: 'Need to write the atlasAdd wrapper in the shim configuration.'
      },
      edges: [
        { label: 'depends_on', target: 'Project: Life OS Core' }
      ]
    },
    campaign: {
      title: 'Marketing Campaign',
      module: 'marketing',
      type: 'campaign',
      status: 'active',
      attrs: {
        campaign_name: 'Summer Launch 2026',
        channels: ['twitter', 'reddit'],
        budget: 500,
        leads_generated: 48,
        conversion_rate: 0.12
      },
      edges: [
        { label: 'publishes_to', target: 'Social Account: X (@life_os_app)' },
        { label: 'uses_asset', target: 'Asset: Summer Banner SVG' }
      ]
    }
  };

  const selectedData = entityDefinitions[selectedEntity];

  return (
    <div className="flex flex-col gap-8">
      {/* Introduction Banner */}
      <div className="neo-surface neo-border-thick neo-shadow p-6 bg-white">
        <h2 className="neo-title-md mb-2 flex items-center gap-2">
          <DbIcon size={24} className="text-[var(--neo-blue)]" />
          The Notion Killer: One Generic Table
        </h2>
        <p className="neo-body-md text-[var(--neo-text-muted)]">
          Unlike Notion, where users are forced to design custom schemas and tables for every new project, Life OS stores all domain models in a single, indexable, multi-tenant <strong>entities</strong> table. New domains require <strong>zero database migrations</strong>.
        </p>
      </div>

      {/* Database Schema Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Core Database Columns */}
        <div className="lg:col-span-5 neo-surface neo-border-thick neo-shadow p-5 bg-white">
          <h3 className="neo-title-md border-b-2 border-[var(--neo-border)] pb-3 mb-4 flex items-center gap-2">
            <Type size={18} />
            `entities` Schema
          </h3>
          <div className="flex flex-col gap-3">
            {entitiesSchema.map((col, idx) => (
              <div key={idx} className="p-3 bg-[var(--neo-surface-muted)] neo-border flex justify-between items-center gap-4">
                <div>
                  <span className="neo-label-md font-mono text-[var(--neo-blue)]">{col.name}</span>
                  <p className="text-xs text-[var(--neo-text-muted)] mt-1">{col.desc}</p>
                </div>
                <span className="neo-label-sm bg-white neo-border px-1.5 py-0.5 text-[10px]">{col.type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Mapping Playground */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="neo-surface neo-border-thick neo-shadow p-5 bg-white flex-1">
            <h3 className="neo-title-md border-b-2 border-[var(--neo-border)] pb-3 mb-4">
              Generic Row Translator
            </h3>
            
            {/* Entity Selectors */}
            <div className="flex gap-3 mb-6">
              {['trade', 'task', 'campaign'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedEntity(type)}
                  className={`neo-btn py-2 px-4 neo-label-md flex-1 ${
                    selectedEntity === type ? 'bg-[var(--neo-yellow)]' : 'bg-white'
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Simulated Database Row */}
            <div className="neo-border p-4 bg-gray-950 text-emerald-400 font-mono text-sm neo-radius overflow-x-auto shadow-inner">
              <div className="text-xs text-gray-500 mb-2">// Simulated SQL row in entities table</div>
              <div><span className="text-pink-400">id</span>: "d3b07384-d113-4cd4"</div>
              <div><span className="text-pink-400">workspace_id</span>: "personal_workspace"</div>
              <div><span className="text-pink-400">module</span>: "{selectedData.module}"</div>
              <div><span className="text-pink-400">type</span>: "{selectedData.type}"</div>
              <div><span className="text-pink-400">status</span>: "{selectedData.status}"</div>
              <div><span className="text-pink-400">attrs</span>: {'{'}</div>
              {Object.entries(selectedData.attrs).map(([key, val]) => (
                <div key={key} className="pl-4">
                  <span className="text-sky-400">"{key}"</span>: {typeof val === 'number' ? <span className="text-yellow-400">{val}</span> : <span className="text-orange-300">"{val}"</span>},
                </div>
              ))}
              <div>{'}'}</div>
            </div>

            {/* Linked Edges (Graph Layer) */}
            <div className="mt-6">
              <h4 className="neo-label-md mb-3 text-[var(--neo-text-muted)]">Cross-Domain Graph Edges (`edges` table)</h4>
              <div className="flex flex-col gap-2">
                {selectedData.edges.map((edge, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-[var(--neo-surface-muted)] neo-border text-xs font-semibold">
                    <span className="neo-chip neo-chip--active py-0.5 text-[9px]">{selectedData.title}</span>
                    <div className="flex items-center gap-1 text-[var(--neo-red)]">
                      <Share2 size={12} />
                      <span className="font-mono">{edge.label}</span>
                    </div>
                    <ArrowRight size={14} />
                    <span className="neo-chip neo-chip--draft py-0.5 text-[9px]">{edge.target}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Unified Jobs Queue Section */}
      <div className="neo-surface neo-border-thick neo-shadow p-5 bg-white">
        <h3 className="neo-title-md border-b-2 border-black pb-3 mb-4">
          Jobs Queue Manager (`jobs` table cloud ↔ Mac)
        </h3>
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="p-4 bg-[var(--neo-bg)] neo-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="neo-label-md font-mono text-xs text-[var(--neo-blue)]">{job.id}</span>
                  <span className="neo-chip py-0.5 text-[9px]">PRIORITY: {job.priority}</span>
                  <span className="neo-tag text-[9px]">kind: {job.kind}</span>
                </div>
                <code className="text-[10px] bg-white p-1 border font-mono block text-gray-600 truncate max-w-lg">
                  {job.payload}
                </code>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] px-1.5 py-0.5 neo-border font-bold uppercase ${
                  job.status === 'done' ? 'bg-[var(--neo-mint)]' :
                  job.status === 'running' ? 'bg-[var(--neo-yellow)]' :
                  job.status === 'failed' ? 'bg-[var(--neo-red)] text-white' : 'bg-white'
                }`}>
                  {job.status}
                </span>
                {job.status !== 'done' && (
                  <button 
                    onClick={() => triggerJobRun(job.id)}
                    disabled={job.status === 'running'}
                    className="neo-btn py-1 px-3 bg-white text-xs font-bold flex items-center gap-1.5"
                  >
                    {job.status === 'running' ? <RefreshCw className="animate-spin" size={12} /> : <Play size={12} />}
                    {job.status === 'running' ? 'Running' : 'Trigger'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

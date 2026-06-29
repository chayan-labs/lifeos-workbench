import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  ChevronRight, 
  Menu, 
  FileText, 
  Terminal, 
  Database,
  Cpu,
  Layers,
  GitBranch,
  Settings,
  Zap,
  History,
  Code,
  FileCode
} from 'lucide-react';

export default function DocsHub() {
  const [selectedDocId, setSelectedDocId] = useState('architecture');
  const [activeSubSection, setActiveSubSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Expansive, capability-oriented developer docs with exact "How to" and "Where to" guidelines
  const documentationData = {
    architecture: {
      title: 'Master Architecture',
      intro: 'Life OS acts as a unified coordinator for code, trades, learning, and automation. This section outlines the structural topology and double-brain delegation rules.',
      icon: Layers,
      subsections: [
        {
          id: 'overview',
          title: 'System Overview & Objective',
          body: 'Life OS provides a centralized "GitHub for your whole life." Instead of managing task lists, option trades, and study flashcards across siloed sites, everything maps into a single queryable entity graph.\n\n• WHERE TO ACCESS:\n  - Main dashboard viewport at `/dashboard` in the browser.\n  - Telegram chatbot interface on your mobile phone.\n\n• HOW TO EXECUTE:\n  - Web client routing is controlled client-side via react-router-dom, allowing fluid transition between module dashboards.\n  - Mobile capture is processed by typing notes or commands directly to the Telegram bot.'
        },
        {
          id: 'tiers',
          title: 'Three-Tier Topology',
          body: 'Operations are divided across three independent computing tiers:\n\n• WHERE TO CONFIGURE:\n  - Tier 1: Cloud Webhook code resides in `worker/bot.js` (Cloudflare Workers).\n  - Tier 2: Local API resides in `services/lifeos-api` (compiled on Mac).\n  - Tier 3: Turso database is configured via local path envs in `.env`.\n\n• HOW TO EXECUTE:\n  - Cloud webhook captures Telegram messages, verifies the user signature, and inserts a job payload in the Turso DB.\n  - The local Mac poller (`lifeos-drain` binary) pulls the job row, completes the calculation, and writes the output back to the database.'
        },
        {
          id: 'brains',
          title: 'Double-Brain Concept',
          body: 'To optimize token cost, Life OS splits intelligence tasks:\n\n• HOW TO RUN INTERACTIVE SCENARIOS:\n  - Light Brain tasks (Haiku): Run `/task Buy milk` in Telegram. Answers complete in <800ms.\n  - Heavy Brain tasks (Sonnet): Triggered by starting a code compile or VCS diff comparison from the local CLI.\n\n• PROCESS FLOW:\n  - Webhook requests process instantly via Haiku cloud callbacks. Heavy enqueued operations sleep until the Mac polling script wakes them.'
        }
      ]
    },
    'data-model': {
      title: 'Database & Sync Engine',
      intro: 'The schema-less relational graph database structure backing the entire operating system.',
      icon: Database,
      subsections: [
        {
          id: 'strategy',
          title: 'The Entities Graph',
          body: 'Life OS maps all data domains into a single table containing generic columns and a flexible attrs JSON block.\n\n• WHERE TO VIEW:\n  - Navigate to the "Unified Database" tab in the main sidebar.\n  - Open the DDL schema preview on the left panel to inspect structural fields.\n\n• HOW TO QUERY DETAILS:\n  - Select any entity key (e.g. TRADE, TASK) to see how the raw JSON properties map into entities table rows.'
        },
        {
          id: 'sync',
          title: 'Sync Replication Settings',
          body: 'Bidirectional sync uses Turso\'s embedded-replica client module.\n\n• WHERE TO MANAGE:\n  - Confured via env settings in `core/db.js`.\n\n• HOW TO EXECUTE SYNC:\n  - Launch the client API on your Mac with offline:true set in the DB initialization script.\n  - When offline, writes commit to the local file instantly. When network connection returns, call client.sync() or wait for the automatic sync interval.'
        },
        {
          id: 'derived',
          title: 'Derived DB Separation',
          body: 'Derived state, vector maps, and search indices must reside outside the replicated database file.\n\n• WHERE TO ACCESS:\n  - Path: `store/lifeos-derived.db` on your local host.\n\n• HOW TO REBUILD INDEXES:\n  - Triggered automatically by lifeos-ingest during file commits.\n  - Force manual indexing by running `lifeos search reindex` inside your CLI terminal.'
        }
      ]
    },
    modules: {
      title: 'Declarative Module System',
      intro: 'The plugin architecture defining how trackers, views, and commands register with the core SPA.',
      icon: Cpu,
      subsections: [
        {
          id: 'manifest',
          title: 'Manifest Registration',
          body: 'Adding a module requires zero schema migrations. The developer writes a manifest calling osRegisterModule() specifying views, models, and tools.\n\n• WHERE TO CONSTRUCT:\n  - Create a new folder under `modules/<module_name>/module.js`.\n\n• HOW TO REGISTER:\n  - Define the entity types, attributes schemas (Zod validation), and routing view layouts.\n  - The core app shell loads directories under modules/ at boot time automatically.'
        },
        {
          id: 'seeds',
          title: 'Seed Modules (How to Run)',
          body: 'Life OS ships with 7 seed modules. Here is how to execute their core capabilities:\n\n• LEARNING:\n  - Where: Click "Seed Modules" -> "Learning" in the main sidebar.\n  - How: Toggle cards to test spaced repetition flashcards, or type `/quiz me` in Telegram.\n\n• TRADING JOURNAL:\n  - Where: Click "Seed Modules" -> "Trading".\n  - How: View current journal logs. Type `/buy TSLA` in Telegram to log a draft order.\n\n• SOCIAL MEDIA:\n  - Where: Click "Seed Modules" -> "Social".\n  - How: Inspect social drafts queue and approve/reject post drafts.\n\n• DESIGN & figmas:\n  - Where: Click "Seed Modules" -> "Design".\n  - How: Link Figma designs and sync SVG assets.'
        },
        {
          id: 'extended',
          title: 'Extended Modules (Travel & Reading)',
          body: '• TRAVEL:\n  - Where: Click "Seed Modules" -> select "Itinerary Timeline" or "Travel Map" on the view toolbar.\n  - How: View legs of flight bookings (LEG_FLIGHT) and hotels (LEG_BOOKING) mapped onto spatial coordinates.\n\n• READING:\n  - How: Type `/save <url>` in Slack/Telegram. The system scrapes the article text, generates highlights, and syncs it to the reading list.'
        }
      ]
    },
    'self-extension': {
      title: 'Self-Extension Engine',
      intro: 'The builder loop enabling Life OS to generate, validate, and commit its own new code modules.',
      icon: Zap,
      subsections: [
        {
          id: 'codegen',
          title: 'Scaffolding Modules',
          body: 'Users can extend the system by instructing the AI to build new feature trackers.\n\n• WHERE TO EXECUTE:\n  - Navigate to the "Self-Extension" tab in the left sidebar.\n  - Enter your prompt inside the Console Input card (e.g. "Create a workout logger").\n  - Click the "RUN" button to start compilation.\n\n• PROCESS FLOW:\n  - local scaffolder copies template modules -> invokes Claude Agent SDK -> writes manifest.'
        },
        {
          id: 'sandbox',
          title: 'Sandboxing Controls',
          body: 'Code compilation is isolated to protect system directories from injection attacks.\n\n• WHERE CONFIGURED:\n  - Seatbelt profiles configured inside `server/sandbox.sb`.\n  - Path intercept hooks defined in `server/scaffold.js`.\n\n• SECURITY BOUNDARIES:\n  - PreToolUse hooks intercept write/edit calls. File writes targeting locations outside modules/ are rejected. macOS Seatbelt blocks outbound network calls during build runs.'
        },
        {
          id: 'validators',
          title: 'Running Validators',
          body: 'All generated code must pass structural and visual checks.\n\n• WHERE CONFIGURED:\n  - Structural verification: `server/validators/structural.js`.\n  - Visual rendering check: `server/validators/render.js`.\n\n• PROCESS FLOW:\n  - NodeJS worker scans syntax -> Playwright starts headless browser on ephemeral port -> asserts module loads with zero JS runtime logs.'
        }
      ]
    },
    'harness-loop': {
      title: 'Harness Loop & Observability',
      intro: 'The feedback loop collecting execution logs, grading output quality, and releasing prompt upgrades.',
      icon: History,
      subsections: [
        {
          id: 'events',
          title: 'Observe & Telemetry Logs',
          body: 'All runs write to the append-only events table.\n\n• WHERE TO INSPECT:\n  - Check "Harness Loop" -> "Observability Telemetry Logs" table in the browser client.\n  - Run `lifeos harness observe` in the local terminal.\n\n• HOW TO ANALYZE:\n  - Review columns for token count, latency (ms), model costs, and evaluation grades.'
        },
        {
          id: 'judge',
          title: 'Eval (LLM-as-Judge)',
          body: 'Quality is verified before release using Haiku evaluations.\n\n• WHERE TO CHECK:\n  - Review "LLM-as-Judge Evaluation" cards on the Harness Loop page.\n\n• PROCESS FLOW:\n  - The judge fetches completed draft entities -> grades alignment -> saves scores to events table. Low scores freeze code releases.'
        },
        {
          id: 'releases',
          title: 'Release Promotions',
          body: 'Deploy prompt or config upgrades atomically.\n\n• WHERE TO EXECUTE:\n  - Navigate to "Harness Loop" -> "Deployment Promotion Loop".\n  - Click the "PROMOTE TO PRODUCTION" button to activate candidate weights.\n\n• PROCESS FLOW:\n  - Config adjustments are shadow-replayed against historical event sequences. Clicking promote flips the active DB config pointer.'
        }
      ]
    },
    versioning: {
      title: 'Universal Version Control',
      intro: 'The lifeos-vcs content-addressed version control framework for binary media.',
      icon: FileCode,
      subsections: [
        {
          id: 'cas',
          title: 'Content-Addressed Commits',
          body: 'All media files, images, and designs are content-addressed.\n\n• WHERE TO EXECUTE:\n  - Local host CLI. Open a terminal and navigate to the project directory.\n  - Run command: `lifeos file commit <filepath>`.\n\n• PROCESS FLOW:\n  - The file bytes are hashed using BLAKE3. The hash acts as a pointer in the database while the bytes are uploaded to Cloudflare R2.'
        },
        {
          id: 'cdc',
          title: 'CDC Deduplication',
          body: 'Content-Defined Chunking handles revisions of large media objects.\n\n• WHERE TO MONITOR:\n  - Open the "VCS & Media Ingest" tab in the sidebar.\n  - Use the "FastCDC Deduplication Simulator" to adjust the chunk size slider and see deduplication ratios.'
        },
        {
          id: 'diff',
          title: 'Semantic Media Diffs',
          body: 'Compare revisions of images, video timelines, or Figma components.\n\n• WHERE TO RUN:\n  - Navigate to "VCS & Media Ingest" -> "Per-Type Semantic Diff Explorer".\n  - Select a file format (Image, Godot scene, or Figma node) to view diff reports.'
        }
      ]
    },
    'media-intelligence': {
      title: 'Media Ingest Pipeline',
      intro: 'Speech-to-text transcription, OCR indexing, and semantic search integration.',
      icon: Terminal,
      subsections: [
        {
          id: 'transcribe',
          title: 'Transcription segments',
          body: 'Parse video and audio tracks to extract spoken content.\n\n• HOW TO EXECUTE:\n  - Place a media file (MP4, MP3) in the ingestion directory, or write an ingest job to the Turso queue.\n  - The poller runs whisper-rs to segment the audio and writes timestamps to the database.'
        },
        {
          id: 'caption',
          title: 'OCR & Image Captions',
          body: 'Scan frames for written text or objects.\n\n• PROCESS FLOW:\n  - Images trigger tesseract OCR and vision-LLM models. Extracted text lists under the asset parent card.'
        },
        {
          id: 'recall',
          title: 'Search & Querying',
          body: 'Retrieve files using lexical and vector search.\n\n• WHERE TO EXECUTE:\n  - Type your search text inside the global search bar on the header, or under the "Semantic Voice Search" input box in "VCS & Media Ingest".\n  - Enter spoken phrases to locate matching video/audio timestamps.'
        }
      ]
    },
    integrations: {
      title: 'Secure Integrations',
      intro: 'Credentials management utilizing self-hosted Nango Proxy sequences.',
      icon: Settings,
      subsections: [
        {
          id: 'nango',
          title: 'Nango Credentials Proxy',
          body: 'Tokens are isolated from the LLM context to prevent credential leaks.\n\n• WHERE TO MANAGE:\n  - Navigate to the "Integrations" page in the left sidebar.\n  - Click the "Add Connection" button to open the OAuth Authorization modal.\n  - Type your account handle and click "AUTHORIZE SECURE CONNECTION".\n\n• PROCESS FLOW:\n  - The Nango server executes the OAuth flow and encrypts tokens at rest. The agent reads and uses connection IDs, and Nango Proxy attaches authorization headers during API calls.'
        },
        {
          id: 'actuator',
          title: 'Browser Actuator Settings',
          body: 'Automate legacy websites without API access.\n\n• HOW TO RUN:\n  - In the CLI, execute `lifeos browse <url> <instructions>`.\n  - The system launches Playwright in a sandbox on your Mac. You must approve the step sequence in the Telegram bot before the browser clicks buttons.'
        }
      ]
    },
    security: {
      title: 'Security Blueprint',
      intro: 'Tenancy isolation parameters, broker-guards, and access scopes.',
      icon: Settings,
      subsections: [
        {
          id: 'isolation',
          title: 'Multi-Tenant Isolation',
          body: 'Tenancy boundary guarantees for SaaS configurations.\n\n• WHERE CONFIGURED:\n  - API route interceptors in `lifeos-api`.\n\n• PROCESS FLOW:\n  - Every database query automatically appends a workspace_id filter. Credentials are encrypted using a workspace-specific key.'
        },
        {
          id: 'trading',
          title: 'Safe Trading Rules',
          body: 'Ensure the system can never execute unauthorized options trades.\n\n• WHERE CONFIGURED:\n  - PreToolUse verification logic in `services/broker-guard`.\n\n• RULES ENFORCED:\n  - All trading tools are configured as read-only. Attempting to place an order triggers a fail-closed response in the broker-guard script. Real orders require manual confirmation on a separate interactive terminal.'
        }
      ]
    },
    'rust-components': {
      title: 'Native Rust Infrastructure',
      intro: 'High-performance Rust binaries compiling core VCS, API routing, and audio ingestion pipelines.',
      icon: Code,
      subsections: [
        {
          id: 'binaries',
          title: 'Cargo compilation guide',
          body: '• WHERE TO BUILD:\n  - Local Mac host machine terminal.\n  - Paths: `services/lifeos-api/`, `services/lifeos-vcs/`, `services/lifeos-ingest/`.\n\n• HOW TO COMPILE:\n  - Open a terminal in the folder of the service you want to build.\n  - Run command: `cargo build --release`.\n  - The binaries compile statically to increase execution speeds and secure API routing.'
        }
      ]
    },
    'build-plan': {
      title: 'Build Plan Roadmap',
      intro: 'The 7-phase roadmap detailing the project schedule from core schema design to SaaS release.',
      icon: GitBranch,
      subsections: [
        {
          id: 'phases',
          title: 'Roadmap (How to Track)',
          body: '• WHERE TO TRACK:\n  - Navigate to the "Unified Database" -> "Jobs Queue Manager" to monitor active implementation states.\n  - Open the "Build Plan Roadmap" tab inside the Docs Portal.\n\n• HOW TO VERIFY PLAN PHASES:\n  - Review completed phase checklists. Confirm Turso schema runs (Phase 1) and React SPA view mounts (Phase 2) are completed successfully.'
        }
      ]
    }
  };

  const selectedDoc = documentationData[selectedDocId];

  const handleDocSelect = (docId) => {
    setSelectedDocId(docId);
    setActiveSubSection(documentationData[docId].subsections[0].id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info */}
      <div className="neo-surface neo-border-thick neo-shadow p-6 bg-neo-yellow">
        <h2 className="neo-title-lg text-neo-text mb-1.5 flex items-center gap-2">
          <BookOpen size={28} />
          System Specifications Portal
        </h2>
        <p className="neo-body-md text-neo-text font-semibold">
          Comprehensive guides, architecture topologies, and sandbox security parameters for the Life OS environment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Document Selector (Level 1 Nav) */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <span className="neo-label-sm text-neo-text-muted text-[10px] px-1">DOCUMENT SPECIFICATIONS</span>
          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
            {Object.keys(documentationData).map((key) => {
              const doc = documentationData[key];
              const Icon = doc.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleDocSelect(key)}
                  className={`neo-btn text-left p-3 flex items-center justify-between transition-all ${
                    selectedDocId === key ? 'bg-neo-yellow neo-shadow' : 'bg-neo-surface'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={14} className="shrink-0 text-neo-text" />
                    <span className="neo-label-md text-xs truncate block">{doc.title}</span>
                  </div>
                  <ChevronRight size={12} className="shrink-0 text-neo-text" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle Table of Contents (Level 2 Nav) */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <span className="neo-label-sm text-neo-text-muted text-[10px] px-1">SECTIONS IN THIS DOC</span>
          <div className="flex flex-col gap-2 bg-neo-surface p-3 neo-border neo-radius min-h-[160px]">
            {selectedDoc.subsections.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubSection(sub.id)}
                className={`text-left py-1.5 px-2.5 text-xs font-mono transition-all border-l-2 ${
                  activeSubSection === sub.id
                    ? 'border-[var(--neo-blue)] text-neo-blue font-bold bg-neo-surface-muted'
                    : 'border-transparent text-neo-text-muted hover:text-neo-text'
                }`}
              >
                {sub.title}
              </button>
            ))}
          </div>
        </div>

        {/* Right Main Text Content Pane */}
        <div className="lg:col-span-6">
          <div className="neo-surface neo-border-thick neo-shadow p-6 bg-neo-surface min-h-[400px] flex flex-col justify-between">
            <div>
              <div className="border-b-2 border-neo-border pb-3 mb-4">
                <span className="neo-chip neo-chip--completed text-[9px] mb-2">READING INDEX</span>
                <h3 className="neo-title-md text-sm">{selectedDoc.title}</h3>
                <p className="text-xs text-neo-text-muted mt-1.5 font-semibold leading-relaxed">
                  {selectedDoc.intro}
                </p>
              </div>

              {/* Show selected subsection content */}
              <div className="mt-4">
                {selectedDoc.subsections.find(s => s.id === activeSubSection) ? (
                  <div className="flex flex-col gap-3">
                    <h4 className="neo-label-md text-xs text-neo-blue border-b border-neo-border border-dashed pb-1.5">
                      {selectedDoc.subsections.find(s => s.id === activeSubSection).title}
                    </h4>
                    <p className="text-xs leading-relaxed text-neo-text-muted font-semibold whitespace-pre-wrap">
                      {selectedDoc.subsections.find(s => s.id === activeSubSection).body}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-neo-text-muted">Select a subsection to inspect the details.</p>
                )}
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-neo-border text-[9px] font-mono text-neo-text-muted flex justify-between">
              <span>Scope: docs/{selectedDocId}.md</span>
              <span>Classification: capabilities</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

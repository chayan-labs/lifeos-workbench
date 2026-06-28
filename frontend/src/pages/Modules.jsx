import React, { useState } from 'react';
import { 
  GraduationCap, 
  CheckSquare, 
  FolderKanban, 
  TrendingUp, 
  MessageSquare, 
  Megaphone, 
  Palette, 
  Play, 
  RefreshCw,
  Plus,
  ShieldCheck,
  Send,
  Eye,
  Calendar,
  Grid,
  List,
  GitBranch,
  MapPin,
  Clock,
  Compass,
  FileText
} from 'lucide-react';

export default function Modules() {
  const [activeModule, setActiveModule] = useState('learning');
  const [viewStyle, setViewStyle] = useState('board'); // board, list, calendar, graph, gallery, timeline, map

  // Flashcard mock state for learning module
  const [flashcardSide, setFlashcardSide] = useState('question');
  const [score, setScore] = useState({ reviewDue: 5, mastered: 12 });

  // Task Board mock state
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Map ENCODE GraphQL API schema', status: 'IN_PROGRESS', label: 'GENETICS' },
    { id: 2, title: 'Write SQLite FTS5 index trigger', status: 'REVIEW', label: 'CORE' },
    { id: 3, title: 'Setup Nango instance on fly.io', status: 'COMPLETED', label: 'DEVOPS' },
    { id: 4, title: 'Verify broker-guard closed bounds', status: 'OVERDUE', label: 'TRADING' },
  ]);

  // Social account connections mock state
  const [socialDrafts, setSocialDrafts] = useState([
    { id: 1, platform: 'X / Twitter', account: '@life_os_dev', text: 'Exciting news! Life OS self-extension validation pipeline is officially 100% locally sandboxed. Headless Playwright assertions prevent build leaks.', status: 'Draft (Pending Telegram Approval)' },
    { id: 2, platform: 'Instagram', account: 'life_os_studio', text: 'Behind the scenes: Spinning up custom connectors using self-hosted Nango OAuth vault.', status: 'Draft' }
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Module Tabs Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { id: 'learning', label: 'Learning', icon: GraduationCap, color: 'var(--neo-yellow)' },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'var(--neo-mint)' },
          { id: 'projects', label: 'Projects', icon: FolderKanban, color: 'var(--neo-blue-bright)' },
          { id: 'trading', label: 'Trading', icon: TrendingUp, color: 'var(--neo-red)' },
          { id: 'social', label: 'Social', icon: MessageSquare, color: 'var(--neo-yellow)' },
          { id: 'marketing', label: 'Marketing', icon: Megaphone, color: 'var(--neo-mint)' },
          { id: 'design', label: 'Design', icon: Palette, color: 'var(--neo-blue-bright)' },
        ].map((mod) => (
          <button
            key={mod.id}
            onClick={() => {
              setActiveModule(mod.id);
              // reset view style based on defaults
              if (mod.id === 'learning') setViewStyle('graph');
              else if (mod.id === 'tasks') setViewStyle('board');
              else if (mod.id === 'trading') setViewStyle('list');
              else if (mod.id === 'design') setViewStyle('gallery');
              else setViewStyle('list');
            }}
            className={`neo-btn py-3 px-2 flex flex-col items-center gap-2 ${
              activeModule === mod.id ? 'bg-[var(--neo-yellow)]' : 'bg-white'
            }`}
          >
            <div className="w-8 h-8 rounded-none border-2 border-black flex items-center justify-center bg-white">
              <mod.icon size={16} />
            </div>
            <span className="neo-label-sm text-xs">{mod.label}</span>
          </button>
        ))}
      </div>

      {/* View Style Toolbar (Shows views specified in manifests: list, board, calendar, detail, graph, gallery, timeline, map) */}
      <div className="neo-surface neo-border p-4 bg-white flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="neo-label-sm text-[var(--neo-text-muted)] text-[10px]">DECLARATIVE VIEW KIND:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'board', label: 'Kanban Board', icon: Grid },
            { id: 'list', label: 'Table / List', icon: List },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'graph', label: 'Cytoscape Graph', icon: GitBranch },
            { id: 'gallery', label: 'Asset Gallery', icon: Palette },
            { id: 'timeline', label: 'Itinerary Timeline', icon: Clock },
            { id: 'map', label: 'Travel Map', icon: MapPin },
          ].map((style) => (
            <button
              key={style.id}
              onClick={() => setViewStyle(style.id)}
              className={`neo-btn py-1 px-2.5 text-xs font-mono flex items-center gap-1.5 ${
                viewStyle === style.id ? 'bg-[var(--neo-yellow)]' : 'bg-white'
              }`}
            >
              <style.icon size={12} />
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Module Content */}
      <div className="neo-surface neo-border-thick neo-shadow p-6 bg-white min-h-[480px] flex flex-col">
        
        {/* Module Header */}
        <div className="flex justify-between items-center border-b-4 border-[var(--neo-border)] pb-4 mb-6">
          <div>
            <span className="neo-chip neo-chip--active text-[10px] mb-2 uppercase">Core Seed Module</span>
            <h3 className="neo-title-md uppercase">{activeModule} Playground</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="neo-tag bg-[var(--neo-surface-muted)] text-[10px]">`modules/{activeModule}/module.js`</span>
          </div>
        </div>

        {/* Conditional views */}
        
        {/* KANBAN BOARD VIEW */}
        {viewStyle === 'board' && (
          <div className="flex-1 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h4 className="neo-label-md">Task Board View</h4>
              <button className="neo-btn py-1.5 px-3 neo-label-sm bg-[var(--neo-yellow)] flex items-center gap-1">
                <Plus size={14} /> Add Task
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              {['DRAFT', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((col) => (
                <div key={col} className="p-4 bg-[var(--neo-bg)] neo-border flex flex-col gap-3">
                  <div className="border-b-2 border-black pb-2 mb-1 flex justify-between items-center">
                    <span className="neo-label-sm font-bold text-xs">{col.replace('_', ' ')}</span>
                    <span className="text-[10px] font-mono bg-white px-1.5 neo-border">
                      {tasks.filter(t => t.status === col).length}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[250px]">
                    {tasks.filter(t => t.status === col).map((task) => (
                      <div key={task.id} className="p-3 bg-white neo-border neo-shadow-sm hover:scale-[1.02] transition-transform">
                        <span className="neo-tag text-[9px] mb-2">{task.label}</span>
                        <p className="text-xs font-bold leading-tight">{task.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIST / TABLE VIEW */}
        {viewStyle === 'list' && (
          <div className="flex-1 flex flex-col gap-4">
            <h4 className="neo-label-md">Structured Relational Lists</h4>
            <div className="neo-border overflow-x-auto text-xs bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-[var(--neo-bg)] font-bold">
                    <th className="p-3">ENTITY ID</th>
                    <th className="p-3">MODULE</th>
                    <th className="p-3">TYPE</th>
                    <th className="p-3">TITLE / IDENTIFIER</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">LATEST RUN</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'ent_learn_903', module: 'learning', type: 'topic', title: 'WebAssembly Garbage Collection spec', status: 'IN_PROGRESS', run: 'quiz.completed' },
                    { id: 'ent_trade_110', module: 'trading', type: 'trade', title: 'BTC Options Contract Call', status: 'DRAFT', run: 'broker-guard.blocked' },
                    { id: 'ent_task_883', module: 'tasks', type: 'task', title: 'Refactor ref layout hooks', status: 'COMPLETED', run: 'task.completed' },
                    { id: 'ent_social_48', module: 'social', type: 'post', title: 'X Release thread update', status: 'REVIEW', run: 'gated.telegram' }
                  ].map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="p-3 font-mono text-[var(--neo-text-muted)]">{row.id}</td>
                      <td className="p-3 font-bold text-[var(--neo-blue)]">{row.module}</td>
                      <td className="p-3 font-mono">{row.type}</td>
                      <td className="p-3 font-bold">{row.title}</td>
                      <td className="p-3">
                        <span className="neo-chip py-0.5 text-[9px]">{row.status}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-[var(--neo-text-muted)]">{row.run}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {viewStyle === 'calendar' && (
          <div className="flex-1 flex flex-col gap-4">
            <h4 className="neo-label-md">Spaced Repetition & Content Schedule</h4>
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="font-bold border-b pb-2">{d}</div>
              ))}
              {Array.from({ length: 28 }).map((_, i) => {
                const dayNum = i + 1;
                const hasEvent = dayNum === 14 || dayNum === 21;
                return (
                  <div key={i} className={`p-4 neo-border min-h-[70px] flex flex-col justify-between items-start bg-white ${
                    hasEvent ? 'bg-yellow-50 border-2 border-[var(--neo-blue)]' : ''
                  }`}>
                    <span className="font-mono text-[10px] text-[var(--neo-text-muted)]">{dayNum}</span>
                    {dayNum === 14 && (
                      <span className="text-[9px] bg-[var(--neo-yellow)] p-0.5 font-bold block leading-none neo-border">
                        Study Due
                      </span>
                    )}
                    {dayNum === 21 && (
                      <span className="text-[9px] bg-[var(--neo-mint)] p-0.5 font-bold block leading-none neo-border">
                        Campaign Tweet
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CYTOSCAPE GRAPH VIEW */}
        {viewStyle === 'graph' && (
          <div className="flex-1 flex flex-col gap-4">
            <h4 className="neo-label-md">Cross-Domain Entity Dependency Graph</h4>
            <div className="p-6 bg-[var(--neo-bg)] neo-border min-h-[300px] flex flex-col justify-center items-center gap-6 relative">
              
              <div className="flex items-center gap-6 justify-center flex-wrap">
                <div className="p-3 bg-white neo-border text-center shadow-md">
                  <span className="neo-chip text-[9px]">Learning</span>
                  <p className="font-bold text-xs mt-1">Topic: Spaced Repetition</p>
                </div>
                <div className="text-[var(--neo-red)] font-mono font-bold text-sm flex items-center">
                  <span>thesis</span>
                  <span>──────►</span>
                </div>
                <div className="p-3 bg-white neo-border text-center shadow-md">
                  <span className="neo-chip text-[9px]">Trading</span>
                  <p className="font-bold text-xs mt-1">Trade:AAPL setup log</p>
                </div>
                <div className="text-[var(--neo-blue)] font-mono font-bold text-sm flex items-center">
                  <span>uses_asset</span>
                  <span>──────►</span>
                </div>
                <div className="p-3 bg-white neo-border text-center shadow-md">
                  <span className="neo-chip text-[9px]">Design</span>
                  <p className="font-bold text-xs mt-1">Asset:AAPL chart.png</p>
                </div>
              </div>

              <span className="absolute bottom-3 right-3 text-[10px] font-mono text-[var(--neo-text-muted)] bg-white px-2 py-0.5 border">
                Cytoscape Engine Enabled
              </span>
            </div>
          </div>
        )}

        {/* ASSET GALLERY VIEW */}
        {viewStyle === 'gallery' && (
          <div className="flex-1 flex flex-col gap-6">
            <h4 className="neo-label-md">Media Assets Gallery (Figma exports & video loops)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'logo_spinning_globe.gif', size: '1.2 MB', color: 'bg-yellow-100', label: 'MARKETING' },
                { name: 'dashboard_v2_mock.png', size: '480 KB', color: 'bg-indigo-100', label: 'DESIGN' },
                { name: 'audio_dictation_notes.wav', size: '12.4 MB', color: 'bg-emerald-100', label: 'LEARNING' },
                { name: 'campaign_banner.svg', size: '120 KB', color: 'bg-rose-100', label: 'MARKETING' }
              ].map((asset, idx) => (
                <div key={idx} className="neo-border neo-shadow bg-white p-3 flex flex-col justify-between min-h-[160px]">
                  <div className={`w-full h-24 ${asset.color} border-2 border-black flex items-center justify-center font-mono text-xs font-bold`}>
                    {asset.name.split('.').pop().toUpperCase()}
                  </div>
                  <div className="mt-2">
                    <span className="neo-tag text-[8px]">{asset.label}</span>
                    <span className="neo-label-md text-xs block mt-1 truncate">{asset.name}</span>
                    <span className="text-[10px] text-[var(--neo-text-muted)] font-mono">{asset.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ITINERARY TIMELINE VIEW */}
        {viewStyle === 'timeline' && (
          <div className="flex-1 flex flex-col gap-4">
            <h4 className="neo-label-md">Trip Itinerary & Event Timeline</h4>
            <div className="flex flex-col gap-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-1 before:bg-black">
              {[
                { time: '09:00 AM', title: 'Flight departures (LEG_FLIGHT)', desc: 'AI auto-blocked schedule blocks on calendar.' },
                { time: '02:00 PM', title: 'Hotel Check-in confirmation (LEG_BOOKING)', desc: 'Nango credentials fetched confirmation code.' },
                { time: '04:30 PM', title: 'Client presentation (LEG_MEETING)', desc: 'Topic: Local offline vector storage features.' }
              ].map((item, idx) => (
                <div key={idx} className="relative bg-white p-4 border-2 border-black shadow-sm">
                  <div className="absolute -left-7 top-4 w-3 h-3 bg-white border-2 border-black rounded-full" />
                  <span className="neo-chip neo-chip--active py-0.5 text-[9px] mb-2">{item.time}</span>
                  <h5 className="font-bold text-xs">{item.title}</h5>
                  <p className="text-[11px] text-[var(--neo-text-muted)] mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAP VIEW */}
        {viewStyle === 'map' && (
          <div className="flex-1 flex flex-col gap-4">
            <h4 className="neo-label-md">Trip Location Mapping</h4>
            <div className="p-8 bg-zinc-950 border-4 border-black text-center text-zinc-400 font-mono text-xs flex flex-col justify-center items-center gap-3 min-h-[300px]">
              <Compass className="text-[var(--neo-yellow)] animate-pulse" size={48} />
              <div>
                <p className="text-white font-bold">Interactive Geolocation Mapping API</p>
                <p className="text-[10px] text-zinc-500 mt-1">LATITUDE: 12.9716° N / LONGITUDE: 77.5946° E</p>
              </div>
              <div className="flex gap-2">
                <span className="neo-chip bg-white text-black text-[9px]">LEG_1: BLR AIRPORT</span>
                <span className="neo-chip bg-white text-black text-[9px]">LEG_2: DOWNTOWN HOTEL</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

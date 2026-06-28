import React, { useState } from 'react';
import { FileCode, Play, FileAudio, Image as ImageIcon, Search, GitCommit, FileText, ArrowRight, Eye, Diff } from 'lucide-react';

export default function VcsIngest() {
  const [transcriptionQuery, setTranscriptionQuery] = useState('Nango credentials proxy');
  const [foundClips, setFoundClips] = useState([
    { file: 'session_clip_382.mp3', text: '...the credentials actually reside inside self-hosted Nango proxy, meaning the agent context does not leak access tokens...', timestamp: '04:12 - 04:30', confidence: '98%' },
    { file: 'meeting_notes_june.mp3', text: '...we should configure the proxy callback URL on the Cloudflare Worker to point to Nango...', timestamp: '12:05 - 12:20', confidence: '91%' }
  ]);

  const [selectedDiffFile, setSelectedDiffFile] = useState('image');
  const [diffResult, setDiffResult] = useState({
    image: {
      filename: 'AAPL_Daily_Chart.png',
      change: 'Perceptual Hash Diff: 14.8% delta',
      details: 'Visual bounds adjusted on RSI index line. Pixels shifted by +12px on Y axis.',
      visual: 'Side-by-side overlay representation: Blue/red outline overlay on RSI channel.'
    },
    godot: {
      filename: 'combat_scene.tscn',
      change: 'Text Diff: 3 lines added, 2 removed',
      details: 'Modified node properties under [node name="Player" type="CharacterBody2D"]:\n- speed = 400.0\n+ speed = 480.0',
      visual: 'Plain-text config serialization matching standard git diff'
    },
    figma: {
      filename: 'Dashboard Design System',
      change: 'Node Tree Diff: 2 nodes added, 1 modified',
      details: 'Added FrameNode "GlobeLogoContainer"\nAdded VectorNode "LatitudeOrbitLine"\nModified TextStyleNode font-weight from Bold to Heavy',
      visual: 'JSON structure comparison of Figma document tree via mcp-figma'
    }
  });

  const versionedFiles = [
    { name: 'logo_animation_hero.mp4', type: 'VIDEO', size: '14.2 MB', versions: 3, lastCommit: 'Refine spin speed offset' },
    { name: 'dashboard_mockup.fig', type: 'DESIGN', size: '4.8 MB', versions: 5, lastCommit: 'Brutalist box outline fix' },
    { name: 'audio_dictation_notes.wav', type: 'AUDIO', size: '32.1 MB', versions: 2, lastCommit: 'Transcript generated' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Overview */}
      <div className="neo-surface neo-border-thick neo-shadow p-6 bg-white">
        <h2 className="neo-title-md mb-2 flex items-center gap-2">
          <FileCode size={24} className="text-[var(--neo-blue)]" />
          `lifeos-vcs` & Media Intelligence
        </h2>
        <p className="neo-body-md text-[var(--neo-text-muted)]">
          Life OS extends version control to all files (images, designs, videos, audio) using content-addressed BLAKE3 + FastCDC chunking. At the same time, the Rust-based <strong>media intelligence pipeline</strong> parses audio files using whisper-rs, mapping voice queries to timestamped database segments.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Version Control list */}
        <div className="lg:col-span-6 neo-surface neo-border-thick neo-shadow p-5 bg-white">
          <h3 className="neo-title-md border-b-2 border-[var(--neo-border)] pb-3 mb-4 flex items-center gap-2">
            <GitCommit size={18} />
            Universal Version History
          </h3>
          <div className="flex flex-col gap-4">
            {versionedFiles.map((file, idx) => (
              <div key={idx} className="p-4 bg-[var(--neo-bg)] neo-border flex flex-col gap-2 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="neo-label-md block font-bold text-[var(--neo-blue)]">{file.name}</span>
                    <span className="text-[10px] text-[var(--neo-text-muted)] font-mono">{file.size} • {file.type}</span>
                  </div>
                  <span className="neo-chip neo-chip--completed py-0.5 text-[9px]">{file.versions} VERSIONS</span>
                </div>
                
                <div className="pt-2 border-t border-[var(--neo-border)] border-dashed text-xs flex justify-between items-center">
                  <span className="text-[10px] italic text-[var(--neo-text-muted)]">Latest: "{file.lastCommit}"</span>
                  <button className="neo-btn py-1 px-2.5 bg-white text-[10px] font-bold">
                    Diff History
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Media Intelligence Clip Finder */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="neo-surface neo-border-thick neo-shadow p-5 bg-white flex-1">
            <h3 className="neo-title-md border-b-2 border-[var(--neo-border)] pb-3 mb-4 flex items-center gap-2">
              <FileAudio size={18} />
              Semantic Voice Search
            </h3>
            
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3 text-[var(--neo-text-muted)]" />
                <input
                  type="text"
                  value={transcriptionQuery}
                  onChange={(e) => setTranscriptionQuery(e.target.value)}
                  placeholder="Search transcription clips..."
                  className="neo-input w-full pl-10"
                />
              </div>
              <button className="neo-btn bg-[var(--neo-yellow)] py-2 px-4 neo-label-md">
                FIND
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {foundClips.map((clip, idx) => (
                <div key={idx} className="p-3 bg-white neo-border text-xs flex flex-col gap-2 relative">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                    <span className="font-bold flex items-center gap-1">
                      <FileAudio size={12} className="text-[var(--neo-blue)]" />
                      {clip.file}
                    </span>
                    <span className="text-[9px] neo-chip neo-chip--completed py-0.5">{clip.confidence} match</span>
                  </div>
                  <p className="italic text-[var(--neo-text-muted)] text-[11px]">"{clip.text}"</p>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] font-mono bg-[var(--neo-bg)] px-1.5 py-0.5 border">
                      Timestamp: {clip.timestamp}
                    </span>
                    <button className="text-[10px] text-[var(--neo-blue)] font-bold flex items-center gap-0.5 hover:underline">
                      Play Segment <Play size={10} className="fill-[var(--neo-blue)]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* Semantic Diff Explorer Section */}
      <div className="neo-surface neo-border-thick neo-shadow p-5 bg-white">
        <h3 className="neo-title-md border-b-2 border-black pb-3 mb-4 flex items-center gap-2">
          <Diff size={18} />
          Per-Type Semantic Diff Explorer (`diff(a, b)` function)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { id: 'image', label: 'Image (PNG/JPG)', desc: 'Perceptual overlay delta' },
            { id: 'godot', label: 'Godot scene (.tscn)', desc: 'Declarative text block comparison' },
            { id: 'figma', label: 'Figma mockups', desc: 'Node-tree vector diff' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedDiffFile(item.id)}
              className={`neo-btn text-left p-3 flex flex-col gap-1 ${
                selectedDiffFile === item.id ? 'bg-[var(--neo-yellow)]' : 'bg-white'
              }`}
            >
              <span className="neo-label-md text-xs">{item.label}</span>
              <span className="text-[10px] text-[var(--neo-text-muted)]">{item.desc}</span>
            </button>
          ))}
        </div>

        <div className="neo-border p-4 bg-[var(--neo-bg)] flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-black pb-2 mb-1">
            <span className="neo-label-sm font-bold text-xs">File: {diffResult[selectedDiffFile].filename}</span>
            <span className="neo-chip neo-chip--review text-[10px]">{diffResult[selectedDiffFile].change}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white neo-border">
              <span className="neo-label-sm block text-[10px] text-[var(--neo-text-muted)] mb-1">DIFF OUTPUT LOGS:</span>
              <pre className="font-mono text-xs whitespace-pre-wrap leading-tight text-gray-700">
                {diffResult[selectedDiffFile].details}
              </pre>
            </div>
            <div className="p-3 bg-white neo-border flex flex-col justify-center items-center text-center">
              <span className="neo-label-sm block text-[10px] text-[var(--neo-text-muted)] mb-2">VISUAL COMPARISON PREVIEW:</span>
              <div className="p-4 bg-zinc-950 text-white font-mono text-[10px] neo-radius w-full border">
                {diffResult[selectedDiffFile].visual}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

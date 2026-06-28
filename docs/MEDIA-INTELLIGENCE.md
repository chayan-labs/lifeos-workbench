# Media intelligence - lifeos-ingest

> Goal: ask "find the clip where I said X" / "find the image showing Y" / "find the doc about Z" across your whole media library.
> **Honest boundary:** memvec is text-only. It cannot see audio, video, or images. Accuracy depends entirely on a media→text front-end we must build. This document specifies it.

---

## 1. The memvec reality check

`memvec.py` = MiniLM-384 (`all-MiniLM-L6-v2`), a **text-only** sentence embedder into sqlite-vec.
Feed it a video and nothing happens.
So "find the clip where I said X" works **if and only if** we first transcribe audio into timestamped text segments, embed those, and store the timestamp.
**The pipeline, not memvec, is the work.** memvec is reused unchanged.

**One honest gap:** this gives *semantic-of-spoken/written-content* search. For **true visual similarity** ("find the frame that looks like this"), MiniLM can't help - add **CLIP** image embeddings as a *second* vector space in the same sqlite-vec DB (different dimension/collection). Ship transcription/caption/parse first (covers ~95% of "find where I said/showed X"); add CLIP only if reverse-image/visual search is genuinely wanted.

---

## 2. The pipeline

```
media file ──► route by MIME ──► extract TEXT ──► segment ──► memvec + FTS5
  audio/video → Whisper (timestamped segments)
  image       → vision-LLM caption / OCR
  pdf/docx    → text extraction (pdfium/poppler)
                         │
                         ▼
        each segment = child entity:
        type=segment, parent=<asset>, attrs={ t_start, t_end, text, page? }
                         │
                         ▼
        memvec embeds segment.text  → entity_vec (in lifeos-derived.db)
        FTS5 indexes segment.text   → entities_fts
```

**Query path:** "where I said X" → memvec matches a `segment` → return `t_start` + parent `asset` → deep-link to that exact timestamp/page.

---

## 3. Components (Rust-heavy)

| Step | Tool | Class | Rust |
|---|---|---|---|
| Orchestrator `lifeos-ingest` | dispatch by MIME, manage segments, write entities | BUILD | 🦀 |
| Transcription (audio/video) | **whisper-rs** or **candle-whisper** (fallback whisper.cpp) | FORK | 🦀 |
| Image caption / OCR | vision-LLM (Haiku) for caption; **tesseract** for OCR | reuse/fork | mixed |
| PDF / doc text | **pdfium** / poppler bindings | fork | C |
| Embedding | **memvec.py** (MiniLM-384, sqlite-vec) | reuse as-is | Python |
| (optional) visual search | **candle-clip** image embeddings | fork | 🦀 |

- Heavy transcription runs on the **Mac heavy lane via `jobs`**: the bot enqueues `{kind:'ingest', payload:{blob_ref}}`; `lifeos-drain` claims it; `lifeos-ingest` processes it.
- Vectors land in the **separate un-synced `lifeos-derived.db`** (per [DATA-MODEL.md](./DATA-MODEL.md) §5) - rebuildable, never synced.

---

## 4. Triggers & freshness

- On `file.imported` / `asset.generated` / `version.created` → enqueue an ingest job.
- On a new file **version**, re-derive segments for that version so search reflects the latest content (old versions remain searchable via their snapshot, see [VERSIONING.md](./VERSIONING.md)).
- Reading-module articles and Email bodies also flow through the text path (no transcription needed) → one unified semantic index across *all* content.

---

## 5. Data shape

- `segment` entities are cheap children of the media `asset`; they carry the searchable text + locator (`t_start/t_end` for AV, `page` for docs, `bbox?` for image regions).
- The `asset` entity keeps a rollup (`attrs.transcript_ref` → full transcript blob) for display.
- Deleting/re-versioning an asset cascades a re-index of its segments.

---

## 6. Verification

- Ingest a known video → assert N `segment` entities with monotonic timestamps; query a phrase spoken at 3:12 → top hit's `t_start ≈ 192s`.
- Ingest a PDF → query a phrase on page 7 → hit carries `page=7`.
- Confirm vectors live only in `lifeos-derived.db` and survive a rebuild (`rm lifeos-derived.db && reindex`).
- (If CLIP added) upload an image, query by a similar image → visual match in the separate CLIP collection.

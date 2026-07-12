# Segneri — AI Voice Tutor Feature Spec

Context doc for integrating a conversational AI tutor (STT + LLM + TTS, Praktika-style) into Segneri.
Personal-use feature only — no commercialization, no marketing extras, no multi-user concerns.

---

## Goal

Add a spoken-conversation mode to Segneri: the user speaks Italian, an AI tutor
listens, replies in Italian (voice), corrects mistakes, and adapts to the user's level.
Equivalent to the core loop of commercial apps like Praktika, minus the curriculum,
gamification, and commercial overhead.

Target usage: ~15 min/day. Target cost: well under $1/month.

## Architecture (three-stage pipeline)

```
Mic capture → STT (speech-to-text) → conversation history + system prompt
           → LLM (tutor reply)     → TTS (text-to-speech) → audio playback
                                   → optional avatar lip-sync (client-side)
```

A realtime speech-to-speech API (e.g. OpenAI gpt-realtime) was considered and
rejected: 10–20x more expensive (~$0.18–0.46/min uncached) for latency gains that
don't matter in a tutoring context. The pipeline approach with a ~0.5–1s pause
before replies is fine.

## Component decisions

### STT — local faster-whisper (chosen)
- Run **faster-whisper** locally with CUDA acceleration (Windows PC, NVIDIA RTX GPU).
  Near-instant transcription, $0 cost.
- Whisper small/medium models handle Italian well, including learner-accented Italian.
- Avoid browser-native speech recognition — weaker on non-native accents, which is
  exactly the input this app receives.
- Cloud fallback if local isn't running: OpenAI GPT-4o Mini Transcribe ($0.003/min)
  or GPT-4o Transcribe / whisper-1 ($0.006/min).

### LLM — Claude Haiku with prompt caching (chosen)
- Model: `claude-haiku-4-5` via the Anthropic API. Built for real-time, low-latency
  chat; strong Italian; good at grammar correction.
- Pricing (verify current at platform.claude.com/docs/en/about-claude/pricing):
  $1 / $5 per million input/output tokens. Cache reads cost ~10% of standard input.
- **Use prompt caching** (`cache_control: { type: "ephemeral" }`) on the system
  prompt and conversation history — in a chat loop almost all input tokens repeat
  each turn, so caching cuts LLM cost by a large majority.
- Expected cost: ~$0.01–0.02 per 15-minute session → roughly $0.50–0.75/month at
  daily use.
- Do NOT downgrade this component to a local model. Small local models are
  noticeably worse at natural Italian and at catching grammar errors — the entire
  point of the feature. The LLM is already the cheapest line item once caching is on.

### TTS — free neural voices (chosen)
- Primary: browser `speechSynthesis` in **Microsoft Edge**, which exposes the
  "Online Natural" neural Italian voices for free (Elsa, Isabella, Diego, Giuseppe).
  These are the same neural voices Azure sells (~$16/1M chars) and are markedly
  better than default Windows SAPI voices. Note: Chrome only exposes basic local
  voices — Edge specifically is the free-quality path.
- Offline/local alternative: **Piper** or **Kokoro** (open-source, run fine on
  Windows CPU, have Italian voices). Kokoro is an 82M-param model, free, ranked
  highly on TTS Arena, though Italian coverage is thinner than English.
- Paid fallback if voice quality disappoints: OpenAI tts-1 at $15/1M characters
  (~$0.011 per minute of generated audio) — would add roughly $0.05–0.08 per session.

### Avatar (optional, cosmetic)
- Commercial apps (Praktika) render animated 3D characters **client-side**, with
  lip-sync driven by the synthesized audio — no server-side video generation,
  near-zero marginal cost.
- For Segneri: entirely optional. If added, keep it a client-side rendered
  character (2D or simple 3D) with mouth animation driven by TTS audio
  amplitude/phonemes. Do not attempt server-generated avatar video.

## Cost model summary (15 min/day usage)

| Component | Choice | Cost |
|---|---|---|
| STT | faster-whisper local (CUDA) | $0 |
| LLM | Claude Haiku + prompt caching | ~$0.02/session → ~$0.60/mo |
| TTS | Edge neural Italian voices | $0 |
| **Total** | | **< $1/month** |

Cloud-everything baseline (no optimization) for reference: ~$0.15–0.20/session,
~$5–6/month. Still trivial; the optimizations are as much about learning the local
tooling as about cost.

## Tutor behavior (system prompt requirements)

The system prompt (cached) should establish:

- **Persona**: a friendly Italian tutor; speaks primarily Italian, calibrated to
  the user's level (currently beginner/early-intermediate — adjust as the vocab
  app data suggests progress).
- **Correction style**: gentle inline corrections — briefly note the error and the
  correct form, then continue the conversation; don't lecture.
- **Level adaptation**: simplify vocabulary/pace if the user struggles; introduce
  slightly harder structures when the user is comfortable.
- **English policy**: use English sparingly for explanations when the user is
  clearly stuck; otherwise stay in Italian.
- **Session structure**: open with a short greeting/question, keep turns short
  (1–3 sentences — this also keeps TTS snappy), end sessions with a 2–3 item recap
  of corrections and new vocabulary.
- **Vocabulary integration**: optionally weave in words from Segneri's existing
  vocab lists (pass the current study list into the prompt).
- Response length discipline matters: short turns = lower latency, lower TTS load,
  more natural conversation.

## Implementation plan (suggested order)

1. **Text-only tutor first.** Wire up the Haiku call with the tutor system prompt
   and caching; iterate on prompt quality as plain text chat inside Segneri.
   This is where most of the quality lives — perfect it before any audio.
2. **Add TTS.** Pipe tutor replies through Edge `speechSynthesis` with an Italian
   neural voice. Add a voice picker (Elsa/Isabella/Diego/Giuseppe).
3. **Add STT.** Mic capture in the client → audio to a small local endpoint running
   faster-whisper (e.g. a tiny FastAPI/Flask service, or whisper.cpp server) →
   transcript into the chat loop. Push-to-talk first; VAD/auto-turn-taking later.
4. **Session state.** Persist conversation history per session; append-only, resend
   with caching each turn. Add the end-of-session recap.
5. **Optional polish**: avatar with lip-sync, pronunciation feedback (compare
   Whisper transcript vs. expected phrase), progress tracking of corrected errors,
   difficulty setting.

## API notes

- Anthropic Messages API, model `claude-haiku-4-5`.
- Mark the system prompt block (and optionally the trailing history block) with
  `cache_control: { type: "ephemeral" }` (5-min TTL is fine for a live session;
  writes cost 1.25x, reads 0.1x — pays for itself after one read).
- Keep max_tokens modest (~300) to enforce short tutor turns.
- Conversation history is resent every turn (the API is stateless) — caching makes
  this cheap.

## Hardware context

Development/runtime machine: Windows laptop (planned: Lenovo Legion Pro 7i,
RTX 5080 16GB VRAM, 64GB RAM) — CUDA available for faster-whisper. No Mac in the
stack. Bigger-model experiments go to rented cloud GPUs (RunPod/Lambda), not local.

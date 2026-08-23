"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Exercise = { id: string; name: string; seconds: number; rest: number; color: string; emoji: string; image?: string; music?: string; musicName?: string; voiceUrl?: string };
type MusicTrack = { id: string; name: string; url: string; bundled?: boolean };
type Round = { id: string; name: string; exerciseIds: string[]; order: "fixed" | "random"; repeats: number };
type Step = { exercise: Exercise; roundName: string; roundIndex: number };

const starterExercises: Exercise[] = [
  { id: "e1", name: "Knäböj", seconds: 40, rest: 15, color: "#ff6b35", emoji: "↕", image: "/exercises/knaboj.webp" },
  { id: "e2", name: "Armhävningar", seconds: 30, rest: 15, color: "#b8e986", emoji: "↔", image: "/exercises/armhavningar.webp" },
  { id: "e3", name: "Plankan", seconds: 45, rest: 20, color: "#ffd166", emoji: "▬", image: "/exercises/plankan.webp" },
  { id: "e4", name: "Utfall", seconds: 40, rest: 15, color: "#7bdff2", emoji: "⌁", image: "/exercises/utfall.webp" },
  { id: "e5", name: "Situps", seconds: 35, rest: 15, color: "#cdb4db", emoji: "◡", image: "/exercises/situps.webp" },
  { id: "e6", name: "Enbensbalans", seconds: 30, rest: 15, color: "#ff8fab", emoji: "◉", image: "/exercises/enbensbalans.jpeg" },
  { id: "e7", name: "Axlar", seconds: 30, rest: 15, color: "#90dbf4", emoji: "↗", image: "/exercises/axlar.jpeg" },
  { id: "e8", name: "Superman", seconds: 30, rest: 15, color: "#f9c74f", emoji: "✦", image: "/exercises/superman.jpeg" },
  { id: "e9", name: "Bird dog", seconds: 40, rest: 15, color: "#43aa8b", emoji: "✧", image: "/exercises/bird-dog.jpeg" },
  { id: "e10", name: "Dead bug", seconds: 40, rest: 15, color: "#f9844a", emoji: "◇", image: "/exercises/dead-bug.jpeg" },
  { id: "e11", name: "Rygglyft", seconds: 35, rest: 15, color: "#9b5de5", emoji: "⌒", image: "/exercises/rygglyft.jpg" },
  { id: "e12", name: "Liggande benlyft", seconds: 35, rest: 15, color: "#00bbf9", emoji: "╱", image: "/exercises/liggande-benlyft.jpeg" },
  { id: "e13", name: "Tricepscurl", seconds: 30, rest: 15, color: "#00f5d4", emoji: "↟", image: "/exercises/tricepscurl.jpeg" },
  { id: "e14", name: "Bicepscurl", seconds: 30, rest: 15, color: "#fee440", emoji: "⌁", image: "/exercises/bicepscurl.jpeg" },
  { id: "e15", name: "Upphopp", seconds: 30, rest: 20, color: "#f15bb5", emoji: "↑", image: "/exercises/upphopp.jpeg" },
];
const starterRounds: Round[] = [
  { id: "r1", name: "Runda 1", exerciseIds: ["e1", "e2", "e3"], order: "fixed", repeats: 1 },
  { id: "r2", name: "Runda 2", exerciseIds: ["e4", "e5", "e2"], order: "random", repeats: 1 },
];
const colors = ["#ff6b35", "#b8e986", "#ffd166", "#7bdff2", "#cdb4db", "#ff8fab"];
const emojis = ["↕", "↔", "▬", "⌁", "◡", "✦"];


function TimeInput({ value, min, onChange }: { value: number; min: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  // Intentional: resyncs the local editable draft whenever the underlying
  // value changes from elsewhere (e.g. remote sync overwriting it). This is
  // the standard "derived local state from a prop" pattern for a controlled
  // text input that needs to allow transient invalid/empty states while typing.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      min={min}
      inputMode="numeric"
      value={draft}
      onFocus={event => event.currentTarget.select()}
      onChange={event => {
        const next = event.target.value;
        setDraft(next);
        if (next !== "") {
          const parsed = Number(next);
          if (Number.isFinite(parsed) && parsed >= min) onChange(parsed);
        }
      }}
      onBlur={() => {
        if (draft === "") {
          setDraft(String(value));
          return;
        }
        const parsed = Number(draft);
        const normalized = Number.isFinite(parsed) ? Math.max(min, Math.round(parsed)) : value;
        setDraft(String(normalized));
        if (normalized !== value) onChange(normalized);
      }}
    />
  );
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

const starterMusic: MusicTrack[] = [];

async function fetchBundledMusic(): Promise<MusicTrack[]> {
  try {
    const response = await fetch("/music/library.json", { cache: "no-store" });
    if (!response.ok) return [];
    const tracks = await response.json();
    return Array.isArray(tracks) ? tracks : [];
  } catch { return []; }
}

function mergeMusicLibrary(saved: MusicTrack[] = [], bundled: MusicTrack[] = [], removedUrls: string[] = []) {
  const removed = new Set(removedUrls);
  const byUrl = new Map<string, MusicTrack>();
  saved.filter(track => !REMOVED_STANDARD_MUSIC.has(track.url) && !removed.has(track.url)).forEach(track => byUrl.set(track.url, track));
  bundled.filter(track => !removed.has(track.url)).forEach(track => byUrl.set(track.url, { ...track, bundled: true }));
  return [...byUrl.values()];
}
const REMOVED_STANDARD_MUSIC = new Set(["/music/energi.mp3", "/music/driv.mp3", "/music/fokus.mp3"]);
const normalizeExerciseMusic = (exercise: Exercise): Exercise =>
  exercise.music === "pass" || REMOVED_STANDARD_MUSIC.has(exercise.music || "")
    ? { ...exercise, music: "none", musicName: undefined }
    : exercise;

function mergeExerciseLibrary(saved: Exercise[] = []) {
  const savedById = new Map(saved.map(exercise => [exercise.id, normalizeExerciseMusic(exercise)]));
  const bundled = starterExercises.map(starter => {
    const existing = savedById.get(starter.id);
    if (!existing) return starter;
    savedById.delete(starter.id);
    return {
      ...starter,
      ...existing,
      image: existing.image?.startsWith("data:") ? existing.image : starter.image,
    };
  });
  return [...bundled, ...savedById.values()];
}
const SYNC_CODE_KEY = "traningsrundan-sync-code";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function generateSyncCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}
function getOrCreateSyncCode() {
  const existing = localStorage.getItem(SYNC_CODE_KEY);
  if (existing) return existing;
  const created = generateSyncCode();
  localStorage.setItem(SYNC_CODE_KEY, created);
  return created;
}
type SyncedState = { exercises: Exercise[]; rounds: Round[]; musicLibrary?: MusicTrack[]; removedMusicUrls?: string[]; hiddenExerciseIds?: string[]; voiceEnabled?: boolean };
async function fetchRemoteState(code: string): Promise<SyncedState | null> {
  const response = await fetch(`/api/state?code=${code}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.found ? (payload.data as SyncedState) : null;
}
async function pushRemoteState(code: string, state: SyncedState) {
  await fetch(`/api/state?code=${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
}
async function uploadAudio(code: string, file: File | Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, filename);
  const response = await fetch(`/api/upload?code=${code}`, { method: "POST", body: formData });
  if (!response.ok) throw new Error("upload failed");
  const payload = await response.json();
  return payload.url as string;
}

export default function Home() {
  const [exercises, setExercises] = useState<Exercise[]>(starterExercises);
  const [rounds, setRounds] = useState<Round[]>(starterRounds);
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>(starterMusic);
  const [removedMusicUrls, setRemovedMusicUrls] = useState<string[]>([]);
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<string[]>([]);
  const [showHiddenExercises, setShowHiddenExercises] = useState(false);
  const [tab, setTab] = useState<"pass" | "ovningar" | "musik">("pass");
  const [editingPass, setEditingPass] = useState(false);
  const [editingRound, setEditingRound] = useState<string | null>(null);
  const [expandedHomeRound, setExpandedHomeRound] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resting, setResting] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [preStarting, setPreStarting] = useState(false);
  const [preStartCount, setPreStartCount] = useState(0);
  const [roundPausing, setRoundPausing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [syncCode, setSyncCode] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "syncing" | "error">("idle");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [uploadingExerciseId, setUploadingExerciseId] = useState<string | null>(null);
  const [uploadingLibraryMusic, setUploadingLibraryMusic] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const announcementRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const ttsBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const ttsPendingRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activeVoiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gongRef = useRef<HTMLAudioElement | null>(null);
  const soundContextRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const activeDucksRef = useRef<number[]>([]);
  const announcementTokenRef = useRef(0);
  const hydratedRef = useRef(false);  useEffect(() => { const el = document.createElement("audio"); el.preload = "auto"; el.style.display = "none"; document.body.appendChild(el); announcementRef.current = el; return () => { document.body.removeChild(el); if (announcementRef.current === el) announcementRef.current = null; }; }, []);

  // Intentional: hydrates client-only localStorage data after mount so the
  // server-rendered markup (no localStorage access) matches the client's first
  // paint and avoids a hydration mismatch. Local cache paints instantly, then
  // the synced backend state (if any) takes over as source of truth.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let localMusic: MusicTrack[] = [];
    let localRemovedMusic: string[] = [];
    let localHiddenExercises: string[] = [];
    let localVoiceEnabled = true;
    const saved = localStorage.getItem("traningsrundan-v1");
    if (saved) try {
      const data = JSON.parse(saved);
      if (data.exercises?.length) setExercises(mergeExerciseLibrary(data.exercises));
      if (data.rounds?.length) setRounds(data.rounds);
      if (Array.isArray(data.musicLibrary)) localMusic = data.musicLibrary;
      if (Array.isArray(data.removedMusicUrls)) localRemovedMusic = data.removedMusicUrls;
      if (Array.isArray(data.hiddenExerciseIds)) localHiddenExercises = data.hiddenExerciseIds;
      if (typeof data.voiceEnabled === "boolean") localVoiceEnabled = data.voiceEnabled;
    } catch {}

    const code = getOrCreateSyncCode();
    setSyncCode(code);
    setSyncStatus("loading");
    Promise.all([fetchRemoteState(code), fetchBundledMusic()]).then(([remote, bundled]) => {
      if (remote) {
        if (remote.exercises?.length) setExercises(mergeExerciseLibrary(remote.exercises));
        if (remote.rounds?.length) setRounds(remote.rounds);
      }
      const syncedMusic = Array.isArray(remote?.musicLibrary) ? remote.musicLibrary : localMusic;
      const syncedRemovedMusic = Array.isArray(remote?.removedMusicUrls) ? remote.removedMusicUrls : localRemovedMusic;
      const syncedHiddenExercises = Array.isArray(remote?.hiddenExerciseIds) ? remote.hiddenExerciseIds : localHiddenExercises;
      const syncedVoiceEnabled = typeof remote?.voiceEnabled === "boolean" ? remote.voiceEnabled : localVoiceEnabled;
      setRemovedMusicUrls(syncedRemovedMusic);
      setHiddenExerciseIds(syncedHiddenExercises);
      setVoiceEnabled(syncedVoiceEnabled);
      setMusicLibrary(mergeMusicLibrary(syncedMusic, bundled, syncedRemovedMusic));
      hydratedRef.current = true;
      setSyncStatus("idle");
    }).catch(() => { hydratedRef.current = true; setSyncStatus("error"); });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => { localStorage.setItem("traningsrundan-v1", JSON.stringify({ exercises, rounds, musicLibrary, removedMusicUrls, hiddenExerciseIds, voiceEnabled })); }, [exercises, rounds, musicLibrary, removedMusicUrls, hiddenExerciseIds, voiceEnabled]);

  // Push to the shared backend whenever the synced data changes, so the other device sees it.
  useEffect(() => {
    if (!syncCode || !hydratedRef.current) return;
    setSyncStatus("syncing");
    const timeout = window.setTimeout(() => {
      pushRemoteState(syncCode, { exercises, rounds, musicLibrary, removedMusicUrls, hiddenExerciseIds, voiceEnabled }).then(() => setSyncStatus("idle")).catch(() => setSyncStatus("error"));
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [exercises, rounds, musicLibrary, removedMusicUrls, hiddenExerciseIds, voiceEnabled, syncCode]);

  const joinSyncCode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    localStorage.setItem(SYNC_CODE_KEY, code);
    setSyncCode(code);
    setSyncStatus("loading");
    hydratedRef.current = false;
    try {
      const remote = await fetchRemoteState(code);
      if (remote) {
        setExercises(remote.exercises?.length ? mergeExerciseLibrary(remote.exercises) : starterExercises);
        setRounds(remote.rounds?.length ? remote.rounds : starterRounds);
        const bundled = await fetchBundledMusic();
        const remoteRemovedMusic = Array.isArray(remote.removedMusicUrls) ? remote.removedMusicUrls : [];
        setRemovedMusicUrls(remoteRemovedMusic);
        setHiddenExerciseIds(Array.isArray(remote.hiddenExerciseIds) ? remote.hiddenExerciseIds : []);
        if (typeof remote.voiceEnabled === "boolean") setVoiceEnabled(remote.voiceEnabled);
        setMusicLibrary(mergeMusicLibrary(Array.isArray(remote.musicLibrary) ? remote.musicLibrary : starterMusic, bundled, remoteRemovedMusic));
      } else {
        window.alert("Ingen data hittades för den koden ännu — den här enheten blir startpunkten.");
      }
    } catch { setSyncStatus("error"); }
    hydratedRef.current = true;
    setSyncStatus("idle");
    setJoinCodeInput("");
  };
  const createNewSyncCode = () => { const code = generateSyncCode(); localStorage.setItem(SYNC_CODE_KEY, code); setSyncCode(code); };

  const totalSeconds = useMemo(() => rounds.reduce((sum, r) => sum + r.exerciseIds.reduce((s, id) => { const e = exercises.find(x => x.id === id); return s + (e ? e.seconds + e.rest : 0); }, 0) * r.repeats, 0), [rounds, exercises]);
  const updateExercise = (id: string, patch: Partial<Exercise>) => setExercises(current => current.map(e => e.id === id ? { ...e, ...patch } : e));
  const updateRound = (id: string, patch: Partial<Round>) => setRounds(rounds.map(r => r.id === id ? { ...r, ...patch } : r));

  const buildSteps = () => {
    const result: Step[] = [];
    rounds.forEach((round, roundIndex) => { for (let repeat = 0; repeat < round.repeats; repeat++) { const selected = round.exerciseIds.map(id => exercises.find(e => e.id === id)).filter(Boolean) as Exercise[]; (round.order === "random" ? shuffle(selected) : selected).forEach(exercise => result.push({ exercise, roundName: round.name, roundIndex })); } });
    return result;
  };
  const getSoundContext = () => { if (!soundContextRef.current) { const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; soundContextRef.current = new Ctx(); } soundContextRef.current.resume().catch(() => {}); return soundContextRef.current; };
  const resolveExerciseMusic = (exercise: Exercise) => !exercise.music || exercise.music === "none" ? null : exercise.music;
  const startWorkout = () => {
    const built = buildSteps();
    if (!built.length) return;
    getSoundContext();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }
    // Visa spelaren direkt, men låt inte arbetstiden eller musiken starta ännu.
    // Första övningen presenteras först och därefter räknar rösten 5–4–3–2–1.
    setSteps(built);
    setStepIndex(0);
    setResting(false);
    setSecondsLeft(built[0].exercise.seconds);
    setPlaybackUrl(null);
    setRunning(true);
    setPaused(false);
    setPreStarting(true);
    setPreStartCount(0);

    // Startnedräkningen ska aldrig kunna fastna på REDO om webbläsaren
    // missar speechSynthesis.onend (kan hända i Safari/Chrome på macOS).
    // Normalt startar den direkt när presentationen är klar; fallbacken
    // ser till att 5–4–3–2–1 ändå kommer igång efter högst 3,5 sekunder.
    let countdownStarted = false;
    const beginCountdown = () => {
      if (countdownStarted) return;
      countdownStarted = true;
      window.setTimeout(() => setPreStartCount(5), 700);
    };
    window.setTimeout(beginCountdown, 5000);
    const countdownWords = ["Fem", "Fyra", "Tre", "Två", "Ett"];
    const workoutPhrases = built.flatMap((step, index) => {
      if (index === 0) {
        return step.exercise.voiceUrl
          ? ["Första övningen är"]
          : [`Första övningen är ${step.exercise.name}.`];
      }
      return step.exercise.voiceUrl
        ? ["Nästa övning är", "Förbered dig."]
        : [`Nästa övning är ${step.exercise.name}.`, "Förbered dig."];
    });
    const roundPausePhrases = built.slice(0, -1).flatMap((step, index) => {
      const upcoming = built[index + 1];
      return upcoming && upcoming.roundIndex !== step.roundIndex
        ? [`${step.roundName} klar. Nästa är ${upcoming.roundName}. Första övningen är ${upcoming.exercise.name}.`]
        : [];
    });
    prefetchTts([...countdownWords, ...workoutPhrases, ...roundPausePhrases]);
    playAnnouncement(built[0].exercise, false, true, beginCountdown);
  };
  const beginDuck = (level: number) => {
    const gain = musicGainRef.current;
    if (!gain) return () => {};

    activeDucksRef.current.push(level);
    const target = Math.min(...activeDucksRef.current);
    const ctx = getSoundContext();
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(target, ctx.currentTime, 0.035);

    return () => {
      const idx = activeDucksRef.current.indexOf(level);
      if (idx !== -1) activeDucksRef.current.splice(idx, 1);
      const nextTarget = activeDucksRef.current.length ? Math.min(...activeDucksRef.current) : 1;
      const currentCtx = getSoundContext();
      gain.gain.cancelScheduledValues(currentCtx.currentTime);
      gain.gain.setTargetAtTime(nextTarget, currentCtx.currentTime, 0.08);
    };
  };
  const duckForSignal = () => { const end = beginDuck(0.14); window.setTimeout(end, 1400); };
  const playPling = () => { duckForSignal(); const ctx = getSoundContext(); const now = ctx.currentTime; const master = ctx.createGain(); const compressor = ctx.createDynamicsCompressor(); master.gain.value = 1.25; compressor.threshold.value = -12; compressor.knee.value = 8; compressor.ratio.value = 5; master.connect(compressor); compressor.connect(ctx.destination); [620, 930, 1370, 2010].forEach((frequency, index) => { const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = index < 2 ? "triangle" : "sine"; osc.frequency.value = frequency; gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.72 / (index + 1), now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + 1.35); osc.connect(gain); gain.connect(master); osc.start(now); osc.stop(now + 1.4); }); };
  const playGong = () => { duckForSignal(); const source = gongRef.current; if (!source) return; const gong = source.cloneNode(true) as HTMLAudioElement; gong.volume = 1; gong.currentTime = 0; gong.play().catch(() => { source.currentTime = 0; source.volume = 1; source.play().catch(() => {}); }); };

  const cancelVoicePlayback = () => {
    announcementTokenRef.current += 1;
    activeVoiceSourceRef.current?.stop();
    activeVoiceSourceRef.current = null;
    const announcement = announcementRef.current;
    if (announcement) { announcement.pause(); announcement.removeAttribute("src"); announcement.load(); }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speechQueueRef.current = Promise.resolve();
    activeDucksRef.current = [];
    const gain = musicGainRef.current;
    const ctx = soundContextRef.current;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(1, ctx.currentTime);
    }
  };

  const getTtsBuffer = (text: string, speed = 1): Promise<AudioBuffer> => {
    const trimmed = text.trim();
    const cacheKey = `${speed.toFixed(2)}|${trimmed}`;
    const cached = ttsBufferCacheRef.current.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    const pending = ttsPendingRef.current.get(cacheKey);
    if (pending) return pending;
    const request = (async () => {
      let url = ttsCacheRef.current.get(cacheKey);
      if (!url) {
        const response = await fetch(`/api/tts?code=${syncCode}&text=${encodeURIComponent(trimmed)}&speed=${speed}`);
        if (!response.ok) throw new Error("tts request failed");
        const data = await response.json();
        url = data.url as string;
        ttsCacheRef.current.set(cacheKey, url);
      }
      const audioResponse = await fetch(url);
      if (!audioResponse.ok) throw new Error("tts audio fetch failed");
      const bytes = await audioResponse.arrayBuffer();
      const buffer = await getSoundContext().decodeAudioData(bytes.slice(0));
      ttsBufferCacheRef.current.set(cacheKey, buffer);
      return buffer;
    })().finally(() => ttsPendingRef.current.delete(cacheKey));
    ttsPendingRef.current.set(cacheKey, request);
    return request;
  };

  const prefetchTts = (texts: string[], speed = 1) => {
    if (!voiceEnabled || !syncCode) return;
    [...new Set(texts.map(text => text.trim()).filter(Boolean))].forEach(text => { void getTtsBuffer(text, speed).catch(() => {}); });
  };

  const playBuffer = (buffer: AudioBuffer, token: number, naturalVoice = false) => new Promise<void>((resolve) => {
    if (announcementTokenRef.current !== token) { resolve(); return; }
    const ctx = getSoundContext();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    // Maximera Cloud-TTS separat från övriga ljud.
    // Hög gain + limiter-lik kompression gör rösten så stark som möjligt
    // utan att ändra musikducking, pling eller gong.
    // Standardfraser får maximal förstärkning. Enstaka längre övningsnamn kan
    // låta hoptryckta av den hårda limitern och får därför en naturligare kedja.
    gain.gain.value = naturalVoice ? 2.1 : 4.0;
    compressor.threshold.value = naturalVoice ? -10 : -3;
    compressor.knee.value = naturalVoice ? 8 : 0;
    compressor.ratio.value = naturalVoice ? 4 : 20;
    compressor.attack.value = naturalVoice ? 0.004 : 0.001;
    compressor.release.value = naturalVoice ? 0.18 : 0.12;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(compressor);
    compressor.connect(ctx.destination);
    activeVoiceSourceRef.current = source;
    source.onended = () => { if (activeVoiceSourceRef.current === source) activeVoiceSourceRef.current = null; resolve(); };
    source.start();
  });

  const fallbackSpeak = (text: string, token: number) => new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window) || announcementTokenRef.current !== token) { resolve(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sv-SE";
    utterance.rate = 0.95;
    const swedish = window.speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith("sv"));
    if (swedish) utterance.voice = swedish;
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(finish, Math.max(3500, text.length * 120));
  });

  const playTts = async (text: string, token: number, speed = 1, naturalVoice = false) => {
    if (!text.trim() || announcementTokenRef.current !== token) return;
    try {
      const buffer = await getTtsBuffer(text, speed);
      if (announcementTokenRef.current === token) await playBuffer(buffer, token, naturalVoice);
    } catch {
      await fallbackSpeak(text, token);
    }
  };

  const playUrlAudio = (url: string, token: number) => new Promise<void>((resolve) => {
    if (announcementTokenRef.current !== token) { resolve(); return; }
    const audio = new Audio(url);
    announcementRef.current = audio;
    audio.preload = "auto";
    audio.volume = 1;
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
  });

  const enqueueSpeech = (task: (token: number) => Promise<void>, duckLevel = 0.08) => {
    const token = announcementTokenRef.current;
    const queued = speechQueueRef.current.catch(() => {}).then(async () => {
      if (announcementTokenRef.current !== token) return;
      const endDuck = beginDuck(duckLevel);
      try { await task(token); } finally { endDuck(); }
    });
    speechQueueRef.current = queued.catch(() => {});
    return queued;
  };

  const speakCloud = (text: string, onEnd?: () => void) => {
    void enqueueSpeech(token => playTts(text, token)).finally(() => onEnd?.());
  };
  const voicePause = (ms: number, token: number) => new Promise<void>((resolve) => {
    const id = window.setTimeout(resolve, ms);
    if (announcementTokenRef.current !== token) {
      window.clearTimeout(id);
      resolve();
    }
  });

  const playCountdownWord = async (value: number) => {
    if (!voiceEnabled) return;
    const words: Record<number, string> = { 5: "Fem", 4: "Fyra", 3: "Tre", 2: "Två", 1: "Ett" };
    const word = words[value];
    if (!word) return;
    const token = announcementTokenRef.current;
    try {
      const buffer = await getTtsBuffer(word);
      if (announcementTokenRef.current !== token) return;
      // Nedräkningen ska följa klockan, inte den vanliga talkön.
      activeVoiceSourceRef.current?.stop();
      activeVoiceSourceRef.current = null;
      const endDuck = beginDuck(0.14);
      try { await playBuffer(buffer, token); } finally { endDuck(); }
    } catch {
      await fallbackSpeak(word, token);
    }
  };

  const playAnnouncement = (exercise?: Exercise, preview = false, first = false, onComplete?: () => void) => {
    if (!exercise) { onComplete?.(); return; }
    if (!voiceEnabled && !preview) { onComplete?.(); return; }
    const prefix = first ? "Första övningen är" : "Nästa övning är";
    const phraseWithName = `${prefix} ${exercise.name}.`;
    const suffix = "Förbered dig.";
    const splitExerciseName = exercise.name.trim().toLocaleLowerCase("sv-SE") === "armhävningar";
    // "Armhävningar" låter onaturligt när TTS binder ihop ordet med "är".
    // För just den övningen läses därför prefix och namn som separata klipp.
    prefetchTts(exercise.voiceUrl
      ? [prefix, ...(first ? [] : [suffix])]
      : splitExerciseName
        ? [prefix, ...(first ? [] : [suffix])]
        : [phraseWithName, ...(first ? [] : [suffix])]);
    if (splitExerciseName && !exercise.voiceUrl) prefetchTts([exercise.name], 1.0);
    void enqueueSpeech(async token => {
      if (exercise.voiceUrl) {
        await playTts(prefix, token);
        if (announcementTokenRef.current !== token) return;
        await voicePause(220, token);
        await playUrlAudio(exercise.voiceUrl, token);
        if (announcementTokenRef.current !== token) return;
        if (!first) {
          await voicePause(splitExerciseName ? 650 : 450, token);
          if (announcementTokenRef.current !== token) return;
          await playTts(suffix, token, 0.9);
        }
      } else {
        if (splitExerciseName) {
          await playTts(prefix, token, 1.0);
          if (announcementTokenRef.current !== token) return;
          await voicePause(360, token);
          if (announcementTokenRef.current !== token) return;
          await playTts(exercise.name, token, 1.0, true);
        } else {
          await playTts(phraseWithName, token, 1.0);
        }
        if (!first && announcementTokenRef.current === token) {
          await voicePause(splitExerciseName ? 650 : 450, token);
          if (announcementTokenRef.current !== token) return;
          await playTts(suffix, token, 0.9);
        }
      }
      // Första övningen går direkt vidare till en tydlig 5–4–3–2–1-nedräkning.
      // Ingen extra "Gör dig redo"-fras precis före femman.
    }, 0.08).finally(() => onComplete?.());
  };
  const previewVoice = (exercise: Exercise) => { cancelVoicePlayback(); playAnnouncement(exercise, true); };
  const resetVoice = (exerciseId: string) => { cancelVoicePlayback(); updateExercise(exerciseId, { voiceUrl: undefined }); };
  const startNextStep = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      setRunning(false);
      setPaused(false);
      setRoundPausing(false);
      audioRef.current?.pause();
      return;
    }
    const upcoming = steps[nextIndex];
    setStepIndex(nextIndex);
    setResting(false);
    setRoundPausing(false);
    setSecondsLeft(upcoming.exercise.seconds);
    setPlaybackUrl(resolveExerciseMusic(upcoming.exercise));
    playPling();
  };

  const announceRoundPause = (currentStep: Step, upcoming: Step) => {
        if (!voiceEnabled) return;
        speakCloud(`${currentStep.roundName} klar. Nästa är ${upcoming.roundName}. Första övningen är ${upcoming.exercise.name}.`);
  };

  const advance = () => {
    const current = steps[stepIndex];
    if (!current) return;
    if (roundPausing) { startNextStep(); return; }
    if (!resting) playGong();

    const nextIndex = stepIndex + 1;
    const upcoming = steps[nextIndex];
    if (!upcoming) {
      setRunning(false);
      setPaused(false);
      audioRef.current?.pause();
      return;
    }

    // Mellan två olika rundor ersätter en 30 sekunders rundpaus den vanliga vilan.
    if (!resting && upcoming.roundIndex !== current.roundIndex) {
      setRoundPausing(true);
      setResting(false);
      setSecondsLeft(30);
      setPlaybackUrl(null);
      audioRef.current?.pause();
      announceRoundPause(current, upcoming);
      return;
    }

    if (!resting && current.exercise.rest > 0) {
      setResting(true);
      setSecondsLeft(current.exercise.rest);
      window.setTimeout(() => playAnnouncement(upcoming.exercise), 1400);
      return;
    }

    startNextStep();
  };

  // Nedräkning före första övningen använder den cachade API-rösten som en egen
  // prioriterad sekvens och startar varken arbetstid eller musik förrän 1 är klar.
  useEffect(() => {
    if (!running || !preStarting || preStartCount <= 0) return;
    if (voiceEnabled) {
      void playCountdownWord(preStartCount);
    }
    const id = window.setTimeout(() => {
      if (preStartCount > 1) {
        setPreStartCount(value => value - 1);
        return;
      }
      const first = steps[0];
      setPreStarting(false);
      setPreStartCount(0);
      if (first) {
        setSecondsLeft(first.exercise.seconds);
        setPlaybackUrl(resolveExerciseMusic(first.exercise));
      }
      playPling();
    }, 1000);
    return () => window.clearTimeout(id);
  }, [running, preStarting, preStartCount, steps, voiceEnabled]);

  // Under rundpausen räknas de sista fem sekunderna upp med standardrösten.
  useEffect(() => {
    if (!running || paused || !roundPausing || secondsLeft < 1 || secondsLeft > 5 || !voiceEnabled) return;
    void playCountdownWord(secondsLeft);
  }, [running, paused, roundPausing, secondsLeft, voiceEnabled]);

  // Kort förvarningspling när det återstår exakt fem sekunder av en ÖVNING.
  // Ingen sådan signal spelas under vanlig vila eller rundpaus.
  useEffect(() => {
    if (!running || paused || preStarting || resting || roundPausing || secondsLeft !== 5) return;
    playPling();
  }, [running, paused, preStarting, resting, roundPausing, secondsLeft, stepIndex]);

  useEffect(() => { if (!running || paused || preStarting) return; const id = window.setInterval(() => setSecondsLeft(value => { if (value <= 1) { window.setTimeout(advance, 0); return 0; } return value - 1; }), 1000); return () => window.clearInterval(id); }, [running, paused, preStarting, roundPausing, stepIndex, resting, steps]);
  useEffect(() => {
    if (!running) return;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const ctx = getSoundContext();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      musicSourceRef.current = source;
      musicGainRef.current = gain;
      return () => {
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
        if (musicSourceRef.current === source) musicSourceRef.current = null;
        if (musicGainRef.current === gain) musicGainRef.current = null;
        activeDucksRef.current = [];
      };
    } catch {
      // Om Web Audio inte kan kopplas in fortsätter musiken normalt.
      musicSourceRef.current = null;
      musicGainRef.current = null;
    }
  }, [running]);

  useEffect(() => { const audio = audioRef.current; if (!audio) return; if (running && !paused && !preStarting && !roundPausing && playbackUrl) audio.play().catch(() => {}); else audio.pause(); }, [running, paused, preStarting, roundPausing, playbackUrl]);

  const addExercise = () => { const name = newName.trim(); if (!name) return; const i = exercises.length % colors.length; setExercises([...exercises, { id: crypto.randomUUID(), name, seconds: 30, rest: 15, color: colors[i], emoji: emojis[i] }]); setNewName(""); };
  const moveExercise = (round: Round, index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= round.exerciseIds.length) return; const ids = [...round.exerciseIds]; [ids[index], ids[target]] = [ids[target], ids[index]]; updateRound(round.id, { exerciseIds: ids }); };
  const addMusicToLibrary = async (file?: File) => {
    if (!file || !syncCode) return;
    setUploadingLibraryMusic(true);
    try {
      const url = await uploadAudio(syncCode, file, file.name);
      const track: MusicTrack = { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ""), url };
      setMusicLibrary(current => [...current, track]);
    } catch { window.alert("Musikfilen kunde inte laddas upp. Kontrollera din internetuppkoppling och försök igen."); }
    setUploadingLibraryMusic(false);
  };
  const removeMusicFromLibrary = (track: MusicTrack) => {
    const usedBy = exercises.filter(exercise => exercise.music === track.url).map(exercise => exercise.name);
    const usageNote = usedBy.length ? `\n\nLåten används av ${usedBy.length === 1 ? usedBy[0] : `${usedBy.length} övningar`}. Dessa ändras till Ingen musik.` : "";
    if (!window.confirm(`Ta bort ”${track.name}” från Musikbiblioteket?${usageNote}`)) return;
    setMusicLibrary(current => current.filter(item => item.url !== track.url));
    if (track.bundled) setRemovedMusicUrls(current => current.includes(track.url) ? current : [...current, track.url]);
    setExercises(current => current.map(exercise => exercise.music === track.url ? { ...exercise, music: "none", musicName: undefined } : exercise));
  };
  const selectImage = (exerciseId: string, file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { const img = new Image(); img.onload = () => { const canvas = document.createElement("canvas"); const size = 420; canvas.width = size; canvas.height = size; const ctx = canvas.getContext("2d"); if (!ctx) return; const scale = Math.max(size / img.width, size / img.height); const w = img.width * scale, h = img.height * scale; ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h); updateExercise(exerciseId, { image: canvas.toDataURL("image/jpeg", .76) }); }; img.src = String(reader.result); }; reader.readAsDataURL(file); };
  const startRecording = async (exerciseId: string) => {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) { window.alert("Ljudinspelning stöds inte i den här webbläsaren."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/mp4" });
        if (!blob.size || !syncCode) return;
        setUploadingExerciseId(exerciseId);
        try {
          const mime = (recorder.mimeType || blob.type || "audio/webm").toLowerCase();
          const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
          const url = await uploadAudio(syncCode, blob, `rost-${exerciseId}.${extension}`);
          updateExercise(exerciseId, { voiceUrl: url });
        } catch { window.alert("Inspelningen kunde inte laddas upp. Kontrollera din internetuppkoppling och försök igen."); }
        setUploadingExerciseId(null);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingId(exerciseId);
    } catch { window.alert("Tillåt mikrofonen för att spela in din röst."); }
  };
  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); setRecordingId(null); };
  const current = steps[stepIndex], next = steps[stepIndex + 1];

  if (running && current) return <main className="player" style={{ "--accent": current.exercise.color } as React.CSSProperties}>
    <audio ref={audioRef} src={playbackUrl ?? undefined} loop crossOrigin="anonymous" /><audio ref={gongRef} src="/sounds/boxing-round-double.mp3" preload="auto" /><div className="playerTop"><div className="roundStatus"><span>RUNDA {current.roundIndex + 1} AV {rounds.length}</span><small>{current.roundName}</small></div><button className="endWorkout" onClick={() => { setRunning(false); setPreStarting(false); setPreStartCount(0); setRoundPausing(false); cancelVoicePlayback(); audioRef.current?.pause(); }}><b aria-hidden="true">■</b> Avsluta</button></div>
    <div className={`exerciseVisual ${(current.exercise.image || resting || roundPausing) ? "hasImage" : ""}`}>{(resting || roundPausing) ? <img src="/exercises/rest.webp" alt="Vila och återhämtning" /> : current.exercise.image ? <img src={current.exercise.image} alt={current.exercise.name} /> : <span>{current.exercise.emoji}</span>}</div><p className="eyebrow">{preStarting ? "GÖR DIG REDO" : roundPausing ? "RUNDPAUS" : resting ? "VILA" : "NU"}</p><h1>{roundPausing ? `${current.roundName} klar` : resting ? "Hämta andan" : current.exercise.name}</h1><div className={`countdown ${!preStarting && secondsLeft <= 5 ? "ending" : ""}`}>{preStarting ? (preStartCount || "REDO") : secondsLeft}</div>
    <div className="progress"><span style={{ width: preStarting ? "0%" : `${((stepIndex + (roundPausing ? .9 : resting ? .7 : .2)) / steps.length) * 100}%` }} /></div><p className="upNext">{preStarting ? "Passet börjar efter nedräkningen" : roundPausing && next ? <>Nästa <strong>{next.roundName}</strong> · {next.exercise.name}</> : next ? <>Nästa <strong>{next.exercise.name}</strong></> : "Sista övningen"}</p>
    <div className="playerControls"><button disabled={preStarting} onClick={() => setSecondsLeft(v => v + 15)}>+15 sek</button><button className="pause" disabled={preStarting} onClick={() => setPaused(!paused)}>{paused ? "▶" : "Ⅱ"}</button><button disabled={preStarting} onClick={advance}>{roundPausing ? "Starta nu" : "Hoppa över"}</button></div>
  </main>;

  return <main className="appShell roundShell">
    <header className="roundHeaderBar"><div className="brandMark pwaBrandMark"><img src="/icons/icon-192.png" alt="ROUND" /></div><div><p className="kicker">INTERVALLTRÄNING</p><h1>ROUND</h1></div></header>
    {tab === "pass" && !editingPass ? <section className="roundHome"><div className="homeIntro"><p>REDO NÄR DU ÄR</p><h2>Ditt pass.<br/><em>Din runda.</em></h2></div><article className="workoutHero"><div className="heroTop"><div><span>DAGENS PASS</span><strong>{rounds.length} rundor</strong></div><div className="heroTime"><b>{Math.max(1, Math.round(totalSeconds / 60))}</b><span>MIN</span></div></div><div className="heroImages">{Array.from(new Set(rounds.flatMap(round => round.exerciseIds))).slice(0, 5).map(id => { const exercise = exercises.find(item => item.id === id); return exercise ? <span key={id} style={{ background: exercise.color }}>{exercise.image ? <img src={exercise.image} alt={exercise.name}/> : exercise.emoji}</span> : null; })}</div><button className="heroStart" onClick={startWorkout}>STARTA PASSET <i>▶</i></button></article><div className="homeRounds">{rounds.map((round, index) => {
  const expanded = expandedHomeRound === round.id;
  return <article
    key={round.id}
    className={expanded ? "expanded" : ""}
    role="button"
    tabIndex={0}
    aria-expanded={expanded}
    onClick={() => setExpandedHomeRound(expanded ? null : round.id)}
    onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setExpandedHomeRound(expanded ? null : round.id);
      }
    }}
  >
    <div className="homeRoundNumber">{String(index + 1).padStart(2, "0")}</div>
    <div className="homeRoundInfo">
      <strong>{round.name}</strong>
      <span>{round.exerciseIds.length} övningar · {round.order === "random" ? "Slumpmässig ordning" : "Bestämd ordning"}</span>
      {!expanded && <div>{round.exerciseIds.slice(0, 5).map((id, i) => {
        const exercise = exercises.find(item => item.id === id);
        return exercise ? <i key={`${id}-${i}`}>{exercise.image ? <img src={exercise.image} alt={exercise.name}/> : exercise.emoji}</i> : null;
      })}</div>}
    </div>
    <b className="homeRoundChevron">›</b>
    {expanded && <div className="homeRoundDetails">
      {round.exerciseIds.map((id, i) => {
        const exercise = exercises.find(item => item.id === id);
        if (!exercise) return null;
        return <div className="homeRoundExercise" key={`${id}-${i}`}>
          <span className="homeRoundExerciseIndex">{i + 1}</span>
          <div className="homeRoundExerciseImage" style={{ background: exercise.color }}>
            {exercise.image ? <img src={exercise.image} alt={exercise.name}/> : exercise.emoji}
          </div>
          <div className="homeRoundExerciseText">
            <strong>{exercise.name}</strong>
            <span>{exercise.seconds} sek arbete · {exercise.rest} sek vila</span>
            {exercise.music && exercise.music !== "none" && <span className="homeRoundExerciseMusic">♫ {exercise.musicName || musicLibrary.find(track => track.url === exercise.music)?.name || "Vald låt"}</span>}
          </div>
        </div>;
      })}
    </div>}
  </article>;
})}</div></section> : tab === "pass" ? <>
      <section className="summaryCard"><div><span>Ditt pass</span><strong>{rounds.length} rundor · {Math.max(1, Math.round(totalSeconds / 60))} min</strong></div><button className="startButton" onClick={startWorkout}>Starta <span>▶</span></button></section>
      <div className="sectionTitle"><h2>Rundor</h2><button onClick={() => setRounds([...rounds, { id: crypto.randomUUID(), name: `Runda ${rounds.length + 1}`, exerciseIds: [], order: "fixed", repeats: 1 }])}>＋ Ny runda</button></div>
      <div className="roundList">{rounds.map((round, ri) => <article className="roundCard" key={round.id}>
        <div className="roundHeader" onClick={() => setEditingRound(editingRound === round.id ? null : round.id)}><div className="roundNumber">{ri + 1}</div><div><input value={round.name} onClick={e => e.stopPropagation()} onChange={e => updateRound(round.id, { name: e.target.value })} /><span>{round.exerciseIds.length} övningar · {round.order === "random" ? "Slumpmässig" : "Bestämd ordning"}</span></div><b>{editingRound === round.id ? "⌃" : "⌄"}</b></div>
        <div className="exerciseDots">{round.exerciseIds.map((id, i) => { const e = exercises.find(x => x.id === id); return e ? <span className={e.image ? "hasExerciseImage" : ""} key={`${id}-${i}`} style={{ background: e.color }}>{e.image ? <img src={e.image} alt={e.name} /> : e.emoji}</span> : null; })}</div>
        {editingRound === round.id && <div className="roundEditor"><div className="settingRow"><span>Ordning</span><select value={round.order} onChange={e => updateRound(round.id, { order: e.target.value as Round["order"] })}><option value="fixed">Bestämd</option><option value="random">Slumpmässig</option></select></div><div className="settingRow"><span>Antal varv</span><div className="stepper"><button onClick={() => updateRound(round.id, { repeats: Math.max(1, round.repeats - 1) })}>−</button><b>{round.repeats}</b><button onClick={() => updateRound(round.id, { repeats: round.repeats + 1 })}>＋</button></div></div><p className="miniTitle">Övningar och ordning</p>
          {round.exerciseIds.map((id, index) => { const e = exercises.find(x => x.id === id); return e ? <div className="orderedExercise" key={`${id}-${index}`}><span className={e.image ? "hasExerciseImage" : ""} style={{ background: e.color }}>{e.image ? <img src={e.image} alt={e.name} /> : e.emoji}</span><b>{e.name}</b><button onClick={() => moveExercise(round, index, -1)}>↑</button><button onClick={() => moveExercise(round, index, 1)}>↓</button><button onClick={() => updateRound(round.id, { exerciseIds: round.exerciseIds.filter((_, i) => i !== index) })}>×</button></div> : null; })}
          <select className="addSelect" value="" onChange={e => e.target.value && updateRound(round.id, { exerciseIds: [...round.exerciseIds, e.target.value] })}><option value="">＋ Lägg till övning</option>{exercises.filter(e => !hiddenExerciseIds.includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="deleteRound" onClick={() => setRounds(rounds.filter(r => r.id !== round.id))}>Ta bort rundan</button></div>}
      </article>)}</div>
      <section className="syncPanel"><div className="syncCard"><div><strong>Synk mellan enheter</strong><span>{syncStatus === "syncing" ? "Sparar…" : syncStatus === "loading" ? "Hämtar…" : syncStatus === "error" ? "Kunde inte synka just nu" : "Synkad"}</span></div><div className="syncCode">{syncCode.split("").map((char, i) => <b key={i}>{char}</b>)}</div><button onClick={() => { if (syncCode) { navigator.clipboard?.writeText(syncCode).catch(() => {}); window.alert(`Koden ${syncCode} är kopierad. Skriv in den på din andra enhet under "Anslut med kod".`); } }}>Kopiera kod</button></div>
        <div className="syncJoin"><input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} placeholder="Anslut med kod från annan enhet" maxLength={6} /><button onClick={() => joinSyncCode(joinCodeInput)}>Anslut</button></div>
        <p className="syncHint">Skriv samma kod på båda enheterna för att dela pass, rundor, övningar, musikbibliotek och inställningar. <button className="syncNewCode" onClick={() => { if (window.confirm("Skapa en ny, egen synk-kod? Den här enheten kopplas då bort från nuvarande kod.")) createNewSyncCode(); }}>Skapa ny kod</button></p>
      </section>
      <section className="voicePanel"><div className="voiceCard"><div><strong>Röstmeddelanden</strong><span>Spelas i början av vilan så du hinner förbereda nästa övning</span></div><button className={voiceEnabled ? "on" : ""} aria-label="Röstmeddelanden" onClick={() => setVoiceEnabled(!voiceEnabled)}><i /></button></div><p className="voiceHint">Spela in bara övningens namn på respektive övning under fliken Övningar.</p></section>
    </> : tab === "ovningar" ? <><div className="sectionTitle"><div><h2>Övningsbibliotek</h2><p>{exercises.filter(e => !hiddenExerciseIds.includes(e.id)).length} övningar</p></div></div><div className="addExercise"><input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addExercise()} placeholder="Namn på ny övning" /><button onClick={addExercise}>Lägg till</button></div>
      <div className="libraryGrid">{exercises.filter(e => !hiddenExerciseIds.includes(e.id)).map(e => { const isCustomMusic = !!e.music && e.music !== "none" && !musicLibrary.some(track => track.url === e.music); return <article key={e.id}><div className={`libraryVisual ${e.image ? "hasImage" : ""}`} style={{ background: e.color }}>{e.image ? <img src={e.image} alt={e.name} /> : e.emoji}<label className="imageUpload" title={e.image ? "Byt bild" : "Lägg till bild"} aria-label={e.image ? "Byt bild" : "Lägg till bild"}>{e.image ? "✎" : "+"}<input type="file" accept="image/*" onChange={x => selectImage(e.id, x.target.files?.[0])} /></label></div><div className="exerciseNameRow"><input className="exerciseName" value={e.name} onChange={x => updateExercise(e.id, { name: x.target.value })} /><button className="hideExerciseIcon" title="Dölj övning" aria-label={`Dölj ${e.name}`} onClick={() => setHiddenExerciseIds(ids => ids.includes(e.id) ? ids : [...ids, e.id])}>−</button></div><div className="timeInputs"><label>Arbete<TimeInput min={5} value={e.seconds} onChange={seconds => updateExercise(e.id, { seconds })} /><span>sek</span></label><label>Vila<TimeInput min={0} value={e.rest} onChange={rest => updateExercise(e.id, { rest })} /><span>sek</span></label></div><div className="recordVoice"><div className="voiceTop"><span>Röstmeddelande</span>{recordingId === e.id ? <button className="recording" onClick={stopRecording}>■ Stoppa</button> : <button disabled={recordingId !== null} onClick={() => startRecording(e.id)}>🎙 {e.voiceUrl ? "Spela in på nytt" : "Spela in"}</button>}</div><small>{uploadingExerciseId === e.id ? "Laddar upp…" : recordingId === e.id ? `Säg bara: ”${e.name}”` : e.voiceUrl ? `Eget övningsnamn sparat · ”Nästa övning är” läses med standardrösten` : `Spela bara in övningens namn: ”${e.name}”`}</small>{e.voiceUrl && <div className="voiceActions"><button className="listenVoice" onClick={() => previewVoice(e)}>▶ Provlyssna</button><button className="resetVoice" onClick={() => resetVoice(e.id)}>↶ Standardröst</button></div>}</div><label className="exerciseMusic">Musik<select value={e.music || "none"} onChange={x => { const track = musicLibrary.find(item => item.url === x.target.value); updateExercise(e.id, { music: x.target.value, musicName: track?.name }); }}><option value="none">Ingen musik</option>{musicLibrary.map(track => <option key={track.id} value={track.url}>{track.name}</option>)}{isCustomMusic && !musicLibrary.some(track => track.url === e.music) && <option value={e.music}>Egen: {e.musicName}</option>}</select></label>{isCustomMusic && <span className="customMusicName">♫ {e.musicName}{uploadingExerciseId === e.id ? " · laddar upp…" : ""}</span>}</article>; })}</div>
      {hiddenExerciseIds.length > 0 && <section className="hiddenExercises"><button className="hiddenExercisesToggle" onClick={() => setShowHiddenExercises(!showHiddenExercises)}><span>Dolda övningar <b>{hiddenExerciseIds.length}</b></span><i>{showHiddenExercises ? "⌃" : "⌄"}</i></button>{showHiddenExercises && <div className="hiddenExerciseList">{exercises.filter(e => hiddenExerciseIds.includes(e.id)).map(e => <div key={e.id}><span>{e.image ? <img src={e.image} alt="" /> : e.emoji}<strong>{e.name}</strong></span><button onClick={() => setHiddenExerciseIds(ids => ids.filter(id => id !== e.id))}>Visa igen</button></div>)}</div>}</section>}
    </> : <><div className="sectionTitle"><div><h2>Musikbibliotek</h2><p>{musicLibrary.length} låtar · ladda upp en gång och återanvänd överallt.</p></div></div><label className="musicLibraryUpload">＋ Lägg till låt {uploadingLibraryMusic ? "· laddar upp…" : ""}<input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" onChange={e => addMusicToLibrary(e.target.files?.[0])} /></label><div className="trackLibrary">{musicLibrary.map(track => <article key={track.id}><button className="trackPlay" onClick={() => { const audio = new Audio(track.url); audio.play().catch(() => {}); }}>▶</button><div><strong>{track.name}</strong><span>Kan väljas på valfri övning</span></div><span className="trackActions">{track.bundled && <span className="bundledTrack">I appen</span>}<button className="trackDelete" onClick={() => removeMusicFromLibrary(track)} aria-label={`Ta bort ${track.name}`}>Ta bort</button></span></article>)}</div></>}<nav className="bottomNav"><button className={tab === "pass" && !editingPass ? "active" : ""} onClick={() => { setTab("pass"); setEditingPass(false); }}><i>◉</i><span>Pass</span></button><button className={tab === "ovningar" ? "active" : ""} onClick={() => setTab("ovningar")}><i>▦</i><span>Övningar</span></button><button className={tab === "musik" ? "active" : ""} onClick={() => setTab("musik")}><i>♫</i><span>Musik</span></button><button className={tab === "pass" && editingPass ? "active" : ""} onClick={() => { setTab("pass"); setEditingPass(true); }}><i>⚙</i><span>Redigera</span></button></nav>{tab === "pass" && editingPass && <footer>Synkas mellan enheter med samma kod. Sparas även lokalt som säkerhetskopia.</footer>}
  </main>;
}

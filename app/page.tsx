"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Exercise = { id: string; name: string; seconds: number; rest: number; color: string; emoji: string; image?: string; music?: string; musicName?: string; hasRecording?: boolean };
type Round = { id: string; name: string; exerciseIds: string[]; order: "fixed" | "random"; repeats: number };
type Step = { exercise: Exercise; roundName: string };

const starterExercises: Exercise[] = [
  { id: "e1", name: "Knäböj", seconds: 40, rest: 15, color: "#ff6b35", emoji: "↕", image: "/exercises/squat.webp" },
  { id: "e2", name: "Armhävningar", seconds: 30, rest: 15, color: "#b8e986", emoji: "↔", image: "/exercises/pushup.webp" },
  { id: "e3", name: "Plankan", seconds: 45, rest: 20, color: "#ffd166", emoji: "▬", image: "/exercises/plank.webp" },
  { id: "e4", name: "Utfall", seconds: 40, rest: 15, color: "#7bdff2", emoji: "⌁", image: "/exercises/lunge.webp" },
  { id: "e5", name: "Situps", seconds: 35, rest: 15, color: "#cdb4db", emoji: "◡", image: "/exercises/situp.webp" },
];
const starterRounds: Round[] = [
  { id: "r1", name: "Runda 1", exerciseIds: ["e1", "e2", "e3"], order: "fixed", repeats: 1 },
  { id: "r2", name: "Runda 2", exerciseIds: ["e4", "e5", "e2"], order: "random", repeats: 1 },
];
const colors = ["#ff6b35", "#b8e986", "#ffd166", "#7bdff2", "#cdb4db", "#ff8fab"];
const emojis = ["↕", "↔", "▬", "⌁", "◡", "✦"];

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

const audioDbName = "traningsrundan-audio";
const audioStoreName = "exercise-music";
const voiceStoreName = "exercise-voice";
function openAudioDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(audioDbName, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(audioStoreName)) request.result.createObjectStore(audioStoreName);
      if (!request.result.objectStoreNames.contains(voiceStoreName)) request.result.createObjectStore(voiceStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveStoredAudio(storeName: string, id: string, blob: Blob) {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
async function loadStoredAudio(storeName: string, id: string) {
  const db = await openAudioDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}
async function saveExerciseAudio(id: string, file: File) {
  await saveStoredAudio(audioStoreName, id, file);
}
async function loadExerciseAudio(id: string) {
  return loadStoredAudio(audioStoreName, id);
}

export default function Home() {
  const [exercises, setExercises] = useState<Exercise[]>(starterExercises);
  const [rounds, setRounds] = useState<Round[]>(starterRounds);
  const [tab, setTab] = useState<"pass" | "ovningar">("pass");
  const [editingPass, setEditingPass] = useState(false);
  const [editingRound, setEditingRound] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [passMusicName, setPassMusicName] = useState("Energi");
  const [passMusicUrl, setPassMusicUrl] = useState<string | null>("/music/energi.mp3");
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resting, setResting] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [customMusicUrls, setCustomMusicUrls] = useState<Record<string, string>>({});
  const [voiceUrls, setVoiceUrls] = useState<Record<string, string>>({});
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const customMusicUrlsRef = useRef<Record<string, string>>({});
  const voiceUrlsRef = useRef<Record<string, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const announcementRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gongRef = useRef<HTMLAudioElement | null>(null);
  const soundContextRef = useRef<AudioContext | null>(null);

  // Intentional: hydrates client-only localStorage data after mount so the
  // server-rendered markup (no localStorage access) matches the client's first
  // paint and avoids a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const saved = localStorage.getItem("traningsrundan-v1"); if (saved) try { const data = JSON.parse(saved); if (data.exercises?.length) setExercises(data.exercises.map((exercise: Exercise) => ({ ...exercise, image: exercise.image?.startsWith("data:") ? exercise.image : starterExercises.find(item => item.id === exercise.id)?.image || exercise.image }))); if (data.rounds?.length) setRounds(data.rounds); } catch {} }, []);
  useEffect(() => { localStorage.setItem("traningsrundan-v1", JSON.stringify({ exercises, rounds })); }, [exercises, rounds]);
  useEffect(() => {
    exercises.filter(exercise => exercise.music === "custom" && !customMusicUrlsRef.current[exercise.id]).forEach(async exercise => {
      try {
        const blob = await loadExerciseAudio(exercise.id);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        customMusicUrlsRef.current[exercise.id] = url;
        setCustomMusicUrls(current => ({ ...current, [exercise.id]: url }));
      } catch {}
    });
  }, [exercises]);
  useEffect(() => {
    exercises.filter(exercise => exercise.hasRecording && !voiceUrlsRef.current[exercise.id]).forEach(async exercise => {
      try {
        const blob = await loadStoredAudio(voiceStoreName, exercise.id);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        voiceUrlsRef.current[exercise.id] = url;
        setVoiceUrls(current => ({ ...current, [exercise.id]: url }));
      } catch {}
    });
  }, [exercises]);
  useEffect(() => () => { Object.values(customMusicUrlsRef.current).forEach(url => URL.revokeObjectURL(url)); Object.values(voiceUrlsRef.current).forEach(url => URL.revokeObjectURL(url)); }, []);

  const totalSeconds = useMemo(() => rounds.reduce((sum, r) => sum + r.exerciseIds.reduce((s, id) => { const e = exercises.find(x => x.id === id); return s + (e ? e.seconds + e.rest : 0); }, 0) * r.repeats, 0), [rounds, exercises]);
  const updateExercise = (id: string, patch: Partial<Exercise>) => setExercises(exercises.map(e => e.id === id ? { ...e, ...patch } : e));
  const updateRound = (id: string, patch: Partial<Round>) => setRounds(rounds.map(r => r.id === id ? { ...r, ...patch } : r));

  const buildSteps = () => {
    const result: Step[] = [];
    rounds.forEach(round => { for (let repeat = 0; repeat < round.repeats; repeat++) { const selected = round.exerciseIds.map(id => exercises.find(e => e.id === id)).filter(Boolean) as Exercise[]; (round.order === "random" ? shuffle(selected) : selected).forEach(exercise => result.push({ exercise, roundName: round.name })); } });
    return result;
  };
  const getSoundContext = () => { if (!soundContextRef.current) { const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; soundContextRef.current = new Ctx(); } soundContextRef.current.resume().catch(() => {}); return soundContextRef.current; };
  const resolveExerciseMusic = (exercise: Exercise) => exercise.music === "none" ? null : exercise.music === "custom" ? customMusicUrlsRef.current[exercise.id] || null : exercise.music && exercise.music !== "pass" ? exercise.music : passMusicUrl;
  const startWorkout = () => { const built = buildSteps(); if (!built.length) return; getSoundContext(); setSteps(built); setStepIndex(0); setResting(false); setSecondsLeft(built[0].exercise.seconds); setPlaybackUrl(resolveExerciseMusic(built[0].exercise)); setRunning(true); setPaused(false); window.setTimeout(() => playAnnouncement(built[0].exercise, false, true), 250); };
  const playPling = () => { const ctx = getSoundContext(); const now = ctx.currentTime; const master = ctx.createGain(); const compressor = ctx.createDynamicsCompressor(); master.gain.value = 1.25; compressor.threshold.value = -12; compressor.knee.value = 8; compressor.ratio.value = 5; master.connect(compressor); compressor.connect(ctx.destination); [620, 930, 1370, 2010].forEach((frequency, index) => { const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = index < 2 ? "triangle" : "sine"; osc.frequency.value = frequency; gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.72 / (index + 1), now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + 1.35); osc.connect(gain); gain.connect(master); osc.start(now); osc.stop(now + 1.4); }); };
  const playGong = () => { const source = gongRef.current; if (!source) return; const gong = source.cloneNode(true) as HTMLAudioElement; gong.volume = 1; gong.currentTime = 0; gong.play().catch(() => { source.currentTime = 0; source.volume = 1; source.play().catch(() => {}); }); };
  const playAnnouncement = (exercise?: Exercise, preview = false, first = false) => { if ((!voiceEnabled && !preview) || !exercise) return; const music = audioRef.current; const oldVolume = music?.volume ?? .75; if (music) music.volume = .12; const restore = () => { if (music) music.volume = oldVolume; }; const url = voiceUrlsRef.current[exercise.id]; if (url) { announcementRef.current?.pause(); const announcement = new Audio(url); announcementRef.current = announcement; announcement.volume = 1; announcement.onended = restore; announcement.onerror = restore; announcement.play().catch(restore); return; } if (!("speechSynthesis" in window)) { restore(); return; } window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(first ? `Första övningen är ${exercise.name}. Börja.` : `Nästa övning är ${exercise.name}. Förbered dig.`); utterance.lang = "sv-SE"; utterance.rate = .95; const swedishVoice = window.speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith("sv")); if (swedishVoice) utterance.voice = swedishVoice; utterance.onend = restore; utterance.onerror = restore; window.speechSynthesis.speak(utterance); };
  const advance = () => { const current = steps[stepIndex]; if (!resting) playGong(); if (!resting && current.exercise.rest > 0) { setResting(true); setSecondsLeft(current.exercise.rest); const upcoming = steps[stepIndex + 1]; if (upcoming) window.setTimeout(() => playAnnouncement(upcoming.exercise), 850); return; } const next = stepIndex + 1; if (next >= steps.length) { setRunning(false); setPaused(false); audioRef.current?.pause(); return; } setStepIndex(next); setResting(false); setSecondsLeft(steps[next].exercise.seconds); setPlaybackUrl(resolveExerciseMusic(steps[next].exercise)); };
  useEffect(() => { if (!running || paused) return; const id = window.setInterval(() => setSecondsLeft(value => { if (value <= 1) { window.setTimeout(advance, 0); return 0; } if (value === 6) playPling(); return value - 1; }), 1000); return () => window.clearInterval(id); }, [running, paused, stepIndex, resting, steps]);
  useEffect(() => { const audio = audioRef.current; if (!audio) return; if (running && !paused && playbackUrl) audio.play().catch(() => {}); else audio.pause(); }, [running, paused, playbackUrl]);

  const addExercise = () => { const name = newName.trim(); if (!name) return; const i = exercises.length % colors.length; setExercises([...exercises, { id: crypto.randomUUID(), name, seconds: 30, rest: 15, color: colors[i], emoji: emojis[i] }]); setNewName(""); };
  const moveExercise = (round: Round, index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= round.exerciseIds.length) return; const ids = [...round.exerciseIds]; [ids[index], ids[target]] = [ids[target], ids[index]]; updateRound(round.id, { exerciseIds: ids }); };
  const selectMusic = (file?: File) => { if (!file) return; if (passMusicUrl?.startsWith("blob:")) URL.revokeObjectURL(passMusicUrl); setPassMusicUrl(URL.createObjectURL(file)); setPassMusicName(file.name); };
  const selectBuiltInMusic = (name: string, url: string) => { if (passMusicUrl?.startsWith("blob:")) URL.revokeObjectURL(passMusicUrl); setPassMusicName(name); setPassMusicUrl(url); };
  const selectImage = (exerciseId: string, file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { const img = new Image(); img.onload = () => { const canvas = document.createElement("canvas"); const size = 420; canvas.width = size; canvas.height = size; const ctx = canvas.getContext("2d"); if (!ctx) return; const scale = Math.max(size / img.width, size / img.height); const w = img.width * scale, h = img.height * scale; ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h); updateExercise(exerciseId, { image: canvas.toDataURL("image/jpeg", .76) }); }; img.src = String(reader.result); }; reader.readAsDataURL(file); };
  const selectExerciseMusic = async (exerciseId: string, file?: File) => {
    if (!file) return;
    try {
      await saveExerciseAudio(exerciseId, file);
      const previous = customMusicUrlsRef.current[exerciseId];
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(file);
      customMusicUrlsRef.current[exerciseId] = url;
      setCustomMusicUrls(current => ({ ...current, [exerciseId]: url }));
      updateExercise(exerciseId, { music: "custom", musicName: file.name });
    } catch { window.alert("Musikfilen kunde inte sparas på den här enheten."); }
  };
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
        if (!blob.size) return;
        try {
          await saveStoredAudio(voiceStoreName, exerciseId, blob);
          const previous = voiceUrlsRef.current[exerciseId];
          if (previous) URL.revokeObjectURL(previous);
          const url = URL.createObjectURL(blob);
          voiceUrlsRef.current[exerciseId] = url;
          setVoiceUrls(current => ({ ...current, [exerciseId]: url }));
          updateExercise(exerciseId, { hasRecording: true });
        } catch { window.alert("Inspelningen kunde inte sparas på den här enheten."); }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingId(exerciseId);
    } catch { window.alert("Tillåt mikrofonen för att spela in din röst."); }
  };
  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); setRecordingId(null); };
  const current = steps[stepIndex], next = steps[stepIndex + 1];

  if (running && current) return <main className="player" style={{ "--accent": current.exercise.color } as React.CSSProperties}>
    <audio ref={audioRef} src={playbackUrl ?? undefined} loop /><audio ref={gongRef} src="/sounds/boxing-round-double.mp3" preload="auto" /><div className="playerTop"><span>{current.roundName}</span><button onClick={() => { setRunning(false); audioRef.current?.pause(); }}>Avsluta</button></div>
    <div className={`exerciseVisual ${(current.exercise.image || resting) ? "hasImage" : ""}`}>{resting ? <img src="/exercises/rest.webp" alt="Vila och återhämtning" /> : current.exercise.image ? <img src={current.exercise.image} alt={current.exercise.name} /> : <span>{current.exercise.emoji}</span>}</div><p className="eyebrow">{resting ? "VILA" : "NU"}</p><h1>{resting ? "Hämta andan" : current.exercise.name}</h1><div className={`countdown ${secondsLeft <= 5 ? "ending" : ""}`}>{secondsLeft}</div>
    <div className="progress"><span style={{ width: `${((stepIndex + (resting ? .7 : .2)) / steps.length) * 100}%` }} /></div><p className="upNext">{next ? <>Nästa <strong>{next.exercise.name}</strong></> : "Sista övningen"}</p>
    <div className="playerControls"><button onClick={() => setSecondsLeft(v => v + 15)}>+15 sek</button><button className="pause" onClick={() => setPaused(!paused)}>{paused ? "▶" : "Ⅱ"}</button><button onClick={advance}>Hoppa över</button></div>
  </main>;

  return <main className="appShell roundShell">
    <header className="roundHeaderBar"><div className="brandMark">R</div><div><p className="kicker">INTERVALLTRÄNING</p><h1>ROUND</h1></div></header>
    {tab === "pass" && !editingPass ? <section className="roundHome"><div className="homeIntro"><p>REDO NÄR DU ÄR</p><h2>Ditt pass.<br/><em>Din runda.</em></h2></div><article className="workoutHero"><div className="heroTop"><div><span>DAGENS PASS</span><strong>{rounds.length} rundor</strong></div><div className="heroTime"><b>{Math.max(1, Math.round(totalSeconds / 60))}</b><span>MIN</span></div></div><div className="heroImages">{Array.from(new Set(rounds.flatMap(round => round.exerciseIds))).slice(0, 5).map(id => { const exercise = exercises.find(item => item.id === id); return exercise ? <span key={id} style={{ background: exercise.color }}>{exercise.image ? <img src={exercise.image} alt={exercise.name}/> : exercise.emoji}</span> : null; })}</div><button className="heroStart" onClick={startWorkout}>STARTA PASSET <i>▶</i></button></article><div className="homeSectionTitle"><div><span>DITT UPPLÄGG</span><h3>Rundor</h3></div><button onClick={() => setEditingPass(true)}>Redigera</button></div><div className="homeRounds">{rounds.map((round, index) => <article key={round.id}><div className="homeRoundNumber">0{index + 1}</div><div className="homeRoundInfo"><strong>{round.name}</strong><span>{round.exerciseIds.length} övningar · {round.order === "random" ? "Slumpmässig ordning" : "Bestämd ordning"}</span><div>{round.exerciseIds.slice(0, 5).map((id, i) => { const exercise = exercises.find(item => item.id === id); return exercise ? <i key={`${id}-${i}`}>{exercise.image ? <img src={exercise.image} alt={exercise.name}/> : exercise.emoji}</i> : null; })}</div></div><b>›</b></article>)}</div></section> : tab === "pass" ? <>
      <section className="summaryCard"><div><span>Ditt pass</span><strong>{rounds.length} rundor · {Math.max(1, Math.round(totalSeconds / 60))} min</strong></div><button className="startButton" onClick={startWorkout}>Starta <span>▶</span></button></section>
      <section className="musicPanel"><div className="musicCard"><div className="musicIcon">♫</div><div><strong>Standardmusik</strong><span>Valt spår: {passMusicName}</span></div><label>Egen fil<input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" onChange={e => selectMusic(e.target.files?.[0])} /></label></div><div className="musicChoices"><button className={passMusicName === "Energi" ? "selected" : ""} onClick={() => selectBuiltInMusic("Energi", "/music/energi.mp3")}>⚡ Energi</button><button className={passMusicName === "Driv" ? "selected" : ""} onClick={() => selectBuiltInMusic("Driv", "/music/driv.mp3")}>● Driv</button><button className={passMusicName === "Fokus" ? "selected" : ""} onClick={() => selectBuiltInMusic("Fokus", "/music/fokus.mp3")}>◉ Fokus</button></div></section>
      <section className="voicePanel"><div className="voiceCard"><div><strong>Egna röstmeddelanden</strong><span>Spelas i början av vilan så du hinner förbereda nästa övning</span></div><button className={voiceEnabled ? "on" : ""} aria-label="Egna röstmeddelanden" onClick={() => setVoiceEnabled(!voiceEnabled)}><i /></button></div><p className="voiceHint">Spela in meddelandet på respektive övning under fliken Övningar.</p></section>
      <div className="sectionTitle"><h2>Rundor</h2><button onClick={() => setRounds([...rounds, { id: crypto.randomUUID(), name: `Runda ${rounds.length + 1}`, exerciseIds: [], order: "fixed", repeats: 1 }])}>＋ Ny runda</button></div>
      <div className="roundList">{rounds.map((round, ri) => <article className="roundCard" key={round.id}>
        <div className="roundHeader" onClick={() => setEditingRound(editingRound === round.id ? null : round.id)}><div className="roundNumber">{ri + 1}</div><div><input value={round.name} onClick={e => e.stopPropagation()} onChange={e => updateRound(round.id, { name: e.target.value })} /><span>{round.exerciseIds.length} övningar · {round.order === "random" ? "Slumpmässig" : "Bestämd ordning"}</span></div><b>{editingRound === round.id ? "⌃" : "⌄"}</b></div>
        <div className="exerciseDots">{round.exerciseIds.map((id, i) => { const e = exercises.find(x => x.id === id); return e ? <span className={e.image ? "hasExerciseImage" : ""} key={`${id}-${i}`} style={{ background: e.color }}>{e.image ? <img src={e.image} alt={e.name} /> : e.emoji}</span> : null; })}</div>
        {editingRound === round.id && <div className="roundEditor"><div className="settingRow"><span>Ordning</span><select value={round.order} onChange={e => updateRound(round.id, { order: e.target.value as Round["order"] })}><option value="fixed">Bestämd</option><option value="random">Slumpmässig</option></select></div><div className="settingRow"><span>Antal varv</span><div className="stepper"><button onClick={() => updateRound(round.id, { repeats: Math.max(1, round.repeats - 1) })}>−</button><b>{round.repeats}</b><button onClick={() => updateRound(round.id, { repeats: round.repeats + 1 })}>＋</button></div></div><p className="miniTitle">Övningar och ordning</p>
          {round.exerciseIds.map((id, index) => { const e = exercises.find(x => x.id === id); return e ? <div className="orderedExercise" key={`${id}-${index}`}><span className={e.image ? "hasExerciseImage" : ""} style={{ background: e.color }}>{e.image ? <img src={e.image} alt={e.name} /> : e.emoji}</span><b>{e.name}</b><button onClick={() => moveExercise(round, index, -1)}>↑</button><button onClick={() => moveExercise(round, index, 1)}>↓</button><button onClick={() => updateRound(round.id, { exerciseIds: round.exerciseIds.filter((_, i) => i !== index) })}>×</button></div> : null; })}
          <select className="addSelect" value="" onChange={e => e.target.value && updateRound(round.id, { exerciseIds: [...round.exerciseIds, e.target.value] })}><option value="">＋ Lägg till övning</option>{exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="deleteRound" onClick={() => setRounds(rounds.filter(r => r.id !== round.id))}>Ta bort rundan</button></div>}
      </article>)}</div>
    </> : <><div className="sectionTitle"><div><h2>Dina övningar</h2><p>Ändra tider direkt i listan.</p></div></div><div className="addExercise"><input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addExercise()} placeholder="Namn på ny övning" /><button onClick={addExercise}>Lägg till</button></div>
      <div className="libraryGrid">{exercises.map(e => <article key={e.id}><div className={`libraryVisual ${e.image ? "hasImage" : ""}`} style={{ background: e.color }}>{e.image ? <img src={e.image} alt={e.name} /> : e.emoji}<label className="imageUpload" title={e.image ? "Byt bild" : "Lägg till bild"} aria-label={e.image ? "Byt bild" : "Lägg till bild"}>{e.image ? "✎" : "+"}<input type="file" accept="image/*" onChange={x => selectImage(e.id, x.target.files?.[0])} /></label></div><input className="exerciseName" value={e.name} onChange={x => updateExercise(e.id, { name: x.target.value })} /><div className="timeInputs"><label>Arbete<input type="number" min="5" value={e.seconds} onChange={x => updateExercise(e.id, { seconds: Number(x.target.value) })} /><span>sek</span></label><label>Vila<input type="number" min="0" value={e.rest} onChange={x => updateExercise(e.id, { rest: Number(x.target.value) })} /><span>sek</span></label></div><div className="recordVoice"><span>Röstmeddelande</span>{recordingId === e.id ? <button className="recording" onClick={stopRecording}>■ Stoppa inspelning</button> : <button disabled={recordingId !== null} onClick={() => startRecording(e.id)}>● {e.hasRecording ? "Spela in på nytt" : "Spela in eget tal"}</button>}{e.hasRecording && voiceUrls[e.id] && <button className="listenVoice" onClick={() => playAnnouncement(e, true)}>▶ Lyssna</button>}<small>{e.hasRecording ? "Inspelning sparad" : `Säg t.ex. ”Nästa övning är ${e.name}”`}</small></div><label className="exerciseMusic">Musik<select value={e.music || "pass"} onChange={x => updateExercise(e.id, { music: x.target.value })}><option value="pass">Standardmusik</option><option value="/music/energi.mp3">Energi</option><option value="/music/driv.mp3">Driv</option><option value="/music/fokus.mp3">Fokus</option>{e.musicName && <option value="custom">Egen: {e.musicName}</option>}<option value="none">Ingen musik</option></select></label><label className="customMusicUpload">{e.musicName ? "Byt egen MP3" : "+ Lägg till egen MP3"}<input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" onChange={x => selectExerciseMusic(e.id, x.target.files?.[0])} /></label>{e.music === "custom" && <span className="customMusicName">♫ {e.musicName}{!customMusicUrls[e.id] ? " · laddas…" : ""}</span>}<button className="removeExercise" onClick={() => { setExercises(exercises.filter(x => x.id !== e.id)); setRounds(rounds.map(r => ({ ...r, exerciseIds: r.exerciseIds.filter(id => id !== e.id) }))); }}>Ta bort</button></article>)}</div>
    </>}<nav className="bottomNav"><button className={tab === "pass" && !editingPass ? "active" : ""} onClick={() => { setTab("pass"); setEditingPass(false); }}><i>◉</i><span>Pass</span></button><button className={tab === "ovningar" ? "active" : ""} onClick={() => setTab("ovningar")}><i>▦</i><span>Övningar</span></button><button className={tab === "pass" && editingPass ? "active" : ""} onClick={() => { setTab("pass"); setEditingPass(true); }}><i>⚙</i><span>Redigera</span></button></nav><footer>Allt sparas automatiskt på den här enheten.</footer>
  </main>;
}

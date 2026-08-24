Round - Träningsrundan
=======================

Next.js (App Router) intervallträningsapp med övningsbibliotek, rundor, timer, musikbibliotek och röstmeddelanden. All data (övningar, rundor, musik, röstinställningar) synkas via en enkel synk-kod mot Vercel Blob (sync/{KOD}/state.json), med backup i localStorage. Ljudfiler lagras i Vercel Blob under sync/{KOD}/... respektive tts/{KOD}/...

Live: https://round-dun.vercel.app
Repo: github.com/j74risberg-web/round

Arkitektur i korthet
---------------------

app/page.tsx: hela klient-appen i en enda stor komponent, mycket kod formaterad medvetet på en rad per funktion.
middleware.ts, app/pin/page.tsx, app/api/gate/route.ts: PIN-spärr (kod satt via ROUND_PIN env-var) för hela sajten.
app/api/state/route.ts: GET/POST synk-state mot Vercel Blob.
app/api/upload/route.ts: laddar upp musik/röstinspelningar till Blob.
app/api/tts/route.ts: text-till-tal via OpenAI (OPENAI_API_KEY), modell tts-1-hd, röst nova, response_format mp3. Cachar resultat i Blob per synk-kod plus sha256-hash av texten.

Röstsystemet
------------

Appen använde tidigare webbläsarens inbyggda speechSynthesis - funkade alltid men lät robotaktigt. Bytt till OpenAI TTS via /api/tts, uppspelat med Web Audio API.

Status 2026-08-23: en tidigare bugg där röstmeddelanden ibland krockade eller lästes fel (race condition mellan asynkrona nätverkssvar) är ÅTGÄRDAD. Fixen pushades direkt via terminal/lokal Claude Code-session, inte via denna chatt-konversation. Lösningen bygger på en riktig talkö istället för enkla token-kontroller.

Nyckeldelar i den nuvarande lösningen, alla i app/page.tsx:

speechQueueRef och enqueueSpeech(task, duckLevel): en riktig kö av talåtgärder. Varje ny talåtgärd kedjas efter den föregående, så två röstmeddelanden kan aldrig spela eller skriva över varandra samtidigt, oavsett hur nätverkssvaren kommer tillbaka i tiden.

announcementTokenRef: ökas för varje ny annonsering. Kontrolleras både innan och EFTER varje asynkron väntan, inte bara vid starten av ett anrop. Det var just avsaknaden av kontroll efter await/then som orsakade den gamla buggen.

getTtsBuffer och playBuffer: hämtar och spelar upp TTS-ljud via AudioContext.decodeAudioData och AudioBufferSourceNode, med kompression och gain för tydlighet mot bakgrundsmusiken.

fallbackSpeak: om hämtning eller avkodning misslyckas faller appen tillbaka på webbläsarens inbyggda speechSynthesis istället för att bli helt tyst.

prefetchTts: hämtar kommande fraser i förväg för att minska väntetid och risken för överlappande nätverksanrop.

beginDuck, activeDucksRef, musicBaseVolumeRef: delad duck-hanterare för bakgrundsmusiken. Både pling/gong och röstmeddelanden sänker musikvolymen via samma mekanism, så att en kort signals duckning inte råkar återställa volymen mitt i ett längre röstmeddelande. Musiken återställs bara när ALLA aktiva duckningar är klara.

announcementRef: ett sidlivslångt audio-element (skapat i en useEffect med document.createElement, inte som JSX) används för egna röstinspelningar. Elementet får aldrig monteras om, annars tappar iOS Safari sin autoplay-upplåsning mitt i passet.

Lärdomar
--------

AudioContext.decodeAudioData på OpenAIs mp3-output gav tidigare EncodingError i ett enkelt försök utan felhantering. Lösningen var inte att undvika Web Audio API helt, utan att lägga till fallbackSpeak som fångar fel och faller tillbaka på speechSynthesis. Dyker decode-fel upp igen: kolla felhanteringen runt getTtsBuffer och playBuffer innan uppspelningstekniken byts igen.

En enkel koll som bara körs vid anropet, inte efter varje await, räcker inte för att förhindra race conditions mellan flera parallella nätverksanrop. En riktig kö löser det mer robust.

Testa alltid röst- och autoplay-relaterade ändringar på riktig iPhone, gärna som hemskärms-PWA. Skrivbordswebbläsare beter sig ofta mer tillåtande och döljer buggar som bara syns på iOS.

Övrigt att veta
----------------

mergeExerciseLibrary: de 15 standardövningarna kan bara döljas via hiddenExerciseIds, aldrig raderas permanent. Medvetet, för att standardbiblioteket ska vara konsekvent mellan synk-koder.

Musik i biblioteket kan tas bort permanent via removedMusicUrls, till skillnad från övningar.

Synk-koder är helt isolerade rum, ingen delning mellan koder alls, varken bibliotek eller program. Diskuterat men inte byggt: ett separat delat bibliotekslager ovanpå personliga program.

Deploy sker automatiskt via Vercel vid varje push till main.

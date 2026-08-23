# Round – Träningsrundan

Next.js (App Router) intervallträningsapp. Övningsbibliotek, rundor, timer,
återanvändbart musikbibliotek och röstmeddelanden. Ingen databas – all data
(övningar, rundor, musik, röstinställningar) synkas via en enkel synk-kod
mot Vercel Blob (`sync/{KOD}/state.json`), och sparas som backup i
localStorage. Ljudfiler (egna inspelningar, uppladdad musik, TTS-cache)
lagras också i Vercel Blob under `sync/{KOD}/...` respektive `tts/{KOD}/...`.

Live: https://round-dun.vercel.app
Repo: github.com/j74risberg-web/round

## Arkitektur i korthet

- `app/page.tsx` – hela klient-appen (en enda stor komponent, mycket kod är
  medvetet formaterad på en rad per funktion – det är inte av misstag).
  - `middleware.ts` + `app/pin/page.tsx` + `app/api/gate/route.ts` – PIN-spärr
    (kod satt via `ROUND_PIN` env-var) för hela sajten.
    - `app/api/state/route.ts` – GET/POST synk-state mot Vercel Blob.
    - `app/api/upload/route.ts` – laddar upp musik/röstinspelningar till Blob.
    - `app/api/tts/route.ts` – text-till-tal via OpenAI (`OPENAI_API_KEY`),
      modell `tts-1-hd`, röst `nova`. Cachar resultat i Blob per
        (synk-kod + sha256-hash av texten), så samma fras kostar bara en gång.

        ## Röstsystemet (senaste och känsligaste delen)

        Appen använde tidigare webbläsarens inbyggda `speechSynthesis` – funkade
        alltid, men lät robotaktigt. Bytt till OpenAI TTS via `/api/tts`.

        Nyckelfunktioner i `app/page.tsx`:
        - `speakCloud(text, onEnd)` – hämtar/cachar ljud-URL, spelar upp via ett
          **enda, sidlivslångt `<audio>`-element** som skapas i en `useEffect` med
            `document.createElement("audio")` (INTE som JSX) och sparas i
              `announcementRef`. Detta är medvetet: elementet får aldrig monteras om,
                annars tappar iOS Safari sin autoplay-"upplåsning" mitt i passet.
                - `beginDuck(level)` / `activeDucksRef` – delad "duck-hanterare" för
                  bakgrundsmusiken. Både pling/gong (`duckForSignal`) och röstmeddelanden
                    (`playAnnouncement`) sänker musikvolymen via samma mekanism, så att en
                      kort signals duckning inte råkar återställa volymen mitt i ett längre
                        röstmeddelande. Musikens "sanna" volym sparas i `musicBaseVolumeRef` och
                          återställs bara när ALLA aktiva duckningar är klara.
                          - `announcementTokenRef` – varje anrop till `playAnnouncement` ökar en
                            räknare (`myToken`). `isCurrent()` jämför mot aktuellt värde. Detta ska
                              förhindra att ett äldre, fortfarande pågående röstmeddelande krockar med
                                ett nytt.

                                ## KÄND OLÖST BUGG (viktigast att fixa)

                                **Symptom:** Ibland läses fel text upp, eller ord "trycks ihop"/rusas,
                                speciellt mellan vissa övningar. Detta upprepades trots flera fixförsök.

                                **Trolig grundorsak (inte helt verifierad, men stark hypotes):**
                                `speakCloud()`s `isCurrent()`-skydd kollar bara VID ANROPET, inte när det
                                asynkrona nätverkssvaret faktiskt kommer tillbaka:

                                ```js
                                fetch(`/api/tts?...`).then(res => res.json()).then(data => {
                                  ttsCacheRef.current.set(trimmed, data.url);
                                    play(data.url); // <-- ingen koll här om detta fortfarande är aktuellt!
                                    });
                                    ```

                                    Om övning A:s hämtning tar längre tid än övning B:s (som hann starta
                                    senare men svara snabbare, t.ex. redan cachad), kan A:s fördröjda svar
                                    komma tillbaka EFTER B redan börjat spela, och skriva över samma delade
                                    `<audio>`-element (`announcementRef.current`) mitt i uppspelningen av B.
                                    Det matchar exakt de rapporterade symptomen.

                                    **Föreslagen fix:** Låt `speakCloud` ta emot (eller stänga över) samma
                                    `isCurrent()`-check som `playAnnouncement` använder, och kolla den INNE I
                                    `.then()`-callbacken innan `play(data.url)` anropas – inte bara i
                                    `speak()`-wrappern som anropar `speakCloud`. Just nu skyddar `isCurrent()`
                                    bara startpunkten, inte när nätverkssvaret faktiskt används.

                                    ## Redan provat och INTE fungerade (undvik att upprepa)

                                    - **Web Audio API (`AudioContext.decodeAudioData`) för att spela upp
                                      TTS-ljudet.** Gav `EncodingError: Unable to decode audio data` – OpenAIs
                                        mp3-output går tydligen inte att avkoda med webbläsarens Web Audio-
                                          avkodare, trots att vanlig `<audio src=...>`-uppspelning fungerar fint.
                                            Använd `<audio>`-element för TTS-uppspelning, aldrig `decodeAudioData`.

                                            ## Övrigt att veta

                                            - `mergeExerciseLibrary()`: de 15 standardövningarna kan bara döljas
                                              (`hiddenExerciseIds`), aldrig raderas permanent – medvetet, för att
                                                standardbiblioteket ska vara konsekvent mellan synk-koder.
                                                - Musik i biblioteket KAN tas bort permanent (`removedMusicUrls`), till
                                                  skillnad från övningar.
                                                  - Synk-koder är helt isolerade "rum" – ingen delning mellan koder alls,
                                                    varken bibliotek eller program. Diskuterat men inte byggt: ett separat
                                                      delat bibliotekslager ovanpå personliga program.
                                                      - Deploy sker automatiskt via Vercel vid varje push till `main`.
                                                      - Testa alltid på riktig iPhone (Safari, gärna som hemskärms-PWA) för
                                                        ljud-/autoplay-relaterade ändringar – skrivbordswebbläsare (inklusive
                                                          denna sandbox) beter sig ofta mer tillåtande och döljer buggar som bara
                                                            syns på iOS.
                                                            

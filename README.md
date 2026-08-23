# Träningsrundan (ROUND)

En Next.js-app för intervallträning med övningsbibliotek, rundor, timer, återanvändbart musikbibliotek
och röstmeddelanden. Övningar, rundor och musikbibliotek synkas via appens Vercel Blob-backend med synkkod och sparas även lokalt som säkerhetskopia. Uppladdade ljudfiler lagras i Vercel Blob.

## Utveckling

```bash
npm install
npm run dev
```

Öppna http://localhost:3000

## Bygg

```bash
npm run build
npm start
```

## Driftsättning på Vercel

Detta är en helt vanlig Next.js-app (App Router) utan några externa
beroenden (ingen databas, ingen serverfunktion utöver Next.js egna), så den
går att driftsätta direkt:

1. Skapa ett repo på GitHub och pusha upp koden.
2. Gå till https://vercel.com/new, importera repot.
3. Vercel känner automatiskt igen Next.js – inga extra inställningar behövs.
4. Klicka "Deploy".

Eller via CLI:

```bash
npm install -g vercel
vercel
```

## Ljud

`public/sounds/boxing-round-double.mp3` är ett redigerat utdrag av "Boxing
bell #1" av Joseph SARDIN (BigSoundBank, CC0). Se `public/sounds/LICENSE.txt`.


## Rundpaus
Mellan olika rundor används en automatisk rundpaus på 30 sekunder. Under rundpausen kan användaren välja **Starta nu**. De sista fem sekunderna räknas ned med standardrösten (om Röstmeddelanden är aktiverat), följt av pling när nästa runda startar.

## Ljud/TTS

Röstmeddelanden använder serverns TTS-endpoint och cachas både på serversidan och i webbläsaren. Appen förhämtar fraser för passet, spelar tal sekventiellt i en ljudkö och sänker musiken under hela röstmeddelandet. Om TTS-ljud inte kan hämtas används webbläsarens svenska speech synthesis som fallback. `OPENAI_API_KEY` ska finnas som servermiljövariabel vid deploy och ska inte läggas i repot.

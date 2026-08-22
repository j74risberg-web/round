# Träningsrundan (ROUND)

En Next.js-app för intervallträning med egna övningar, rundor, timer, musik
och röstmeddelanden. All data (övningar, rundor, egen musik, egna
röstinspelningar) sparas lokalt i webbläsaren (`localStorage` + `IndexedDB`) –
appen har ingen backend eller databas.

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

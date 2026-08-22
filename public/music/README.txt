Lägg fasta musikfiler i den här mappen.

Stödda format: .mp3, .m4a, .wav, .aac, .ogg

Vid npm run dev eller npm run build skapas public/music/library.json automatiskt.
Låtarna visas därefter i Musikbiblioteket och följer med i GitHub, Vercel och ZIP-filer.

Exempel:
  public/music/eye-of-the-tiger.mp3
  public/music/traning-01.mp3

Obs: Musik som laddas upp via appens knapp "Lägg till låt" sparas fortfarande i Vercel Blob.
För att en låt ska bli permanent i projektet måste själva ljudfilen läggas i public/music/ före deploy/ZIP.

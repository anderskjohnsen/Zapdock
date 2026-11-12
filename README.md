# Zapdock ⚡

Zapdock er en ny oppgavelinje for Windows 10 og 11, inspirert av Lumabar. Den inneholder moduler og små widgets. Klikk på en modul for å åpne et panel over linja, eller **dra den ut av docken**, så blir den et eget vindu som alltid ligger øverst.

## Moduler

| Modul | I docken | I panelet |
|---|---|---|
| **Claude Code** | En «pille» per aktiv økt. Grønn betyr at økten jobber. Når en økt **trenger svar**, får pillen farge som **gradvis blir mørkere** jo lenger den venter: lys gul, så oransje, rust og til slutt mørk vinrød. Klikk på pillen for å hoppe til terminalen. | Alle økter med tittel, status og ventetid, bruk i 5-timersblokken, tid til nullstilling, tokens per minutt og graf for 7 dager. Du får et Windows-varsel når Claude er ferdig eller venter på tillatelse. |
| **Spotify** | Albumbilde, låt og artist, med forrige, pause og neste | Stort albumbilde, fremdriftslinje, kontroller og volum. Fungerer også med andre spillere som Chrome, Edge og VLC. |
| **YouTube** / **Stremio** | Grønn prikk når noe spilles. Midtklikk gir pause. | Innebygd nettleser med egen innlogging. Som løsnet vindu fungerer det som bilde-i-bilde. |
| **World of Warcraft** | – | **Live bilde av spillet** når du Alt+Tabber ut. Klikk for å hoppe tilbake. |
| **Kalender** | Neste avtale («Fotball Emma · om 25 min») | Avtaler for i dag, i morgen og de neste dagene, med påminnelse 15 minutter før. Bruker Google Kalender via iCal-lenke. |
| **Vær** | ⛅ 7° | Været nå, de neste 12 timene og de neste 7 dagene, fra yr.no (MET). Standard sted er Avaldsnes. |
| **Timer** | Nedtelling | Hurtigvalg fra 1 til 60 minutter, egne navn, pause og +1 min. Varsler når tiden er ute. |
| **Notater** | Antall åpne punkter | Huskeliste og fritekstnotater som lagres automatisk |
| **Utklippstavle** | – | De siste 40 tingene du har kopiert, med søk. Du kan feste ting du bruker ofte. |
| **System** | CPU- og RAM-måler | CPU-graf, minne, disker og batteri |

Du kan også legge til **egne nettsidemoduler** fra innstillingene. Ferdige valg finnes for YouTube Music, Twitch, Discord, Claude.ai, ChatGPT, Gmail, Google Kalender, Spond, Wowhead og Raider.IO. Du kan også legge inn hvilken som helst URL, for eksempel Visma Flyt. **Live forhåndsvisning** kan legges til for hvilket som helst spill eller program, basert på exe-navnet.

Docken har ellers startknapp, festede programmer og åpne vinduer gruppert per program. Klikk aktiverer eller minimerer, og høyreklikk lukker. Volum justeres med scrollhjulet, klikk demper, og høyreklikk åpner hurtiginnstillinger. Klokka åpner varslingssenteret, og helt til høyre er «vis skrivebord».

## Installer

**Ferdig bygget:** åpne fanen *Actions* i GitHub-repoet, velg siste kjøring av «Bygg og test (Windows)» og last ned **Zapdock-windows**. Du får to filer:
- `Zapdock Setup 1.0.0.exe`, en installasjonsfil som lager snarvei
- `Zapdock-1.0.0-portable.exe`, som kjører uten installasjon

**Fra kildekode:**

```powershell
npm install
npm start          # kjør
npm run dist       # bygg .exe-filer i dist/
npm test           # tester
```

## Bruk

- **Åpne en modul:** klikk på ikonet eller widgeten. Esc eller et klikk utenfor lukker panelet.
- **Løsne en modul:** dra ikonet opp fra docken. Panelet følger musa og blir et vindu som alltid ligger øverst. Du kan også dra i tittellinja eller trykke ⧉.
- **Feste den igjen:** dra vinduet ned på docken, eller trykk ⤓.
- **Innstillinger:** tannhjulet i docken, eller høyreklikk på tomt felt.
- **Nødbryter:** `Ctrl+Alt+Shift+Z` viser eller skjuler Windows sin egen oppgavelinje. Den kommer alltid tilbake når Zapdock avsluttes.

### Claude Code

Modulen leser Claude Code sine lokale logger i `%USERPROFILE%\.claude\projects`. Den trenger ingen innlogging eller API-nøkkel. Statusene er:

- 🟢 **jobber:** Claude skriver, tenker eller kjører verktøy.
- 🟡→🟤 **venter på svar:** Claude er ferdig og venter på deg. Fargen blir mørkere over 20 minutter, og du kan justere tiden.
- 🟡→🟤 **venter på tillatelse?:** et verktøykall har stått uten resultat i over 30 sekunder, og Claude venter trolig på at du godkjenner noe.

Klikk på en økt for å hoppe til terminalvinduet. Med × kan du skjule en ventende økt til neste gang den trenger svar. Bruker du Claude Code i **WSL**, legger du til `\\wsl$\Ubuntu\home\<bruker>\.claude` under Innstillinger → Claude Code → Ekstra mapper.

### Spotify

Modulen henter «spilles nå» fra Windows sine mediekontroller, så den fungerer med Spotify-appen uten innlogging. Spotify kan ikke kjøres *inne i* docken, fordi nettspilleren krever DRM.

### WoW-forhåndsvisning

Forhåndsvisningen bruker samme teknikk som Windows sine miniatyrer på oppgavelinja. Den bruker nesten ingen ressurser, og den rører ikke spillet.
- Sett WoW til **Windowed (Fullscreen)**.
- Bruk **Alt+Tab**, ikke minimer. Windows tegner ikke minimerte vinduer.

### Kalender

Google Kalender: gå til ⚙ Innstillinger, velg kalenderen, kopier **«Hemmelig adresse i iCal-format»** og lim den inn under Zapdock → Innstillinger → Kalender. Du kan legge inn flere kalendere, med hver sin farge.

### Stremio

Stremio kjører via `web.stremio.com`. For torrent-strømmer må Stremio for Windows være installert, fordi strømmeserveren følger med den.

## Personvern

All data blir på maskinen. Zapdock henter bare værvarsel fra api.met.no og de kalenderlenkene du selv legger inn. Historikken for utklippstavla lagres bare i minnet, med unntak av ting du har festet.

## Filer

`%APPDATA%\Zapdock\` inneholder `config.json` (innstillinger), `state.json` (vindusposisjoner, timere og festede utklipp) og `notes.json`.

## Arkitektur

```
src/main/
  main.js              docken (Windows-appbar), panelvinduer, forhåndsvisning, IPC
  win32.js             Win32 via koffi: appbar, vindusliste, oppgavelinje, DWM-miniatyrer
  claudeUsage.js       inkrementell lesing av Claude Code-logger, økter og 5-timersblokker
  providers/*.js       datatjeneste per modul (claude, media, kalender, vær, …)
  services/winhelper.js + helpers/winhelper.ps1
                       PowerShell-hjelper for «spilles nå» (WinRT) og volum (Core Audio)
  lib/ics.js           iCal-parser med gjentakelser, unntak og tidssoner
src/renderer/
  dock.*               linja med widgets
  panel.* + modules/   panelene
  settings.*           innstillingsvinduet
```

CI (`.github/workflows/build.yml`) kjører på Windows. Den kjører testene, syntakssjekker PowerShell-skriptet, røyktester Win32-bindingene og hjelpeprosessen, og bygger `.exe`-filene.

## Kjente begrensninger

- Systemstatusfeltet med nettverk og Bluetooth er ikke erstattet. Høyreklikk på volum åpner Windows sine hurtiginnstillinger.
- Docken vises bare på hovedskjermen.

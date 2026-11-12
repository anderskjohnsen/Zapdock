# Zapdock

En erstatning for oppgavelinjen i Windows, inspirert av Lumabar. Docken har moduler som åpnes som paneler over linja. Hvert panel kan **dras ut og bli et eget vindu som alltid ligger øverst**.

| Modul | Hva den gjør |
|---|---|
| **Claude Code** | Bruk i nåværende 5-timersblokk (tokens, tid til nullstilling, tokens/min, modeller), aktive økter (jobber, venter på deg, venter på tillatelse) og graf for de siste 7 dagene. Merket på ikonet viser hvor mange økter som jobber. |
| **YouTube** | Innebygd nettleser med egen innlogging. Midtklikk på ikonet gir spill av/pause, og en grønn prikk viser at noe spilles. |
| **Stremio** | Samme funksjoner som YouTube, via `web.stremio.com`. |
| **World of Warcraft** | Live forhåndsvisning av spillet når du har tabbet ut med Alt+Tab. Den forsvinner når WoW er i fokus igjen. Klikk i den for å hoppe tilbake til spillet. |

Docken har ellers startknapp, festede programmer, åpne vinduer med ikoner (klikk for å aktivere eller minimere, høyreklikk for å lukke), klokke og «vis skrivebord».

## Kom i gang

```powershell
npm install
npm start          # kjør i utviklingsmodus
npm run dist       # bygg installasjonsfil + portable .exe i dist/
npm run check      # syntakssjekk + tester for Claude-bruk
```

Krever Windows 10/11 og Node 20+.

## Slik bruker du den

- **Åpne en modul:** klikk på ikonet i docken. Panelet lukkes når du klikker et annet sted.
- **Løsne en modul:** dra ikonet opp fra docken. Panelet følger musa og blir et eget vindu som alltid ligger øverst. Du kan også dra i panelets tittellinje eller trykke ⧉.
- **Feste den igjen:** dra vinduet ned på docken, eller trykk ⤓.
- **Videovindu som løsnet vindu:** tittellinja er skjult til du holder musa over, så det fungerer som bilde-i-bilde.
- **Høyreklikk** på et modulikon gir en meny med løsne/feste, last inn på nytt og autovisning for WoW. Høyreklikk på tomt felt i docken gir innstillinger, «Start med Windows» og «Avslutt».
- **Nødbryter:** `Ctrl+Alt+Shift+Z` viser eller skjuler Windows sin egen oppgavelinje.

### WoW-forhåndsvisningen

Forhåndsvisningen bruker samme teknikk som Windows sine miniatyrer på oppgavelinjen (DWM-miniatyr). Den bruker derfor nesten ingen ressurser, og den rører ikke spillet. Ting å vite:

- Sett WoW til **Windowed (Fullscreen)** eller **Windowed**. Ekte fullskjerm minimeres når du tabber ut.
- Bruk **Alt+Tab**, ikke minimer. Windows tegner ikke minimerte vinduer, og da står det en melding i panelet i stedet.
- Spillet gjenkjennes på `Wow.exe`, `WowClassic.exe` og lignende, eller på vindustittelen. Du kan endre dette under `modules[].match` i config.json. Det samme oppsettet fungerer for andre spill og programmer.

### Claude Code-bruk

Modulen leser Claude Code sine lokale logger i `%USERPROFILE%\.claude\projects`. Den trenger ingen innlogging eller API-nøkkel. Bruker du Claude Code i **WSL**, legger du til WSL-mappen:

```json
"claude": { "dirs": ["\\\\wsl$\\Ubuntu\\home\\anders\\.claude"], "blockTokenLimit": 0 }
```

Setter du `blockTokenLimit` til et antall tokens, viser panelet en fremdriftslinje mot den grensen for 5-timersblokken.

### Stremio

`web.stremio.com` kjører inne i docken. For å strømme torrent-baserte kilder trengs Stremio sin strømmeserver. Den følger med når Stremio for Windows er installert, og kjører i bakgrunnen på `127.0.0.1:11470`.

## Innstillinger

`%APPDATA%\Zapdock\config.json` lages første gang du starter appen. Du åpner den fra høyreklikkmenyen.

```jsonc
{
  "bar": { "height": 48, "edge": "bottom", "hideWindowsTaskbar": true, "showWindowTitles": false },
  "pinned": [{ "name": "Battle.net", "path": "C:\\Program Files (x86)\\Battle.net\\Battle.net Launcher.exe" }],
  "modules": [ /* claude, youtube, stremio, wow – legg til flere web-moduler med type "web" og url */ ],
  "claude": { "dirs": [], "blockTokenLimit": 0, "activeMinutes": 15, "refreshSeconds": 10 }
}
```

Plassering og størrelse på løsnede vinduer lagres i `state.json` i samme mappe.

## Arkitektur

- `src/main/main.js` styrer appen: docken (registrert som Windows-appbar, så maksimerte vinduer ikke legger seg under den), panelvinduer, polling og IPC.
- `src/main/win32.js` inneholder Win32-bindinger via [koffi](https://koffi.dev): appbar, vindusliste, skjuling av Windows-oppgavelinjen og DWM-miniatyrer.
- `src/main/claudeUsage.js` leser JSONL-loggene inkrementelt og regner ut 5-timersblokker, økter og dager.
- `src/renderer/` inneholder docken (`dock.*`) og panelene (`panel.*` + `modules/`).

Windows-oppgavelinjen blir alltid satt tilbake når Zapdock avsluttes, også ved feil.

## Kjente begrensninger

- Systemstatusfeltet (klokkeikoner for nettverk, lyd og lignende) er ikke erstattet ennå. Klokka åpner varslingssenteret med Win+N.
- Docken vises bare på hovedskjermen.
- Vinduene vises enkeltvis og grupperes ikke per program.

# Žebírka na čas

Řež rychle. Prsty si nech.

Webová hra (canvas + vanilla JS v ES modulech, bez závislostí a bez build kroku) ve stylu starého řeznictví: bílé kachličky, řeznická červená, mátová a papír od masa. Na prkně leží plát žeber a hráč ho má co nejrychleji rozřezat mezi kostmi na jednotlivá žebírka. Druhá ruka plát drží a průběžně ho přehmátává, takže je potřeba hlídat, kde má zrovna prsty.

## Spuštění a nasazení

Repozitář je rovnou statický build. Stačí nahrát soubory na libovolný statický hosting (GitHub Pages, Netlify, S3, nginx), server nic nepočítá. Lokálně je kvůli ES modulům potřeba jakýkoli statický server (přes `file://` je prohlížeč zablokuje):

```sh
python3 -m http.server 8080
# http://localhost:8080
```

## PWA

- **Instalace:** v Chrome a Edge se na úvodní obrazovce objeví tlačítko „Nainstalovat hru“. Na iPhonu se instaluje přes Sdílet → Přidat na plochu (hra na to upozorní). Po instalaci běží na celou obrazovku.
- **Offline:** `sw.js` při první návštěvě uloží celou hru včetně fontu a ikon a pak ji servíruje z cache s obnovou na pozadí (stale-while-revalidate).
- **Aktualizace:** při změně `sw.js` (zvyš `VERSION`) se hráči ukáže lišta „Je k dispozici nová verze“ s tlačítkem Obnovit.
- **Manifest:** `manifest.webmanifest` s ikonami 192 a 512 px (běžné i maskable) a screenshoty pro instalační dialog, `orientation: any`.
- **Fonty:** Alfa Slab One a Rubik (SIL OFL 1.1, `fonts/OFL-*.txt`) jsou hostované lokálně, žádné požadavky na cizí servery.
- **Telefon:** obrazovka během hry nezhasne (Screen Wake Lock) a HUD respektuje výřez displeje (`safe-area-inset`).

Při přidání nového souboru ho doplň do seznamu `SHELL` v `sw.js`.

## Ovládání

- **Myš:** drž tlačítko a táhni nožem přes celý plát (shora dolů nebo zdola nahoru) v mezeře mezi kostmi.
- **Dotyk:** totéž prstem. Na výšku se prkno otočí, takže plát vede shora dolů a řeže se vodorovným tahem.
- Tah se počítá, až když přejde přes celý plát, takže klikatým pohybem tam a zpátky nakrájíš víc žebírek bez zvednutí prstu.
- P nebo Esc: pauza (hra se zastaví i při přepnutí záložky), M: zvuk.

## Pravidla

- Pět plátů (6, 7, 8, 8 a 9 kostí), měří se celkový čas. Přesuny mezi pláty se do času nepočítají.
- Řez přes kost: nůž se na chvíli zasekne a připočte se 1 s.
- Řez do ruky (prst, palec, dlaň i rukáv): +5 s a náplast. Po třetí náplasti hra končí („pohotovost“) a čas se nezapisuje.
- Ruka se s každým plátem hýbe víc: na prvním drží na místě, pak po každém řezu přehmátne, od třetího se pohupuje, od čtvrtého škube prsty a přehmátává i sama od sebe. Vždy ale nechá aspoň jednu mezeru volnou.
- Pět nejlepších časů se jménem se ukládá do localStorage (jen v tomto prohlížeči).

## Struktura

- `index.html`, `style.css`: kostra a styly
- `src/main.js`: bootstrap, vstup (včetně coalesced pointer events, aby rychlý tah nepřeskočil prst ani kost), obrazovky, pauza, PWA
- `src/game.js`: herní logika bez DOM (plát, řezy, ruka, čas, tresty)
- `src/render.js`: kreslení scény a HUD. Hraje se na pevném prkně 1100×700 jednotek, které se vejde do okna a na výšku se otočí o 90°, takže časy jsou srovnatelné na každé obrazovce.
- `src/audio.js`: syntetizované zvuky (WebAudio, bez souborů)
- `src/scores.js`: lokální tabulka top 5
- `tools/sim.mjs`: boti hrají přímo nad herní logikou (`node tools/sim.mjs 40`), slouží k vyvážení a ke kontrole, že se ruka nikdy nezasekne nad posledními mezerami
- `tools/assets.cjs`, `tools/icon.html`: vygenerují ikony a screenshoty přes Playwright (`NODE_PATH=…/node_modules node tools/assets.cjs`)

Respektuje `prefers-reduced-motion` (bez otřesů obrazovky a vibrací). Na telefonech s podporou vibruje při řezu do kosti a do prstu.

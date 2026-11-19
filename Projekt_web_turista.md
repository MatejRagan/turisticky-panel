{\rtf1\ansi\ansicpg1250\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # PROJECT_SPEC \'97 Slovensk\'fd turistick\'fd web (\'84Rozhodovac\'ed panel pred t\'farou\'93)\
\
> \'da\uc0\u269 el dokumentu: Kompletn\'e1 technick\'e1 a produktov\'e1 \'9apecifik\'e1cia pre v\'fdvoj MVP verzie projektu. S\'fabor je \'9atrukt\'farovan\'fd tak, aby sl\'fa\'9eil ako priamy kontext pre AI n\'e1stroje (Claude, Gemini Pro, GitHub Copilot) aj ako z\'e1kladn\'e1 dokument\'e1cia v koreni GitHub repozit\'e1ra.\
\
---\
\
## 1. Kontext, v\'edzia a cie\uc0\u318  produktu\
\
* Typ produktu: D\'e1tov\'fd agreg\'e1tor a rozhodovac\'ed n\'e1stroj pred t\'farou (Pre-hike Dashboard / \'84Waze pre turistov\'93). Nejde o \uc0\u271 al\'9aiu soci\'e1lnu sie\u357  ani fotogal\'e9riu.\
* Hlavn\'fd cie\uc0\u318 : Pom\'f4c\u357  turistovi na Slovensku do 5 sek\'fand rozhodn\'fa\u357  sa, \u269 i a s akou v\'fdbavou \'eds\u357  na konkr\'e9tny vrch.\
* Rozsah MVP: 20 \'96 30 najfrekventovanej\'9a\'edch vrchov (Vysok\'e9 Tatry, N\'edzke Tatry, Mal\'e1 Fatra, Ve\uc0\u318 k\'e1 Fatra), prim\'e1rny fokus na prechodn\'e9 a zimn\'e9 obdobie (okt\'f3ber \'96 m\'e1j).\
* Rozpo\uc0\u269 et: Striktne 0 \'80 (v\'fdhradne free-tier slu\'9eby, open-source kni\'9enice, OpenStreetMap, bezplatn\'e9 meteo API).\
* Aktu\'e1lna priorita: Najprv stabiln\'e1 architekt\'fara, d\'e1tov\'e9 toky, v\'fdpo\uc0\u269 ty a funk\u269 n\'e9 jadro na GitHub Pages. Vizu\'e1lny dizajn a fin\'e1lne mobiln\'e9 UI/UX sa rie\'9aia a\'9e po overen\'ed funk\u269 nosti.\
\
### Konkurencia a diera na trhu\
- Mapy.cz: Siln\'e9 mapov\'e9 podklady | Slabina: Fotky s\'fa \'84pekn\'e9 spomienky\'93, nie preh\uc0\u318 adn\'fd aktu\'e1lny stav ter\'e9nu.\
- Facebook skupiny: Re\'e1lne hl\'e1senia z ter\'e9nu | Slabina: Nepreh\uc0\u318 adn\'e9, pr\'edspevky po 2 d\u328 och zapadn\'fa v \'9aume.\
- Hiking.sk: Obsah a trad\'edcia | Slabina: Zastaran\'e9 rozhranie, zl\'e1 pou\'9eite\uc0\u318 nos\u357  na mobile.\
- Windy / Meteoblue / SHM\'da: Presn\'e9 meteorologick\'e9 d\'e1ta | Slabina: Pre be\'9en\'e9ho turistu zlo\'9eit\'e9 na \uc0\u269 \'edtanie (najm\'e4 v\'fd\'9akov\'e9 profily a inverzia).\
\
* Na\'9aa v\'fdhoda: Spojenie presn\'e9ho po\uc0\u269 asia pre nadmorsk\'fa v\'fd\'9aku vrchu, zrozumite\u318 n\'e9ho verdiktu o inverzii a \u269 erstv\'fdch fotiek ter\'e9nu na jednej karte vrchu.\
\
---\
\
## 2. Architekt\'fara syst\'e9mu (JAMstack)\
\
Web be\'9e\'ed ako statick\'e1 aplik\'e1cia na GitHub Pages (<nick>.github.io/<repo>). Ke\uc0\u271 \'9ee GitHub Pages nevie sp\'fa\'9a\u357 a\u357  backend a meteo API (najm\'e4 MET Norway) vy\'9eaduj\'fa serverov\'fa hlavi\u269 ku User-Agent, zber a prepo\u269 et d\'e1t be\'9e\'ed automaticky na pozad\'ed cez GitHub Actions a hotov\'e9 v\'fdsledky sa ukladaj\'fa do Supabase.\
\
```text\
                       [ EXTERN\'c9 ZDROJE ]\
             Open-Meteo API   |   MET Norway API\
                    \\         |         /\
                     v        v        v\
          +---------------------------------------+\
          |   GitHub Actions (Cron ka\'9ed\'e9 2 hod)   |\
          |  - stiahne meteo pre 20-30 vrchov     |\
          |  - vypo\uc0\u269 \'edta inverziu a zhodu modelov  |\
          +-------------------+-------------------+\
                              | (z\'e1pis cez Service Role Key)\
                              v\
          +---------------------------------------+\
          |          Supabase (Free Tier)         |\
          |  - PostgreSQL DB (vrchy, po\uc0\u269 asie,     |\
          |    uz\'e1very, fotky, webkamery)         |\
          |  - Storage (WebP fotky, limit 1 GB)   |\
          +-------------------+-------------------+\
                              ^\
                              | (\uc0\u269 \'edtanie d\'e1t + upload cez Anon Key)\
                              v\
          +---------------------------------------+\
          |    Frontend na GitHub Pages (Vite)    |\
          |  - React + TypeScript (strict)        |\
          |  - Leaflet mapa (OpenStreetMap)       |\
          |  - SunCalc (v\'fdpo\uc0\u269 et svetla bez API)   |\
          |  - exifr (GPS/d\'e1tum + WebP kompresia) |\
          +---------------------------------------+\
```\
\
### Pre\uc0\u269 o t\'e1to architekt\'fara\
1. R\'fdchlos\uc0\u357  do 5 sek\'fand: Pou\'9e\'edvate\u318  ne\u269 ak\'e1 na odpovede extern\'fdch meteo serverov ani na prepo\u269 ty tlakov\'fdch hlad\'edn \'96 na\u269 \'edta hotov\'fd z\'e1znam z DB.\
2. Ochrana pred limitmi API: Bez oh\uc0\u318 adu na po\u269 et n\'e1v\'9atevn\'edkov webu dostan\'fa extern\'e9 API len jeden dopyt za 2 hodiny.\
3. Pripravenos\uc0\u357  na \'9ak\'e1lovanie: Supabase m\'e1 zabudovan\'fa autentifik\'e1ciu (bud\'faci turistick\'fd denn\'edk) aj Edge Functions (bud\'face e-mailov\'e9 alarmy).\
\
---\
\
## 3. Technologick\'fd stack, prostredie a pr\'e1ca s AI\
\
### V\'fdvojov\'e9 prostredie a n\'e1stroje\
- IDE & Runtime: Visual Studio Code + Node.js (LTS) \'97 lok\'e1lny v\'fdvoj, termin\'e1l, integrovan\'fd Copilot (0 \'80)\
- Verzovanie & Z\'e1lohy: Git + GitHub \'97 vetva main (produkcia/Pages), vetva dev (v\'fdvoj) (0 \'80)\
- Jazyk & Framework: TypeScript (strict) + React + Vite \'97 jednotn\'fd jazyk pre frontend aj Node.js skripty (0 \'80)\
- Datab\'e1za & Storage: Supabase (PostgreSQL + Storage) \'97 rela\uc0\u269 n\'e9 d\'e1ta, RLS pr\'e1va, ukladanie WebP fotiek (0 \'80)\
- CI/CD & Cron: GitHub Actions \'97 automatick\'fd deploy webu + pravideln\'fd zber po\uc0\u269 asia (0 \'80)\
- Klientske kni\'9enice: leaflet, suncalc, exifr, @supabase/supabase-js \'97 open-source, bez platen\'fdch API k\uc0\u318 \'fa\u269 ov (0 \'80)\
\
### Rozdelenie \'faloh medzi AI n\'e1strojmi\
* Gemini Pro (Architekt a analytik): N\'e1vrh d\'e1tov\'fdch modelov, meteorologick\'e9 vzorce (inverzia z tlakov\'fdch hlad\'edn), kontrola dokument\'e1cie API, rev\'edzia \'9atrukt\'fary.\
* Claude (Hlavn\'fd program\'e1tor): Generovanie komplexn\'fdch modulov (inverzn\'fd algoritmus, SQL sch\'e9ma, GitHub Actions skripty, refaktoring).\
* GitHub Copilot (Asistent vo VS Code): Dop\uc0\u314 \u328 anie k\'f3du, oprava TypeScript typov, vysvet\u318 ovanie ch\'fdb v termin\'e1li.\
\
---\
\
## 4. \'8atrukt\'fara repozit\'e1ra\
\
```text\
turisticky-panel/\
\uc0\u9500 \u9472 \u9472  .github/\
\uc0\u9474    \u9492 \u9472 \u9472  workflows/\
\uc0\u9474        \u9500 \u9472 \u9472  deploy.yml              # Build a deploy na GitHub Pages pri push do main\
\uc0\u9474        \u9492 \u9472 \u9472  fetch-weather.yml       # Cron job (ka\'9ed\'e9 2 hodiny) pre zber po\u269 asia\
\uc0\u9500 \u9472 \u9472  scripts/\
\uc0\u9474    \u9500 \u9472 \u9472  fetchWeather.ts             # S\u357 ahovanie Open-Meteo & MET Norway, z\'e1pis do DB\
\uc0\u9474    \u9500 \u9472 \u9472  inversionEngine.ts          # \u268 ist\'e1 logika: v\'fdpo\u269 et inverzie + index zhody\
\uc0\u9474    \u9492 \u9472 \u9472  seedPeaks.ts                # Jednorazov\'fd import peaks-seed.json do Supabase\
\uc0\u9500 \u9472 \u9472  supabase/\
\uc0\u9474    \u9492 \u9472 \u9472  schema.sql                  # Kompletn\'e1 z\'e1loha SQL sch\'e9my, indexov a RLS pravidiel\
\uc0\u9500 \u9472 \u9472  src/\
\uc0\u9474    \u9500 \u9472 \u9472  data/\
\uc0\u9474    \u9474    \u9492 \u9472 \u9472  peaks-seed.json         # Dataset 20\'9630 vrchov (GPS, v\'fd\'9aky, uz\'e1very, \u269 asy)\
\uc0\u9474    \u9500 \u9472 \u9472  services/\
\uc0\u9474    \u9474    \u9500 \u9472 \u9472  supabaseClient.ts       # Inicializ\'e1cia Supabase klienta\
\uc0\u9474    \u9474    \u9500 \u9472 \u9472  sunService.ts           # V\'fdpo\u269 et z\'e1padu slnka + \u269 as \'9atartu bez \u269 elovky\
\uc0\u9474    \u9474    \u9492 \u9472 \u9472  photoService.ts         # EXIF extrakcia, Haversine priradenie, WebP kompresia\
\uc0\u9474    \u9500 \u9472 \u9472  components/                 # Funk\u269 n\'e9 komponenty (dizajn a\'9e v neskor\'9aej f\'e1ze)\
\uc0\u9474    \u9474    \u9500 \u9472 \u9472  PeakMap.tsx             # Leaflet mapa so semaforom \u269 erstvosti\
\uc0\u9474    \u9474    \u9500 \u9472 \u9472  FilterBar.tsx           # Obr\'e1ten\'e9 vyh\u318 ad\'e1vanie / filtre nad mapou\
\uc0\u9474    \u9474    \u9500 \u9472 \u9472  PeakDetailPanel.tsx     # Karta vrchu (po\u269 asie, inverzia, fotky, uz\'e1vera)\
\uc0\u9474    \u9474    \u9492 \u9472 \u9472  PhotoUploadForm.tsx     # Upload bez registr\'e1cie + klikate\u318 n\'e9 tagy\
\uc0\u9474    \u9492 \u9472 \u9472  types/\
\uc0\u9474        \u9492 \u9472 \u9472  index.ts                # Zdie\u318 an\'e9 TypeScript rozhrania\
\uc0\u9500 \u9472 \u9472  .env.example                    # Vzor premenn\'fdch prostredia (.env je v .gitignore!)\
\uc0\u9500 \u9472 \u9472  PROJECT_SPEC.md                 # Projektov\'e1 \'9apecifik\'e1cia\
\uc0\u9492 \u9472 \u9472  package.json\
```\
\
---\
\
## 5. Datab\'e1zov\'fd model (Supabase PostgreSQL)\
\
### Tabu\uc0\u318 ka 1: peaks\
* id (text, PK \'96 napr. velky-rozsutec, krivan)\
* name (text, NOT NULL)\
* mountain_range (text, NOT NULL \'96 napr. Vysok\'e9 Tatry, Mal\'e1 Fatra)\
* lat (double precision), lon (double precision), elevation_m (integer \'96 presn\'e1 v\'fd\'9aka vrcholu)\
* start_name (text), start_lat (double precision), start_lon (double precision), start_elevation_m (integer \'96 v\'fdchodiskov\'fd bod v doline)\
* avg_ascent_minutes (integer \'96 priemern\'fd \uc0\u269 as v\'fdstupu pre v\'fdpo\u269 et \u269 elovky)\
* seasonal_closure_active (boolean), closure_start_mmdd (text, napr. '11-01'), closure_end_mmdd (text, napr. '05-31'), closure_note (text)\
\
### Tabu\uc0\u318 ka 2: weather_snapshots\
* id (uuid, PK)\
* peak_id (text, FK -> peaks.id)\
* fetched_at (timestamptz, NOT NULL)\
* temp_summit_c (real), windchill_summit_c (real), windchill_valley_c (real)\
* wind_kmh (real), precip_mm (real)\
* agreement_index (text \'96 'high' | 'medium' | 'low')\
* agreement_summary (text \'96 napr. \'84Vysok\'e1 istota \'96 modely sa zhoduj\'fa\'93)\
* inversion_status (text \'96 'above_clouds' | 'in_clouds' | 'below_clouds' | 'clear')\
* inversion_level_m (integer, nullable)\
* inversion_summary (text \'96 napr. \'84Inverzia \'96 v doline hmla, vrch nad oblakmi od 1 600 m\'93)\
* raw_models_json (jsonb \'96 detail oboch modelov pre rozba\uc0\u318 ovac\'ed blok)\
\
### Tabu\uc0\u318 ka 3: photo_reports\
* id (uuid, PK)\
* peak_id (text, FK -> peaks.id)\
* image_url (text, NOT NULL)\
* taken_at (timestamptz, NOT NULL \'96 re\'e1lny d\'e1tum z EXIF alebo \uc0\u269 as nahrania)\
* taken_month (smallint, 1 \'96 12 \'96 indexovan\'e9 pre r\'fdchly sez\'f3nny arch\'edv)\
* exif_verified (boolean, default false)\
* tags (text[] \'96 napr. ['sneh', 'lad', 'blato', 'nutne_macky', 'sucho', 'silny_vietor'])\
* is_flagged (boolean, default false)\
* created_at (timestamptz, default now())\
\
### Tabu\uc0\u318 ka 4: webcams\
* id (uuid, PK)\
* peak_id (text, FK -> peaks.id)\
* name (text), url (text)\
* elevation_m (integer), elevation_diff_m (integer)\
\
### Storage a bezpe\uc0\u269 nos\u357  (Row Level Security \'96 RLS)\
* Storage bucket: Verejn\'fd bucket terrain-photos s limitom ve\uc0\u318 kosti s\'faboru (max 2 MB) a povolen\'fdmi MIME typmi (image/webp, image/jpeg).\
* SELECT (\uc0\u269 \'edtanie): Povolen\'e9 verejne pre v\'9aetky 4 tabu\u318 ky (cez anon k\u318 \'fa\u269 ).\
* INSERT (nahr\'e1vanie fotiek): Povolen\'e9 verejne iba do photo_reports a bucketu terrain-photos.\
* Z\'e1pis po\uc0\u269 asia a vrchov: Zak\'e1zan\'e9 pre anon k\u318 \'fa\u269 ; povolen\'e9 v\'fdhradne cez service_role k\u318 \'fa\u269  v GitHub Actions (ulo\'9een\'fd v GitHub Secrets).\
\
---\
\
## 6. \'8apecifik\'e1cia k\uc0\u318 \'fa\u269 ov\'fdch funkci\'ed a dom\'e9novej logiky\
\
### A. Po\uc0\u269 asie priamo pre vrch + Index zhody modelov\
* Zdroje:\
  1. Open-Meteo API (modely ICON-D2 / ECMWF) s explicitn\'fdm parametrom elevation=<elevation_m> a tlakov\'fdmi hladinami.\
  2. MET Norway Locationforecast 2.0 (vy\'9eaduje vlastn\'fa HTTP hlavi\uc0\u269 ku User-Agent s n\'e1zvom projektu a kontaktom).\
* Zobrazenie: Namiesto dvoch paraleln\'fdch tabuliek vid\'ed turista jednu zjednoten\'fa predpove\uc0\u271  + Index zhody modelov (napr. rozdiel tepl\'f4t < 2 \'b0C a zhoda v zr\'e1\'9ekach -> Vysok\'e1 istota, v\'e4\u269 \'9a\'ed rozptyl -> Neist\'e9 po\u269 asie \'96 modely sa rozch\'e1dzaj\'fa). Surov\'e9 porovnanie oboch modelov je v rozba\u318 ovacom detaile.\
* Dolina vs. Vrch: V\'fdpo\uc0\u269 et a porovnanie pocitovej teploty (windchill) v bode \'9atartu a na vrchole + jednoduch\'e9 odpor\'fa\u269 anie v\'fdbavy.\
\
### B. Inverzia \'96 pod oblakmi, v nich alebo nad nimi (Hlavn\'fd diferenci\'e1tor)\
* Vstupy: Tlakov\'e9 hladiny z Open-Meteo (925 hPa \uc0\u8776  750 m, 850 hPa \u8776  1 450 m, 700 hPa \u8776  3 000 m), vertik\'e1lny profil teploty, relat\'edvnej vlhkosti a n\'edzkej/strednej obla\u269 nosti.\
* V\'fdstup: Jednoduch\'e1 ikona a \uc0\u318 udsk\'e1 veta (napr. \'84Inverzia \'96 v doline hmla, vrch nad oblakmi od 1 600 m\'93).\
\
### C. Vizu\'e1lny stav ter\'e9nu (Fotky, semafor a sez\'f3nny arch\'edv)\
* Semafor \uc0\u269 erstvosti na mape:\
  - Zelen\'e1: fotka star\'e1 0 \'96 3 dni\
  - Oran\'9eov\'e1: fotka star\'e1 4 \'96 7 dn\'ed\
  - Siv\'e1: fotka star\'9aia ako 7 dn\'ed alebo ch\'fdba\
* Sez\'f3nny arch\'edv (fallback): Ak ch\'fdba fotka nov\'9aia ako 14 dn\'ed, zobrazia sa fotky z rovnak\'e9ho kalend\'e1rneho mesiaca (taken_month) minul\'fdch rokov. Aby nevznikla falo\'9an\'e1 istota, arch\'edvna fotka sa zobraz\'ed \uc0\u269 iernobielo / s tlmen\'fdm filtrom + v\'fdrazn\'fd banner (\'84Ilustra\u269 n\'e9 z novembra 2025 \'96 aktu\'e1lna fotka ch\'fdba\'93).\
* Nahr\'e1vanie bez trenia (do 10 sek\'fand, bez registr\'e1cie):\
  - Kni\'9enica exifr priamo v prehliada\uc0\u269 i vy\u269 \'edta GPS (automaticky prirad\'ed najbli\'9e\'9a\'ed vrch cez Haversine vzdialenos\u357 ) a DateTimeOriginal (overenie re\'e1lneho d\'e1tumu pre offline fotenie a neskor\'9a\'ed upload na Wi-Fi).\
  - Kompresia priamo v prehliada\uc0\u269 i cez HTML5 Canvas (max. \'9a\'edrka 1200 px, form\'e1t WebP).\
  - R\'fdchle klikate\uc0\u318 n\'e9 tagy: sneh, \u318 ad, blato, nutn\'e9 ma\u269 ky, sucho, siln\'fd vietor.\
\
### D. Bezpe\uc0\u269 nos\u357 , svetlo v doline a filtre\
* Leg\'e1lnos\uc0\u357  a bezpe\u269 nos\u357 : Zobrazenie sez\'f3nnych uz\'e1ver chodn\'edkov z DB, v\'fdstrah HZS / lav\'ednov\'e9ho stup\u328 a a povinn\'fd pr\'e1vny disclaimer.\
* Svetlo a tma v doline (sunService.ts): Matematick\'fd v\'fdpo\uc0\u269 et v\'fdchodu/z\'e1padu slnka z GPS a d\'e1tumu cez suncalc (bez API). Zoh\u318 adnenie skor\'9aej tmy v lese/doline (rezerva 30 \'96 45 min) a \u269 asu v\'fdstupu/zostupu -> jeden konkr\'e9tny \'fadaj: \'84\'8atart bez \u269 elovky najnesk\'f4r o XX:XX\'93.\
* Obr\'e1ten\'e9 vyh\uc0\u318 ad\'e1vanie (filtre nad mapou): \'84Kde je dnes nad oblakmi?\'93, \'84Otvoren\'e9 v zime\'93, \'84\u268 erstv\'e1 fotka do 3 dn\'ed\'93.\
* Cold Start (u\'9eito\uc0\u269 nos\u357  od d\u328 a 0 aj bez fotiek): Automatick\'e9 meteo d\'e1ta, v\'fdpo\u269 et inverzie, priraden\'e9 najbli\'9e\'9aie webkamery (s uveden\'edm v\'fd\'9akov\'e9ho rozdielu oproti vrchu), nesk\'f4r pr\'edpadne satelitn\'e1 vrstva snehu (Copernicus Sentinel-2).\
\
---\
\
## 7. Pl\'e1n f\'e1zovania implement\'e1cie (MVP Roadmap)\
\
1. F\'e1za 1 \'96 Prostredie, kostra a CI/CD:\
   - Inicializ\'e1cia Vite + React + TypeScript (npm create vite@latest . -- --template react-ts).\
   - Nastavenie Git vetiev (main, dev), .gitignore (vr\'e1tane .env), vite.config.ts (base pre GitHub Pages) a .github/workflows/deploy.yml.\
2. F\'e1za 2 \'96 Datab\'e1za a seed d\'e1ta:\
   - Vytvorenie a spustenie supabase/schema.sql (4 tabu\uc0\u318 ky, indexy, Storage bucket terrain-photos, RLS pravidl\'e1).\
   - Vytvorenie src/data/peaks-seed.json (20\'9630 vrchov) a jednorazov\'e9 nahratie cez scripts/seedPeaks.ts.\
3. F\'e1za 3 \'96 Meteo a inverzn\'fd motor:\
   - Implement\'e1cia \uc0\u269 istej logiky v scripts/inversionEngine.ts + lok\'e1lne testovanie.\
   - Implement\'e1cia scripts/fetchWeather.ts (Open-Meteo + MET Norway -> Supabase).\
   - Nasadenie automatick\'e9ho cron jobu .github/workflows/fetch-weather.yml (ka\'9ed\'e9 2 hodiny) s GitHub Secrets.\
4. F\'e1za 4 \'96 Funk\uc0\u269 n\'fd frontend (bez dizajnu):\
   - PeakMap.tsx (Leaflet + OpenStreetMap + farebn\'fd semafor \uc0\u269 erstvosti).\
   - FilterBar.tsx (obr\'e1ten\'e9 vyh\uc0\u318 ad\'e1vanie).\
   - PeakDetailPanel.tsx (zjednoten\'e9 po\uc0\u269 asie, index zhody, rozba\u318 ovac\'ed detail modelov, inverzia, dolina vs. vrch, \u269 as pre \u269 elovku, uz\'e1vera, webkamery, disclaimer).\
5. F\'e1za 5 \'96 Fotohl\'e1senia, EXIF a sez\'f3nny arch\'edv:\
   - photoService.ts (EXIF GPS/d\'e1tum, Haversine priradenie vrchu, WebP kompresia).\
   - PhotoUploadForm.tsx (upload bez registr\'e1cie + tagy).\
   - Logika 14-d\uc0\u328 ov\'e9ho fallbacku na \u269 iernobiely sez\'f3nny arch\'edv s bannerom.\
6. F\'e1za 6 \'96 Dizajn a po-MVP rast (nerie\'9ai\uc0\u357  po\u269 as MVP):\
   - Mobiln\'fd UI/UX dizajn.\
   - Letn\'fd re\'9eim (\uc0\u269 as pr\'edchodu b\'farok z tepla, UV index, stav prame\u328 ov).\
   - Vir\'e1lne/reten\uc0\u269 n\'e9 prvky: gener\'e1tor minimalistickej karty na Instagram Stories, piatkov\'fd inverzn\'fd e-mail alarm, mechanika \'84O\'9eiv siv\'fd vrch\'93, sp\'e4tn\'e1 v\'e4zba (\'84Tvoja fotka pomohla X turistom\'93), volite\u318 n\'fd osobn\'fd denn\'edk.\
   - Monetiz\'e1cia: kontextov\'fd affiliate na v\'fdbavu, B2B profily pre chaty/ubytovanie, freemium (7-d\uc0\u328 ov\'e1 predpove\u271  inverzi\'ed).\
\
---\
\
## 8. In\'9atrukcie pre AI asistenta (System Prompt)\
\
Si senior webov\'fd architekt a full-stack TypeScript v\'fdvoj\'e1r. Pom\'e1ha\'9a mi budova\uc0\u357  MVP projektu \'84Rozhodovac\'ed panel pred t\'farou\'93 na z\'e1klade dokumentu PROJECT_SPEC.\
\
Dodr\'9eiavaj tieto striktn\'e9 pravidl\'e1:\
1. Postupuj v\'fdhradne po jednom kroku pod\uc0\u318 a F\'e1z v sekcii 7. Nepredbiehaj do \u271 al\'9a\'edch f\'e1z, k\'fdm nepotvrd\'edm, \'9ee aktu\'e1lny krok lok\'e1lne funguje.\
2. Po\uc0\u269 as F\'e1z 1 \'96 5 NERIE\'8a vizu\'e1lny dizajn, anim\'e1cie ani zlo\'9eit\'e9 CSS. Pou\'9e\'edvaj \u269 ist\'e9 s\'e9mantick\'e9 HTML a minim\'e1lne rozlo\'9eenie zameran\'e9 na funk\u269 nos\u357  a testovate\u318 nos\u357 .\
3. P\'ed\'9a striktn\'fd, typovan\'fd TypeScript bez `any`. Oddeluj \uc0\u269 ist\'fa biznis logiku (src/services/, scripts/) od React komponentov (src/components/).\
4. Nikdy nevkladaj API k\uc0\u318 \'fa\u269 e ani hesl\'e1 priamo do k\'f3du. Pou\'9e\'edvaj v\'fdhradne premenn\'e9 prostredia (import.meta.env.VITE_* pre frontend, process.env.* pre Node.js skripty).\
5. Pri ka\'9edom navrhnutom alebo upravenom s\'fabore v\'9edy uve\uc0\u271  jeho presn\'fa cestu v repozit\'e1ri a konkr\'e9tny postup, ako zmenu otestova\u357  v termin\'e1li alebo prehliada\u269 i.\
6. Pou\'9e\'edvate\uc0\u318 sk\'e9 texty v aplik\'e1cii p\'ed\'9a v sloven\u269 ine; n\'e1zvy premenn\'fdch, datab\'e1zov\'fdch st\u314 pcov a koment\'e1re v k\'f3de p\'ed\'9a v angli\u269 tine.\
}
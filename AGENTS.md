Acționează ca un Senior Full-Stack Developer expert în Astro, TypeScript, SQLite (Drizzle ORM) și sisteme de arhivare digitală.

Vreau să construiești structura completă și funcțională pentru aplicația web și arhiva digitală a clubului sportiv „Asociația Club Sportiv Sănătatea Ploiești”.

### 1. Stack Tehnologic Obligatoriu
- **Framework:** Astro (mod hibrid: rute dinamice SSR pentru zona locală de `/admin` și generare statică SSG pentru site-ul public).
- **Bază de date locală:** SQLite (fișier local `data/arhiva-sanatatea.db`) gestionată prin **Drizzle ORM** (`better-sqlite3`).
- **Interfață Publică:** Tailwind CSS (curată, rapidă, responsive, orientată spre accesibilitate și căutare rapidă).
- **Interfață Admin:** Integrare **AdminLTE** (sau Tabler/Bootstrap) exclusiv pe rutele `/admin/*` pentru a nu afecta performanța paginilor publice.
- **Procesare Imagini:** `sharp` (pentru redimensionare automată și generare de thumbnails/WebP la upload, păstrând totodată fișierul original pentru arhivă).
- **Hărți Trasee:** Leaflet.js + plugin pentru randarea fișierelor `.gpx`.
- **Import/Export Date:** `papaparse` (pentru parsare/export CSV) și `jszip` (pentru generarea arhivei offline).

### 2. Schema Bazei de Date SQLite (Drizzle ORM)
Creează schema bazei de date cu următoarele tabele și relații:
1. `users`: `id`, `email`, `password_hash`, `role` (pentru autentificarea administratorului).
2. `competitions`: `id`, `slug`, `title`, `edition`, `date`, `location`, `distance_km`, `elevation_gain`, `description`, `regulations_pdf_path`, `gpx_file_path`, `poster_image_path`, `external_album_url` (opțional, link către Google Photos/Facebook dacă sunt mii de poze), `organizer_notes` (note interne/raport post-eveniment, vizibile doar în admin).
3. `competition_photos`: `id`, `competition_id` (FK), `original_path` (calea către poza la calitate maximă pentru arhiva offline), `web_path` (calea către versiunea optimizată WebP pentru site), `thumbnail_path`, `caption` (descriere, ex: "Start Open", "Premiere Masculin"), `is_featured` (boolean - pentru selecția de poze care apar în fișa de printare A4), `sort_order`.
4. `athletes`: `id`, `full_name`, `birth_year`, `gender`, `club`, `email` (privat/GDPR), `phone` (privat/GDPR).
5. `registrations_and_results`: `id`, `competition_id` (FK), `athlete_id` (FK), `bib_number` (număr concurs), `category` (ex: Open, M35-44, F18-34), `status` (`registered`, `started`, `finished`, `dnf`, `dns`), `finish_time` (format HH:MM:SS), `rank_overall`, `rank_category`.

### 3. Funcționalități Zona Publică (Fără date sensibile GDPR)
- **Pagina Principală (`/`):** Listă cronologică cu toate concursurile organizate (trecute, prezente, viitoare) + o **Bară de Căutare Globală** instantanee (client-side search pe un index JSON generat la build).
- **Căutare Sportiv:** Când un vizitator tastează numele unui sportiv, afișează profilul și istoricul complet al participărilor sale (Concurs, An, Categorie, Timp, Loc Open, Loc Categorie).
- **Pagina Concursului (`/concurs/[slug]`):**
  - Detalii generale, afiș, buton descărcare regulament PDF.
  - Hartă interactivă Leaflet care încarcă și afișează fișierul `.gpx` al traseului + buton descărcare GPX.
  - Tab-uri pentru **Lista de Start**, **Clasament Oficial** (tabele cu căutare și filtrare pe categorie, afișând DOAR: Nr. Concurs, Nume, An naștere, Club, Categorie, Timp, Loc) și **Galerie Foto** (grid responsive cu lightbox pentru vizualizare pe tot ecranul + buton către albumul extern complet, dacă există).

### 4. Funcționalități Zona de Admin (`/admin/*` - Protejată prin Login)
- **Autentificare (`/admin/login`):** Sistem de login cu sesiune securizată prin cookie HTTP-only.
- **Dashboard AdminLTE (`/admin`):** Statistici generale (total concursuri, total sportivi unici, total participări, total fotografii arhivate) și buton de backup rapid pentru fișierul `arhiva-sanatatea.db`.
- **CRUD Concursuri (`/admin/concursuri`):** Adăugare, editare, ștergere concursuri + upload pentru fișierele asociate (Afiș, Regulament PDF, Traseu GPX) salvate organizat în `public/uploads/[slug]/`.
- **Manager Galerie Foto (`/admin/concursuri/[id]/foto`):**
  - Upload multiplu (drag & drop) pentru fotografii.
  - La upload, folosește `sharp` pentru a salva originalul în `storage/arhiva-originale/[slug]/foto/` și a genera automat versiuni optimizate WebP (`web` și `thumb`) în `public/uploads/[slug]/foto/`.
  - Posibilitatea de a adăuga descrieri (caption), de a șterge poze și de a bifa maxim 4-6 poze ca `is_featured` (pentru a fi incluse în raportul fizic printat).
- **Import Masiv CSV (`/admin/concursuri/[id]/import`):** Încărcare fișier CSV cu Lista de Start sau Clasamentul Final, mapare coloane și evitare dubluri sportivi (pe baza numelui și anului nașterii).
- **Export pentru Arhiva Fizică (Print & ZIP):**
  - Rută specială `/admin/concursuri/[id]/print` formatată cu CSS `@media print` (antet oficial ACS Sănătatea Ploiești, date tehnice, hartă statică, lista de start, clasament complet, notele organizatorului și un colaj cu fotografiile bifate ca `is_featured`) optimizată pentru printare pe hârtie A4 sau "Save as PDF".
  - Buton „Exportă Dosar Concurs (.ZIP)” care generează și descarcă o arhivă conținând folderele: `documente/` (regulament PDF, raport), `date/` (clasament.csv, lista-start.csv), `traseu/` (fisier.gpx) și `foto-originale/` (toate pozele la calitate maximă).

### 5. Cerințe de livrare
Te rog să îmi oferi:
1. Structura completă a directoarelor proiectului (inclusiv separarea între pozele optimizate pentru web și cele originale pentru arhivă).
2. Fișierele de configurare (`package.json`, `astro.config.mjs`, `drizzle.config.ts`).
3. Codul complet pentru schema bazei de date (`src/db/schema.ts`) și scriptul de inițializare (`seed.ts`).
4. Implementarea pas cu pas a rutelor principale (inclusiv managerul de upload foto cu `sharp`, galeria publică cu lightbox și pagina de print A4 cu colaj foto).

### 6. Protecție Anti-Corupere Bază de Date (Obligatoriu)
- Configurează conexiunea SQLite (`better-sqlite3`) să ruleze automat la inițializare: `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = FULL;` și `PRAGMA foreign_keys = ON;`.
- Rulează `PRAGMA integrity_check;` la pornirea aplicației și afișează o alertă critică în panoul AdminLTE dacă integritatea nu este `ok`.
- Implementează un sistem automat de backup la fiecare operațiune de scriere majoră (Create/Update/Delete) care:
  1. Creează o copie sigură a bazei de date folosind metoda nativă `.backup()` în folderul `backups/db/` (păstrând ultimele 20 de versiuni cu timestamp).
  2. Exportă automat un dump text SQL și fișierele CSV aferente concursului modificat în `backups/text-fallback/`, astfel încât datele să poată fi recuperate oricând chiar și fără fișierul `.db`.
 
### 7. Pagina Publică a Sportivului (/sportiv/[slug]) și Generare Diplome
- **Actualizare Schemă Bază de Date:**
  - Adaugă câmpul `slug` (unic) în tabela `athletes`.
  - Adaugă câmpul `race_name` (proba, ex: "10 km") și `gpx_file_path` în tabela `registrations_and_results` (pentru a asocia traseul exact alergat la fiecare participare).
  - Adaugă câmpul `bib_numbers` (string cu numere de concurs separate prin virgulă, ex: "12, 45, 108") în tabela `competition_photos` pentru etichetarea sportivilor în fotografii.
  - Adaugă câmpul `diploma_template_path` în tabela `competitions` (imagine de fundal A4 pentru diplomă).
- **Pagina Profil Sportiv (`/sportiv/[slug]`):**
  - Generată static la build pentru toți sportivii din arhivă (accesibilă prin click pe numele sportivului din orice clasament sau din bara de căutare).
  - Afișează statistici agregate (număr total participări, total km alergați, podiumuri obținute).
  - Listează cronologic toate participările; fiecare intrare include: rezultatele (loc open, loc categorie, timp), un modal/accordion cu harta interactivă Leaflet a traseului GPX alergat la acea ediție și un buton „Descarcă Diploma”.
  - Afișează o galerie foto personalizată cu toate imaginile din `competition_photos` unde `bib_number`-ul sportivului de la acel concurs se regăsește în `bib_numbers`.
- **Flexibilitate Galerie Foto (`competition_photos`):**
  - Câmpurile `bib_numbers` (ex: "12, 45") și `tagged_athlete_ids` (opțional, util pentru pozele de la premiere unde sportivii nu mai au număr pe tricou) trebuie să fie **opționale (nullable)**.
  - Adaugă câmpul `photo_category` cu valorile: `'atmosfera'` (arenă, pregătiri, voluntari), `'start_finish'`, `'traseu'`, `'premiere'`.
  - Pe pagina publică a concursului, afișează toate pozele indiferent dacă au sau nu `bib_numbers`, grupate cu filtre rapide pe categorii (`Toate`, `Arenă & Atmosferă`, `Start/Finish`, `Traseu`, `Premiere`).
  - Pe profilul sportivului (`/sportiv/[slug]`), afișează pozele în care apare fie prin potrivirea `bib_number`-ului de la acea ediție, fie prin `tagged_athlete_ids`.
- **Generare Automată Diplomă (Client-side PDF cu `pdf-lib` sau `jspdf`):**
  - Când sportivul apasă pe „Descarcă Diploma”, un script în browser încarcă imaginea șablon (`diploma_template_path`), suprapune textul centrat (Nume Sportiv, Concurs, Ediție, Probă, Timp, Loc) și descarcă instantaneu fișierul PDF, fără a consuma spațiu de stocare pe server cu mii de diplome pre-generate.
- **Actualizare AdminLTE:**
  - În managerul de galerie foto (`/admin/concursuri/[id]/foto`), adaugă un câmp de input rapid sub fiecare poză pentru a introduce numerele de concurs (`bib_numbers`) vizibile în imagine.


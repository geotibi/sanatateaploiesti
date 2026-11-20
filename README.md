# Arhiva Oficială — A.C.S. Sănătatea Ploiești

Platformă web modulară și sistem de arhivare digitală și fizică pentru competițiile sportive organizate de **Asociația Club Sportiv Sănătatea Ploiești** (ediții trecute, prezente și viitoare).

## 🎯 Obiectivele proiectului
- **Memorie instituțională pe termen lung:** Stocarea centralizată a regulamentelor, listelor de start, clasamentelor, traseelor și galeriilor foto.
- **Arhivă hibridă (Digitală + Fizică):** Bază de date locală portabilă (SQLite) și generator de fișe formatate A4 + dosare `.ZIP` gata de printat pentru bibliorafturile clubului.
- **Portal public pentru sportivi:** Căutare instantanee după nume, profil individual al sportivului (`/sportiv/[slug]`), vizualizare trasee interactive (Livelox KMZ, GPX sau hărți scanate calibrate manual) și descărcare automată a diplomelor PDF.

---

## 🏗️ Arhitectura Proiectului

Proiectul este construit pe **4 straturi independente** pentru a putea actualiza designul sau funcționalitățile fără a afecta datele:

```text
├── data/                   # [PRIVAT - Ignorat de Git] Baza de date locală SQLite (arhiva-sanatatea.db)
├── backups/                # [PRIVAT - Ignorat de Git] Copii de siguranță automate (.db și .sql/.csv)
├── storage/                # [PRIVAT - Ignorat de Git] Fotografiile originale la rezoluție maximă
├── public/
│   └── uploads/            # Fișiere publice optimizate (poze WebP, PDF-uri regulamente, trasee)
└── src/
    ├── config/             # Configurări centrale ale clubului (club.config.ts)
    ├── core/               # Conexiunea SQLite (db.ts) + Schema tabelelor (schema.ts)
    ├── services/           # Logica aplicației (sportivi, concursuri, media, export ZIP/PDF)
    ├── modules/            # Componente vizuale izolate (Hărți Leaflet, Galerii, Tabele, Print A4)
    └── pages/              # Rutele publice și panoul de administrare (/admin)
```

---

## 🚀 Instalare și Pornire Locală (Pe calculatorul de administrare)

### Cerințe preliminare
- **Node.js** (versiunea 18 sau mai nouă) instalat pe calculator.

### Pași de configurare inițială
1. Clonează acest repository pe calculatorul tău (într-un folder local, **NU** într-un folder sincronizat automat de Google Drive / OneDrive, pentru a proteja integritatea bazei de date):
   ```bash
   git clone https://github.com
   cd arhiva-acs-sanatatea-ploiesti
   ```
2. Instalează dependențele:
   ```bash
   npm install
   ```
3. Creează baza de date locală SQLite (`data/arhiva-sanatatea.db`) și tabelele aferente:
   ```bash
   npm run db:push
   ```
4. Pornește aplicația local:
   ```bash
   npm run dev
   ```
   - **Site-ul public** va fi disponibil la: `http://localhost:4321`
   - **Panoul de administrare** va fi disponibil la: `http://localhost:4321/admin`

---

## 🛡️ Reguli de Siguranță și Backup (Anti-Corupere)

1. **Protecție automată:** Baza de date rulează în modul `WAL` (*Write-Ahead Logging*) cu sincronizare `FULL` și verificare automată de integritate la fiecare pornire.
2. **Backup automat:** La fiecare adăugare sau modificare majoră din panoul de administrare, aplicația salvează o copie validă a bazei de date în `backups/db/` (păstrând ultimele 20 de versiuni).
3. **Regula 3-2-1:** Periodic, copiază conținutul folderelor `backups/` și `storage/` pe un **hard disk extern** și într-un **cont cloud al asociației**.
4. **Protecția datelor (GDPR):** Datele sensibile (email, telefon, note interne ale organizatorilor) sunt stocate strict în baza de date locală și nu sunt exportate niciodată pe site-ul public.

---

## 🛠️ Comenzi Utile

| Comandă | Ce face |
| :--- | :--- |
| `npm run dev` | Pornește serverul local de dezvoltare și administrare. |
| `npm run build` | Generează versiunea finală, optimizată a site-ului public în folderul `dist/`. |
| `npm run db:push` | Actualizează structura tabelelor din SQLite dacă s-a modificat `src/core/schema.ts`. |
| `npm run db:studio` | Deschide o interfață vizuală în browser pentru a inspecta direct tabelele bazei de date. |

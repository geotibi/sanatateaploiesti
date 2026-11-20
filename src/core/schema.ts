import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// 1. UTILIZATORI (Administratori & Organizatori)
// ============================================================================
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ['admin', 'editor'] }).notNull().default('admin'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// 2. CONCURSURI (Ediții trecute, prezente și viitoare)
// ============================================================================
export const competitions = sqliteTable('competitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(), // ex: "2026-trofeul-sanatatea-ed12"
  title: text('title').notNull(), // ex: "Trofeul Sănătatea Ploiești"
  edition: text('edition'), // ex: "Ediția a XII-a"
  date: text('date').notNull(), // Format ISO: "YYYY-MM-DD" (pentru sortare cronologică exactă)
  location: text('location').notNull(), // ex: "Pădurea Păulești, Prahova"
  status: text('status', { enum: ['upcoming', 'completed', 'cancelled'] })
    .notNull()
    .default('completed'),
  
  // Detalii tehnice & descriere
  distanceKm: real('distance_km'),
  elevationGain: integer('elevation_gain'),
  description: text('description'),
  
  // Documente Oficiale & Media
  posterImagePath: text('poster_image_path'), // Afișul competiției
  regulationsPdfPath: text('regulations_pdf_path'), // Regulament / Buletin tehnic
  diplomaTemplatePath: text('diploma_template_path'), // Imagine fundal A4 pentru generare diplome
  externalAlbumUrl: text('external_album_url'), // Link Google Photos / Facebook (opțional)
  liveloxEventUrl: text('livelox_event_url'), // Link către evenimentul din Livelox (opțional)

  // Modul Hărți Hibride (KMZ automat sau Hartă Scanată calibrată manual)
  mapSourceType: text('map_source_type', { enum: ['kmz', 'scanned_image', 'none'] })
    .notNull()
    .default('none'),
  kmzFilePath: text('kmz_file_path'), // Calea către fișierul .kmz din Livelox/OCAD
  mapImagePath: text('map_image_path'), // Calea către imaginea hărții scanate (dacă nu e KMZ)
  mapCornersJson: text('map_corners_json'), // JSON cu cele 4 perechi [lat, lng] ale colțurilor calibrate
  officialCourseGeojson: text('official_course_geojson'), // Traseul oficial (GPX convertit sau desenat manual)

  // Date Private (Vizibile DOAR în AdminLTE și în Raportul de Printare A4)
  organizerNotes: text('organizer_notes'), // Jurnal post-eveniment, probleme întâmpinate, buget
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// 3. SPORTIVI (Profiluri unice pentru istoricul pe termen lung)
// ============================================================================
export const athletes = sqliteTable('athletes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(), // ex: "ion-popescu" (pentru URL-ul /sportiv/ion-popescu)
  fullName: text('full_name').notNull(),
  normalizedName: text('normalized_name').notNull(), // Fără diacritice, lowercase (pentru evitare dubluri la import CSV)
  birthYear: integer('birth_year'), // Util pentru diferențierea omonimelor și calcul categorii
  gender: text('gender', { enum: ['M', 'F'] }),
  club: text('club'), // Ultimul club cunoscut (ex: "ACS Sănătatea Ploiești")

  // Date Private (GDPR - NU se afișează niciodată pe site-ul public)
  email: text('email'),
  phone: text('phone'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// 4. ÎNSCRIERI, LISTE DE START ȘI REZULTATE (Legătura Concurs <-> Sportiv)
// ============================================================================
export const registrationsAndResults = sqliteTable(
  'registrations_and_results',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    competitionId: integer('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    athleteId: integer('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),

    // Date de concurs
    bibNumber: text('bib_number'), // Text deoarece pot exista numere cu litere (ex: "A12")
    raceName: text('race_name'), // Proba / Traseul (ex: "M21E", "Open", "Cros 10km")
    category: text('category'), // Categoria de vârstă (ex: "M35-44", "F18-34")
    clubAtEvent: text('club_at_event'), // Clubul pe care l-a reprezentat la acea ediție specifică
    
    // Rezultat
    status: text('status', { enum: ['registered', 'started', 'finished', 'dnf', 'dns', 'mp'] })
      .notNull()
      .default('registered'), // 'mp' = Missing Punch (specific orientării sportive)
    finishTime: text('finish_time'), // Format "HH:MM:SS"
    timeSeconds: integer('time_seconds'), // Timpul în secunde (pentru sortare și statistici rapide)
    rankOverall: integer('rank_overall'),
    rankCategory: integer('rank_category'),

    // Ruta individuală a sportivului la această ediție (KMZ din Livelox, GPX sau desenată manual)
    routeSourceType: text('route_source_type', { enum: ['kmz', 'gpx', 'manual_geojson', 'none'] })
      .notNull()
      .default('none'),
    routeFilePath: text('route_file_path'), // Calea către .kmz sau .gpx individual
    manualRouteGeojson: text('manual_route_geojson'), // Coordonate traseu desenat manual
  },
  (table) => ({
    // Previne înscrierea dublă a aceluiași sportiv la aceeași probă din același concurs
    uniqueParticipation: uniqueIndex('unique_participation_idx').on(
      table.competitionId,
      table.athleteId,
      table.raceName
    ),
  })
);

// ============================================================================
// 5. GALERIE FOTO & MEDIA (Atât poze cu Bib, cât și poze generale/premiere)
// ============================================================================
export const competitionPhotos = sqliteTable('competition_photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionId: integer('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),

  // Căi fișiere
  originalPath: text('original_path').notNull(), // Calitate maximă (pentru arhiva offline ZIP)
  webPath: text('web_path').notNull(), // Optimizat WebP (pentru încărcare rapidă pe site)
  thumbnailPath: text('thumbnail_path').notNull(), // Miniatură pentru grid-ul galeriei

  // Categorisire și Descriere
  photoCategory: text('photo_category', {
    enum: ['atmosfera', 'start_finish', 'traseu', 'premiere'],
  })
    .notNull()
    .default('atmosfera'),
  caption: text('caption'), // Descriere opțională (ex: "Podium Open Masculin")

  // Etichetare Opțională Sportivi (pot rămâne NULL pentru poze generale)
  bibNumbers: text('bib_numbers'), // Numere vizibile separate prin virgulă: "102, 45, 88"
  taggedAthleteIds: text('tagged_athlete_ids'), // JSON array cu ID-uri sportivi (util la premiere fără bib): "[12, 45]"

  // Control Arhivă Fizică & Afișare
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false), // Dacă apare în colajul A4 printat
  sortOrder: integer('sort_order').notNull().default(0),
  uploadedAt: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// RELAȚII DRIZZLE (Pentru interogări curate între tabele)
// ============================================================================
export const competitionsRelations = relations(competitions, ({ many }) => ({
  participations: many(registrationsAndResults),
  photos: many(competitionPhotos),
}));

export const athletesRelations = relations(athletes, ({ many }) => ({
  participations: many(registrationsAndResults),
}));

export const registrationsAndResultsRelations = relations(registrationsAndResults, ({ one }) => ({
  competition: one(competitions, {
    fields: [registrationsAndResults.competitionId],
    references: [competitions.id],
  }),
  athlete: one(athletes, {
    fields: [registrationsAndResults.athleteId],
    references: [athletes.id],
  }),
}));

export const competitionPhotosRelations = relations(competitionPhotos, ({ one }) => ({
  competition: one(competitions, {
    fields: [competitionPhotos.competitionId],
    references: [competitions.id],
  }),
}));

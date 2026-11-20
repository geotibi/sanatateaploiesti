import path from 'node:path';

export const CLUB_CONFIG = {
  // Date oficiale club (apar în antetul site-ului, pe diplome și pe fișele de printare A4)
  numeComplet: 'Asociația Club Sportiv Sănătatea Ploiești',
  numeScurt: 'A.C.S. Sănătatea Ploiești',
  oras: 'Ploiești',
  judet: 'Prahova',
  coordonateImpliciteHarta: {
    lat: 44.9412, // Ploiești centru (punct de pornire la calibrarea hărților)
    lng: 26.0225,
    zoom: 13,
  },

  // Categorii standard pentru galeria foto
  categoriiFoto: [
    { id: 'atmosfera', label: 'Arenă & Atmosferă' },
    { id: 'start_finish', label: 'Start & Sosire' },
    { id: 'traseu', label: 'Acțiune pe Traseu' },
    { id: 'premiere', label: 'Festivitate de Premiere' },
  ] as const,

  // Căi de stocare pe disc
  paths: {
    dataDir: path.resolve(process.cwd(), 'data'),
    dbFile: path.resolve(process.cwd(), 'data', 'arhiva-sanatatea.db'),
    backupsDbDir: path.resolve(process.cwd(), 'backups', 'db'),
    backupsTextDir: path.resolve(process.cwd(), 'backups', 'text-fallback'),
    // Pozele optimizate WebP + PDF-uri publice (accesibile în browser)
    publicUploadsDir: path.resolve(process.cwd(), 'public', 'uploads'),
    // Pozele originale la rezoluție maximă (păstrate doar în arhiva locală/ZIP)
    rawArchiveDir: path.resolve(process.cwd(), 'storage', 'arhiva-originale'),
  },

  // Setări procesare imagini (Sharp)
  imageSettings: {
    webMaxWidth: 1600, // Lățime maximă pentru site (px)
    webQuality: 82, // Calitate WebP (echilibru optim viteză/claritate)
    thumbWidth: 450, // Lățime miniaturi în galerie
    maxFeaturedPhotosPrint: 6, // Număr maxim de poze incluse în raportul printat A4
  },
} as const;

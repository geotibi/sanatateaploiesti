import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { CompetitionService } from './competition.service';
import { CLUB_CONFIG } from '../config/club.config';

export class ExportService {
  /**
   * Generează o arhivă .ZIP completă pentru un concurs (gata de pus pe hard disk extern / DVD / cloud)
   */
  static async buildCompetitionArchiveZip(competitionSlug: string): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const comp = await CompetitionService.getCompetitionBySlug(competitionSlug);
    if (!comp) {
      throw new Error(`Concursul "${competitionSlug}" nu a fost găsit.`);
    }

    const zip = new JSZip();

    // 1. Raportul oficial text (rezumat + notele private ale organizatorului)
    const reportLines = [
      `====================================================================`,
      `ARHIVA OFICIALĂ - ${CLUB_CONFIG.numeComplet.toUpperCase()}`,
      `====================================================================`,
      `Competiție:   ${comp.title} ${comp.edition ? `(${comp.edition})` : ''}`,
      `Data:         ${comp.date}`,
      `Locație:      ${comp.location}`,
      `Distanță:     ${comp.distanceKm ? `${comp.distanceKm} km` : 'Nespecificat'}`,
      `Diferență niv:${comp.elevationGain ? ` ${comp.elevationGain} m` : ' Nespecificat'}`,
      `Total înscriși: ${comp.participants.length}`,
      `Total finișeri: ${comp.participants.filter((p) => p.result.status === 'finished').length}`,
      `Data export:  ${new Date().toLocaleString('ro-RO')}`,
      `--------------------------------------------------------------------`,
      `DESCRIERE EVENIMENT:`,
      comp.description || 'Fără descriere.',
      `--------------------------------------------------------------------`,
      `JURNAL ORGANIZATOR / NOTE POST-EVENIMENT (CONFIDENȚIAL):`,
      comp.organizerNotes || 'Fără note interne înregistrate.',
      `====================================================================`,
    ];
    zip.file('01_Raport_Organizator.txt', reportLines.join('\n'));

    // 2. Clasament Oficial & Listă de Start în format CSV (universal, lizibil peste zeci de ani)
    const csvRows = comp.participants.map(({ result, athlete }) => ({
      Nr_Concurs: result.bibNumber || '',
      Nume_Sportiv: athlete.fullName,
      An_Nastere: athlete.birthYear || '',
      Gen: athlete.gender || '',
      Club: result.clubAtEvent || athlete.club || '',
      Proba: result.raceName || '',
      Categorie: result.category || '',
      Status: result.status,
      Timp_Oficial: result.finishTime || '',
      Loc_Open: result.rankOverall || '',
      Loc_Categorie: result.rankCategory || '',
    }));

    const csvContent = Papa.unparse(csvRows, { delimiter: ',' });
    // Adăugăm BOM (\uFEFF) ca Excel să deschidă corect diacriticele românești (ă, â, î, ș, ț)
    zip.file('02_Date_Concurs/clasament_si_participanti.csv', '\uFEFF' + csvContent);

    // 3. Adăugăm documentele oficiale (Regulament PDF, Afiș, Șablon Diplomă)
    const docsFolder = zip.folder('03_Documente_Oficiale');
    const filesToInclude = [
      { webPath: comp.regulationsPdfPath, name: 'regulament_oficial' },
      { webPath: comp.posterImagePath, name: 'afis_oficial' },
      { webPath: comp.diplomaTemplatePath, name: 'sablon_diploma' },
    ];

    for (const item of filesToInclude) {
      if (item.webPath) {
        const diskPath = path.join(process.cwd(), 'public', item.webPath);
        if (fs.existsSync(diskPath)) {
          const ext = path.extname(diskPath);
          docsFolder?.file(`${item.name}${ext}`, fs.readFileSync(diskPath));
        }
      }
    }

    // 4. Adăugăm Harta și Traseele (KMZ Livelox / Hartă scanată / GeoJSON)
    const mapsFolder = zip.folder('04_Harti_si_Trasee');
    if (comp.kmzFilePath) {
      const diskPath = path.join(process.cwd(), 'public', comp.kmzFilePath);
      if (fs.existsSync(diskPath)) {
        mapsFolder?.file(`harta_si_trasee_${comp.slug}.kmz`, fs.readFileSync(diskPath));
      }
    }
    if (comp.mapImagePath) {
      const diskPath = path.join(process.cwd(), 'public', comp.mapImagePath);
      if (fs.existsSync(diskPath)) {
        const ext = path.extname(diskPath);
        mapsFolder?.file(`harta_scanata_${comp.slug}${ext}`, fs.readFileSync(diskPath));
      }
    }
    if (comp.mapCornersJson) {
      mapsFolder?.file('coordonate_calibrare_harta.json', comp.mapCornersJson);
    }
    if (comp.officialCourseGeojson) {
      mapsFolder?.file('traseu_oficial.geojson', comp.officialCourseGeojson);
    }

    // 5. Adăugăm Fotografiile Originale (la calitate maximă)
    const photosFolder = zip.folder('05_Fotografii_Originale');
    comp.photos.forEach((photo, index) => {
      if (photo.originalPath && fs.existsSync(photo.originalPath)) {
        const ext = path.extname(photo.originalPath);
        const fileName = `${String(index + 1).padStart(3, '0')}_${photo.photoCategory}${ext}`;
        photosFolder?.file(fileName, fs.readFileSync(photo.originalPath));
      }
    });

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return {
      buffer: zipBuffer,
      fileName: `Arhiva_${comp.slug}.zip`,
    };
  }

  /**
   * Salvează un backup text CSV al unui concurs în backups/text-fallback/
   * (Plasă de siguranță suplimentară pe lângă fișierul SQLite)
   */
  static async saveTextFallbackBackup(competitionSlug: string) {
    const comp = await CompetitionService.getCompetitionBySlug(competitionSlug);
    if (!comp) return;

    const fallbackDir = path.join(CLUB_CONFIG.paths.backupsTextDir, comp.slug);
    fs.mkdirSync(fallbackDir, { recursive: true });

    const csvRows = comp.participants.map(({ result, athlete }) => ({
      Bib: result.bibNumber || '',
      Nume: athlete.fullName,
      AnNastere: athlete.birthYear || '',
      Gen: athlete.gender || '',
      Club: result.clubAtEvent || athlete.club || '',
      Proba: result.raceName || '',
      Categorie: result.category || '',
      Status: result.status,
      Timp: result.finishTime || '',
      LocOpen: result.rankOverall || '',
      LocCat: result.rankCategory || '',
    }));

    const csvContent = '\uFEFF' + Papa.unparse(csvRows);
    fs.writeFileSync(path.join(fallbackDir, 'rezultate_backup.csv'), csvContent, 'utf-8');
    fs.writeFileSync(
      path.join(fallbackDir, 'detalii_concurs.json'),
      JSON.stringify(comp, null, 2),
      'utf-8'
    );
  }
}

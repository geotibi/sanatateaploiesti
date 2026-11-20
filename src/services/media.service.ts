import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '../core/db';
import { competitionPhotos } from '../core/schema';
import { eq } from 'drizzle-orm';
import { CLUB_CONFIG } from '../config/club.config';

export class MediaService {
  /**
   * Asigură existența directoarelor necesare pentru un concurs
   */
  static ensureCompetitionDirs(competitionSlug: string) {
    const publicDir = path.join(CLUB_CONFIG.paths.publicUploadsDir, competitionSlug);
    const publicPhotosDir = path.join(publicDir, 'foto');
    const rawPhotosDir = path.join(CLUB_CONFIG.paths.rawArchiveDir, competitionSlug, 'foto');

    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(publicPhotosDir, { recursive: true });
    fs.mkdirSync(rawPhotosDir, { recursive: true });

    return { publicDir, publicPhotosDir, rawPhotosDir };
  }

  /**
   * Salvează un fișier standard (PDF regulament, KMZ Livelox, GPX, șablon diplomă, hartă scanată)
   * Returnează calea publică relativă (ex: "/uploads/2026-cros/traseu.kmz")
   */
  static async saveCompetitionAsset(
    competitionSlug: string,
    fileBuffer: Buffer,
    originalFileName: string,
    prefix: string = 'doc'
  ): Promise<string> {
    const { publicDir } = this.ensureCompetitionDirs(competitionSlug);
    const ext = path.extname(originalFileName).toLowerCase();
    const cleanName = `${prefix}_${Date.now()}${ext}`;
    const fullDiskPath = path.join(publicDir, cleanName);

    await fs.promises.writeFile(fullDiskPath, fileBuffer);

    // Returnăm calea URL accesibilă din browser
    return `/uploads/${competitionSlug}/${cleanName}`;
  }

  /**
   * Procesează și arhivează o fotografie de la eveniment:
   * 1. Salvează originalul necomprimat în storage/arhiva-originale/
   * 2. Generează versiunea WebP optimizată pentru site
   * 3. Generează miniatura (thumbnail) pentru galeria foto
   */
  static async processAndSavePhoto(params: {
    competitionId: number;
    competitionSlug: string;
    fileBuffer: Buffer;
    originalFileName: string;
    photoCategory?: 'atmosfera' | 'start_finish' | 'traseu' | 'premiere';
    caption?: string | null;
    bibNumbers?: string | null;
    isFeatured?: boolean;
  }) {
    const { publicPhotosDir, rawPhotosDir } = this.ensureCompetitionDirs(params.competitionSlug);

    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const origExt = path.extname(params.originalFileName).toLowerCase() || '.jpg';

    // 1. Salvăm originalul la calitate 100% în arhiva privată
    const rawFileName = `orig_${uniqueId}${origExt}`;
    const rawDiskPath = path.join(rawPhotosDir, rawFileName);
    await fs.promises.writeFile(rawDiskPath, params.fileBuffer);

    // 2. Generăm versiunea WebP pentru vizualizare pe site
    const webFileName = `web_${uniqueId}.webp`;
    const webDiskPath = path.join(publicPhotosDir, webFileName);
    await sharp(params.fileBuffer)
      .rotate() // Corectează automat orientarea EXIF de pe telefon/aparat foto
      .resize({
        width: CLUB_CONFIG.imageSettings.webMaxWidth,
        withoutEnlargement: true,
      })
      .webp({ quality: CLUB_CONFIG.imageSettings.webQuality })
      .toFile(webDiskPath);

    // 3. Generăm miniatura (thumbnail) pentru încărcare instantanee în grid
    const thumbFileName = `thumb_${uniqueId}.webp`;
    const thumbDiskPath = path.join(publicPhotosDir, thumbFileName);
    await sharp(params.fileBuffer)
      .rotate()
      .resize({
        width: CLUB_CONFIG.imageSettings.thumbWidth,
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toFile(thumbDiskPath);

    // 4. Salvăm înregistrarea în baza de date SQLite
    const [inserted] = await db
      .insert(competitionPhotos)
      .values({
        competitionId: params.competitionId,
        originalPath: rawDiskPath,
        webPath: `/uploads/${params.competitionSlug}/foto/${webFileName}`,
        thumbnailPath: `/uploads/${params.competitionSlug}/foto/${thumbFileName}`,
        photoCategory: params.photoCategory || 'atmosfera',
        caption: params.caption || null,
        bibNumbers: params.bibNumbers || null,
        isFeatured: params.isFeatured || false,
      })
      .returning();

    return inserted;
  }

  /**
   * Actualizează etichetele (Bib numbers, categorie, descriere, featured) unei poze
   */
  static async updatePhotoMetadata(
    photoId: number,
    data: {
      photoCategory?: 'atmosfera' | 'start_finish' | 'traseu' | 'premiere';
      caption?: string | null;
      bibNumbers?: string | null;
      taggedAthleteIds?: string | null;
      isFeatured?: boolean;
    }
  ) {
    const [updated] = await db
      .update(competitionPhotos)
      .set(data)
      .where(eq(competitionPhotos.id, photoId))
      .returning();
    return updated;
  }

  /**
   * Șterge o fotografie atât din baza de date, cât și de pe disc
   */
  static async deletePhoto(photoId: number) {
    const [photo] = await db
      .select()
      .from(competitionPhotos)
      .where(eq(competitionPhotos.id, photoId));

    if (!photo) return;

    // Ștergem fișierele fizice de pe disc dacă există
    const publicWebFull = path.join(process.cwd(), 'public', photo.webPath);
    const publicThumbFull = path.join(process.cwd(), 'public', photo.thumbnailPath);

    for (const filePath of [photo.originalPath, publicWebFull, publicThumbFull]) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Nu s-a putut șterge fișierul:', filePath, e);
        }
      }
    }

    await db.delete(competitionPhotos).where(eq(competitionPhotos.id, photoId));
  }
}

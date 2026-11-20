import { db, createSafeBackup } from '../core/db';
import { competitions, registrationsAndResults, athletes, competitionPhotos } from '../core/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { AthleteService } from './athlete.service';

export interface CsvResultRow {
  fullName: string;
  birthYear?: number | null;
  gender?: 'M' | 'F' | null;
  club?: string | null;
  email?: string | null;
  phone?: string | null;
  bibNumber?: string | null;
  raceName?: string | null;
  category?: string | null;
  status?: 'registered' | 'started' | 'finished' | 'dnf' | 'dns' | 'mp';
  finishTime?: string | null;
  rankOverall?: number | null;
  rankCategory?: number | null;
}

export class CompetitionService {
  /**
   * Convertește un timp text ("01:24:15" sau "42:10") în secunde totale
   */
  static parseTimeToSeconds(timeStr?: string | null): number | null {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    const parts = clean.split(':').map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return null;
  }

  /**
   * Listează toate concursurile ordonate cronologic (cele mai recente primele)
   */
  static async getAllCompetitions() {
    return await db.select().from(competitions).orderBy(desc(competitions.date));
  }

  /**
   * Preluare detalii complete concurs (inclusiv participanți și galerie foto)
   */
  static async getCompetitionBySlug(slug: string) {
    const [comp] = await db.select().from(competitions).where(eq(competitions.slug, slug));
    if (!comp) return null;

    const participants = await db
      .select({
        result: registrationsAndResults,
        athlete: {
          id: athletes.id,
          slug: athletes.slug,
          fullName: athletes.fullName,
          birthYear: athletes.birthYear,
          gender: athletes.gender,
          club: athletes.club,
        },
      })
      .from(registrationsAndResults)
      .innerJoin(athletes, eq(registrationsAndResults.athleteId, athletes.id))
      .where(eq(registrationsAndResults.competitionId, comp.id));

    const photos = await db
      .select()
      .from(competitionPhotos)
      .where(eq(competitionPhotos.competitionId, comp.id))
      .orderBy(competitionPhotos.sortOrder);

    return {
      ...comp,
      participants,
      photos,
    };
  }

  /**
   * Creează un concurs nou și face backup automat la baza de date
   */
  static async createCompetition(data: typeof competitions.$inferInsert) {
    const [created] = await db.insert(competitions).values(data).returning();
    await createSafeBackup(`create_comp_${created.slug}`);
    return created;
  }

  /**
   * Actualizează un concurs existent și face backup automat
   */
  static async updateCompetition(id: number, data: Partial<typeof competitions.$inferInsert>) {
    const [updated] = await db
      .update(competitions)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(competitions.id, id))
      .returning();
    await createSafeBackup(`update_comp_${updated.slug}`);
    return updated;
  }

  /**
   * Șterge un concurs (și rezultatele/pozele asociate) după un backup de siguranță
   */
  static async deleteCompetition(id: number) {
    await createSafeBackup(`before_delete_comp_${id}`);
    await db.delete(competitions).where(eq(competitions.id, id));
  }

  /**
   * Import masiv din CSV (Lista de Start sau Clasament Final)
   */
  static async importParticipantsFromRows(competitionId: number, rows: CsvResultRow[]) {
    let importedCount = 0;

    for (const row of rows) {
      if (!row.fullName || row.fullName.trim() === '') continue;

      // 1. Găsim sau creăm profilul unic al sportivului
      const athlete = await AthleteService.findOrCreateAthlete({
        fullName: row.fullName,
        birthYear: row.birthYear,
        gender: row.gender,
        club: row.club,
        email: row.email,
        phone: row.phone,
      });

      const timeSeconds = this.parseTimeToSeconds(row.finishTime);
      const raceName = row.raceName?.trim() || 'General';

      // 2. Inserăm sau actualizăm participarea lui la acest concurs (Upsert)
      await db
        .insert(registrationsAndResults)
        .values({
          competitionId,
          athleteId: athlete.id,
          bibNumber: row.bibNumber?.toString().trim() || null,
          raceName,
          category: row.category?.trim() || null,
          clubAtEvent: row.club?.trim() || athlete.club || null,
          status: row.status || (row.finishTime ? 'finished' : 'registered'),
          finishTime: row.finishTime?.trim() || null,
          timeSeconds,
          rankOverall: row.rankOverall || null,
          rankCategory: row.rankCategory || null,
        })
        .onConflictDoUpdate({
          target: [
            registrationsAndResults.competitionId,
            registrationsAndResults.athleteId,
            registrationsAndResults.raceName,
          ],
          set: {
            bibNumber: row.bibNumber?.toString().trim() || undefined,
            category: row.category?.trim() || undefined,
            clubAtEvent: row.club?.trim() || undefined,
            status: row.status || (row.finishTime ? 'finished' : undefined),
            finishTime: row.finishTime?.trim() || undefined,
            timeSeconds: timeSeconds ?? undefined,
            rankOverall: row.rankOverall ?? undefined,
            rankCategory: row.rankCategory ?? undefined,
          },
        });

      importedCount++;
    }

    // Facem backup automat după importul masiv
    await createSafeBackup(`import_csv_comp_${competitionId}`);
    return { importedCount };
  }

  /**
   * Statistici generale pentru Dashboard-ul AdminLTE
   */
  static async getDashboardStats() {
    const [compCount] = await db.select({ count: sql<number>`count(*)` }).from(competitions);
    const [athleteCount] = await db.select({ count: sql<number>`count(*)` }).from(athletes);
    const [resultsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrationsAndResults);
    const [photosCount] = await db.select({ count: sql<number>`count(*)` }).from(competitionPhotos);

    return {
      competitions: compCount?.count || 0,
      athletes: athleteCount?.count || 0,
      participations: resultsCount?.count || 0,
      photos: photosCount?.count || 0,
    };
  }
}

import { db } from '../core/db';
import { athletes, registrationsAndResults, competitions, competitionPhotos } from '../core/schema';
import { eq, and, desc } from 'drizzle-orm';

export class AthleteService {
  /**
   * Elimină diacriticele, spațiile duble și transformă în litere mici
   * Ex: "  Popescu   Ștefan-Ionuț " -> "popescu stefan-ionut"
   */
  static normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimină diacriticele (ă, â, î, ș, ț)
      .replace(/\s+/g, ' '); // Înlocuiește spațiile multiple cu unul singur
  }

  /**
   * Generează un slug curat pentru URL: "Popescu Ion" -> "popescu-ion"
   */
  static createSlug(name: string, birthYear?: number | null): string {
    const base = this.normalizeName(name)
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    return birthYear ? `${base}-${birthYear}` : base;
  }

  /**
   * Găsește un sportiv existent sau creează unul nou (evitând dublurile)
   */
  static async findOrCreateAthlete(data: {
    fullName: string;
    birthYear?: number | null;
    gender?: 'M' | 'F' | null;
    club?: string | null;
    email?: string | null;
    phone?: string | null;
  }) {
    const normalized = this.normalizeName(data.fullName);

    // 1. Căutăm după numele normalizat
    const existingList = await db
      .select()
      .from(athletes)
      .where(eq(athletes.normalizedName, normalized));

    // Dacă avem anul nașterii, verificăm potrivirea exactă (pentru a nu confunda tatăl cu fiul cu același nume)
    let matched = existingList.find((a) => {
      if (data.birthYear && a.birthYear) {
        return a.birthYear === data.birthYear;
      }
      return true;
    });

    if (matched) {
      // Actualizăm ultimul club, email sau telefon dacă au apărut date noi la această ediție
      const updates: Partial<typeof athletes.$inferInsert> = {};
      if (data.club && data.club !== matched.club) updates.club = data.club;
      if (data.email && !matched.email) updates.email = data.email;
      if (data.phone && !matched.phone) updates.phone = data.phone;
      if (data.birthYear && !matched.birthYear) updates.birthYear = data.birthYear;

      if (Object.keys(updates).length > 0) {
        await db.update(athletes).set(updates).where(eq(athletes.id, matched.id));
      }
      return matched;
    }

    // 2. Dacă nu există, generăm un slug unic și îl inserăm
    let slug = this.createSlug(data.fullName, data.birthYear);
    const slugExists = await db.select().from(athletes).where(eq(athletes.slug, slug));
    if (slugExists.length > 0) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const [inserted] = await db
      .insert(athletes)
      .values({
        slug,
        fullName: data.fullName.trim(),
        normalizedName: normalized,
        birthYear: data.birthYear || null,
        gender: data.gender || null,
        club: data.club || null,
        email: data.email || null,
        phone: data.phone || null,
      })
      .returning();

    return inserted;
  }

  /**
   * Returnează profilul public complet al unui sportiv (fără date GDPR: email/telefon)
   * Include: istoric participări, statistici și pozele în care apare
   */
  static async getPublicProfileBySlug(slug: string) {
    const [athlete] = await db.select().from(athletes).where(eq(athletes.slug, slug));
    if (!athlete) return null;

    // Preluăm toate participările ordonate descrescător după data concursului
    const participations = await db
      .select({
        participation: registrationsAndResults,
        competition: competitions,
      })
      .from(registrationsAndResults)
      .innerJoin(competitions, eq(registrationsAndResults.competitionId, competitions.id))
      .where(eq(registrationsAndResults.athleteId, athlete.id))
      .orderBy(desc(competitions.date));

    // Preluăm toate pozele în care sportivul apare (după Bib Number la concursul respectiv SAU etichetat direct)
    const allPhotos = await db.select().from(competitionPhotos);
    const athletePhotos = allPhotos.filter((photo) => {
      // 1. Verificăm etichetarea directă după ID (ex: la premiere fără bib)
      if (photo.taggedAthleteIds) {
        try {
          const taggedIds: number[] = JSON.parse(photo.taggedAthleteIds);
          if (taggedIds.includes(athlete.id)) return true;
        } catch {}
      }

      // 2. Verificăm potrivirea Bib Number-ului la același concurs
      if (photo.bibNumbers) {
        const bibList = photo.bibNumbers.split(',').map((b) => b.trim());
        const participationAtThatEvent = participations.find(
          (p) => p.competition.id === photo.competitionId
        );
        if (
          participationAtThatEvent?.participation.bibNumber &&
          bibList.includes(participationAtThatEvent.participation.bibNumber.trim())
        ) {
          return true;
        }
      }

      return false;
    });

    // Calculăm statisticile rapide ale sportivului
    const finishedEvents = participations.filter((p) => p.participation.status === 'finished');
    const podiums = finishedEvents.filter(
      (p) =>
        (p.participation.rankOverall && p.participation.rankOverall <= 3) ||
        (p.participation.rankCategory && p.participation.rankCategory <= 3)
    );
    const totalKm = finishedEvents.reduce(
      (acc, p) => acc + (p.competition.distanceKm || 0),
      0
    );

    return {
      id: athlete.id,
      slug: athlete.slug,
      fullName: athlete.fullName,
      birthYear: athlete.birthYear,
      gender: athlete.gender,
      club: athlete.club,
      stats: {
        totalParticipations: participations.length,
        finishedCount: finishedEvents.length,
        podiumsCount: podiums.length,
        totalKm: Math.round(totalKm * 10) / 10,
      },
      participations,
      photos: athletePhotos,
    };
  }

  /**
   * Returnează indexul ușor pentru bara de căutare globală de pe prima pagină (fără date GDPR)
   */
  static async getSearchIndex() {
    const allAthletes = await db.select().from(athletes);
    const allResults = await db
      .select({
        athleteId: registrationsAndResults.athleteId,
        raceName: registrationsAndResults.raceName,
        category: registrationsAndResults.category,
        finishTime: registrationsAndResults.finishTime,
        rankOverall: registrationsAndResults.rankOverall,
        rankCategory: registrationsAndResults.rankCategory,
        status: registrationsAndResults.status,
        compTitle: competitions.title,
        compDate: competitions.date,
        compSlug: competitions.slug,
      })
      .from(registrationsAndResults)
      .innerJoin(competitions, eq(registrationsAndResults.competitionId, competitions.id))
      .orderBy(desc(competitions.date));

    return allAthletes.map((a) => ({
      slug: a.slug,
      fullName: a.fullName,
      normalizedName: a.normalizedName,
      birthYear: a.birthYear,
      club: a.club,
      results: allResults.filter((r) => r.athleteId === a.id),
    }));
  }
}

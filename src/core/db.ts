import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import fs from 'node:fs';
import path from 'node:path';

// Căile implicite pentru baza de date locală și folderul de backup
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'db');
const DB_PATH = path.join(DATA_DIR, 'arhiva-sanatatea.db');

// 1. Ne asigurăm că directoarele necesare există pe disc
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 2. Inițializăm conexiunea SQLite cu timeout de 5 secunde (evită erorile "database is locked")
const sqlite = new Database(DB_PATH, {
  timeout: 5000,
});

// 3. REGULI DE AUR ANTI-CORUPERE
// WAL (Write-Ahead Logging) previne coruperea la căderi de curent sau închidere bruscă
sqlite.pragma('journal_mode = WAL');
// FULL garantează că datele sunt scrise fizic pe disc înainte de confirmare
sqlite.pragma('synchronous = FULL');
// Activează constrângerile dintre tabele (ex: ștergerea unui concurs curăță și rezultatele lui)
sqlite.pragma('foreign_keys = ON');

// 4. Verificare automată a integrității la pornirea aplicației
export function checkDatabaseHealth(): { ok: boolean; message: string } {
  try {
    const result = sqlite.pragma('integrity_check', { simple: true });
    if (result === 'ok') {
      return { ok: true, message: 'Baza de date SQLite este sănătoasă (OK).' };
    }
    console.error('⚠️ ATENȚIE CRITICĂ: Eroare de integritate SQLite:', result);
    return { ok: false, message: `Eroare integritate: ${result}` };
  } catch (error: any) {
    console.error('⚠️ ATENȚIE CRITICĂ: Nu s-a putut verifica baza de date:', error);
    return { ok: false, message: error.message || 'Eroare necunoscută la verificare.' };
  }
}

// Rulăm verificarea imediat la pornire
const health = checkDatabaseHealth();
if (!health.ok) {
  console.error('🚨 RECOMANDARE: Oprește aplicația și restaurează ultimul fișier valid din backups/db/!');
}

// 5. Exportăm instanța Drizzle ORM conectată la schema noastră
export const db = drizzle(sqlite, { schema });

// 6. Funcție de Backup Sigur (folosește metoda nativă SQLite, sigură chiar și în timpul scrierii)
export async function createSafeBackup(reason: string = 'manual'): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_');
  const backupFileName = `arhiva_${timestamp}_${safeReason}.db`;
  const destinationPath = path.join(BACKUP_DIR, backupFileName);

  try {
    // Metoda nativă .backup() din better-sqlite3 copiază pagina cu pagină în siguranță
    await sqlite.backup(destinationPath);
    
    // Curățenie automată: păstrăm doar ultimele 20 de backup-uri ca să nu umplem discul
    cleanOldBackups(20);
    
    return destinationPath;
  } catch (error) {
    console.error('Eroare la crearea backup-ului SQLite:', error);
    throw error;
  }
}

// Șterge cele mai vechi backup-uri dacă depășesc limita stabilită
function cleanOldBackups(maxFilesToKeep: number) {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => file.endsWith('.db'))
      .map((file) => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time); // Cele mai noi primele

    if (files.length > maxFilesToKeep) {
      const toDelete = files.slice(maxFilesToKeep);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (err) {
    console.warn('Nu s-au putut curăța backup-urile vechi:', err);
  }
}

// 7. Închidere curată a conexiunii când oprești serverul (Ctrl+C)
process.on('SIGINT', () => {
  sqlite.pragma('wal_checkpoint(TRUNCATE)');
  sqlite.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sqlite.pragma('wal_checkpoint(TRUNCATE)');
  sqlite.close();
  process.exit(0);
});

import type { APIRoute } from 'astro';
import { ExportService } from '../../services/export.service';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const idParam = url.searchParams.get('id');
  const competitionId = idParam ? Number(idParam) : NaN;

  if (!competitionId || Number.isNaN(competitionId)) {
    return new Response('ID-ul competiției lipsește sau este invalid.', { status: 400 });
  }

  try {
    const { buffer, filename } = await ExportService.generateCompetitionZip(competitionId);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err: any) {
    return new Response(err?.message || 'Eroare la generarea arhivei ZIP.', { status: 500 });
  }
};

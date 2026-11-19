import { supabase } from './supabaseClient';
import type { PhotoReportInsert, PhotoReportRow } from '../types/database';

/**
 * Data access for terrain photo reports.
 * RLS only exposes approved reports and only allows inserts with
 * is_approved = true, so this service never sets it to false.
 * Uploading the image file to the "terrain-photos" bucket is handled
 * separately (Phase 4); here we only work with the table rows.
 */

const DEFAULT_LIMIT = 50;

/** Approved reports for one peak, newest photo first. */
export async function getPhotoReportsForPeak(
  peakId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<PhotoReportRow[]> {
  const { data, error } = await supabase
    .from('photo_reports')
    .select('*')
    .eq('peak_id', peakId)
    .eq('is_approved', true)
    .order('taken_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`photoReportsService.getPhotoReportsForPeak failed: ${error.message}`);
  }
  return data;
}

/** Input for a new report; is_approved is fixed by the service. */
export type NewPhotoReport = Omit<PhotoReportInsert, 'id' | 'is_approved' | 'created_at'>;

/** Creates a new report row and returns the stored row. */
export async function createPhotoReport(report: NewPhotoReport): Promise<PhotoReportRow> {
  const { data, error } = await supabase
    .from('photo_reports')
    .insert({ ...report, is_approved: true })
    .select('*')
    .single();

  if (error) {
    throw new Error(`photoReportsService.createPhotoReport failed: ${error.message}`);
  }
  return data;
}

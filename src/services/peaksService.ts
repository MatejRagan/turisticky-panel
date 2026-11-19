import { supabase } from './supabaseClient';
import type { PeakRow } from '../types/database';

/**
 * Read-only access to the peaks catalog.
 * Every function throws an Error with a descriptive message on failure,
 * so callers can handle errors in one place (e.g. an error boundary).
 */

/** All peaks, grouped by mountain range and sorted by name. */
export async function getAllPeaks(): Promise<PeakRow[]> {
  const { data, error } = await supabase
    .from('peaks')
    .select('*')
    .order('mountain_range', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`peaksService.getAllPeaks failed: ${error.message}`);
  }
  return data;
}

/** A single peak by its unique slug, or null when it does not exist. */
export async function getPeakBySlug(slug: string): Promise<PeakRow | null> {
  const { data, error } = await supabase
    .from('peaks')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`peaksService.getPeakBySlug("${slug}") failed: ${error.message}`);
  }
  return data;
}

/** All peaks in one mountain range (e.g. "Vysoké Tatry"), sorted by name. */
export async function getPeaksByRange(mountainRange: string): Promise<PeakRow[]> {
  const { data, error } = await supabase
    .from('peaks')
    .select('*')
    .eq('mountain_range', mountainRange)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`peaksService.getPeaksByRange("${mountainRange}") failed: ${error.message}`);
  }
  return data;
}

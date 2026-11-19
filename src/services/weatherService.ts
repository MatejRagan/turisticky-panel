import { supabase } from './supabaseClient';
import type { WeatherSnapshotRow } from '../types/database';

/**
 * Read-only access to weather snapshots (written by the sync worker
 * via service_role, see scripts/syncWeather.ts in a later step).
 * Dates are ISO calendar dates in the format "YYYY-MM-DD".
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string, label: string): void {
  if (!ISO_DATE.test(value)) {
    throw new Error(`weatherService: ${label} must be "YYYY-MM-DD", got "${value}"`);
  }
}

/** The snapshot for one peak and one forecast date, or null if none exists yet. */
export async function getWeatherForDate(
  peakId: string,
  forecastDate: string,
): Promise<WeatherSnapshotRow | null> {
  assertIsoDate(forecastDate, 'forecastDate');

  const { data, error } = await supabase
    .from('weather_snapshots')
    .select('*')
    .eq('peak_id', peakId)
    .eq('forecast_date', forecastDate)
    .maybeSingle();

  if (error) {
    throw new Error(`weatherService.getWeatherForDate failed: ${error.message}`);
  }
  return data;
}

/** Snapshots for one peak in an inclusive date range, sorted from oldest to newest. */
export async function getWeatherRange(
  peakId: string,
  fromDate: string,
  toDate: string,
): Promise<WeatherSnapshotRow[]> {
  assertIsoDate(fromDate, 'fromDate');
  assertIsoDate(toDate, 'toDate');

  const { data, error } = await supabase
    .from('weather_snapshots')
    .select('*')
    .eq('peak_id', peakId)
    .gte('forecast_date', fromDate)
    .lte('forecast_date', toDate)
    .order('forecast_date', { ascending: true });

  if (error) {
    throw new Error(`weatherService.getWeatherRange failed: ${error.message}`);
  }
  return data;
}

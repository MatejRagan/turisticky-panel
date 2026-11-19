/**
 * Weather sync worker: Open-Meteo (ICON, ECMWF IFS, GFS) -> public.weather_snapshots.
 *
 * Usage (from repository root):
 *   npm run sync:weather -- --probe     # inspect raw API response keys, writes nothing
 *   npm run sync:weather -- --dry-run   # fetch + compute for all peaks, writes nothing
 *   npm run sync:weather                # fetch + upsert into Supabase
 *
 * Idempotent: rows are upserted by (peak_id, forecast_date), so re-running
 * refreshes existing snapshots and never creates duplicates.
 *
 * Requires in .env (git-ignored) or CI secrets:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-side only)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json, WeatherSnapshotInsert } from '../src/types/database';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const API_URL = 'https://api.open-meteo.com/v1/forecast';
const MODELS = ['icon_seamless', 'ecmwf_ifs025', 'gfs_seamless'] as const;
type ModelId = (typeof MODELS)[number];

const TIMEZONE = 'Europe/Bratislava';
const FORECAST_DAYS = 7;
const REQUEST_DELAY_MS = 300;
const MAX_ATTEMPTS = 3;

const DAILY_PEAK_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'precipitation_sum',
  'snowfall_sum',
] as const;
const DAILY_VALLEY_VARS = ['temperature_2m_max', 'temperature_2m_min'] as const;
const HOURLY_VARS = ['cloud_cover'] as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Series = (number | null)[];

/** Values of one model for one calendar day. */
type DayValues = {
  temp_peak_max: number | null;
  temp_peak_min: number | null;
  temp_valley_max: number | null;
  temp_valley_min: number | null;
  wind_max: number | null;
  gust_max: number | null;
  precip: number | null;
  snow: number | null;
  cloud: number | null;
};
type DayValueKey = keyof DayValues;

interface PeakRef {
  id: string;
  slug: string;
  latitude: number;
  longitude: number;
  peak_elevation_m: number;
  valley_elevation_m: number;
}

/**
 * Model agreement heuristic (0-100): for each metric, take the spread
 * (max - min) across models; a spread of 0 scores 1, a spread >= tolerance
 * scores 0. The index is the weighted average over metrics that have values
 * from at least two models. Tune tolerances/weights here if needed.
 */
const AGREEMENT_METRICS: ReadonlyArray<{ key: DayValueKey; tolerance: number; weight: number }> = [
  { key: 'precip', tolerance: 10, weight: 0.25 }, // mm
  { key: 'wind_max', tolerance: 30, weight: 0.2 }, // km/h
  { key: 'temp_peak_max', tolerance: 6, weight: 0.2 }, // °C
  { key: 'snow', tolerance: 10, weight: 0.15 }, // cm
  { key: 'gust_max', tolerance: 40, weight: 0.1 }, // km/h
  { key: 'cloud', tolerance: 60, weight: 0.1 }, // percentage points
];

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSeries(value: unknown): value is Series {
  return Array.isArray(value) && value.every((x) => x === null || typeof x === 'number');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (check your .env file)`);
  return value;
}

function parseArgs(argv: string[]): { probe: boolean; dryRun: boolean } {
  return { probe: argv.includes('--probe'), dryRun: argv.includes('--dry-run') };
}

// -----------------------------------------------------------------------------
// Open-Meteo access
// -----------------------------------------------------------------------------

async function fetchForecast(params: URLSearchParams): Promise<unknown> {
  const url = `${API_URL}?${params.toString()}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = true;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body: unknown = await response.json();
        return body;
      }
      const detail = (await response.text()).slice(0, 300);
      retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`Open-Meteo HTTP ${response.status}: ${detail}`);
    } catch (error) {
      lastError = error;
    }
    if (!retryable) break;
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildParams(peak: Pick<PeakRef, 'latitude' | 'longitude'>, elevation: number, withHourly: boolean): URLSearchParams {
  const params = new URLSearchParams({
    latitude: String(peak.latitude),
    longitude: String(peak.longitude),
    elevation: String(elevation),
    daily: (withHourly ? DAILY_PEAK_VARS : DAILY_VALLEY_VARS).join(','),
    models: MODELS.join(','),
    timezone: TIMEZONE,
    forecast_days: String(FORECAST_DAYS),
  });
  if (withHourly) params.set('hourly', HOURLY_VARS.join(','));
  return params;
}

function readBlock(body: unknown, name: 'daily' | 'hourly'): Record<string, unknown> {
  if (!isRecord(body)) throw new Error('Open-Meteo response is not an object');
  const block = body[name];
  if (!isRecord(block)) throw new Error(`Open-Meteo response has no "${name}" block`);
  return block;
}

function readTimes(block: Record<string, unknown>): string[] {
  const times = block.time;
  if (!Array.isArray(times) || !times.every((t): t is string => typeof t === 'string')) {
    throw new Error('Open-Meteo block has no valid "time" array');
  }
  return times;
}

/** Looks up "<variable>_<model>" (multi-model response naming). */
function findSeries(block: Record<string, unknown>, variable: string, model: ModelId): Series | null {
  const value = block[`${variable}_${model}`];
  return isSeries(value) ? value : null;
}

function valueAt(series: Series | null, index: number): number | null {
  if (!series) return null;
  const value = series[index];
  return value === undefined ? null : value;
}

/** Mean of hourly values per calendar day (date = first 10 chars of the timestamp). */
function dailyMeanFromHourly(times: string[], series: Series | null): Map<string, number | null> {
  const sums = new Map<string, { sum: number; count: number }>();
  if (series) {
    times.forEach((time, i) => {
      const value = series[i];
      if (value === null || value === undefined) return;
      const date = time.slice(0, 10);
      const entry = sums.get(date) ?? { sum: 0, count: 0 };
      entry.sum += value;
      entry.count += 1;
      sums.set(date, entry);
    });
  }
  const result = new Map<string, number | null>();
  for (const [date, { sum, count }] of sums) result.set(date, count > 0 ? sum / count : null);
  return result;
}

// -----------------------------------------------------------------------------
// Aggregation
// -----------------------------------------------------------------------------

function hasAnyValue(values: DayValues): boolean {
  return Object.values(values).some((v) => v !== null);
}

function aggregate(list: DayValues[], key: DayValueKey): number | null {
  const numbers = list.map((v) => v[key]).filter((v): v is number => v !== null);
  if (numbers.length === 0) return null;
  return round1(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

function computeAgreement(list: DayValues[]): number | null {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const { key, tolerance, weight } of AGREEMENT_METRICS) {
    const numbers = list.map((v) => v[key]).filter((v): v is number => v !== null);
    if (numbers.length < 2) continue;
    const spread = Math.max(...numbers) - Math.min(...numbers);
    const score = 1 - Math.min(spread / tolerance, 1);
    weightedSum += score * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;
  return Math.round((100 * weightedSum) / weightTotal);
}

function clampPercent(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildModelDays(
  peakDaily: Record<string, unknown>,
  peakHourly: Record<string, unknown>,
  valleyDaily: Record<string, unknown>,
  days: string[],
  hourlyTimes: string[],
): Map<ModelId, Map<string, DayValues>> {
  const result = new Map<ModelId, Map<string, DayValues>>();

  for (const model of MODELS) {
    const tMax = findSeries(peakDaily, 'temperature_2m_max', model);
    const tMin = findSeries(peakDaily, 'temperature_2m_min', model);
    const wind = findSeries(peakDaily, 'wind_speed_10m_max', model);
    const gust = findSeries(peakDaily, 'wind_gusts_10m_max', model);
    const precip = findSeries(peakDaily, 'precipitation_sum', model);
    const snow = findSeries(peakDaily, 'snowfall_sum', model);
    const vMax = findSeries(valleyDaily, 'temperature_2m_max', model);
    const vMin = findSeries(valleyDaily, 'temperature_2m_min', model);
    const cloud = dailyMeanFromHourly(hourlyTimes, findSeries(peakHourly, 'cloud_cover', model));

    const perDay = new Map<string, DayValues>();
    days.forEach((date, i) => {
      perDay.set(date, {
        temp_peak_max: valueAt(tMax, i),
        temp_peak_min: valueAt(tMin, i),
        temp_valley_max: valueAt(vMax, i),
        temp_valley_min: valueAt(vMin, i),
        wind_max: valueAt(wind, i),
        gust_max: valueAt(gust, i),
        precip: valueAt(precip, i),
        snow: valueAt(snow, i),
        cloud: cloud.get(date) ?? null,
      });
    });
    result.set(model, perDay);
  }

  return result;
}

function buildSnapshots(
  peak: PeakRef,
  modelDays: Map<ModelId, Map<string, DayValues>>,
  days: string[],
  fetchedAt: string,
): WeatherSnapshotInsert[] {
  const snapshots: WeatherSnapshotInsert[] = [];

  for (const date of days) {
    const perModel = new Map<ModelId, DayValues>();
    for (const model of MODELS) {
      const values = modelDays.get(model)?.get(date);
      if (values && hasAnyValue(values)) perModel.set(model, values);
    }
    if (perModel.size === 0) continue;

    const list = [...perModel.values()];
    const models: { [key: string]: Json | undefined } = {};
    for (const [model, values] of perModel) models[model] = values;

    snapshots.push({
      peak_id: peak.id,
      forecast_date: date,
      fetched_at: fetchedAt,
      temp_peak_min_c: aggregate(list, 'temp_peak_min'),
      temp_peak_max_c: aggregate(list, 'temp_peak_max'),
      temp_valley_min_c: aggregate(list, 'temp_valley_min'),
      temp_valley_max_c: aggregate(list, 'temp_valley_max'),
      wind_speed_max_kmh: aggregate(list, 'wind_max'),
      wind_gust_max_kmh: aggregate(list, 'gust_max'),
      precipitation_mm: aggregate(list, 'precip'),
      snowfall_cm: aggregate(list, 'snow'),
      cloud_cover_pct: clampPercent(aggregate(list, 'cloud')),
      model_agreement_index: computeAgreement(list),
      source_models: [...perModel.keys()],
      raw_payload: {
        elevations_m: { peak: peak.peak_elevation_m, valley: peak.valley_elevation_m },
        models,
      },
    });
  }

  return snapshots;
}

async function fetchPeakSnapshots(peak: PeakRef, fetchedAt: string): Promise<WeatherSnapshotInsert[]> {
  const peakBody = await fetchForecast(buildParams(peak, peak.peak_elevation_m, true));
  await sleep(REQUEST_DELAY_MS);
  const valleyBody = await fetchForecast(buildParams(peak, peak.valley_elevation_m, false));

  const peakDaily = readBlock(peakBody, 'daily');
  const peakHourly = readBlock(peakBody, 'hourly');
  const valleyDaily = readBlock(valleyBody, 'daily');

  const days = readTimes(peakDaily);
  const valleyDays = readTimes(valleyDaily);
  const hourlyTimes = readTimes(peakHourly);
  if (days.length !== valleyDays.length) {
    throw new Error('Peak and valley responses have a different number of days');
  }

  const modelDays = buildModelDays(peakDaily, peakHourly, valleyDaily, days, hourlyTimes);
  const snapshots = buildSnapshots(peak, modelDays, days, fetchedAt);

  if (snapshots.length === 0) {
    throw new Error(
      `No data matched the requested models. Keys in response: ${Object.keys(peakDaily).join(', ')}. ` +
        'Run "npm run sync:weather -- --probe" and adjust MODELS in the script.',
    );
  }
  return snapshots;
}

// -----------------------------------------------------------------------------
// Modes
// -----------------------------------------------------------------------------

/** Prints raw response keys for one known peak (Rysy); touches no database. */
async function runProbe(): Promise<void> {
  const rysy = { latitude: 49.1795, longitude: 20.0881 };
  const body = await fetchForecast(buildParams(rysy, 2503, true));
  const daily = readBlock(body, 'daily');
  const hourly = readBlock(body, 'hourly');

  console.log(`Requested models: ${MODELS.join(', ')}`);
  console.log('\nDaily keys:');
  for (const key of Object.keys(daily)) {
    const value = daily[key];
    const preview = Array.isArray(value) ? JSON.stringify(value.slice(0, 3)) : String(value);
    console.log(`  ${key}: ${preview}`);
  }
  console.log('\nHourly keys:');
  for (const key of Object.keys(hourly)) console.log(`  ${key}`);

  const expected = MODELS.map((m) => `temperature_2m_max_${m}`);
  const missing = expected.filter((key) => !(key in daily));
  console.log(
    missing.length === 0
      ? '\nOK: all expected "<variable>_<model>" keys are present.'
      : `\nWARNING: missing keys: ${missing.join(', ')} - adjust MODELS in the script.`,
  );
}

async function loadPeaks(): Promise<{ peaks: PeakRef[]; supabase: ReturnType<typeof createClient<Database>> }> {
  const supabase = createClient<Database>(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('peaks')
    .select('id, slug, latitude, longitude, peak_elevation_m, valley_elevation_m')
    .order('slug', { ascending: true });

  if (error) throw new Error(`Loading peaks failed: ${error.message}`);
  if (data.length === 0) throw new Error('Table public.peaks is empty - run "npm run seed:peaks" first.');
  return { peaks: data, supabase };
}

async function runSync(dryRun: boolean): Promise<void> {
  const { peaks, supabase } = await loadPeaks();
  const fetchedAt = new Date().toISOString();
  console.log(`${dryRun ? '[dry-run] ' : ''}Syncing ${peaks.length} peaks (${MODELS.join(', ')}), ${FORECAST_DAYS} days each.`);

  const failures: string[] = [];
  let totalRows = 0;

  for (const peak of peaks) {
    try {
      const snapshots = await fetchPeakSnapshots(peak, fetchedAt);

      if (!dryRun) {
        const { error } = await supabase
          .from('weather_snapshots')
          .upsert(snapshots, { onConflict: 'peak_id,forecast_date' });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
      }

      const indexes = snapshots
        .map((s) => s.model_agreement_index)
        .filter((v): v is number => typeof v === 'number');
      const avg = indexes.length > 0 ? Math.round(indexes.reduce((a, b) => a + b, 0) / indexes.length) : 'n/a';
      totalRows += snapshots.length;
      console.log(`OK   ${peak.slug}: ${snapshots.length} days, avg agreement ${avg}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(peak.slug);
      console.error(`FAIL ${peak.slug}: ${message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n${dryRun ? 'Computed' : 'Upserted'} ${totalRows} snapshot rows for ${peaks.length - failures.length}/${peaks.length} peaks.`);
  if (failures.length > 0) {
    console.error(`Failed peaks: ${failures.join(', ')}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { probe, dryRun } = parseArgs(process.argv.slice(2));
  if (probe) {
    await runProbe();
    return;
  }
  await runSync(dryRun);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

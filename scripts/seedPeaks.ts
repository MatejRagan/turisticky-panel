/**
 * Idempotent seed script for public.peaks.
 *
 * Usage (from repository root):
 *   npm run seed:peaks
 *
 * Reads src/data/peaks-seed.json, validates every row against the
 * constraints from supabase/schema.sql and upserts by `slug`.
 * Re-running the script updates existing rows and never creates duplicates.
 *
 * Requires in .env (git-ignored):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-side only, never expose to the frontend)
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

interface PeakSeed {
  slug: string;
  name: string;
  mountain_range: string;
  peak_elevation_m: number;
  valley_elevation_m: number;
  latitude: number;
  longitude: number;
  starting_point_name: string;
  ascent_minutes: number;
  descent_minutes: number;
  distance_km: number;
  seasonal_closure_start: string | null;
  seasonal_closure_end: string | null;
  seasonal_closure_note: string | null;
}

const SEED_FILE = fileURLToPath(new URL('../src/data/peaks-seed.json', import.meta.url));
const MM_DD = /^\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns a list of validation problems for one row (empty list = valid). */
function validateRow(row: unknown, index: number): string[] {
  if (!isRecord(row)) return [`row ${index}: not an object`];

  const problems: string[] = [];
  const label = typeof row.slug === 'string' ? row.slug : `row ${index}`;

  const requireString = (key: string): void => {
    const v = row[key];
    if (typeof v !== 'string' || v.trim().length === 0) {
      problems.push(`${label}: "${key}" must be a non-empty string`);
    }
  };
  const requireInt = (key: string, min: number): number | null => {
    const v = row[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min) {
      problems.push(`${label}: "${key}" must be an integer >= ${min}`);
      return null;
    }
    return v;
  };
  const requireNumber = (key: string): number | null => {
    const v = row[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      problems.push(`${label}: "${key}" must be a finite number`);
      return null;
    }
    return v;
  };
  const optionalMmDd = (key: string): string | null => {
    const v = row[key];
    if (v === null) return null;
    if (typeof v !== 'string' || !MM_DD.test(v)) {
      problems.push(`${label}: "${key}" must be null or "MM-DD"`);
      return null;
    }
    return v;
  };

  requireString('slug');
  requireString('name');
  requireString('mountain_range');
  requireString('starting_point_name');

  const peak = requireInt('peak_elevation_m', 1);
  const valley = requireInt('valley_elevation_m', 0);
  if (peak !== null && valley !== null && valley >= peak) {
    problems.push(`${label}: valley_elevation_m must be < peak_elevation_m`);
  }

  const lat = requireNumber('latitude');
  if (lat !== null && (lat < -90 || lat > 90)) problems.push(`${label}: latitude out of range`);
  const lon = requireNumber('longitude');
  if (lon !== null && (lon < -180 || lon > 180)) problems.push(`${label}: longitude out of range`);

  requireInt('ascent_minutes', 1);
  requireInt('descent_minutes', 1);
  const dist = requireNumber('distance_km');
  if (dist !== null && (dist <= 0 || dist >= 1000)) {
    problems.push(`${label}: distance_km must be > 0 and < 1000 (numeric(5,2))`);
  }

  const start = optionalMmDd('seasonal_closure_start');
  const end = optionalMmDd('seasonal_closure_end');
  if ((start === null) !== (end === null)) {
    problems.push(`${label}: seasonal_closure_start and _end must both be set or both null`);
  }

  const note = row.seasonal_closure_note;
  if (note !== null && typeof note !== 'string') {
    problems.push(`${label}: "seasonal_closure_note" must be a string or null`);
  }

  return problems;
}

function isPeakSeed(row: unknown, index: number): row is PeakSeed {
  return validateRow(row, index).length === 0;
}

async function loadSeed(): Promise<PeakSeed[]> {
  const raw = await readFile(SEED_FILE, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('peaks-seed.json must contain a JSON array');
  }

  const problems = parsed.flatMap((row, i) => validateRow(row, i));
  const slugs = parsed.filter(isRecord).map((r) => r.slug);
  if (new Set(slugs).size !== slugs.length) problems.push('duplicate slugs in seed file');

  if (problems.length > 0) {
    throw new Error(`Seed validation failed:\n - ${problems.join('\n - ')}`);
  }

  return parsed.filter(isPeakSeed);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (check your .env file)`);
  return value;
}

async function main(): Promise<void> {
  const url = requireEnv('VITE_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const peaks = await loadSeed();
  console.log(`Loaded and validated ${peaks.length} peaks from seed file.`);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: upsertError } = await supabase
    .from('peaks')
    .upsert(peaks, { onConflict: 'slug' });

  if (upsertError) {
    throw new Error(`Upsert failed: ${upsertError.message}`);
  }

  const { count, error: countError } = await supabase
    .from('peaks')
    .select('slug', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Count check failed: ${countError.message}`);
  }

  console.log(`Upsert OK. Table public.peaks now contains ${count ?? 'unknown'} rows.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

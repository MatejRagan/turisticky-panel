/**
 * TypeScript models mirroring supabase/schema.sql (public schema).
 * Keep this file in sync with the schema: column names, nullability and
 * allowed values must match the database exactly.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Mirrors the CHECK constraint on photo_reports.surface_condition. */
export type SurfaceCondition =
  | 'dry'
  | 'mud'
  | 'snow_patches'
  | 'continuous_snow'
  | 'ice'
  | 'mixed';

// -----------------------------------------------------------------------------
// peaks
// -----------------------------------------------------------------------------

export interface PeakRow {
  id: string;
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
  /** 'MM-DD' or null (recurring annual closure window). */
  seasonal_closure_start: string | null;
  seasonal_closure_end: string | null;
  seasonal_closure_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PeakInsert {
  id?: string;
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
  seasonal_closure_start?: string | null;
  seasonal_closure_end?: string | null;
  seasonal_closure_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PeakUpdate = Partial<PeakInsert>;

// -----------------------------------------------------------------------------
// weather_snapshots
// -----------------------------------------------------------------------------

export interface WeatherSnapshotRow {
  id: string;
  peak_id: string;
  /** 'YYYY-MM-DD' */
  forecast_date: string;
  fetched_at: string;
  temp_peak_min_c: number | null;
  temp_peak_max_c: number | null;
  temp_valley_min_c: number | null;
  temp_valley_max_c: number | null;
  wind_speed_max_kmh: number | null;
  wind_gust_max_kmh: number | null;
  precipitation_mm: number | null;
  snowfall_cm: number | null;
  cloud_cover_pct: number | null;
  /** 0-100 agreement across ICON, ECMWF and GFS. */
  model_agreement_index: number | null;
  source_models: string[];
  raw_payload: Json | null;
}

export interface WeatherSnapshotInsert {
  id?: string;
  peak_id: string;
  forecast_date: string;
  fetched_at?: string;
  temp_peak_min_c?: number | null;
  temp_peak_max_c?: number | null;
  temp_valley_min_c?: number | null;
  temp_valley_max_c?: number | null;
  wind_speed_max_kmh?: number | null;
  wind_gust_max_kmh?: number | null;
  precipitation_mm?: number | null;
  snowfall_cm?: number | null;
  cloud_cover_pct?: number | null;
  model_agreement_index?: number | null;
  source_models?: string[];
  raw_payload?: Json | null;
}

export type WeatherSnapshotUpdate = Partial<WeatherSnapshotInsert>;

// -----------------------------------------------------------------------------
// photo_reports
// -----------------------------------------------------------------------------

export interface PhotoReportRow {
  id: string;
  peak_id: string;
  image_path: string;
  image_url: string;
  /** 'YYYY-MM-DD' */
  taken_at: string;
  elevation_approx_m: number | null;
  surface_condition: SurfaceCondition;
  recommended_gear: string[];
  note: string | null;
  author_name: string;
  is_approved: boolean;
  created_at: string;
}

/**
 * Note: the RLS insert policy only allows rows with is_approved = true
 * (the column default), so clients should not set it to false.
 */
export interface PhotoReportInsert {
  id?: string;
  peak_id: string;
  image_path: string;
  image_url: string;
  taken_at: string;
  elevation_approx_m?: number | null;
  surface_condition: SurfaceCondition;
  recommended_gear?: string[];
  note?: string | null;
  author_name?: string;
  is_approved?: boolean;
  created_at?: string;
}

export type PhotoReportUpdate = Partial<PhotoReportInsert>;

// -----------------------------------------------------------------------------
// webcams
// -----------------------------------------------------------------------------

export interface WebcamRow {
  id: string;
  peak_id: string;
  name: string;
  provider: string;
  stream_url: string;
  thumbnail_url: string | null;
  elevation_m: number | null;
  is_active: boolean;
  created_at: string;
}

export interface WebcamInsert {
  id?: string;
  peak_id: string;
  name: string;
  provider: string;
  stream_url: string;
  thumbnail_url?: string | null;
  elevation_m?: number | null;
  is_active?: boolean;
  created_at?: string;
}

export type WebcamUpdate = Partial<WebcamInsert>;

// -----------------------------------------------------------------------------
// Database generic for supabase-js (createClient<Database>)
// -----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      peaks: {
        Row: PeakRow;
        Insert: PeakInsert;
        Update: PeakUpdate;
        Relationships: [];
      };
      weather_snapshots: {
        Row: WeatherSnapshotRow;
        Insert: WeatherSnapshotInsert;
        Update: WeatherSnapshotUpdate;
        Relationships: [
          {
            foreignKeyName: 'weather_snapshots_peak_id_fkey';
            columns: ['peak_id'];
            isOneToOne: false;
            referencedRelation: 'peaks';
            referencedColumns: ['id'];
          },
        ];
      };
      photo_reports: {
        Row: PhotoReportRow;
        Insert: PhotoReportInsert;
        Update: PhotoReportUpdate;
        Relationships: [
          {
            foreignKeyName: 'photo_reports_peak_id_fkey';
            columns: ['peak_id'];
            isOneToOne: false;
            referencedRelation: 'peaks';
            referencedColumns: ['id'];
          },
        ];
      };
      webcams: {
        Row: WebcamRow;
        Insert: WebcamInsert;
        Update: WebcamUpdate;
        Relationships: [
          {
            foreignKeyName: 'webcams_peak_id_fkey';
            columns: ['peak_id'];
            isOneToOne: false;
            referencedRelation: 'peaks';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

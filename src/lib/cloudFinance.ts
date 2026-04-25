/**
 * Cloud sync for household financial data.
 *
 * Design:
 *   - localStorage is the PRIMARY store — all reads/writes hit it first (zero latency, offline).
 *   - `household_finance` in Supabase is the SYNC layer — it lets every member of a household
 *     share the same data across devices.
 *   - On FinanceProvider mount: fetch cloud data, merge into local (cloud wins on financial
 *     fields; device keeps its own darkMode + language preferences).
 *   - On every data change: push to cloud debounced at 1.5 s (FinanceContext owns the timer).
 *   - When supabaseConfigured is false every function is a silent no-op — single-device usage
 *     works exactly as before with zero code changes at call sites.
 */

import { supabase, supabaseConfigured } from './supabase'
import type { FinanceData } from '@/types'

// ─── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the shared household FinanceData from Supabase.
 * Returns null when:
 *   - Supabase is not configured
 *   - No row exists yet (owner hasn't pushed data yet)
 *   - Any network/parse error
 */
export async function fetchCloudFinanceData(householdId: string): Promise<FinanceData | null> {
  if (!supabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('household_finance')
      .select('data')
      .eq('household_id', householdId)
      .single()
    if (error || !data?.data) return null
    return data.data as FinanceData
  } catch {
    return null
  }
}

// ─── Push ──────────────────────────────────────────────────────────────────────

/**
 * Upsert the household FinanceData to Supabase.
 * Safe to call on every change — FinanceContext debounces this to 1.5 s.
 * Silent no-op when Supabase is not configured.
 */
export async function pushCloudFinanceData(
  householdId: string,
  financeData: FinanceData
): Promise<void> {
  if (!supabaseConfigured) return
  try {
    await supabase
      .from('household_finance')
      .upsert(
        { household_id: householdId, data: financeData, updated_at: new Date().toISOString() },
        { onConflict: 'household_id' }
      )
  } catch {
    // Network failures are non-fatal — local data is always safe
  }
}

// ─── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merge cloud data on top of local data.
 *
 * Strategy:
 *   - Cloud wins on ALL financial fields (members, expenses, accounts, goals, history,
 *     currency, locale, emergencyBufferMonths) so every household member sees the same
 *     numbers.
 *   - Local device keeps its OWN darkMode and language — these are UI preferences
 *     that differ per person and must never be overwritten by another member's device.
 *
 * @param cloudData  Data fetched from Supabase (source of truth for financials)
 * @param localData  Data currently in localStorage (source of truth for device prefs)
 */
export function mergeFinanceData(cloudData: FinanceData, localData: FinanceData): FinanceData {
  return {
    ...cloudData,
    // Preserve per-device UI prefs — never overwrite from cloud
    darkMode: localData.darkMode,
    language: localData.language,
  }
}

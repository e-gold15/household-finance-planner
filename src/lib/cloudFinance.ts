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

// Shared fallback shape — used by mergeFinanceData to fill in fields that may be
// absent in cloud blobs written by an older version of the app.
// historicalExpenses is optional on MonthSnapshot — old cloud blobs without it are safe (accessed via ?? [] in UI)
const FINANCE_DEFAULTS: FinanceData = {
  members:               [],
  expenses:              [],
  accounts:              [],
  goals:                 [],
  history:               [],
  emergencyBufferMonths: 3,
  currency:              'ILS',
  locale:                'he-IL',
  darkMode:              false,
  language:              'en',
  categoryBudgets:       {},
}

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

// ─── Merge helpers ─────────────────────────────────────────────────────────────

/**
 * Additive merge for arrays identified by `id`.
 *
 * Cloud wins on conflicts (same ID → cloud version kept).
 * Local-only items (IDs not in cloud) are preserved so that writes made on this
 * device between the last push and the current pull are never silently dropped.
 */
function mergeById<T extends { id: string }>(cloudItems: T[], localItems: T[]): T[] {
  const result = new Map(cloudItems.map(item => [item.id, item]))
  for (const localItem of localItems) {
    if (!result.has(localItem.id)) {
      result.set(localItem.id, localItem)
    }
  }
  return Array.from(result.values())
}

// ─── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merge cloud data on top of local data.
 *
 * Strategy:
 *   - Start from FINANCE_DEFAULTS so any field missing from an older cloud blob
 *     (schema added after the blob was written) is filled with a safe default.
 *   - Scalar financial fields (currency, locale, emergencyBufferMonths,
 *     categoryBudgets): cloud wins outright.
 *   - Array fields (expenses, accounts, goals, members, history): additive merge
 *     via mergeById — cloud wins on conflicts (same ID), local-only items are
 *     preserved so writes not yet pushed to cloud are never lost.
 *   - Local device keeps its OWN darkMode and language — these are UI preferences
 *     that differ per person and must never be overwritten by another member's device.
 *
 * @param cloudData  Data fetched from Supabase (source of truth for financials)
 * @param localData  Data currently in localStorage (source of truth for device prefs)
 */
export function mergeFinanceData(cloudData: FinanceData, localData: FinanceData): FinanceData {
  return {
    ...FINANCE_DEFAULTS,
    // Scalar fields: cloud wins
    currency:              cloudData.currency              ?? FINANCE_DEFAULTS.currency,
    locale:                cloudData.locale                ?? FINANCE_DEFAULTS.locale,
    emergencyBufferMonths: cloudData.emergencyBufferMonths ?? FINANCE_DEFAULTS.emergencyBufferMonths,
    // categoryBudgets: union merge — cloud wins on conflicts, local-only entries preserved
    categoryBudgets: {
      ...(localData.categoryBudgets  ?? {}),
      ...(cloudData.categoryBudgets  ?? {}),
    },
    // Array fields: additive merge (cloud wins on conflicts, local-only items preserved)
    expenses: mergeById(cloudData.expenses ?? [], localData.expenses ?? []),
    accounts: mergeById(cloudData.accounts ?? [], localData.accounts ?? []),
    goals:    mergeById(cloudData.goals    ?? [], localData.goals    ?? []),
    members:  mergeById(cloudData.members  ?? [], localData.members  ?? []),
    history:  mergeById(cloudData.history  ?? [], localData.history  ?? []),
    // Per-device prefs: local always wins
    darkMode: localData.darkMode,
    language: localData.language,
  }
}

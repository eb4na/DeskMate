import { supabase } from '@/lib/supabase';

// User moderation: reporting and blocking. Reports land in the `user_reports`
// table (founder reviews them in the Supabase dashboard — no in-app admin view).
// Blocks use the `blocked_codes` table; the client filters blocked codes out of the
// friends list, incoming requests and DMs ("hide them"). Both need their migrations
// applied (supabase/migrations/20260622_user_reports.sql + 20260614c_blocked_codes.sql).

export type ReportReason = 'harassment' | 'spam' | 'inappropriate' | 'cheating' | 'underage' | 'other';
export const REPORT_REASONS: ReportReason[] = ['harassment', 'spam', 'inappropriate', 'cheating', 'underage', 'other'];

const norm = (code: string) => code.trim().toUpperCase();

/** File a report against a friend code. Returns true on success. */
export async function reportUser(reportedCode: string, reason: ReportReason, reporterCode?: string, details?: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('user_reports').insert({
    reporter_id: user.id,
    reporter_code: reporterCode ? norm(reporterCode) : null,
    reported_code: norm(reportedCode),
    reason,
    details: details?.trim() || null,
  });
  return !error;
}

/** The codes this account has blocked (owner-only row-level security). */
export async function loadBlockedCodes(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('blocked_codes').select('blocked_code').eq('user_id', user.id);
  return (data ?? []).map((r) => r.blocked_code as string);
}

export async function blockUserRemote(code: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('blocked_codes').upsert({ user_id: user.id, blocked_code: norm(code) });
  return !error;
}

export async function unblockUserRemote(code: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('blocked_codes').delete().eq('user_id', user.id).eq('blocked_code', norm(code));
  return !error;
}

import { supabase } from "./supabase";
// Supabase defaults to a row cap. Load complete, deterministically ordered pages
// so summary totals and exports do not silently stop at the first 1000 records.
export async function fetchAllReportRows<T>(table: string, order: { field: string; ascending: boolean }[], columns = "*") {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase!.from(table).select(columns);
    for (const field of order) query = query.order(field.field, { ascending: field.ascending, nullsFirst: false });
    const { data, error } = await query.order("id").range(offset, offset + 999);
    if (error) return { data: rows, error };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

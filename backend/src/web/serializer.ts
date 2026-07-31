import { filterColumnsForRole, filterRowsForRole, type ColumnDef } from '../lib/rbac.js';

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResult<T extends Record<string, unknown>> {
  columns: ColumnDef[];
  rows: T[];
  total: number;
  meta: PaginatedMeta;
}

export function paginatedResponse<T extends Record<string, unknown>>(
  columns: ColumnDef[],
  rows: T[],
  total: number,
  page: number,
  limit: number,
  role: string,
): PaginatedResult<T> {
  return {
    columns: filterColumnsForRole(role, columns),
    rows: filterRowsForRole(role, rows),
    total,
    meta: { total, page, limit },
  };
}

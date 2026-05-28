import type { PaginatedResponse } from "@auto8/shared";

import type { PaginationQueryDto } from "../dto/pagination.dto";

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationQueryDto,
): PaginatedResponse<T> {
  const skip = (pagination.page - 1) * pagination.limit;
  return {
    data: items,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: skip + items.length < total,
    },
  };
}

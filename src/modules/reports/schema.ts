import { z } from "zod";

export const reportDateRangeSchema = z.object({
  startDate: z.string().min(10, "Valid start date required (YYYY-MM-DD)"),
  endDate: z.string().min(10, "Valid end date required (YYYY-MM-DD)"),
  branchId: z.string().uuid("Invalid branch ID").optional().or(z.literal("")),
  warehouseId: z.string().uuid("Invalid warehouse ID").optional().or(z.literal("")),
});

export type ReportDateRangeInput = z.infer<typeof reportDateRangeSchema>;

export const salesReportFilterSchema = reportDateRangeSchema.extend({
  customerId: z.string().uuid().optional().or(z.literal("")),
  salesmanId: z.string().uuid().optional().or(z.literal("")),
  productId: z.string().uuid().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
});

export type SalesReportFilterInput = z.infer<typeof salesReportFilterSchema>;

export const inventoryReportFilterSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal("")),
  warehouseId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  expiryThresholdDays: z.coerce.number().int().min(0).default(30),
});

export type InventoryReportFilterInput = z.infer<typeof inventoryReportFilterSchema>;

export const productionReportFilterSchema = reportDateRangeSchema.extend({
  productId: z.string().uuid().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
});

export type ProductionReportFilterInput = z.infer<typeof productionReportFilterSchema>;

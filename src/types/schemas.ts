import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const ItemStatusSchema = z.enum(['backlog', 'planned', 'in-progress', 'done']);

export const InitiativeSizeSchema = z.enum(['weeks', 'months', 'quarters', 'years']);

export const ConnectionTypeSchema = z.enum(['direct', 'indirect', 'blocking']);

export const ViewModeSchema = z.enum(['canvas', 'kanban', 'gantt']);

// ── Value Objects ────────────────────────────────────────────────────────────

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const DateRangeSchema = z.object({
  start: z.string(), // ISO date string (YYYY-MM-DD)
  end: z.string(),   // ISO date string (YYYY-MM-DD)
});

// ── Domain Models ────────────────────────────────────────────────────────────

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
});

export const RoadmapItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: ItemStatusSchema,
  size: InitiativeSizeSchema.optional(),
  dateRange: DateRangeSchema.optional(),
  parentId: z.string().optional(),
  milestones: z.array(MilestoneSchema),
  position: PositionSchema,
});

export const ConnectionSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  label: z.string().optional(),
  type: ConnectionTypeSchema.optional(),
});

export const GroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  colorIndex: z.number(),
  itemIds: z.array(z.string()),
});

// ── Aggregate ────────────────────────────────────────────────────────────────

export const RoadmapDataSchema = z.object({
  items: z.array(RoadmapItemSchema),
  connections: z.array(ConnectionSchema),
  groups: z.array(GroupSchema),
});

// ── API Response Schemas ─────────────────────────────────────────────────────

export const StatusUpdateResponseSchema = z.object({
  items: z.array(RoadmapItemSchema),
});

export const HealthResponseSchema = z.object({
  status: z.string(),
});

// ── Form Validation Schemas ──────────────────────────────────────────────────

export const ItemFormSchema = z.object({
  title: z.string().min(1, 'Title is required').transform((s) => s.trim()),
  description: z.string().transform((s) => s.trim()),
  status: ItemStatusSchema,
  size: InitiativeSizeSchema.or(z.literal('')).optional(),
  dateRange: DateRangeSchema.optional(),
  parentId: z.string().optional(),
});

// ── Import Validation (lenient — coerces missing fields) ─────────────────────

export const ImportDataSchema = z.object({
  items: z.array(RoadmapItemSchema),
  connections: z.array(ConnectionSchema).default([]),
  groups: z.array(GroupSchema).default([]),
});

// ── Inferred Types ───────────────────────────────────────────────────────────

export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type InitiativeSize = z.infer<typeof InitiativeSizeSchema>;
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;
export type ViewMode = z.infer<typeof ViewModeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type RoadmapItem = z.infer<typeof RoadmapItemSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type RoadmapData = z.infer<typeof RoadmapDataSchema>;
export type ItemFormData = z.infer<typeof ItemFormSchema>;

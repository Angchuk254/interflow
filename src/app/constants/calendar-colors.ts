/**
 * Shared calendar color constants - ensures legend and event colors match across all views.
 * Use these for calendar event dots, borders, and legend.
 */

export const CALENDAR_PRIORITY_COLORS = {
  high: 'danger',
  medium: 'warning',
  low: 'secondary',
} as const;

export const CALENDAR_EVENT_TYPE_COLORS = {
  task_start: 'task-start',   // green (secondary)
  task_due: 'task-due',       // primary blue
  project_start: 'project-start', // purple
  project_due: 'project-due',  // sky blue
} as const;

export type PriorityClass = (typeof CALENDAR_PRIORITY_COLORS)[keyof typeof CALENDAR_PRIORITY_COLORS];
export type EventTypeClass = (typeof CALENDAR_EVENT_TYPE_COLORS)[keyof typeof CALENDAR_EVENT_TYPE_COLORS];

export function getCalendarPriorityClass(priority: string): string {
  return CALENDAR_PRIORITY_COLORS[priority as keyof typeof CALENDAR_PRIORITY_COLORS] ?? 'secondary';
}

import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
export type Availability =
  | { state: "enabled" }
  | {
      state: "disabled" | "read_only" | "unsupported" | "unknown";
      reason: string;
    };
export type AsyncState =
  | "idle"
  | "loading"
  | "pending"
  | "ready"
  | "empty"
  | "error"
  | "stale"
  | "unknown";
export interface ProblemView {
  title: string;
  description?: string;
  code?: string;
  correlationId?: string;
}
export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
  availability?: Availability;
}
export interface Action {
  testId?: string;
  label: string;
  onPress: () => void;
  availability?: Availability;
}
export interface Stage {
  id: string;
  label: string;
  state: "pending" | "running" | "succeeded" | "failed" | "unknown" | "skipped";
  detail?: string;
}
export interface TimelineItem {
  id: string;
  content: ReactNode;
}
export const enabled: Availability = { state: "enabled" };
export function unavailableReason(availability: Availability | undefined) {
  return availability && availability.state !== "enabled"
    ? availability.reason
    : undefined;
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Availability, CalendarEntry, OutcomeResult, ScheduleItem } from "../lib/types";

export const useSchedule = (day: string) =>
  useQuery({
    queryKey: ["interviewer", "schedule", day],
    queryFn: async () => (await api.get<ScheduleItem[]>("/interviewer/schedule", { params: { day } })).data,
    refetchInterval: 30_000, // statuses change on their own (e.g. marked missed after the slot)
  });

export const useHistory = () =>
  useQuery({
    queryKey: ["interviewer", "history"],
    queryFn: async () => (await api.get<ScheduleItem[]>("/interviewer/history")).data,
  });

export const useAvailability = () =>
  useQuery({
    queryKey: ["interviewer", "availability"],
    queryFn: async () => (await api.get<Availability>("/interviewer/availability")).data,
  });

function useAvailabilityMutation<T>(fn: (input: T) => Promise<Availability>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(["interviewer", "availability"], data);
      qc.invalidateQueries({ queryKey: ["interviewer", "schedule"] });
      qc.invalidateQueries({ queryKey: ["interviewer", "calendar"] });
    },
  });
}

export interface WindowInput {
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
}

export const useAddWindow = () =>
  useAvailabilityMutation(async (body: WindowInput) => (await api.post("/interviewer/availability/windows", body)).data);

export const useDeleteWindow = () =>
  useAvailabilityMutation(async (id: string) => (await api.delete(`/interviewer/availability/windows/${id}`)).data);

export const useBlockSlot = () =>
  useAvailabilityMutation(
    async ({ slotId, blocked, reason }: { slotId: string; blocked: boolean; reason?: string }) =>
      (await api.post(`/interviewer/slots/${slotId}/block`, { blocked, reason: reason ?? "" })).data,
  );

/** Let students book these "too soon" slots at short notice (at least 5 minutes before). */
export const useShortNotice = () =>
  useAvailabilityMutation(
    async ({ slotIds, allowed = true }: { slotIds: string[]; allowed?: boolean }) =>
      (await api.post("/interviewer/slots/short-notice", { slot_ids: slotIds, allowed })).data,
  );

export const useBlockDay = () =>
  useAvailabilityMutation(
    async ({ day, reason }: { day: string; reason: string }) =>
      (await api.post("/interviewer/block-day", { day, reason })).data,
  );

function useInterviewAction<T>(fn: (input: T) => Promise<ScheduleItem>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["interviewer"] }) });
}

export const useStartInterview = () =>
  useInterviewAction(async (id: string) => (await api.post(`/interviewer/interviews/${id}/start`)).data);

export const useMarkNoShow = () =>
  useInterviewAction(
    async ({ id, note }: { id: string; note: string }) => (await api.post(`/interviewer/interviews/${id}/no-show`, { note })).data,
  );

export const useInterviewerReschedule = () =>
  useInterviewAction(
    async ({ id, slotId, fromSlotId, reason }: { id: string; slotId: string; fromSlotId: string; reason: string }) =>
      (await api.post(`/interviewer/interviews/${id}/reschedule`, { slot_id: slotId, from_slot_id: fromSlotId, reason })).data,
  );

export const useInterviewerCancel = () =>
  useInterviewAction(
    async ({ id, fromSlotId, reason }: { id: string; fromSlotId: string; reason: string }) =>
      (await api.post(`/interviewer/interviews/${id}/cancel`, { from_slot_id: fromSlotId, reason })).data,
  );

export interface OutcomeInput {
  result: OutcomeResult;
  scores: Record<string, number>;
  feedback_to_student: string;
  internal_notes: string;
  retake_after: string | null;
}

export const useRecordOutcome = () =>
  useInterviewAction(
    async ({ id, body }: { id: string; body: OutcomeInput }) =>
      (await api.post(`/interviewer/interviews/${id}/outcome`, body)).data,
  );

export const useSetMyBadges = () =>
  useAvailabilityMutation(async (badgeIds: string[]) => (await api.put("/interviewer/badges", { badge_ids: badgeIds })).data);

export const useInterviewerCalendar = (start: string) =>
  useQuery({
    queryKey: ["interviewer", "calendar", start],
    queryFn: async () => (await api.get<CalendarEntry[]>("/interviewer/calendar", { params: { start, days: 7 } })).data,
    placeholderData: keepPreviousData,
  });

export function useReportMalpractice() {
  return useMutation({
    mutationFn: async ({ id, reason, evidence_url }: { id: string; reason: string; evidence_url: string | null }) =>
      (await api.post(`/interviewer/interviews/${id}/report`, { reason, evidence_url })).data,
  });
}

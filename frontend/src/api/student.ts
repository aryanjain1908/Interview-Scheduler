import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Dashboard, EarnedBadge, Interview, InterviewDetail, Slot } from "../lib/types";

export const studentKeys = {
  dashboard: ["student", "dashboard"] as const,
  slots: (badgeId: string) => ["student", "slots", badgeId] as const,
  interview: (id: string) => ["student", "interview", id] as const,
  badges: ["student", "badges"] as const,
};

export const useDashboard = () =>
  useQuery({
    queryKey: studentKeys.dashboard,
    queryFn: async () => (await api.get<Dashboard>("/student/dashboard")).data,
  });

export const useOpenSlots = (badgeId: string) =>
  useQuery({
    queryKey: studentKeys.slots(badgeId),
    queryFn: async () => (await api.get<Slot[]>("/student/slots", { params: { badge_id: badgeId } })).data,
    refetchInterval: 30_000,
  });

export const useInterviewDetail = (id: string) =>
  useQuery({
    queryKey: studentKeys.interview(id),
    queryFn: async () => (await api.get<InterviewDetail>(`/student/interviews/${id}`)).data,
  });

function useInvalidateStudent() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["student"] });
}

export function useBook() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: async (body: { badge_id: string; slot_id: string }) =>
      (await api.post<Interview>("/student/interviews", body)).data,
    onSettled: invalidate,
  });
}

export function useReschedule() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: async ({ interviewId, slotId }: { interviewId: string; slotId: string }) =>
      (await api.post<Interview>(`/student/interviews/${interviewId}/reschedule`, { slot_id: slotId })).data,
    onSettled: invalidate,
  });
}

export function useCancelInterview() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: async (interviewId: string) =>
      (await api.post<Interview>(`/student/interviews/${interviewId}/cancel`)).data,
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateStudent();
  return useMutation({ mutationFn: () => api.post("/student/notifications/read-all"), onSuccess: invalidate });
}

export const useMyBadges = () =>
  useQuery({
    queryKey: studentKeys.badges,
    queryFn: async () => (await api.get<EarnedBadge[]>("/student/badges")).data,
  });

export function useReportInterviewerAbsent() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: async (interviewId: string) =>
      (await api.post<Interview>(`/student/interviews/${interviewId}/interviewer-absent`)).data,
    onSuccess: invalidate,
  });
}

export function useDisputeNoShow() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post<Interview>(`/student/interviews/${id}/dispute`, { reason })).data,
    onSuccess: invalidate,
  });
}

/** Late change inside the 12h window: reason required, reviewed by the team. No slot = cancel. */
export function useEmergencyChange() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: async ({ interviewId, reason, slotId }: { interviewId: string; reason: string; slotId: string | null }) =>
      (await api.post(`/student/interviews/${interviewId}/emergency-change`, { reason, slot_id: slotId })).data,
    onSettled: invalidate,
  });
}

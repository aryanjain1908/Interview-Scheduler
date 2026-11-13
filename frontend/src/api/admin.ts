import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type {
  BadgeHolder,
  Flag,
  FlagResolution,
  InterviewStatus,
  Overview,
  Person,
  StaffInterview,
  StudentPage,
  StudentRecord,
  InterviewerOverview,
  CalendarEntry,
} from "../lib/types";

export const useOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: async () => (await api.get<Overview>("/admin/overview")).data });

export const useInterviewers = () =>
  useQuery({
    queryKey: ["admin", "interviewers"],
    queryFn: async () => (await api.get<Person[]>("/admin/interviewers")).data,
    staleTime: Infinity,
  });

export interface InterviewFilters {
  status: InterviewStatus | "";
  day: string;
  interviewer_id: string;
  disputed: boolean;
  emergency: boolean;
}

export const useAllInterviews = (filters: InterviewFilters) =>
  useQuery({
    queryKey: ["admin", "interviews", filters],
    queryFn: async () =>
      (
        await api.get<StaffInterview[]>("/admin/interviews", {
          params: {
            status: filters.status || undefined,
            day: filters.day || undefined,
            interviewer_id: filters.interviewer_id || undefined,
            disputed: filters.disputed || undefined,
            emergency: filters.emergency || undefined,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

export const useBadgeHolders = () =>
  useQuery({
    queryKey: ["admin", "holders"],
    queryFn: async () => (await api.get<BadgeHolder[]>("/admin/badge-holders")).data,
  });

export const useFlags = () =>
  useQuery({ queryKey: ["admin", "flags"], queryFn: async () => (await api.get<Flag[]>("/admin/flags")).data });

export function useRaiseFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { student_id: string; badge_id: string; reason: string; evidence_url: string | null }) =>
      (await api.post<Flag>("/admin/flags", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useResolveFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: FlagResolution }) =>
      (await api.patch<Flag>(`/admin/flags/${id}`, { resolution })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export const useStudentDirectory = (search: string, page: number, pageSize = 25) =>
  useQuery({
    queryKey: ["admin", "directory", search, page],
    queryFn: async () =>
      (
        await api.get<StudentPage>("/admin/students", {
          params: { search, limit: pageSize, offset: page * pageSize },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

export const useStudentRecord = (studentId: string | null) =>
  useQuery({
    queryKey: ["admin", "record", studentId],
    queryFn: async () => (await api.get<StudentRecord>(`/admin/students/${studentId}`)).data,
    enabled: Boolean(studentId),
  });

function useRecordMutation<T>(fn: (input: T) => Promise<StudentRecord>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (record) => {
      qc.setQueryData(["admin", "record", record.student.id], record);
      qc.invalidateQueries({ queryKey: ["admin", "directory"] });
      qc.invalidateQueries({ queryKey: ["team", "eligible"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

export const useSetSkillCleared = () =>
  useRecordMutation(
    async ({ studentId, skillId, cleared }: { studentId: string; skillId: string; cleared: boolean }) =>
      (await api.post<StudentRecord>(`/admin/students/${studentId}/skills`, { skill_id: skillId, cleared })).data,
  );

export const useAllowRebooking = () =>
  useRecordMutation(
    async ({ journeyId, reason }: { journeyId: string; reason: string }) =>
      (await api.post<StudentRecord>(`/admin/journeys/${journeyId}/allow-rebooking`, { reason })).data,
  );

export function useNullifyBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentBadgeId, reason, evidence_url }: { studentBadgeId: string; reason: string; evidence_url: string | null }) =>
      (await api.post<Flag>(`/admin/student-badges/${studentBadgeId}/nullify`, { reason, evidence_url })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export const useInterviewerOverview = () =>
  useQuery({
    queryKey: ["admin", "interviewers", "overview"],
    queryFn: async () => (await api.get<InterviewerOverview[]>("/admin/interviewers/overview")).data,
  });

export const useAdminCalendar = (start: string, interviewerId: string) =>
  useQuery({
    queryKey: ["admin", "calendar", start, interviewerId],
    queryFn: async () =>
      (
        await api.get<CalendarEntry[]>("/admin/calendar", {
          params: { start, days: 7, interviewer_id: interviewerId || undefined },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

export function useExcuseNoShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/admin/interviews/${id}/excuse-no-show`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useRejectDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/admin/interviews/${id}/reject-dispute`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useReviewChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: "approve" | "reject"; reason: string }) =>
      (await api.post(`/admin/change-requests/${id}/${decision}`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

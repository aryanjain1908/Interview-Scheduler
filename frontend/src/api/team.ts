import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Badge, EligibleRow } from "../lib/types";

export const useBadges = () =>
  useQuery({
    queryKey: ["badges"],
    queryFn: async () => (await api.get<Badge[]>("/badges")).data,
    staleTime: Infinity,
  });

export interface EligibleFilters {
  booked: "all" | "booked" | "not_booked";
  badge_id: string;
  search: string;
}

export const useEligibleStudents = (filters: EligibleFilters) =>
  useQuery({
    queryKey: ["team", "eligible", filters],
    queryFn: async () =>
      (
        await api.get<EligibleRow[]>("/team/eligible-students", {
          params: { booked: filters.booked, badge_id: filters.badge_id || undefined, search: filters.search },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

export function useNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (journeyIds: string[]) =>
      (await api.post<{ count: number }>("/team/nudge", { journey_ids: journeyIds })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "eligible"] }),
  });
}


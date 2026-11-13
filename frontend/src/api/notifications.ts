import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Notification } from "../lib/types";

export const useInbox = () =>
  useQuery({
    queryKey: ["inbox"],
    queryFn: async () => (await api.get<Notification[]>("/notifications")).data,
    refetchInterval: 60_000,
  });

export function useMarkInboxRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["student", "dashboard"] });
    },
  });
}

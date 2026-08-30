import { useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCustomGame,
  addToLibrary,
  listLibrary,
  removeEntry,
  updateEntry,
} from "@/lib/api";
import type { GameEntry, LibrarySnapshot, Status } from "@/lib/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const libraryKey = ["library"] as const;

export type EntryPatch = {
  id: number;
  status?: Status;
  score?: number | null;
  hours?: number | null;
  favorite?: boolean;
  notes?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export function useLibrary() {
  const { user, isPending } = useCurrentUserState();
  const query = useInfiniteQuery({
    queryKey: libraryKey,
    queryFn: ({ pageParam }) =>
      listLibrary({ data: { cursor: pageParam, limit: 50 } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !isPending && Boolean(user),
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const data: GameEntry[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    ...query,
    data,
  };
}

export function useLibraryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: libraryKey });

  const add = useMutation({
    mutationFn: (input: {
      catalogId: string;
      status?: Status;
      snapshot: LibrarySnapshot;
    }) => addToLibrary({ data: input }),
    onSuccess: () => {
      void invalidate();
      toast.success("Added to your library");
    },
    onError: (err) => toast.error(err.message || "Could not add game"),
  });

  const custom = useMutation({
    mutationFn: (input: { title: string; status?: Status; notes?: string }) =>
      addCustomGame({ data: input }),
    onSuccess: () => {
      void invalidate();
      toast.success("Custom title added");
    },
    onError: (err) => toast.error(err.message || "Could not add game"),
  });

  const update = useMutation({
    mutationFn: (input: EntryPatch) => updateEntry({ data: input }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(err.message || "Could not save"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => removeEntry({ data: { id } }),
    onSuccess: () => {
      void invalidate();
      toast.success("Removed from library");
    },
    onError: (err) => toast.error(err.message || "Could not remove"),
  });

  return { add, custom, update, remove };
}

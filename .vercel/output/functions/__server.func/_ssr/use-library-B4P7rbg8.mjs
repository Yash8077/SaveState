import { o as __toESM } from "../_runtime.mjs";
import { a as useQueryClient, n as useMutation, s as require_react, t as useInfiniteQuery } from "../_libs/react+tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as addCustomGame, f as listLibrary, g as updateEntry, l as addToLibrary, p as removeEntry, y as useCurrentUserState } from "./router-BQDdMn6j.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-library-B4P7rbg8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var libraryKey = ["library"];
function useLibrary() {
	const { user, isPending } = useCurrentUserState();
	const query = useInfiniteQuery({
		queryKey: libraryKey,
		queryFn: ({ pageParam }) => listLibrary({ data: {
			cursor: pageParam,
			limit: 50
		} }),
		initialPageParam: null,
		getNextPageParam: (last) => last.nextCursor ?? void 0,
		enabled: !isPending && Boolean(user)
	});
	(0, import_react.useEffect)(() => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	}, [
		query.hasNextPage,
		query.isFetchingNextPage,
		query.fetchNextPage
	]);
	const data = query.data?.pages.flatMap((page) => page.items) ?? [];
	return {
		...query,
		data
	};
}
function useLibraryMutations() {
	const qc = useQueryClient();
	const invalidate = () => qc.invalidateQueries({ queryKey: libraryKey });
	return {
		add: useMutation({
			mutationFn: (input) => addToLibrary({ data: input }),
			onSuccess: () => {
				invalidate();
				toast.success("Added to your library");
			},
			onError: (err) => toast.error(err.message || "Could not add game")
		}),
		custom: useMutation({
			mutationFn: (input) => addCustomGame({ data: input }),
			onSuccess: () => {
				invalidate();
				toast.success("Custom title added");
			},
			onError: (err) => toast.error(err.message || "Could not add game")
		}),
		update: useMutation({
			mutationFn: (input) => updateEntry({ data: input }),
			onSuccess: () => void invalidate(),
			onError: (err) => toast.error(err.message || "Could not save")
		}),
		remove: useMutation({
			mutationFn: (id) => removeEntry({ data: { id } }),
			onSuccess: () => {
				invalidate();
				toast.success("Removed from library");
			},
			onError: (err) => toast.error(err.message || "Could not remove")
		})
	};
}
//#endregion
export { useLibraryMutations as n, useLibrary as t };

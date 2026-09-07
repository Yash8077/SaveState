import { useQuery } from "@tanstack/react-query";
import { Activity, HeartPulse, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SyncStatus = "never_synced" | "syncing" | "synced" | "failed";

type SyncSlice = {
  status: SyncStatus;
  lastAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  syncedSets?: number;
  failedSets?: number;
  syncingSets?: number;
  pendingSets?: number;
};

type SyncPayload = {
  device: { name: string; lastSeenAt: string | null } | null;
  activity: SyncSlice;
  trophies: SyncSlice;
};

async function getSyncStatus(signal?: AbortSignal) {
  const res = await fetch("/api/sync/status", {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Could not load sync health");
  return (await res.json()) as SyncPayload;
}

function label(status: SyncStatus) {
  if (status === "synced") return "Synced";
  if (status === "syncing") return "Syncing";
  if (status === "failed") return "Failed";
  return "Never synced";
}

function when(raw: string | null | undefined) {
  if (!raw) return "Never";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString();
}

function overall(data: SyncPayload): SyncStatus {
  const statuses = [data.activity.status, data.trophies.status];
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("syncing")) return "syncing";
  if (statuses.includes("synced")) return "synced";
  return "never_synced";
}

function Pill({ status }: { status: SyncStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "synced" && "bg-accent/15 text-accent",
        status === "syncing" && "bg-subtle text-muted",
        status === "failed" && "bg-red-500/15 text-red-400",
        status === "never_synced" && "bg-subtle text-faint",
      )}
    >
      {label(status)}
    </span>
  );
}

function Tile({
  title,
  icon: Icon,
  data,
}: {
  title: string;
  icon: typeof Activity;
  data: SyncSlice;
}) {
  return (
    <section className="rounded-[1.75rem] bg-elevated p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-accent/15 text-accent">
          <Icon className="size-5" />
        </span>
        <h3 className="min-w-0 flex-1 text-base font-semibold">{title}</h3>
        <Pill status={data.status} />
      </div>
      <p className="mt-4 text-sm text-muted">Last success {when(data.lastSyncedAt)}</p>
      <p className="text-sm text-muted">Last attempt {when(data.lastAttemptAt)}</p>
      {data.syncedSets != null ? (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["Synced", data.syncedSets],
            ["Failed", data.failedSets],
            ["Syncing", data.syncingSets],
            ["Pending", data.pendingSets],
          ].map(([labelText, value]) => (
            <div key={String(labelText)}>
              <p className="text-lg font-semibold tabular-nums">{value ?? 0}</p>
              <p className="text-[11px] text-faint">{labelText}</p>
            </div>
          ))}
        </div>
      ) : null}
      {data.lastError ? (
        <p className="mt-4 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {data.lastError}
        </p>
      ) : null}
    </section>
  );
}

export function SyncHealthPane() {
  const query = useQuery({
    queryKey: ["sync-status"],
    queryFn: ({ signal }) => getSyncStatus(signal),
    staleTime: 30_000,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-4 min-[720px]:grid-cols-[22rem_minmax(0,1fr)]">
        <Skeleton className="h-48 rounded-[1.75rem]" />
        <Skeleton className="h-64 rounded-[1.75rem]" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="rounded-[1.75rem] bg-elevated p-6 text-center">
        <p className="font-medium">Couldn’t load sync health</p>
        <p className="mt-1 text-sm text-muted">
          {query.error instanceof Error ? query.error.message : "Try again in a moment."}
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          Try again
        </button>
      </section>
    );
  }

  const data = query.data;
  const status = overall(data);
  const title =
    status === "synced"
      ? "All caught up"
      : status === "syncing"
        ? "Sync in progress"
        : status === "failed"
          ? "Needs attention"
          : "Not synced yet";

  return (
    <div className="grid items-start gap-4 min-[720px]:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="rounded-[1.75rem] bg-elevated p-5">
          <HeartPulse className="size-7 text-accent" />
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">
            {data.device
              ? `Last seen ${when(data.device.lastSeenAt)}`
              : "Connect a PS5 payload to start logging play."}
          </p>
          <div className="mt-4">
            <Pill status={status} />
          </div>
        </section>
        <section className="rounded-[1.75rem] bg-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
            PS5 device
          </p>
          {data.device ? (
            <>
              <p className="mt-3 text-lg font-semibold">{data.device.name}</p>
              <p className="mt-1 text-sm text-muted">
                Last seen {when(data.device.lastSeenAt)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No device linked yet.</p>
          )}
        </section>
      </div>
      <div className="space-y-4">
        <Tile title="PS5 Activity" icon={Activity} data={data.activity} />
        <Tile title="Trophies" icon={Trophy} data={data.trophies} />
      </div>
    </div>
  );
}

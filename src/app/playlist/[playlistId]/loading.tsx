import { Skeleton } from "@heroui/react";

export default function Loading() {
  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <Skeleton className="h-4 w-28 rounded-lg" />
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="size-48 rounded-2xl sm:size-64" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-10 w-72 rounded-lg" />
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentLibraryClient } from "@/components/dashboard/content-library-client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Content & drafts",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: searchQ } = await searchParams;
  const user = await fetchMeServer();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content library</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Published posts, reels, stories, drafts, and trash in one place. Use desktop upload and detailed controls for
          tagging, privacy, preview, and bulk management.
        </p>
      </div>

      <Card>
        <CardTitle>Workflow</CardTitle>
        <CardDescription>
          Create from web or app → review in modal → manage comments/insights/boost → recover from trash or purge
          permanently with bulk actions.
        </CardDescription>
        <Link
          href="/dashboard/promotions"
          className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Open campaigns →
        </Link>
      </Card>

      <ContentLibraryClient userId={user._id} searchHint={searchQ} />
    </div>
  );
}

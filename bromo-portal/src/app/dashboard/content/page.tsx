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
          Published posts, reels, and drafts in one place. Upload and transcode still happen in the Bromo app; organize,
          sort, and tune metadata here.
        </p>
      </div>

      <Card>
        <CardTitle>Workflow</CardTitle>
        <CardDescription>
          Shoot in the app → review below → promote from the campaigns workspace when you are ready to scale reach.
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

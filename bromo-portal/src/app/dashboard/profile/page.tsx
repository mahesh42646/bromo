import type { Metadata } from "next";
import {
  CreatorProfileShell,
  type ProfileGridStats,
} from "@/components/dashboard/creator-profile-shell";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const user = await fetchMeServer();
  if (!user) return null;

  const gridRes = await apiWithAuth(`/posts/user/${user._id}/grid-stats`);
  const grid: ProfileGridStats = gridRes.ok ? ((await gridRes.json()) as ProfileGridStats) : {};

  return (
    <div className="min-h-full bg-[#0a0a0a] pb-16">
      <CreatorProfileShell user={user} gridStats={grid} editForm={<ProfileForm user={user} />} />
    </div>
  );
}

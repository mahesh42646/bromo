import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BadgeCheck, Building2, CheckCircle2, FileText, Search, ShieldCheck, Store, UserCheck, XCircle } from "lucide-react";
import { adminApi, fetchAdminMe } from "@/lib/admin-api";
import { getApiBase } from "@/lib/env";

type Owner = {
  _id: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
};

type PendingStore = {
  _id: string;
  owner?: Owner;
  name: string;
  phone: string;
  city: string;
  address: string;
  category: string;
  storeType: "d2c" | "b2b" | "online";
  description?: string;
  termsPdfUrl?: string;
  kyc?: {
    gstNumber?: string;
    shopActLicense?: string;
    panCardUrl?: string;
    aadhaarCardUrl?: string;
    addressProofUrl?: string;
    storePhotoUrls?: string[];
  };
  coinDiscountRule?: {
    coinsRequired?: number;
    discountPercent?: number;
    minOrderInr?: number;
    active?: boolean;
  };
  createdAt?: string;
};

type AdminUser = {
  _id: string;
  username: string;
  displayName: string;
  email: string;
  isVerified?: boolean;
  verificationStatus?: "none" | "pending" | "verified" | "rejected";
  isCreator?: boolean;
  creatorStatus?: "none" | "pending" | "verified" | "rejected";
  creatorBadge?: boolean;
};

async function approveStore(formData: FormData) {
  "use server";
  const id = String(formData.get("storeId") ?? "");
  await adminApi(`/admin/stores/${encodeURIComponent(id)}/approval`, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved" }),
  });
  revalidatePath("/admin/approvals");
}

async function rejectStore(formData: FormData) {
  "use server";
  const id = String(formData.get("storeId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  await adminApi(`/admin/stores/${encodeURIComponent(id)}/approval`, {
    method: "PATCH",
    body: JSON.stringify({ status: "rejected", reason }),
  });
  revalidatePath("/admin/approvals");
}

async function updateUserVerification(formData: FormData) {
  "use server";
  const id = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "pending");
  await adminApi(`/admin/users/${encodeURIComponent(id)}/verification`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  revalidatePath("/admin/approvals");
}

async function updateCreatorVerification(formData: FormData) {
  "use server";
  const id = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "pending");
  await adminApi(`/admin/users/${encodeURIComponent(id)}/creator`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  revalidatePath("/admin/approvals");
}

async function loadPendingStores(): Promise<PendingStore[]> {
  const res = await adminApi("/admin/stores/pending?limit=50");
  if (res.status === 401) redirect("/admin/login");
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as { stores?: PendingStore[] };
  return body.stores ?? [];
}

async function searchUsers(q: string): Promise<AdminUser[]> {
  if (!q) return [];
  const res = await adminApi(`/admin/users?limit=20&search=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as { users?: AdminUser[] };
  return body.users ?? [];
}

function mediaUrl(path?: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const admin = await fetchAdminMe();
  if (!admin) redirect("/admin/login");

  const params = searchParams ? await searchParams : {};
  const q = String(params?.q ?? "").trim();
  const [stores, users] = await Promise.all([loadPendingStores(), searchUsers(q)]);

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Signed in as {admin.email}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Approval Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              Review store KYC, approve store launch, trigger partner certificates, and manually verify creators or blue badges.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/75">
            Back to portal
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard icon={<Store className="size-5" />} label="Pending stores" value={String(stores.length)} />
          <StatCard icon={<ShieldCheck className="size-5" />} label="KYC gate" value="Mandatory" />
          <StatCard icon={<BadgeCheck className="size-5" />} label="Blue tick" value="Manual only" />
        </section>

        <section className="mt-8 rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-5">
          <div className="mb-5 flex items-center gap-3">
            <Building2 className="size-5 text-emerald-300" />
            <h2 className="text-xl font-semibold">Store Approval Queue</h2>
          </div>
          <div className="grid gap-4">
            {stores.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/55">No pending store requests.</p>
            ) : (
              stores.map((store) => <StoreApprovalCard key={store._id} store={store} />)
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserCheck className="size-5 text-sky-300" />
              <h2 className="text-xl font-semibold">Manual User & Creator Verification</h2>
            </div>
            <form className="flex min-w-72 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <Search className="size-4 text-white/45" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, username, email"
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
              />
            </form>
          </div>
          {q ? (
            <div className="grid gap-3">
              {users.length === 0 ? (
                <p className="text-sm text-white/55">No users found.</p>
              ) : (
                users.map((user) => <UserApprovalRow key={user._id} user={user} />)
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/55">
              Search a user to manually approve the verification badge or Creator Dashboard.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
      <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">{icon}</div>
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StoreApprovalCard({ store }: { store: PendingStore }) {
  const docs = [
    ["PAN", store.kyc?.panCardUrl],
    ["Aadhaar", store.kyc?.aadhaarCardUrl],
    ["Address Proof", store.kyc?.addressProofUrl],
    ["Terms PDF", store.termsPdfUrl],
  ] as const;
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{store.name}</h3>
            <span className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-xs font-bold uppercase text-emerald-200">{store.storeType}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/70">{store.category}</span>
          </div>
          <p className="mt-1 text-sm text-white/55">
            {store.city} · {store.phone} · {store.address}
          </p>
          <p className="mt-1 text-sm text-white/55">
            Owner: {store.owner?.displayName ?? "Unknown"} @{store.owner?.username ?? "unknown"} {store.owner?.email ? `· ${store.owner.email}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={approveStore}>
            <input type="hidden" name="storeId" value={store._id} />
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-bold text-black">
              <CheckCircle2 className="size-4" />
              Approve
            </button>
          </form>
          <form action={rejectStore} className="flex gap-2">
            <input type="hidden" name="storeId" value={store._id} />
            <input
              name="reason"
              placeholder="Reject reason"
              className="w-36 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <button className="inline-flex items-center gap-2 rounded-xl bg-red-400/90 px-3 py-2 text-sm font-bold text-black">
              <XCircle className="size-4" />
              Reject
            </button>
          </form>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Info label="GST" value={store.kyc?.gstNumber || "Not provided"} />
        <Info label="Shop Act" value={store.kyc?.shopActLicense || "Not provided"} />
        <Info
          label="D2C rule"
          value={
            store.coinDiscountRule?.coinsRequired
              ? `${store.coinDiscountRule.coinsRequired} coins = ${store.coinDiscountRule.discountPercent}% off`
              : store.storeType === "b2b"
                ? "B2B leads only"
                : "Online store"
          }
        />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {docs.map(([label, url]) =>
          url ? (
            <Link key={label} href={mediaUrl(url)} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75">
              <FileText className="size-4" />
              {label}
            </Link>
          ) : null,
        )}
        {(store.kyc?.storePhotoUrls ?? []).map((url, index) => (
          <Link key={url} href={mediaUrl(url)} target="_blank" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75">
            Store photo {index + 1}
          </Link>
        ))}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 text-sm text-white/75">{value}</p>
    </div>
  );
}

function UserApprovalRow({ user }: { user: AdminUser }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div>
        <p className="font-semibold">{user.displayName} <span className="text-white/45">@{user.username}</span></p>
        <p className="text-sm text-white/45">{user.email}</p>
        <p className="mt-1 text-xs text-white/45">
          Badge: {user.verificationStatus ?? "none"} · Creator: {user.creatorStatus ?? "none"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <form action={updateUserVerification}>
          <input type="hidden" name="userId" value={user._id} />
          <input type="hidden" name="status" value="verified" />
          <button className="rounded-xl bg-sky-300 px-3 py-2 text-sm font-bold text-black">Approve Blue Tick</button>
        </form>
        <form action={updateCreatorVerification}>
          <input type="hidden" name="userId" value={user._id} />
          <input type="hidden" name="status" value="verified" />
          <button className="rounded-xl bg-emerald-300 px-3 py-2 text-sm font-bold text-black">Approve Creator</button>
        </form>
        <form action={updateUserVerification}>
          <input type="hidden" name="userId" value={user._id} />
          <input type="hidden" name="status" value="rejected" />
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-red-200">Reject Badge</button>
        </form>
        <form action={updateCreatorVerification}>
          <input type="hidden" name="userId" value={user._id} />
          <input type="hidden" name="status" value="rejected" />
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-red-200">Reject Creator</button>
        </form>
      </div>
    </article>
  );
}

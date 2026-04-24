// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { ImagePlus, Music2, Search, SlidersHorizontal, X } from "lucide-react";

// type CreateType = "story" | "post" | "reel";
// type AudioSource = "original" | "mute" | "bromo";

// type CreationPayload = {
//   type: CreateType;
//   file: File;
//   caption: string;
//   tagsCsv: string;
//   location: string;
//   feedCategory: string;
//   audioSource: AudioSource;
//   audioTrack: string;
//   filterPreset: string;
//   trimStartMs: number;
//   trimEndMs: number;
//   speed: number;
//   brightness: number;
//   contrast: number;
//   saturation: number;
//   blur: number;
//   crop: string;
//   visibility: "public" | "close_friends";
//   commentsOff: boolean;
//   hideLikes: boolean;
//   pollQuestion: string;
//   pollOptionsCsv: string;
//   tagPeopleCsv: string;
//   tagProductsCsv: string;
// };

// type SuggestUser = { _id: string; username: string };
// type SuggestPlace = { name: string; address?: string };
// type SuggestTrack = { id: string; title: string; artist: string };
// type SuggestProduct = { _id: string; title: string };

// const FILTER_PRESETS = [
//   "normal",
//   "clarendon",
//   "gingham",
//   "lark",
//   "reyes",
//   "juno",
//   "slate",
//   "lux",
//   "aden",
//   "crema",
// ] as const;

// const PRESET_LABELS: Record<(typeof FILTER_PRESETS)[number], string> = {
//   normal: "Normal",
//   clarendon: "Clarendon",
//   gingham: "Gingham",
//   lark: "Lark",
//   reyes: "Reyes",
//   juno: "Juno",
//   slate: "Slate",
//   lux: "Lux",
//   aden: "Aden",
//   crema: "Crema",
// };

// const PRESET_FILTER_MAP: Record<(typeof FILTER_PRESETS)[number], string> = {
//   normal: "",
//   clarendon: "contrast(1.12) saturate(1.2) brightness(1.05)",
//   gingham: "contrast(0.95) saturate(0.9) sepia(0.08)",
//   lark: "brightness(1.08) saturate(1.08)",
//   reyes: "contrast(0.9) saturate(0.82) sepia(0.12)",
//   juno: "contrast(1.15) saturate(1.22)",
//   slate: "contrast(1.06) saturate(0.85) hue-rotate(355deg)",
//   lux: "contrast(1.18) saturate(1.26)",
//   aden: "contrast(0.92) saturate(0.9) sepia(0.18)",
//   crema: "contrast(0.95) saturate(0.92) sepia(0.1)",
// };

// const MUSIC_PRESETS: SuggestTrack[] = [
//   { id: "a1", title: "Original audio", artist: "Bromo Sound" },
//   { id: "a2", title: "City Nights", artist: "Lo-Fi Pack" },
//   { id: "a3", title: "Drill Beat", artist: "Trending" },
//   { id: "a4", title: "Acoustic Warm", artist: "UGC Lite" },
//   { id: "a5", title: "Trap Vibes", artist: "Hip Hop" },
//   { id: "a6", title: "Chill Wave", artist: "Ambient" },
// ];

// const PLACE_PRESETS = ["Dubai Mall", "Mumbai", "Bandra", "SoHo NYC", "London Bridge", "Bengaluru"];

// function debounce<T>(fn: (v: T) => void, delay: number) {
//   let t: ReturnType<typeof setTimeout> | null = null;
//   return (v: T) => {
//     if (t) clearTimeout(t);
//     t = setTimeout(() => fn(v), delay);
//   };
// }

// function cropAspectValue(crop: string): number {
//   if (crop === "1:1") return 1;
//   if (crop === "4:5") return 4 / 5;
//   if (crop === "16:9") return 16 / 9;
//   if (crop === "9:16") return 9 / 16;
//   return 1;
// }

// function formatSec(v: number): string {
//   const safe = Math.max(0, v);
//   const m = Math.floor(safe / 60);
//   const s = Math.floor(safe % 60);
//   const ms = Math.floor((safe % 1) * 10);
//   return `${m}:${String(s).padStart(2, "0")}.${ms}`;
// }

// export function ContentCreationModal({
//   open,
//   initialType,
//   onClose,
//   onPostNow,
//   onSaveDraft,
// }: {
//   open: boolean;
//   initialType?: CreateType;
//   onClose: () => void;
//   onPostNow: (payload: CreationPayload) => Promise<void>;
//   onSaveDraft: (payload: CreationPayload) => Promise<void>;
// }) {
//   const [type, setType] = useState<CreateType>(initialType ?? "post");
//   const [file, setFile] = useState<File | null>(null);
//   const [caption, setCaption] = useState("");
//   const [tagsCsv, setTagsCsv] = useState("");
//   const [location, setLocation] = useState("");
//   const [locationQuery, setLocationQuery] = useState("");
//   const [locationHits, setLocationHits] = useState<SuggestPlace[]>([]);
//   const [feedCategory, setFeedCategory] = useState("general");
//   const [audioSource, setAudioSource] = useState<AudioSource>("original");
//   const [audioTrack, setAudioTrack] = useState("");
//   const [trackQuery, setTrackQuery] = useState("");
//   const [filterPreset, setFilterPreset] = useState<(typeof FILTER_PRESETS)[number]>("normal");
//   const [speed, setSpeed] = useState(1);
//   const [brightness, setBrightness] = useState(0);
//   const [contrast, setContrast] = useState(0);
//   const [saturation, setSaturation] = useState(0);
//   const [blur, setBlur] = useState(0);
//   const [crop, setCrop] = useState("9:16");
//   const [visibility, setVisibility] = useState<"public" | "close_friends">("public");
//   const [commentsOff, setCommentsOff] = useState(false);
//   const [hideLikes, setHideLikes] = useState(false);
//   const [pollQuestion, setPollQuestion] = useState("");
//   const [pollOptionsCsv, setPollOptionsCsv] = useState("");
//   const [peopleQuery, setPeopleQuery] = useState("");
//   const [peopleHits, setPeopleHits] = useState<SuggestUser[]>([]);
//   const [taggedUsers, setTaggedUsers] = useState<SuggestUser[]>([]);
//   const [productQuery, setProductQuery] = useState("");
//   const [productHits, setProductHits] = useState<SuggestProduct[]>([]);
//   const [taggedProducts, setTaggedProducts] = useState<SuggestProduct[]>([]);
//   const [trimStartSec, setTrimStartSec] = useState(0);
//   const [trimEndSec, setTrimEndSec] = useState(0);
//   const [mediaDuration, setMediaDuration] = useState(0);
//   const [busy, setBusy] = useState<"post" | "draft" | null>(null);
//   const [err, setErr] = useState<string | null>(null);

//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const localUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
//   const isVideo = Boolean(file && file.type.startsWith("video/"));

//   useEffect(() => {
//     return () => {
//       if (localUrl) URL.revokeObjectURL(localUrl);
//     };
//   }, [localUrl]);

//   useEffect(() => {
//     if (!open) return;
//     setType(initialType ?? "post");
//   }, [initialType, open]);

//   useEffect(() => {
//     const v = videoRef.current;
//     if (!v || !isVideo) return;
//     v.playbackRate = speed;
//     v.muted = audioSource === "mute";
//   }, [audioSource, isVideo, speed]);

//   useEffect(() => {
//     const v = videoRef.current;
//     if (!v || !isVideo) return;
//     const onTime = () => {
//       if (trimEndSec > trimStartSec && v.currentTime > trimEndSec) {
//         v.currentTime = trimStartSec;
//       }
//     };
//     v.addEventListener("timeupdate", onTime);
//     return () => v.removeEventListener("timeupdate", onTime);
//   }, [isVideo, trimEndSec, trimStartSec]);

//   const previewFilter = useMemo(() => {
//     const preset = PRESET_FILTER_MAP[filterPreset] || "";
//     const adjust = [
//       `brightness(${1 + brightness / 100})`,
//       `contrast(${1 + contrast / 100})`,
//       `saturate(${1 + saturation / 100})`,
//       `blur(${Math.max(0, blur)}px)`,
//     ].join(" ");
//     return `${preset} ${adjust}`.trim();
//   }, [blur, brightness, contrast, filterPreset, saturation]);

//   useEffect(() => {
//     const run = debounce(async (q: string) => {
//       if (!q.trim()) {
//         setPeopleHits([]);
//         return;
//       }
//       const res = await fetch(`/api/portal/users/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
//       const data = (await res.json().catch(() => ({}))) as { users?: Array<{ _id: string; username?: string }> };
//       const hits = (data.users ?? [])
//         .map((u) => ({ _id: String(u._id), username: String(u.username ?? "") }))
//         .filter((u) => u.username);
//       setPeopleHits(hits.slice(0, 8));
//     }, 240);
//     run(peopleQuery);
//   }, [peopleQuery]);

//   useEffect(() => {
//     const run = debounce(async (q: string) => {
//       if (!q.trim()) {
//         setProductHits([]);
//         return;
//       }
//       const res = await fetch(`/api/portal/products?q=${encodeURIComponent(q.trim())}&limit=10`, { cache: "no-store" });
//       const data = (await res.json().catch(() => ({}))) as { items?: Array<{ _id: string; title?: string }> };
//       const hits = (data.items ?? [])
//         .map((p) => ({ _id: String(p._id), title: String(p.title ?? "") }))
//         .filter((p) => p.title);
//       setProductHits(hits);
//     }, 260);
//     run(productQuery);
//   }, [productQuery]);

//   useEffect(() => {
//     const run = debounce(async (q: string) => {
//       if (!q.trim()) {
//         setLocationHits([]);
//         return;
//       }
//       const res = await fetch(`/api/portal/places/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
//       const data = (await res.json().catch(() => ({}))) as { items?: SuggestPlace[] };
//       setLocationHits((data.items ?? []).slice(0, 8));
//     }, 260);
//     run(locationQuery);
//   }, [locationQuery]);

//   const filteredTracks = useMemo(() => {
//     const q = trackQuery.trim().toLowerCase();
//     if (!q) return MUSIC_PRESETS;
//     return MUSIC_PRESETS.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q));
//   }, [trackQuery]);

//   const trimStartPct = mediaDuration > 0 ? (trimStartSec / mediaDuration) * 100 : 0;
//   const trimEndPct = mediaDuration > 0 ? (trimEndSec / mediaDuration) * 100 : 100;
//   const clipDurationSec = Math.max(0, trimEndSec - trimStartSec);

//   const payload = (): CreationPayload | null => {
//     if (!file) return null;
//     return {
//       type,
//       file,
//       caption,
//       tagsCsv,
//       location,
//       feedCategory,
//       audioSource,
//       audioTrack,
//       filterPreset,
//       trimStartMs: Math.round(trimStartSec * 1000),
//       trimEndMs: Math.round(trimEndSec * 1000),
//       speed,
//       brightness,
//       contrast,
//       saturation,
//       blur,
//       crop,
//       visibility,
//       commentsOff,
//       hideLikes,
//       pollQuestion,
//       pollOptionsCsv,
//       tagPeopleCsv: taggedUsers.map((u) => u._id).join(","),
//       tagProductsCsv: taggedProducts.map((p) => p._id).join(","),
//     };
//   };

//   const runPost = async () => {
//     const p = payload();
//     if (!p) {
//       setErr("Pick media first.");
//       return;
//     }
//     setBusy("post");
//     setErr(null);
//     try {
//       await onPostNow(p);
//       onClose();
//     } catch (e) {
//       setErr(e instanceof Error ? e.message : "Could not publish");
//     } finally {
//       setBusy(null);
//     }
//   };

//   const runDraft = async () => {
//     const p = payload();
//     if (!p) {
//       setErr("Pick media first.");
//       return;
//     }
//     setBusy("draft");
//     setErr(null);
//     try {
//       await onSaveDraft(p);
//       onClose();
//     } catch (e) {
//       setErr(e instanceof Error ? e.message : "Could not save draft");
//     } finally {
//       setBusy(null);
//     }
//   };

//   const resetAndClose = () => {
//     setErr(null);
//     setFile(null);
//     onClose();
//   };

//   if (!open) return null;

//   return (
//     <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true">
//       <button type="button" className="absolute inset-0" aria-label="Close" onClick={resetAndClose} />
//       <div className="relative z-10 flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--card)]">
//         <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
//           <div className="flex gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
//             {(["story", "post", "reel"] as const).map((t) => (
//               <button
//                 key={t}
//                 type="button"
//                 onClick={() => setType(t)}
//                 className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
//                   type === t ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--foreground-muted)]"
//                 }`}
//               >
//                 {t[0].toUpperCase() + t.slice(1)}
//               </button>
//             ))}
//           </div>
//           <button type="button" onClick={resetAndClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close">
//             <X className="size-5" />
//           </button>
//         </div>

//         <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
//           <div className="min-h-0 border-b border-[var(--hairline)] p-4 lg:border-b-0 lg:border-r">
//             <div className="mb-3 text-sm font-semibold text-[var(--foreground-muted)]">Preview</div>
//             <div className="flex h-full min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]">
//               {localUrl ? (
//                 <div className="w-full max-w-[460px]" style={{ aspectRatio: cropAspectValue(crop) }}>
//                   {isVideo ? (
//                     <video
//                       ref={videoRef}
//                       src={localUrl}
//                       controls
//                       playsInline
//                       className="h-full w-full rounded-xl bg-black object-cover"
//                       style={{ filter: previewFilter }}
//                       onLoadedMetadata={(e) => {
//                         const d = e.currentTarget.duration || 0;
//                         setMediaDuration(d);
//                         setTrimStartSec(0);
//                         setTrimEndSec(d);
//                       }}
//                     />
//                   ) : (
//                     // eslint-disable-next-line @next/next/no-img-element
//                     <img src={localUrl} alt="Preview" className="h-full w-full rounded-xl object-cover" style={{ filter: previewFilter }} />
//                   )}
//                 </div>
//               ) : (
//                 <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-[var(--foreground-muted)]">
//                   <ImagePlus className="size-9 opacity-70" />
//                   <span>Select photo or video</span>
//                   <input
//                     type="file"
//                     accept={type === "reel" ? "video/*" : "image/*,video/*"}
//                     className="hidden"
//                     onChange={(e) => setFile(e.target.files?.[0] ?? null)}
//                   />
//                 </label>
//               )}
//             </div>
//           </div>

//           <div className="min-h-0 overflow-y-auto p-4">
//             <section className="space-y-3 rounded-xl border border-[var(--hairline)] p-3">
//               <div className="flex items-center justify-between">
//                 <h3 className="text-sm font-semibold">Timeline & crop</h3>
//                 <div className="flex items-center gap-1 rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--foreground-muted)]">
//                   <span>Playhead</span>
//                   <span className="font-semibold text-[var(--foreground)]">{formatSec(trimStartSec)}</span>
//                 </div>
//               </div>
//               {isVideo ? (
//                 <>
//                   <div className="grid grid-cols-3 gap-2">
//                     <TimePill label="In" value={formatSec(trimStartSec)} />
//                     <TimePill label="Out" value={formatSec(trimEndSec)} />
//                     <TimePill label="Duration" value={formatSec(clipDurationSec)} />
//                   </div>
//                   <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
//                     <div className="mb-2 flex items-center justify-between px-1 text-[10px] text-[var(--foreground-muted)]">
//                       <span>V1</span>
//                       <span>{mediaDuration > 0 ? formatSec(mediaDuration) : "0:00.0"}</span>
//                     </div>
//                     <div className="relative mb-2 flex h-12 overflow-hidden rounded-lg border border-[var(--hairline)] bg-black/40">
//                       {Array.from({ length: 18 }).map((_, i) => (
//                         <div key={i} className="h-full flex-1 border-r border-white/5">
//                           {localUrl ? (
//                             // eslint-disable-next-line @next/next/no-img-element
//                             <img src={localUrl} alt="" className="size-full object-cover opacity-35" />
//                           ) : null}
//                         </div>
//                       ))}
//                       <div
//                         className="absolute inset-y-0 border-x-2 border-[var(--accent)] bg-[var(--accent)]/15"
//                         style={{ left: `${trimStartPct}%`, width: `${Math.max(2, trimEndPct - trimStartPct)}%` }}
//                       />
//                       <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Video track</div>
//                     </div>
//                     <div className="mb-2 flex items-center justify-between px-1 text-[10px] text-[var(--foreground-muted)]">
//                       <span>A1</span>
//                       <span>{audioSource === "bromo" ? audioTrack || "Selected track" : "Original audio"}</span>
//                     </div>
//                     <div className="relative h-8 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--background)]">
//                       <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(168,85,247,0.28)_12%,transparent_24%,rgba(168,85,247,0.28)_36%,transparent_48%,rgba(168,85,247,0.28)_60%,transparent_72%,rgba(168,85,247,0.28)_84%,transparent_100%)]" />
//                       <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Audio track</div>
//                     </div>
//                     <div className="relative mt-3 h-10">
//                       <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
//                       <div className="absolute left-1/2 top-0 bottom-0 w-[1px] -translate-x-1/2 bg-white/35" />
//                       <div
//                         className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent)]"
//                         style={{ left: `${trimStartPct}%`, width: `${Math.max(0, trimEndPct - trimStartPct)}%` }}
//                       />
//                       <input
//                         type="range"
//                         min={0}
//                         max={Math.max(mediaDuration, 0)}
//                         step={0.05}
//                         value={trimStartSec}
//                         onChange={(e) => {
//                           const next = Number(e.target.value);
//                           setTrimStartSec(Math.min(next, trimEndSec));
//                         }}
//                         className="pointer-events-auto absolute left-0 top-0 h-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--accent)] [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:shadow"
//                       />
//                       <input
//                         type="range"
//                         min={0}
//                         max={Math.max(mediaDuration, 0)}
//                         step={0.05}
//                         value={trimEndSec}
//                         onChange={(e) => {
//                           const next = Number(e.target.value);
//                           setTrimEndSec(Math.max(next, trimStartSec));
//                         }}
//                         className="pointer-events-auto absolute left-0 top-0 h-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--accent)] [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:shadow"
//                       />
//                     </div>
//                   </div>
//                   <div className="flex flex-wrap gap-2">
//                     {[3, 5, 10, 15, 30].map((sec) => (
//                       <button
//                         key={sec}
//                         type="button"
//                         onClick={() => {
//                           const end = Math.min(mediaDuration, trimStartSec + sec);
//                           setTrimEndSec(end);
//                         }}
//                         className="rounded-full border border-[var(--hairline)] px-2.5 py-1 text-xs text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
//                       >
//                         {sec}s clip
//                       </button>
//                     ))}
//                   </div>
//                 </>
//               ) : (
//                 <p className="text-xs text-[var(--foreground-muted)]">Trim controls apply to video only.</p>
//               )}
//               <div className="grid gap-2 sm:grid-cols-2">
//                 <label className="block text-sm">
//                   <span className="text-[var(--foreground-muted)]">Crop ratio</span>
//                   <select value={crop} onChange={(e) => setCrop(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2">
//                     <option value="9:16">9:16 (Reels / Story)</option>
//                     <option value="1:1">1:1</option>
//                     <option value="4:5">4:5</option>
//                     <option value="16:9">16:9</option>
//                   </select>
//                 </label>
//                 <div className="block text-sm">
//                   <span className="text-[var(--foreground-muted)]">Crop quick presets</span>
//                   <div className="mt-1 flex gap-2">
//                     {["9:16", "1:1", "4:5", "16:9"].map((v) => (
//                       <button
//                         key={v}
//                         type="button"
//                         onClick={() => setCrop(v)}
//                         className={`rounded-md border px-2 py-1 text-xs ${crop === v ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]" : "border-[var(--hairline)] text-[var(--foreground-muted)]"}`}
//                       >
//                         {v}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </section>

//             <section className="mt-4 space-y-3 rounded-xl border border-[var(--hairline)] p-3">
//               <h3 className="text-sm font-semibold">Audio</h3>
//               <div className="grid gap-2 text-sm sm:grid-cols-3">
//                 <button type="button" onClick={() => setAudioSource("original")} className={`rounded-lg px-3 py-2 ${audioSource === "original" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface)]"}`}>Original</button>
//                 <button type="button" onClick={() => setAudioSource("mute")} className={`rounded-lg px-3 py-2 ${audioSource === "mute" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface)]"}`}>Mute</button>
//                 <button type="button" onClick={() => setAudioSource("bromo")} className={`rounded-lg px-3 py-2 ${audioSource === "bromo" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface)]"}`}>Bromo library</button>
//               </div>
//               {audioSource === "bromo" ? (
//                 <>
//                   <label className="relative block">
//                     <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--foreground-muted)]" />
//                     <input
//                       value={trackQuery}
//                       onChange={(e) => setTrackQuery(e.target.value)}
//                       placeholder="Search tracks"
//                       className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] py-2 pl-9 pr-2 text-sm"
//                     />
//                   </label>
//                   <div className="grid gap-2">
//                     {filteredTracks.map((t) => (
//                       <button key={t.id} type="button" onClick={() => setAudioTrack(t.title)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${audioTrack === t.title ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--hairline)]"}`}>
//                         <span>{t.title}</span>
//                         <span className="text-[var(--foreground-muted)]">{t.artist}</span>
//                       </button>
//                     ))}
//                   </div>
//                 </>
//               ) : null}
//               <label className="block text-sm">
//                 <span className="text-[var(--foreground-muted)]">Speed</span>
//                 <input type="range" min={0.25} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full" />
//                 <span className="text-xs text-[var(--foreground-muted)]">{speed.toFixed(2)}x</span>
//               </label>
//             </section>

//             <section className="mt-4 space-y-3 rounded-xl border border-[var(--hairline)] p-3">
//               <h3 className="text-sm font-semibold">Filters</h3>
//               <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
//                 {FILTER_PRESETS.map((id) => (
//                   <button
//                     key={id}
//                     type="button"
//                     onClick={() => setFilterPreset(id)}
//                     className={`rounded-lg border px-3 py-2 text-sm ${filterPreset === id ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--hairline)]"}`}
//                   >
//                     {PRESET_LABELS[id]}
//                   </button>
//                 ))}
//               </div>
//             </section>

//             <section className="mt-4 space-y-3 rounded-xl border border-[var(--hairline)] p-3">
//               <h3 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4" />Adjust</h3>
//               <SliderRow label="Brightness" value={brightness} min={-100} max={100} onChange={setBrightness} />
//               <SliderRow label="Contrast" value={contrast} min={-100} max={100} onChange={setContrast} />
//               <SliderRow label="Saturation" value={saturation} min={-100} max={100} onChange={setSaturation} />
//               <SliderRow label="Soft blur" value={blur} min={0} max={6} step={0.1} onChange={setBlur} />
//               <button
//                 type="button"
//                 onClick={() => {
//                   setBrightness(0);
//                   setContrast(0);
//                   setSaturation(0);
//                   setBlur(0);
//                   setFilterPreset("normal");
//                 }}
//                 className="rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm"
//               >
//                 Reset all
//               </button>
//             </section>

//             <section className="mt-4 space-y-3 rounded-xl border border-[var(--hairline)] p-3">
//               <h3 className="text-sm font-semibold">Caption, tags, location, poll</h3>
//               <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption..." className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2 text-sm" />
//               <input value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} placeholder="#hashtags (comma separated)" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2 text-sm" />
//               <label className="relative block">
//                 <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--foreground-muted)]" />
//                 <input value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Search location..." className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] py-2 pl-9 pr-2 text-sm" />
//               </label>
//               <div className="flex flex-wrap gap-2">
//                 {[...PLACE_PRESETS, ...locationHits.map((p) => p.name)].slice(0, 10).map((name) => (
//                   <button key={name} type="button" onClick={() => setLocation(name)} className={`rounded-full border px-3 py-1.5 text-xs ${location === name ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--hairline)]"}`}>
//                     {name}
//                   </button>
//                 ))}
//               </div>
//               <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2 text-sm" />
//               <input value={pollOptionsCsv} onChange={(e) => setPollOptionsCsv(e.target.value)} placeholder="Poll options: option A, option B" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2 text-sm" />
//             </section>

//             <section className="mt-4 space-y-3 rounded-xl border border-[var(--hairline)] p-3">
//               <h3 className="text-sm font-semibold">Tag people/products + visibility</h3>
//               <label className="relative block">
//                 <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--foreground-muted)]" />
//                 <input value={peopleQuery} onChange={(e) => setPeopleQuery(e.target.value)} placeholder="Search people" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] py-2 pl-9 pr-2 text-sm" />
//               </label>
//               <div className="flex flex-wrap gap-2">
//                 {peopleHits.map((u) => (
//                   <button
//                     key={u._id}
//                     type="button"
//                     onClick={() => setTaggedUsers((prev) => (prev.some((x) => x._id === u._id) ? prev : [...prev, u]))}
//                     className="rounded-full border border-[var(--hairline)] px-3 py-1.5 text-xs"
//                   >
//                     @{u.username}
//                   </button>
//                 ))}
//               </div>
//               {taggedUsers.length ? (
//                 <div className="flex flex-wrap gap-2">
//                   {taggedUsers.map((u) => (
//                     <span key={u._id} className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs">
//                       @{u.username}
//                     </span>
//                   ))}
//                 </div>
//               ) : null}

//               <label className="relative block">
//                 <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--foreground-muted)]" />
//                 <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search products" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] py-2 pl-9 pr-2 text-sm" />
//               </label>
//               <div className="flex flex-wrap gap-2">
//                 {productHits.map((p) => (
//                   <button
//                     key={p._id}
//                     type="button"
//                     onClick={() => setTaggedProducts((prev) => (prev.some((x) => x._id === p._id) ? prev : [...prev, p]))}
//                     className="rounded-full border border-[var(--hairline)] px-3 py-1.5 text-xs"
//                   >
//                     {p.title}
//                   </button>
//                 ))}
//               </div>

//               <div className="grid gap-2 text-sm sm:grid-cols-2">
//                 <label className="space-y-1">
//                   <span className="text-[var(--foreground-muted)]">Visibility</span>
//                   <select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "close_friends")} className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2">
//                     <option value="public">Public</option>
//                     <option value="close_friends">Close friends</option>
//                   </select>
//                 </label>
//                 <label className="space-y-1">
//                   <span className="text-[var(--foreground-muted)]">Feed category</span>
//                   <select value={feedCategory} onChange={(e) => setFeedCategory(e.target.value)} className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2 py-2">
//                     <option value="general">General</option>
//                     <option value="politics">Politics</option>
//                     <option value="sports">Sports</option>
//                     <option value="shopping">Shopping</option>
//                     <option value="tech">Tech</option>
//                   </select>
//                 </label>
//               </div>
//               <div className="grid gap-2 text-sm sm:grid-cols-2">
//                 <label className="inline-flex items-center gap-2"><input type="checkbox" checked={commentsOff} onChange={(e) => setCommentsOff(e.target.checked)} /> Turn off comments</label>
//                 <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideLikes} onChange={(e) => setHideLikes(e.target.checked)} /> Hide likes count</label>
//               </div>
//             </section>

//             {err ? <p className="text-sm text-rose-300">{err}</p> : null}
//             <div className="flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
//               <button type="button" disabled={busy !== null} onClick={() => void runPost()} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-50">
//                 {busy === "post" ? "Posting..." : "Post"}
//               </button>
//               <button type="button" disabled={busy !== null} onClick={() => void runDraft()} className="rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm disabled:opacity-50">
//                 {busy === "draft" ? "Saving..." : "Save draft"}
//               </button>
//               <button type="button" disabled={busy !== null} onClick={resetAndClose} className="rounded-xl border border-rose-500/30 px-4 py-2 text-sm text-rose-300 disabled:opacity-50">
//                 Discard
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function SliderRow({
//   label,
//   value,
//   min,
//   max,
//   step,
//   onChange,
// }: {
//   label: string;
//   value: number;
//   min: number;
//   max: number;
//   step?: number;
//   onChange: (v: number) => void;
// }) {
//   return (
//     <label className="block text-sm">
//       <div className="mb-1 flex items-center justify-between">
//         <span className="text-[var(--foreground-muted)]">{label}</span>
//         <span className="text-xs text-[var(--foreground-muted)]">{value.toFixed(step && step < 1 ? 1 : 0)}</span>
//       </div>
//       <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
//     </label>
//   );
// }

// function TimePill({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-2">
//       <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">{label}</div>
//       <div className="mt-0.5 text-sm font-semibold">{value}</div>
//     </div>
//   );
// }



"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ImagePlus, Music2, Search, SlidersHorizontal, X, Play, Pause,
  Volume2, VolumeX, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  ZoomIn, ZoomOut, Crop, Scissors, ChevronLeft, ChevronRight,
  Download, Eye, Layers, Settings2, Hash, MapPin, Users, ShoppingBag,
  Lock, Globe, MessageSquareOff, Heart, ChevronDown, ChevronUp,
  SkipBack, SkipForward, Maximize2, CheckCircle2, Circle, Wand2
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type CreateType = "story" | "post" | "reel";
type AudioSource = "original" | "mute" | "library";

type CreationPayload = {
  type: CreateType;
  file: File;
  caption: string;
  tagsCsv: string;
  location: string;
  feedCategory: string;
  audioSource: AudioSource;
  audioTrack: string;
  filterPreset: string;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sharpness: number;
  vignette: number;
  temperature: number;
  highlights: number;
  shadows: number;
  fadeIn: number;
  fadeOut: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  crop: string;
  zoom: number;
  visibility: "public" | "close_friends";
  commentsOff: boolean;
  hideLikes: boolean;
  pollQuestion: string;
  pollOptionsCsv: string;
  tagPeopleCsv: string;
  tagProductsCsv: string;
};

type SuggestUser = { _id: string; username: string };
type SuggestPlace = { name: string; address?: string };
type SuggestTrack = { id: string; title: string; artist: string; duration: string; bpm?: number };
type SuggestProduct = { _id: string; title: string };

// ─── Constants ──────────────────────────────────────────────────────────────

const FILTER_PRESETS = [
  { id: "none",      label: "Original",   css: "",                                                        thumb: "hue-rotate(0deg)" },
  { id: "vivid",     label: "Vivid",      css: "saturate(1.6) contrast(1.1)",                             thumb: "saturate(1.8)" },
  { id: "fade",      label: "Fade",       css: "opacity(0.88) contrast(0.9) brightness(1.05)",            thumb: "opacity(0.8)" },
  { id: "cinematic", label: "Cinematic",  css: "contrast(1.15) saturate(0.85) sepia(0.15)",               thumb: "sepia(0.3)" },
  { id: "noir",      label: "Noir",       css: "grayscale(1) contrast(1.2)",                              thumb: "grayscale(1)" },
  { id: "warm",      label: "Warm",       css: "sepia(0.3) saturate(1.2) brightness(1.05)",               thumb: "sepia(0.5)" },
  { id: "cool",      label: "Cool",       css: "hue-rotate(185deg) saturate(1.1)",                        thumb: "hue-rotate(185deg)" },
  { id: "matte",     label: "Matte",      css: "contrast(0.88) brightness(1.08) saturate(0.92)",          thumb: "contrast(0.8)" },
  { id: "chrome",    label: "Chrome",     css: "contrast(1.2) saturate(1.3) brightness(0.95)",            thumb: "contrast(1.3) saturate(1.3)" },
  { id: "golden",    label: "Golden",     css: "sepia(0.4) saturate(1.4) hue-rotate(-10deg)",             thumb: "sepia(0.6) saturate(1.4)" },
  { id: "lush",      label: "Lush",       css: "saturate(1.5) hue-rotate(10deg) brightness(1.04)",       thumb: "saturate(1.8) hue-rotate(10deg)" },
  { id: "dusk",      label: "Dusk",       css: "hue-rotate(340deg) saturate(1.2) contrast(1.08)",        thumb: "hue-rotate(340deg)" },
] as const;

type FilterId = (typeof FILTER_PRESETS)[number]["id"];

const MUSIC_LIBRARY: SuggestTrack[] = [
  { id: "t1", title: "Original Audio",  artist: "Your Media",     duration: "—",    bpm: undefined },
  { id: "t2", title: "City Nights",     artist: "Lo-Fi Pack",     duration: "2:34", bpm: 90 },
  { id: "t3", title: "Drill Wave",      artist: "Trending",       duration: "1:58", bpm: 140 },
  { id: "t4", title: "Acoustic Warm",   artist: "UGC Lite",       duration: "3:12", bpm: 78 },
  { id: "t5", title: "Trap Ritual",     artist: "Hip Hop Pack",   duration: "2:11", bpm: 145 },
  { id: "t6", title: "Chill Drift",     artist: "Ambient",        duration: "4:00", bpm: 70 },
  { id: "t7", title: "Euphoric Drop",   artist: "EDM Hits",       duration: "1:45", bpm: 128 },
  { id: "t8", title: "Jazz Corner",     artist: "Classic",        duration: "3:28", bpm: 92 },
  { id: "t9", title: "Pop Spark",       artist: "Viral Sounds",   duration: "2:04", bpm: 116 },
];

const PLACE_PRESETS = ["Dubai Mall", "Mumbai", "Bandra Kurla", "SoHo NYC", "London Bridge", "Bengaluru Tech Park", "Pune Koregaon Park"];

const CROP_RATIOS = [
  { label: "9:16", value: "9:16", ratio: 9 / 16, icon: "│" },
  { label: "1:1",  value: "1:1",  ratio: 1,       icon: "□" },
  { label: "4:5",  value: "4:5",  ratio: 4 / 5,   icon: "▯" },
  { label: "16:9", value: "16:9", ratio: 16 / 9,  icon: "▬" },
  { label: "Free", value: "free", ratio: null,     icon: "⊹" },
];

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const TABS = [
  { id: "edit",     label: "Edit",     icon: Wand2 },
  { id: "filters",  label: "Filters",  icon: Layers },
  { id: "adjust",   label: "Adjust",   icon: SlidersHorizontal },
  { id: "audio",    label: "Audio",    icon: Music2 },
  { id: "caption",  label: "Caption",  icon: Hash },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Utilities ──────────────────────────────────────────────────────────────

function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: T) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${m}:${String(ss).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function buildFilter(preset: FilterId, b: number, c: number, sat: number, blr: number, sharp: number, vign: number): string {
  const presetCss = FILTER_PRESETS.find(f => f.id === preset)?.css ?? "";
  const adj = [
    b !== 0    ? `brightness(${1 + b / 100})` : "",
    c !== 0    ? `contrast(${1 + c / 100})` : "",
    sat !== 0  ? `saturate(${1 + sat / 100})` : "",
    blr > 0    ? `blur(${blr}px)` : "",
  ].filter(Boolean).join(" ");
  return `${presetCss} ${adj}`.trim();
}

// Generates waveform path as SVG polyline points
function generateWaveformPoints(width: number, height: number, seed: number): string {
  const segments = 120;
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const amp = Math.abs(Math.sin(i * 0.4 + seed) * Math.cos(i * 0.17 + seed * 2) * (height / 2) * 0.85);
    points.push(`${x.toFixed(1)},${(height / 2 + amp).toFixed(1)}`);
  }
  return points.join(" ");
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step = 1, unit = "", onChange, center = false
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void; center?: boolean;
}) {
  const pct = center
    ? 50 + ((value - (min + max) / 2) / (max - min)) * 100
    : ((value - min) / (max - min)) * 100;

  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--fg-muted)] group-hover:text-[var(--fg)]" style={{ transition: "color .15s" }}>{label}</span>
        <span className="min-w-[2.5rem] text-right text-xs font-semibold tabular-nums text-[var(--accent)]">
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-white/10" />
        {center && <div className="absolute left-1/2 h-3 w-px bg-white/20 -translate-x-1/2" />}
        <div
          className="absolute h-1 rounded-full"
          style={{
            background: "var(--accent)",
            left: center ? `${Math.min(50, pct)}%` : "0%",
            width: center ? `${Math.abs(pct - 50)}%` : `${pct}%`,
            opacity: 0.7,
          }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="relative w-full h-5 appearance-none bg-transparent cursor-pointer"
          style={{
            // thumb styles via inline for cross-browser
          }}
        />
      </div>
    </div>
  );
}

function ToggleChip({
  active, onClick, children
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-medium border transition-all duration-150"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        borderColor: active ? "var(--accent)" : "var(--border)",
        color: active ? "var(--accent-fg)" : "var(--fg-muted)",
      }}
    >
      {children}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ContentCreationModal({
  open,
  initialType,
  onClose,
  onPostNow,
  onSaveDraft,
}: {
  open: boolean;
  initialType?: CreateType;
  onClose: () => void;
  onPostNow: (payload: CreationPayload) => Promise<void>;
  onSaveDraft: (payload: CreationPayload) => Promise<void>;
}) {
  // ── Media ──
  const [type, setType] = useState<CreateType>(initialType ?? "post");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Playback ──
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // ── Trim (seconds, float) ──
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);
  const trimBarRef = useRef<HTMLDivElement>(null);
  const draggingHandle = useRef<"in" | "out" | "playhead" | null>(null);

  // ── Transform ──
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [crop, setCrop] = useState("9:16");
  const [zoom, setZoom] = useState(1);

  // ── Filters & Adjust ──
  const [filterPreset, setFilterPreset] = useState<FilterId>("none");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [blur, setBlur] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [vignette, setVignette] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [shadows, setShadows] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);

  // ── Audio ──
  const [audioSource, setAudioSource] = useState<AudioSource>("original");
  const [audioTrack, setAudioTrack] = useState("");
  const [trackQuery, setTrackQuery] = useState("");
  const [speed, setSpeed] = useState(1);

  // ── Caption & Meta ──
  const [caption, setCaption] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationHits, setLocationHits] = useState<SuggestPlace[]>([]);
  const [feedCategory, setFeedCategory] = useState("general");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsCsv, setPollOptionsCsv] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleHits, setPeopleHits] = useState<SuggestUser[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<SuggestUser[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<SuggestProduct[]>([]);
  const [taggedProducts, setTaggedProducts] = useState<SuggestProduct[]>([]);

  // ── Visibility ──
  const [visibility, setVisibility] = useState<"public" | "close_friends">("public");
  const [commentsOff, setCommentsOff] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);

  // ── UI ──
  const [activeTab, setActiveTab] = useState<TabId>("edit");
  const [busy, setBusy] = useState<"post" | "draft" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filterExpanded, setFilterExpanded] = useState(false);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const localUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const isVideo = Boolean(file?.type.startsWith("video/"));

  const previewFilter = useMemo(
    () => buildFilter(filterPreset, brightness, contrast, saturation, blur, sharpness, vignette),
    [filterPreset, brightness, contrast, saturation, blur, sharpness, vignette]
  );

  const previewTransform = useMemo(() => {
    const parts: string[] = [];
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (flipH || flipV) parts.push(`scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`);
    if (zoom !== 1) parts.push(`scale(${zoom})`);
    return parts.join(" ") || "none";
  }, [rotation, flipH, flipV, zoom]);

  const cropRatio = useMemo(
    () => CROP_RATIOS.find(r => r.value === crop)?.ratio ?? 9 / 16,
    [crop]
  );

  const filteredTracks = useMemo(() => {
    const q = trackQuery.trim().toLowerCase();
    if (!q) return MUSIC_LIBRARY;
    return MUSIC_LIBRARY.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(q));
  }, [trackQuery]);

  const trimInPct  = duration > 0 ? (trimIn  / duration) * 100 : 0;
  const trimOutPct = duration > 0 ? (trimOut / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const clipDuration = Math.max(0, trimOut - trimIn);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { return () => { if (localUrl) URL.revokeObjectURL(localUrl); }; }, [localUrl]);

  useEffect(() => {
    if (!open) return;
    setType(initialType ?? "post");
  }, [initialType, open]);

  // Sync video speed + mute
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    v.volume = volume;
    v.muted = audioSource === "mute" || muted;
  }, [speed, volume, muted, audioSource]);

  // Enforce trim loop
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    const onTime = () => {
      if (v.currentTime < trimIn) v.currentTime = trimIn;
      if (trimOut > trimIn && v.currentTime >= trimOut) {
        v.currentTime = trimIn;
        if (playing) v.play().catch(() => {});
      }
      setCurrentTime(v.currentTime);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [isVideo, trimIn, trimOut, playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => { v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
  }, []);

  // Debounced API hooks (mocked — replace with real endpoints)
  useEffect(() => {
    const run = debounce(async (q: string) => {
      if (!q.trim()) { setPeopleHits([]); return; }
      try {
        const res = await fetch(`/api/portal/users/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
        const data = await res.json() as { users?: Array<{ _id: string; username?: string }> };
        setPeopleHits((data.users ?? []).map(u => ({ _id: String(u._id), username: String(u.username ?? "") })).filter(u => u.username).slice(0, 8));
      } catch { setPeopleHits([]); }
    }, 280);
    run(peopleQuery);
  }, [peopleQuery]);

  useEffect(() => {
    const run = debounce(async (q: string) => {
      if (!q.trim()) { setProductHits([]); return; }
      try {
        const res = await fetch(`/api/portal/products?q=${encodeURIComponent(q.trim())}&limit=10`, { cache: "no-store" });
        const data = await res.json() as { items?: Array<{ _id: string; title?: string }> };
        setProductHits((data.items ?? []).map(p => ({ _id: String(p._id), title: String(p.title ?? "") })).filter(p => p.title));
      } catch { setProductHits([]); }
    }, 280);
    run(productQuery);
  }, [productQuery]);

  useEffect(() => {
    const run = debounce(async (q: string) => {
      if (!q.trim()) { setLocationHits([]); return; }
      try {
        const res = await fetch(`/api/portal/places/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
        const data = await res.json() as { items?: SuggestPlace[] };
        setLocationHits((data.items ?? []).slice(0, 8));
      } catch { setLocationHits([]); }
    }, 280);
    run(locationQuery);
  }, [locationQuery]);

  // ─── Trim Bar Drag Logic ─────────────────────────────────────────────────────

  const getBarFraction = useCallback((clientX: number): number => {
    const bar = trimBarRef.current;
    if (!bar || duration <= 0) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, [duration]);

  const onTrimMouseDown = useCallback((handle: "in" | "out" | "playhead") => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingHandle.current = handle;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingHandle.current) return;
      const frac = getBarFraction(e.clientX);
      const t = frac * duration;
      if (draggingHandle.current === "in") {
        setTrimIn(Math.min(t, trimOut - 0.1));
        videoRef.current && (videoRef.current.currentTime = Math.min(t, trimOut - 0.1));
      } else if (draggingHandle.current === "out") {
        setTrimOut(Math.max(t, trimIn + 0.1));
        videoRef.current && (videoRef.current.currentTime = Math.max(t, trimIn + 0.1));
      } else if (draggingHandle.current === "playhead") {
        const clamped = Math.max(trimIn, Math.min(trimOut, t));
        setCurrentTime(clamped);
        videoRef.current && (videoRef.current.currentTime = clamped);
      }
    };
    const onUp = () => { draggingHandle.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [duration, trimIn, trimOut, getBarFraction]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { if (v.currentTime >= trimOut) v.currentTime = trimIn; v.play().catch(() => {}); }
    else v.pause();
  };

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(trimIn, Math.min(trimOut, v.currentTime + delta));
  };

  const resetAdjustments = () => {
    setBrightness(0); setContrast(0); setSaturation(0); setBlur(0);
    setSharpness(0); setVignette(0); setTemperature(0); setHighlights(0); setShadows(0);
    setFilterPreset("none"); setFadeIn(0); setFadeOut(0);
  };

  const resetTransform = () => {
    setRotation(0); setFlipH(false); setFlipV(false); setZoom(1);
  };

  const setClipLength = (sec: number) => {
    const end = Math.min(duration, trimIn + sec);
    setTrimOut(end);
  };

  const buildPayload = (): CreationPayload | null => {
    if (!file) return null;
    return {
      type, file, caption, tagsCsv, location, feedCategory, audioSource, audioTrack,
      filterPreset, trimStartMs: Math.round(trimIn * 1000), trimEndMs: Math.round(trimOut * 1000),
      speed, brightness, contrast, saturation, blur, sharpness, vignette, temperature,
      highlights, shadows, fadeIn, fadeOut, rotation, flipH, flipV, crop, zoom,
      visibility, commentsOff, hideLikes, pollQuestion, pollOptionsCsv,
      tagPeopleCsv: taggedUsers.map(u => u._id).join(","),
      tagProductsCsv: taggedProducts.map(p => p._id).join(","),
    };
  };

  const handlePost = async () => {
    const p = buildPayload();
    if (!p) { setErr("Select a photo or video first."); return; }
    setBusy("post"); setErr(null);
    try { await onPostNow(p); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not publish"); }
    finally { setBusy(null); }
  };

  const handleDraft = async () => {
    const p = buildPayload();
    if (!p) { setErr("Select a photo or video first."); return; }
    setBusy("draft"); setErr(null);
    try { await onSaveDraft(p); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save draft"); }
    finally { setBusy(null); }
  };

  const resetAndClose = () => { setErr(null); setFile(null); onClose(); };

  if (!open) return null;

  // ─── CSS Variables (injected inline via style on root) ───────────────────────

  const cssVars = {
    "--bg":         "#0a0a0f",
    "--surface":    "#111118",
    "--surface2":   "#18181f",
    "--card":       "#0e0e14",
    "--border":     "rgba(255,255,255,0.08)",
    "--border2":    "rgba(255,255,255,0.04)",
    "--fg":         "#f0f0f5",
    "--fg-muted":   "rgba(240,240,245,0.45)",
    "--fg-dim":     "rgba(240,240,245,0.25)",
    "--accent":     "#a78bfa",
    "--accent-glow":"rgba(167,139,250,0.35)",
    "--accent-fg":  "#0a0a0f",
    "--green":      "#4ade80",
    "--red":        "#f87171",
  } as React.CSSProperties;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Global style for range thumbs */}
      <style>{`
        .editor-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid #0a0a0f;
          cursor: pointer;
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .editor-slider::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid #0a0a0f;
          cursor: pointer;
        }
        .editor-slider { cursor: pointer; }
        .trim-handle {
          cursor: ew-resize;
          user-select: none;
        }
        .trim-handle:hover > div { background: #c4b5fd !important; }
        .filter-thumb { transition: transform .15s, box-shadow .15s; }
        .filter-thumb:hover { transform: scale(1.04); }
        .filter-thumb.active { box-shadow: 0 0 0 2px var(--accent), 0 0 12px var(--accent-glow); }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        .tab-panel { animation: fadeSlide .18s ease; }
      `}</style>

      <div
        role="dialog" aria-modal="true"
        className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4"
        style={{ ...cssVars, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" } as React.CSSProperties}
      >
        {/* Backdrop close */}
        <button type="button" className="absolute inset-0" aria-label="Close" onClick={resetAndClose} />

        <div
          className="relative z-10 flex flex-col overflow-hidden"
          style={{
            width: "min(100%, 1340px)",
            height: "min(100vh - 16px, 920px)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
          }}
        >
          {/* ── Header ───────────────────────────────────────── */}
          <div
            className="flex items-center justify-between shrink-0 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
          >
            {/* Type selector */}
            <div
              className="flex gap-0.5 rounded-xl p-1"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              {(["story", "post", "reel"] as const).map(t => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className="rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150"
                  style={{
                    background: type === t ? "var(--accent)" : "transparent",
                    color: type === t ? "var(--bg)" : "var(--fg-muted)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <span className="text-xs font-semibold" style={{ color: "var(--fg-muted)", letterSpacing: "0.06em" }}>
              BROMO CREATOR
            </span>

            <button
              type="button" onClick={resetAndClose}
              className="rounded-lg p-2 transition-colors"
              style={{ color: "var(--fg-muted)" }}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* ── Body ─────────────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 overflow-hidden">

            {/* ── Left: Preview Pane ───────────────────────── */}
            <div
              className="flex flex-col shrink-0"
              style={{
                width: "clamp(300px, 38%, 480px)",
                borderRight: "1px solid var(--border)",
                background: "var(--bg)",
              }}
            >
              {/* Media preview */}
              <div
                className="flex flex-1 items-center justify-center overflow-hidden p-3 min-h-0"
                style={{ background: "#050508" }}
              >
                {localUrl ? (
                  <div
                    className="relative overflow-hidden rounded-xl"
                    style={{
                      width: "100%",
                      maxWidth: cropRatio && cropRatio < 1 ? "240px" : "100%",
                      aspectRatio: cropRatio ?? "9/16",
                      maxHeight: "calc(100% - 8px)",
                      background: "#000",
                    }}
                  >
                    {isVideo ? (
                      <video
                        ref={videoRef}
                        src={localUrl}
                        playsInline
                        className="h-full w-full object-cover"
                        style={{ filter: previewFilter, transform: previewTransform }}
                        onLoadedMetadata={e => {
                          const d = e.currentTarget.duration || 0;
                          setDuration(d);
                          setTrimIn(0);
                          setTrimOut(d);
                          setCurrentTime(0);
                        }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={localUrl} alt="Preview"
                        className="h-full w-full object-cover"
                        style={{ filter: previewFilter, transform: previewTransform }}
                      />
                    )}
                    {/* Vignette overlay */}
                    {vignette > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{
                          boxShadow: `inset 0 0 ${vignette * 8}px ${vignette * 4}px rgba(0,0,0,${vignette * 0.7})`,
                        }}
                      />
                    )}
                    {/* Fade overlays */}
                    {fadeIn > 0 && (
                      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${fadeIn * 8}%`, background: "linear-gradient(to bottom, #000, transparent)" }} />
                    )}
                    {fadeOut > 0 && (
                      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: `${fadeOut * 8}%`, background: "linear-gradient(to top, #000, transparent)" }} />
                    )}
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center gap-3 cursor-pointer rounded-2xl p-10 transition-all"
                    style={{
                      border: "2px dashed var(--border)",
                      color: "var(--fg-dim)",
                      width: "100%",
                      maxWidth: 280,
                    }}
                  >
                    <ImagePlus className="size-10 opacity-60" style={{ color: "var(--accent)" }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Drop media here</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>Photo · Video · Reel</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={type === "reel" ? "video/*" : "image/*,video/*"}
                      className="hidden"
                      onChange={e => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>

              {/* ── Video Controls ─────────────────────────── */}
              {localUrl && isVideo && (
                <div
                  className="shrink-0 p-3 space-y-2"
                  style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
                >
                  {/* Time display */}
                  <div className="flex items-center justify-between text-xs font-mono" style={{ color: "var(--fg-muted)" }}>
                    <span style={{ color: "var(--accent)" }}>{formatTime(currentTime)}</span>
                    <div className="flex gap-3">
                      <span>IN {formatTime(trimIn)}</span>
                      <span>OUT {formatTime(trimOut)}</span>
                      <span style={{ color: "var(--green)" }}>CLIP {formatTime(clipDuration)}</span>
                    </div>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {/* Waveform + trim bar */}
                  <div
                    ref={trimBarRef}
                    className="relative h-14 rounded-lg overflow-hidden cursor-pointer select-none"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                    onClick={e => {
                      if (draggingHandle.current) return;
                      const frac = getBarFraction(e.clientX);
                      const t = Math.max(trimIn, Math.min(trimOut, frac * duration));
                      setCurrentTime(t);
                      if (videoRef.current) videoRef.current.currentTime = t;
                    }}
                  >
                    {/* Waveform SVG */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 56">
                      {/* Dim region before trim in */}
                      <rect x={0} y={0} width={`${trimInPct * 4}px`} height={56} fill="rgba(0,0,0,0.6)" />
                      {/* Dim region after trim out */}
                      <rect x={`${trimOutPct * 4}px`} y={0} width={`${(100 - trimOutPct) * 4}px`} height={56} fill="rgba(0,0,0,0.6)" />
                      {/* Waveform */}
                      <polyline
                        points={generateWaveformPoints(400, 56, 3.7)}
                        fill="none"
                        stroke="rgba(167,139,250,0.35)"
                        strokeWidth={1.2}
                      />
                      <polyline
                        points={generateWaveformPoints(400, 56, 1.2)}
                        fill="none"
                        stroke="rgba(167,139,250,0.2)"
                        strokeWidth={0.8}
                      />
                    </svg>

                    {/* Active region highlight */}
                    <div
                      className="absolute inset-y-0 pointer-events-none"
                      style={{
                        left: `${trimInPct}%`,
                        width: `${trimOutPct - trimInPct}%`,
                        background: "rgba(167,139,250,0.08)",
                        borderTop: "2px solid var(--accent)",
                        borderBottom: "2px solid var(--accent)",
                      }}
                    />

                    {/* Trim IN handle */}
                    <div
                      className="trim-handle absolute top-0 bottom-0 flex items-center justify-center"
                      style={{ left: `${trimInPct}%`, transform: "translateX(-50%)", width: 20, zIndex: 4 }}
                      onMouseDown={onTrimMouseDown("in")}
                    >
                      <div
                        className="h-full w-3 rounded-sm flex flex-col items-center justify-center gap-0.5"
                        style={{ background: "var(--accent)" }}
                      >
                        <div className="w-0.5 h-3 rounded-full bg-black/70" />
                        <div className="w-0.5 h-3 rounded-full bg-black/70" />
                      </div>
                    </div>

                    {/* Trim OUT handle */}
                    <div
                      className="trim-handle absolute top-0 bottom-0 flex items-center justify-center"
                      style={{ left: `${trimOutPct}%`, transform: "translateX(-50%)", width: 20, zIndex: 4 }}
                      onMouseDown={onTrimMouseDown("out")}
                    >
                      <div
                        className="h-full w-3 rounded-sm flex flex-col items-center justify-center gap-0.5"
                        style={{ background: "var(--accent)" }}
                      >
                        <div className="w-0.5 h-3 rounded-full bg-black/70" />
                        <div className="w-0.5 h-3 rounded-full bg-black/70" />
                      </div>
                    </div>

                    {/* Playhead */}
                    <div
                      className="trim-handle absolute top-0 bottom-0 pointer-events-auto"
                      style={{
                        left: `${playheadPct}%`,
                        transform: "translateX(-50%)",
                        width: 18,
                        zIndex: 5,
                      }}
                      onMouseDown={onTrimMouseDown("playhead")}
                    >
                      <div className="absolute inset-x-1/2 inset-y-0 -translate-x-1/2 w-0.5" style={{ background: "#fff" }} />
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0"
                        style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid #fff" }}
                      />
                    </div>
                  </div>

                  {/* Clip quick presets */}
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {[3, 5, 10, 15, 30, 60].map(s => (
                      <button
                        key={s} type="button"
                        onClick={() => setClipLength(s)}
                        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                        style={{
                          background: clipDuration === s ? "var(--accent)" : "var(--surface2)",
                          color: clipDuration === s ? "#000" : "var(--fg-muted)",
                          border: `1px solid ${clipDuration === s ? "var(--accent)" : "var(--border)"}`,
                        }}
                      >
                        {s}s
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setTrimIn(0); setTrimOut(duration); }}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{ background: "var(--surface2)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                    >
                      Full
                    </button>
                  </div>

                  {/* Playback controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => seek(-5)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: "var(--fg-muted)" }}>
                        <SkipBack className="size-4" />
                      </button>
                      <button
                        type="button" onClick={togglePlay}
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
                        style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)" }}
                      >
                        {playing
                          ? <Pause className="size-4" style={{ color: "#000" }} />
                          : <Play className="size-4 translate-x-0.5" style={{ color: "#000" }} />
                        }
                      </button>
                      <button type="button" onClick={() => seek(5)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: "var(--fg-muted)" }}>
                        <SkipForward className="size-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setMuted(m => !m)} style={{ color: "var(--fg-muted)" }}>
                        {muted || audioSource === "mute"
                          ? <VolumeX className="size-4" />
                          : <Volume2 className="size-4" />
                        }
                      </button>
                      <input
                        type="range" min={0} max={1} step={0.01} value={volume}
                        onChange={e => { setVolume(Number(e.target.value)); setMuted(false); }}
                        className="editor-slider w-16 h-1"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>{speed}x</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Change media button if file set */}
              {localUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors hover:bg-white/5"
                  style={{ borderTop: "1px solid var(--border)", color: "var(--fg-muted)" }}
                >
                  <ImagePlus className="size-3.5" />
                  Change media
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={type === "reel" ? "video/*" : "image/*,video/*"}
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </button>
              )}
            </div>

            {/* ── Right: Editor Pane ───────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">

              {/* Tab bar */}
              <div
                className="flex shrink-0 overflow-x-auto"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
              >
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id} type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className="flex shrink-0 items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all relative"
                      style={{
                        color: active ? "var(--fg)" : "var(--fg-muted)",
                        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                        marginBottom: -1,
                      }}
                    >
                      <Icon className="size-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab panels */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 tab-panel" key={activeTab}>

                {/* ── EDIT tab ───────────────────────────────── */}
                {activeTab === "edit" && (
                  <>
                    {/* Crop */}
                    <Section title="Aspect Ratio & Crop">
                      <div className="flex gap-2 flex-wrap">
                        {CROP_RATIOS.map(r => (
                          <button
                            key={r.value} type="button"
                            onClick={() => setCrop(r.value)}
                            className="flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 transition-all"
                            style={{
                              background: crop === r.value ? "rgba(167,139,250,0.15)" : "var(--surface2)",
                              border: `1.5px solid ${crop === r.value ? "var(--accent)" : "var(--border)"}`,
                              color: crop === r.value ? "var(--accent)" : "var(--fg-muted)",
                              minWidth: 56,
                            }}
                          >
                            <span className="text-sm">{r.icon}</span>
                            <span className="text-[11px] font-bold">{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </Section>

                    {/* Transform */}
                    <Section title="Transform" action={<ResetBtn onClick={resetTransform} />}>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Rotation */}
                        <div>
                          <p className="mb-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>Rotation</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {[-90, -45, -15, 0, 15, 45, 90].map(r => (
                              <button
                                key={r} type="button"
                                onClick={() => setRotation(r)}
                                className="rounded-md px-2 py-1 text-[11px] font-medium transition-all"
                                style={{
                                  background: rotation === r ? "var(--accent)" : "var(--surface2)",
                                  color: rotation === r ? "#000" : "var(--fg-muted)",
                                  border: `1px solid ${rotation === r ? "var(--accent)" : "var(--border)"}`,
                                }}
                              >
                                {r}°
                              </button>
                            ))}
                          </div>
                          <input
                            type="range" min={-180} max={180} step={1} value={rotation}
                            onChange={e => setRotation(Number(e.target.value))}
                            className="editor-slider w-full mt-2 h-1"
                            style={{ accentColor: "var(--accent)" }}
                          />
                        </div>
                        {/* Flip + Zoom */}
                        <div className="space-y-2">
                          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Flip & Zoom</p>
                          <div className="flex gap-2">
                            <ToggleChip active={flipH} onClick={() => setFlipH(h => !h)}>
                              <span className="flex items-center gap-1"><FlipHorizontal className="size-3" /> H</span>
                            </ToggleChip>
                            <ToggleChip active={flipV} onClick={() => setFlipV(v => !v)}>
                              <span className="flex items-center gap-1"><FlipVertical className="size-3" /> V</span>
                            </ToggleChip>
                          </div>
                          <SliderRow label="Zoom" value={zoom} min={0.5} max={3} step={0.05} onChange={setZoom} />
                        </div>
                      </div>
                    </Section>

                    {/* Speed (video only) */}
                    {isVideo && (
                      <Section title="Playback Speed">
                        <div className="flex gap-1.5 flex-wrap">
                          {SPEED_PRESETS.map(s => (
                            <button
                              key={s} type="button"
                              onClick={() => setSpeed(s)}
                              className="rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                              style={{
                                background: speed === s ? "var(--accent)" : "var(--surface2)",
                                color: speed === s ? "#000" : "var(--fg-muted)",
                                border: `1px solid ${speed === s ? "var(--accent)" : "var(--border)"}`,
                              }}
                            >
                              {s}×
                            </button>
                          ))}
                        </div>
                        <div className="mt-2">
                          <SliderRow label="Custom speed" value={speed} min={0.1} max={4} step={0.05} unit="×" onChange={setSpeed} />
                        </div>
                      </Section>
                    )}

                    {/* Fade (video only) */}
                    {isVideo && (
                      <Section title="Fade In / Out">
                        <div className="space-y-3">
                          <SliderRow label="Fade In" value={fadeIn} min={0} max={10} step={0.5} onChange={setFadeIn} />
                          <SliderRow label="Fade Out" value={fadeOut} min={0} max={10} step={0.5} onChange={setFadeOut} />
                        </div>
                      </Section>
                    )}
                  </>
                )}

                {/* ── FILTERS tab ────────────────────────────── */}
                {activeTab === "filters" && (
                  <Section title="Filter Presets">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {FILTER_PRESETS.map(f => (
                        <button
                          key={f.id} type="button"
                          onClick={() => setFilterPreset(f.id as FilterId)}
                          className={`filter-thumb flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all ${filterPreset === f.id ? "active" : ""}`}
                          style={{
                            background: "var(--surface2)",
                            border: `1.5px solid ${filterPreset === f.id ? "var(--accent)" : "var(--border)"}`,
                          }}
                        >
                          {/* Thumbnail swatch */}
                          <div
                            className="w-full rounded-lg overflow-hidden"
                            style={{ aspectRatio: "1", background: "linear-gradient(135deg, #a78bfa, #60a5fa, #34d399, #fb923c)" }}
                          >
                            {localUrl ? (
                              isVideo ? (
                                <div
                                  className="w-full h-full"
                                  style={{
                                    backgroundImage: `url(${localUrl})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    filter: f.css,
                                  }}
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={localUrl} alt={f.label} className="w-full h-full object-cover" style={{ filter: f.css }} />
                              )
                            ) : (
                              <div className="w-full h-full" style={{ filter: f.css, background: "linear-gradient(135deg, #a78bfa, #60a5fa, #34d399, #fb923c)" }} />
                            )}
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: filterPreset === f.id ? "var(--accent)" : "var(--fg-muted)" }}>
                            {f.label}
                          </span>
                          {filterPreset === f.id && <CheckCircle2 className="size-3" style={{ color: "var(--accent)" }} />}
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── ADJUST tab ─────────────────────────────── */}
                {activeTab === "adjust" && (
                  <>
                    <Section title="Light" action={<ResetBtn onClick={resetAdjustments} />}>
                      <div className="space-y-3">
                        <SliderRow label="Brightness" value={brightness} min={-100} max={100} onChange={setBrightness} center unit="" />
                        <SliderRow label="Highlights"  value={highlights}  min={-100} max={100} onChange={setHighlights} center />
                        <SliderRow label="Shadows"     value={shadows}     min={-100} max={100} onChange={setShadows} center />
                      </div>
                    </Section>
                    <Section title="Colour">
                      <div className="space-y-3">
                        <SliderRow label="Contrast"    value={contrast}    min={-100} max={100} onChange={setContrast} center />
                        <SliderRow label="Saturation"  value={saturation}  min={-100} max={100} onChange={setSaturation} center />
                        <SliderRow label="Temperature" value={temperature} min={-100} max={100} onChange={setTemperature} center />
                      </div>
                    </Section>
                    <Section title="Detail">
                      <div className="space-y-3">
                        <SliderRow label="Sharpness"  value={sharpness} min={0} max={100} onChange={setSharpness} />
                        <SliderRow label="Soft Blur"  value={blur}      min={0} max={8}   step={0.1} onChange={setBlur} />
                        <SliderRow label="Vignette"   value={vignette}  min={0} max={10}  step={0.1} onChange={setVignette} />
                      </div>
                    </Section>
                  </>
                )}

                {/* ── AUDIO tab ──────────────────────────────── */}
                {activeTab === "audio" && (
                  <>
                    <Section title="Audio Source">
                      <div className="grid grid-cols-3 gap-2">
                        {(["original", "mute", "library"] as AudioSource[]).map(s => (
                          <button
                            key={s} type="button"
                            onClick={() => setAudioSource(s)}
                            className="rounded-xl py-2.5 text-xs font-semibold transition-all"
                            style={{
                              background: audioSource === s ? "var(--accent)" : "var(--surface2)",
                              color: audioSource === s ? "#000" : "var(--fg-muted)",
                              border: `1.5px solid ${audioSource === s ? "var(--accent)" : "var(--border)"}`,
                            }}
                          >
                            {s === "original" ? "Original" : s === "mute" ? "Mute" : "Library"}
                          </button>
                        ))}
                      </div>
                    </Section>

                    {audioSource === "library" && (
                      <Section title="Music Library">
                        <div
                          className="relative mb-3"
                          style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}
                        >
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--fg-muted)" }} />
                          <input
                            value={trackQuery}
                            onChange={e => setTrackQuery(e.target.value)}
                            placeholder="Search tracks, artists…"
                            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none"
                            style={{ color: "var(--fg)" }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          {filteredTracks.map(t => (
                            <button
                              key={t.id} type="button"
                              onClick={() => setAudioTrack(t.title)}
                              className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all"
                              style={{
                                background: audioTrack === t.title ? "rgba(167,139,250,0.12)" : "var(--surface2)",
                                border: `1px solid ${audioTrack === t.title ? "var(--accent)" : "var(--border)"}`,
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                                  style={{ background: "var(--bg)" }}
                                >
                                  <Music2 className="size-3.5" style={{ color: audioTrack === t.title ? "var(--accent)" : "var(--fg-muted)" }} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{t.title}</p>
                                  <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{t.artist}{t.bpm ? ` · ${t.bpm} BPM` : ""}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono" style={{ color: "var(--fg-dim)" }}>{t.duration}</span>
                                {audioTrack === t.title && <CheckCircle2 className="size-4" style={{ color: "var(--accent)" }} />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </Section>
                    )}

                    {isVideo && (
                      <Section title="Volume Mix">
                        <SliderRow label="Volume" value={Math.round(volume * 100)} min={0} max={100} unit="%" onChange={v => setVolume(v / 100)} />
                      </Section>
                    )}
                  </>
                )}

                {/* ── CAPTION tab ────────────────────────────── */}
                {activeTab === "caption" && (
                  <>
                    <Section title="Caption">
                      <textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        rows={4}
                        placeholder="Write a caption…"
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                        style={{
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          color: "var(--fg)",
                        }}
                      />
                      <p className="mt-1 text-right text-[11px]" style={{ color: "var(--fg-dim)" }}>{caption.length} chars</p>
                    </Section>

                    <Section title="Hashtags">
                      <input
                        value={tagsCsv}
                        onChange={e => setTagsCsv(e.target.value)}
                        placeholder="#travel, #bromo, #explore"
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)" }}
                      />
                    </Section>

                    <Section title="Location">
                      <div className="relative mb-2">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--fg-muted)" }} />
                        <input
                          value={locationQuery}
                          onChange={e => setLocationQuery(e.target.value)}
                          placeholder="Search location…"
                          className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)" }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...PLACE_PRESETS, ...locationHits.map(p => p.name)].slice(0, 12).map(name => (
                          <ToggleChip key={name} active={location === name} onClick={() => setLocation(name)}>
                            {name}
                          </ToggleChip>
                        ))}
                      </div>
                      {location && (
                        <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                          📍 {location}
                        </p>
                      )}
                    </Section>

                    <Section title="Poll (optional)">
                      <div className="space-y-2">
                        <input
                          value={pollQuestion}
                          onChange={e => setPollQuestion(e.target.value)}
                          placeholder="Poll question…"
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)" }}
                        />
                        <input
                          value={pollOptionsCsv}
                          onChange={e => setPollOptionsCsv(e.target.value)}
                          placeholder="Option A, Option B, …"
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)" }}
                        />
                      </div>
                    </Section>

                    <Section title="Tag People">
                      <div className="relative mb-2">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--fg-muted)" }} />
                        <input
                          value={peopleQuery}
                          onChange={e => setPeopleQuery(e.target.value)}
                          placeholder="Search people…"
                          className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)" }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {peopleHits.map(u => (
                          <ToggleChip
                            key={u._id}
                            active={taggedUsers.some(x => x._id === u._id)}
                            onClick={() => setTaggedUsers(p => p.some(x => x._id === u._id) ? p.filter(x => x._id !== u._id) : [...p, u])}
                          >
                            @{u.username}
                          </ToggleChip>
                        ))}
                        {taggedUsers.map(u => (
                          <span key={u._id} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "rgba(167,139,250,0.15)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                            @{u.username} <button type="button" onClick={() => setTaggedUsers(p => p.filter(x => x._id !== u._id))}>×</button>
                          </span>
                        ))}
                      </div>
                    </Section>

                    <Section title="Tag Products">
                      <div className="relative mb-2">
                        <ShoppingBag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--fg-muted)" }} />
                        <input
                          value={productQuery}
                          onChange={e => setProductQuery(e.target.value)}
                          placeholder="Search products…"
                          className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)" }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {productHits.map(p => (
                          <ToggleChip
                            key={p._id}
                            active={taggedProducts.some(x => x._id === p._id)}
                            onClick={() => setTaggedProducts(prev => prev.some(x => x._id === p._id) ? prev.filter(x => x._id !== p._id) : [...prev, p])}
                          >
                            {p.title}
                          </ToggleChip>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                {/* ── SETTINGS tab ───────────────────────────── */}
                {activeTab === "settings" && (
                  <>
                    <Section title="Visibility & Audience">
                      <div className="space-y-2">
                        {(["public", "close_friends"] as const).map(v => (
                          <button
                            key={v} type="button"
                            onClick={() => setVisibility(v)}
                            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                            style={{
                              background: visibility === v ? "rgba(167,139,250,0.1)" : "var(--surface2)",
                              border: `1.5px solid ${visibility === v ? "var(--accent)" : "var(--border)"}`,
                            }}
                          >
                            {v === "public" ? <Globe className="size-4" style={{ color: "var(--fg-muted)" }} /> : <Lock className="size-4" style={{ color: "var(--fg-muted)" }} />}
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                                {v === "public" ? "Public" : "Close Friends"}
                              </p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                {v === "public" ? "Anyone can see this" : "Only your close friends list"}
                              </p>
                            </div>
                            {visibility === v && <CheckCircle2 className="size-4 ml-auto" style={{ color: "var(--accent)" }} />}
                          </button>
                        ))}
                      </div>
                    </Section>

                    <Section title="Feed Category">
                      <div className="grid grid-cols-3 gap-2">
                        {["general", "politics", "sports", "shopping", "tech", "entertainment"].map(cat => (
                          <ToggleChip key={cat} active={feedCategory === cat} onClick={() => setFeedCategory(cat)}>
                            {cat[0].toUpperCase() + cat.slice(1)}
                          </ToggleChip>
                        ))}
                      </div>
                    </Section>

                    <Section title="Interaction Controls">
                      <div className="space-y-2">
                        <label
                          className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                        >
                          <div className="flex items-center gap-3">
                            <MessageSquareOff className="size-4" style={{ color: "var(--fg-muted)" }} />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Turn off comments</p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>No one can comment on this</p>
                            </div>
                          </div>
                          <Toggle checked={commentsOff} onChange={setCommentsOff} />
                        </label>
                        <label
                          className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                        >
                          <div className="flex items-center gap-3">
                            <Heart className="size-4" style={{ color: "var(--fg-muted)" }} />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Hide like count</p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>Viewers won't see the count</p>
                            </div>
                          </div>
                          <Toggle checked={hideLikes} onChange={setHideLikes} />
                        </label>
                      </div>
                    </Section>
                  </>
                )}

              </div>

              {/* ── Footer / Actions ─────────────────────────── */}
              <div
                className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
              >
                {err && (
                  <p className="text-xs font-medium" style={{ color: "var(--red)" }}>{err}</p>
                )}
                <div className="flex flex-wrap gap-2 ml-auto">
                  <button
                    type="button" disabled={busy !== null} onClick={resetAndClose}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}
                  >
                    Discard
                  </button>
                  <button
                    type="button" disabled={busy !== null} onClick={() => void handleDraft()}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--fg-muted)", background: "var(--surface2)" }}
                  >
                    {busy === "draft" ? "Saving…" : "Save Draft"}
                  </button>
                  <button
                    type="button" disabled={busy !== null} onClick={() => void handlePost()}
                    className="rounded-xl px-5 py-2 text-sm font-bold transition-all disabled:opacity-50"
                    style={{
                      background: "var(--accent)",
                      color: "#000",
                      boxShadow: busy === null ? "0 0 16px var(--accent-glow)" : "none",
                    }}
                  >
                    {busy === "post" ? "Posting…" : "Post Now"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Helper sub-components ───────────────────────────────────────────────────

function Section({
  title, children, action
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border2)" }}
      >
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)", letterSpacing: "0.1em" }}>{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ResetBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
      style={{ color: "var(--fg-dim)" }}
    >
      <RotateCcw className="size-3" /> Reset
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 rounded-full transition-all shrink-0"
      style={{ background: checked ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
        style={{
          background: "#fff",
          left: checked ? "calc(100% - 1.375rem)" : "1px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}
import { Router, type Response } from "express";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";

export const placesRouter = Router();

type Place = { name: string; address?: string; lat?: number; lng?: number; placeId?: string; type?: string };

function googlePlacesKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_KEY;
}

/**
 * GET /places/nearby?lat=..&lng=..&q=..
 * Returns nearby places. Uses Google Places if GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_KEY set,
 * otherwise falls back to OpenStreetMap Nominatim (no key, rate-limited).
 */
placesRouter.get(
  "/nearby",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const q = String(req.query.q ?? "").trim();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ message: "lat and lng required" });
      }

      const key = googlePlacesKey();
      if (key) {
        const url = q
          ? `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${lat},${lng}&radius=5000&key=${key}`
          : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&key=${key}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`google ${resp.status}`);
        const data = (await resp.json()) as {
          results?: Array<{
            name: string;
            vicinity?: string;
            formatted_address?: string;
            place_id?: string;
            types?: string[];
            geometry?: { location?: { lat: number; lng: number } };
          }>;
        };
        const items: Place[] = (data.results ?? []).slice(0, 20).map((r) => ({
          name: r.name,
          address: r.vicinity ?? r.formatted_address,
          lat: r.geometry?.location?.lat,
          lng: r.geometry?.location?.lng,
          placeId: r.place_id,
          type: r.types?.[0],
        }));
        return res.json({ items });
      }

      // Fallback: Nominatim (reverse + nearby search)
      const url = q
        ? `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=20&addressdetails=1&viewbox=${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}&bounded=1`
        : `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=17`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "BromoApp/1.0 (contact@bromo.app)" },
      });
      if (!resp.ok) throw new Error(`nominatim ${resp.status}`);
      const raw = (await resp.json()) as unknown;
      const rows = Array.isArray(raw) ? raw : [raw];
      const items: Place[] = rows
        .filter((r): r is Record<string, unknown> => Boolean(r))
        .slice(0, 20)
        .map((r) => {
          const addr = (r.address as Record<string, string> | undefined) ?? {};
          const name =
            addr.amenity ??
            addr.shop ??
            addr.building ??
            addr.road ??
            addr.suburb ??
            addr.neighbourhood ??
            addr.village ??
            addr.town ??
            addr.city ??
            String(r.name ?? r.display_name ?? "Unknown place");
          return {
            name: String(name).slice(0, 120),
            address: typeof r.display_name === "string" ? r.display_name : undefined,
            lat: Number(r.lat),
            lng: Number(r.lon),
            placeId: r.place_id != null ? String(r.place_id) : undefined,
            type: typeof r.type === "string" ? r.type : undefined,
          };
        });
      return res.json({ items });
    } catch (err) {
      console.error("[places] nearby:", err);
      return res.json({ items: [] });
    }
  },
);

placesRouter.get(
  "/search",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const q = String(req.query.q ?? "").trim();
      if (!q) return res.json({ items: [] });
      const key = googlePlacesKey();
      if (key) {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${key}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`google ${resp.status}`);
        const data = (await resp.json()) as {
          results?: Array<{
            name: string;
            formatted_address?: string;
            place_id?: string;
            geometry?: { location?: { lat: number; lng: number } };
          }>;
        };
        const items: Place[] = (data.results ?? []).slice(0, 20).map((r) => ({
          name: r.name,
          address: r.formatted_address,
          lat: r.geometry?.location?.lat,
          lng: r.geometry?.location?.lng,
          placeId: r.place_id,
        }));
        return res.json({ items });
      }
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=20&addressdetails=1`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "BromoApp/1.0 (contact@bromo.app)" },
      });
      if (!resp.ok) throw new Error(`nominatim ${resp.status}`);
      const rows = (await resp.json()) as Array<Record<string, unknown>>;
      const items: Place[] = rows.slice(0, 20).map((r) => ({
        name: String(r.display_name ?? "").split(",")[0] || "Place",
        address: typeof r.display_name === "string" ? r.display_name : undefined,
        lat: Number(r.lat),
        lng: Number(r.lon),
        placeId: r.place_id != null ? String(r.place_id) : undefined,
      }));
      return res.json({ items });
    } catch (err) {
      console.error("[places] search:", err);
      return res.json({ items: [] });
    }
  },
);

/**
 * GET /places/details?placeId= — Google Place Details (requires API key).
 */
placesRouter.get(
  "/details",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const placeId = String(req.query.placeId ?? "").trim();
      const key = googlePlacesKey();
      if (!placeId) return res.status(400).json({ message: "placeId required" });
      if (!key) return res.status(503).json({ message: "Google Places not configured" });
      const fields = "name,formatted_address,geometry,place_id,types";
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${key}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`google ${resp.status}`);
      const data = (await resp.json()) as {
        result?: {
          name?: string;
          formatted_address?: string;
          place_id?: string;
          geometry?: { location?: { lat: number; lng: number } };
          types?: string[];
        };
      };
      const r = data.result;
      if (!r) return res.status(404).json({ message: "Place not found" });
      return res.json({
        place: {
          name: r.name,
          address: r.formatted_address,
          lat: r.geometry?.location?.lat,
          lng: r.geometry?.location?.lng,
          placeId: r.place_id,
          type: r.types?.[0],
        },
      });
    } catch (err) {
      console.error("[places] details:", err);
      return res.status(500).json({ message: "Failed to load place" });
    }
  },
);

/**
 * GET /places/geocode?lat=&lng= — reverse geocode via Google Geocoding API.
 */
placesRouter.get(
  "/geocode",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ message: "lat and lng required" });
      }
      const key = googlePlacesKey();
      if (!key) return res.json({ formattedAddress: null as string | null });
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`google ${resp.status}`);
      const data = (await resp.json()) as {
        results?: Array<{ formatted_address?: string; place_id?: string }>;
      };
      const first = data.results?.[0];
      return res.json({
        formattedAddress: first?.formatted_address ?? null,
        placeId: first?.place_id ?? null,
      });
    } catch (err) {
      console.error("[places] geocode:", err);
      return res.json({ formattedAddress: null as string | null, placeId: null as string | null });
    }
  },
);

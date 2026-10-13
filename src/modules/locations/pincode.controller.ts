import { Request, Response } from "express";
import { City, Country, State } from "country-state-city";
import CustomCity from "../../models/dropdown/CustomCity.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";

/*
 * GET /pincode/:pincode — Indian PIN code → state / city / country, for the registration
 * forms' pincode autofill. The lookup is India Post's public directory; the state and city
 * are then mapped onto the names /crm-states and /crm-cities serve, so the forms' dropdowns
 * can select them directly.
 */

const PINCODE = /^[1-9]\d{5}$/;
const LOOKUP_URL = "https://api.postalpincode.in/pincode/";
const LOOKUP_TIMEOUT_MS = 7000;
const FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED = 5000;

export type PincodePlace = {
  pincode: string;
  country: "India";
  countryCode: "IN";
  state: string;
  /** "IN-DL" style, as /crm-states */
  stateCode: string;
  city: string;
  /** false: `city` is the postal district and is not in /crm-cities for the state */
  cityListed: boolean;
  district: string;
};

type PostOffice = { State?: string; District?: string; Block?: string; Division?: string };

const cache = new Map<string, { place: PincodePlace | null; expiresAt: number }>();
const inFlight = new Map<string, Promise<PincodePlace | null>>();

const normalise = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z]+/g, " ")
    .trim();

const INDIAN_STATES = State.getStatesOfCountry("IN");
const stateByName = new Map(INDIAN_STATES.map((s) => [normalise(s.name), s]));
// India Post spellings / pre-merger names that differ from the dropdown's state names
const STATE_ALIASES: Record<string, string> = {
  "andaman and nicobar": "AN",
  chattisgarh: "CT",
  "daman and diu": "DH",
  "dadra and nagar haveli": "DH",
  "the dadra and nagar haveli and daman and diu": "DH",
  pondicherry: "PY",
  orissa: "OR",
  uttaranchal: "UT",
  telengana: "TG",
  "nct of delhi": "DL",
};
// Postal district names the city dropdown lists under their current name
const CITY_ALIASES: Record<string, string> = {
  bangalore: "bengaluru",
  pondicherry: "puducherry",
  gurgaon: "gurugram",
  allahabad: "prayagraj",
  mysore: "mysuru",
  belgaum: "belagavi",
  trivandrum: "thiruvananthapuram",
};
// Ladakh's post offices are still filed under Jammu & Kashmir
const LADAKH_DISTRICTS = new Set(["leh", "kargil", "leh ladakh"]);

const mostCommon = (values: (string | undefined)[]) => {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = (raw || "").trim();
    if (!value || value.toUpperCase() === "NA") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
};

const resolveState = (postalState: string, district: string) => {
  const key = normalise(postalState);
  if (key === "jammu and kashmir" && LADAKH_DISTRICTS.has(normalise(district))) {
    return INDIAN_STATES.find((s) => s.isoCode === "LA");
  }
  const alias = STATE_ALIASES[key];
  return alias ? INDIAN_STATES.find((s) => s.isoCode === alias) : stateByName.get(key);
};

const cityNames = async (isoCode: string) => {
  const stateCode = `IN-${isoCode}`;
  const custom = await CustomCity.find({ stateCode, isActive: true }).select("name").lean();
  return [...City.getCitiesOfState("IN", isoCode).map((c) => c.name), ...custom.map((c: any) => String(c.name))];
};

const lookup = async (pincode: string): Promise<PincodePlace | null> => {
  let body: unknown;
  try {
    const response = await fetch(`${LOOKUP_URL}${pincode}`, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    body = await response.json();
  } catch {
    throw new ApiError(503, "Pincode lookup is unavailable right now. Please fill in the state and city yourself.");
  }

  const result = Array.isArray(body) ? body[0] : null;
  const offices: PostOffice[] = Array.isArray(result?.PostOffice) ? result.PostOffice : [];
  if (!offices.length) return null;

  const district = mostCommon(offices.map((o) => o.District));
  const state = resolveState(mostCommon(offices.map((o) => o.State)), district);
  if (!state) return null;

  // Prefer a name the city dropdown already has: the district, else the block / division
  const listed = new Map((await cityNames(state.isoCode)).map((name) => [normalise(name), name]));
  const candidates = [district, mostCommon(offices.map((o) => o.Block)), mostCommon(offices.map((o) => o.Division))];
  const match = candidates
    .map((c) => listed.get(normalise(c)) || listed.get(CITY_ALIASES[normalise(c)] || ""))
    .find(Boolean);

  return {
    pincode,
    country: "India",
    countryCode: "IN",
    state: state.name,
    stateCode: `IN-${state.isoCode}`,
    city: match || district,
    cityListed: Boolean(match),
    district,
  };
};

export const getPincode = asyncHandler(async (req: Request, res: Response) => {
  const pincode = String(req.params.pincode || "").trim();
  if (!PINCODE.test(pincode)) throw new ApiError(400, "Pincode must be 6 digits and cannot start with 0.");

  const cached = cache.get(pincode);
  let place: PincodePlace | null;
  if (cached && cached.expiresAt > Date.now()) {
    place = cached.place;
  } else {
    // One upstream request per pincode, however many visitors ask at once
    let pending = inFlight.get(pincode);
    if (!pending) {
      pending = lookup(pincode).finally(() => inFlight.delete(pincode));
      inFlight.set(pincode, pending);
    }
    place = await pending;
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
    cache.set(pincode, { place, expiresAt: Date.now() + (place ? FOUND_TTL_MS : NOT_FOUND_TTL_MS) });
  }

  if (!place) throw new ApiError(404, "No location found for this pincode. Please check it.");
  res.status(200).json(new ApiResponse(200, "Pincode found", place));
});

/*
 * GET /postal/:countryCode/:code — postal / ZIP code outside India → state / city, from the
 * public Zippopotam directory (about 60 countries). Countries or codes it does not know answer
 * 404, and the form then leaves the state and city for the visitor to choose.
 */

const POSTAL = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;
const POSTAL_URL = "https://api.zippopotam.us/";

export type PostalPlace = {
  pincode: string;
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  /** "" when the place is not in the state's city list — the visitor then picks the city */
  city: string;
  cityListed: boolean;
};

type ZipPlace = { "place name"?: string; state?: string; "state abbreviation"?: string };

const postalCache = new Map<string, { place: PostalPlace | null; expiresAt: number }>();
const postalInFlight = new Map<string, Promise<PostalPlace | null>>();

/** The directory indexes the UK by outward code ("SW1A"), Canada by the first three characters and the US by 5-digit ZIP */
const directoryCode = (countryCode: string, code: string) => {
  const value = code.trim().toUpperCase();
  if (countryCode === "GB") return value.includes(" ") ? value.split(" ")[0] : value.length > 4 ? value.slice(0, -3) : value;
  if (countryCode === "CA") return value.replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (countryCode === "US") return value.slice(0, 5);
  return value;
};

const lookupPostal = async (countryCode: string, code: string): Promise<PostalPlace | null> => {
  let body: any;
  try {
    const url = `${POSTAL_URL}${countryCode.toLowerCase()}/${encodeURIComponent(directoryCode(countryCode, code))}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`status ${response.status}`);
    body = await response.json();
  } catch {
    throw new ApiError(503, "Postal code lookup is unavailable right now. Please fill in the state and city yourself.");
  }

  const places: ZipPlace[] = Array.isArray(body?.places) ? body.places : [];
  if (!places.length) return null;

  // The state must be one the dropdown offers: by name, else by its abbreviation (US "NY", CA "ON")
  const states = State.getStatesOfCountry(countryCode);
  const name = normalise(mostCommon(places.map((p) => p.state)));
  const abbreviation = mostCommon(places.map((p) => p["state abbreviation"])).toUpperCase();
  const state = states.find((s) => normalise(s.name) === name) || states.find((s) => s.isoCode === abbreviation);
  if (!state) return null;

  const stateCode = `${countryCode}-${state.isoCode}`;
  const custom = await CustomCity.find({ stateCode, isActive: true }).select("name").lean();
  const listed = new Map(
    [...City.getCitiesOfState(countryCode, state.isoCode).map((c) => c.name), ...custom.map((c: any) => String(c.name))].map((n) => [normalise(n), n])
  );
  const names = places.map((p) => (p["place name"] || "").trim()).filter(Boolean);
  const match = names.map((n) => listed.get(normalise(n))).find(Boolean);

  return {
    pincode: code,
    country: Country.getCountryByCode(countryCode)?.name || "",
    countryCode,
    state: state.name,
    stateCode,
    // Only a city the dropdown lists: place names here can be landmarks or districts
    city: match || "",
    cityListed: Boolean(match),
  };
};

export const getPostalCode = asyncHandler(async (req: Request, res: Response) => {
  const countryCode = String(req.params.countryCode || "").trim().toUpperCase();
  const code = String(req.params.code || "").trim();
  if (!Country.getCountryByCode(countryCode)) throw new ApiError(400, "Unknown country.");
  if (countryCode === "IN") throw new ApiError(400, "Use /pincode for Indian pincodes.");
  if (!POSTAL.test(code)) throw new ApiError(400, "Please enter a valid postal / ZIP code.");

  const key = `${countryCode}/${code.toUpperCase()}`;
  const cached = postalCache.get(key);
  let place: PostalPlace | null;
  if (cached && cached.expiresAt > Date.now()) {
    place = cached.place;
  } else {
    let pending = postalInFlight.get(key);
    if (!pending) {
      pending = lookupPostal(countryCode, code).finally(() => postalInFlight.delete(key));
      postalInFlight.set(key, pending);
    }
    place = await pending;
    if (postalCache.size >= MAX_CACHED) postalCache.delete(postalCache.keys().next().value as string);
    postalCache.set(key, { place, expiresAt: Date.now() + (place ? FOUND_TTL_MS : NOT_FOUND_TTL_MS) });
  }

  if (!place) {
    throw new ApiError(404, "State and city could not be found for this postal code. Please select them yourself.");
  }
  res.status(200).json(new ApiResponse(200, "Postal code found", place));
});

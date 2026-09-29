import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { City, Country, State } from "country-state-city";
import CustomCity from "../../models/dropdown/CustomCity.model";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";

/*
 * Country / State / City dropdowns for the registration forms. The data ships with the
 * `country-state-city` package; the only thing stored in MongoDB is cities the admin
 * adds because the package lacks them (CustomCity).
 *
 * The response shape matches what the website already reads (the old CRM API):
 *   country { _id, name, countryCode }
 *   state   { _id, name, stateCode, countryCode }   stateCode is "IN-DL" (ISO 3166-2)
 *   city    { _id, name, stateCode, countryCode }
 * State ISO codes like "DL" repeat across countries, so stateCode carries the country
 * too — the website only sends stateCode when it asks for cities.
 */

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

let countriesCache: unknown[] | null = null;
const statesCache = new Map<string, unknown[]>();
const citiesCache = new Map<string, unknown[]>();

const countryParam = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, "countryCode is required");
  const code = value.trim().toUpperCase();
  if (!Country.getCountryByCode(code)) throw new ApiError(404, `Unknown country "${value}"`);
  return code;
};

export const getCountries = asyncHandler(async (_req: Request, res: Response) => {
  countriesCache ??= Country.getAllCountries()
    .map((c) => ({ _id: c.isoCode, name: c.name, countryCode: c.isoCode, phoneCode: c.phonecode, flag: c.flag }))
    .sort(byName);
  res.status(200).json(new ApiResponse(200, "Countries fetched successfully", countriesCache));
});

/** GET /crm-states?countryCode=IN */
export const getStates = asyncHandler(async (req: Request, res: Response) => {
  const countryCode = countryParam(req.query.countryCode);
  if (!statesCache.has(countryCode)) {
    statesCache.set(
      countryCode,
      State.getStatesOfCountry(countryCode)
        .map((s) => ({
          _id: `${countryCode}-${s.isoCode}`,
          name: s.name,
          stateCode: `${countryCode}-${s.isoCode}`,
          isoCode: s.isoCode,
          countryCode,
        }))
        .sort(byName)
    );
  }
  res.status(200).json(new ApiResponse(200, "States fetched successfully", statesCache.get(countryCode)));
});

/** Accepts "IN-DL", or a plain "DL" together with countryCode; checks the state exists. */
const stateParam = (stateCodeRaw: unknown, countryCodeRaw: unknown) => {
  const raw = typeof stateCodeRaw === "string" ? stateCodeRaw.trim().toUpperCase() : "";
  if (!raw) throw new ApiError(400, "stateCode is required");

  let countryCode: string;
  let isoCode: string;
  if (countryCodeRaw !== undefined) {
    countryCode = countryParam(countryCodeRaw);
    isoCode = raw.startsWith(`${countryCode}-`) ? raw.slice(countryCode.length + 1) : raw;
  } else {
    const dash = raw.indexOf("-");
    if (dash < 1) throw new ApiError(400, 'stateCode must look like "IN-DL", or pass countryCode as well');
    countryCode = countryParam(raw.slice(0, dash));
    isoCode = raw.slice(dash + 1);
  }

  if (!State.getStateByCodeAndCountry(isoCode, countryCode)) throw new ApiError(404, `Unknown state "${raw}"`);
  return { countryCode, isoCode, stateCode: `${countryCode}-${isoCode}` };
};

// Always offered last, so a user whose city is missing can still finish the form.
const OTHER_CITY = "Other";

/**
 * GET /crm-cities?stateCode=IN-DL  (or ?countryCode=IN&stateCode=DL)
 * Built-in cities plus any the admin added for the state, then "Other".
 */
export const getCities = asyncHandler(async (req: Request, res: Response) => {
  const { countryCode, isoCode, stateCode } = stateParam(req.query.stateCode, req.query.countryCode);

  if (!citiesCache.has(stateCode)) {
    const seen = new Set<string>();
    citiesCache.set(
      stateCode,
      City.getCitiesOfState(countryCode, isoCode)
        .filter((c) => !seen.has(c.name) && seen.add(c.name))
        .map((c) => ({ _id: `${stateCode}-${c.name}`, name: c.name, stateCode, countryCode }))
    );
  }

  const builtIn = citiesCache.get(stateCode) as { _id: string; name: string }[];
  const known = new Set(builtIn.map((c) => c.name.toLowerCase()));
  const custom = (await CustomCity.find({ stateCode, isActive: true }).select("name").lean())
    .filter((c: any) => !known.has(c.name.toLowerCase()))
    .map((c: any) => ({ _id: String(c._id), name: c.name, stateCode, countryCode }));

  const cities = [...builtIn, ...custom]
    .filter((c) => c.name.toLowerCase() !== OTHER_CITY.toLowerCase())
    .sort(byName);
  cities.push({ _id: `${stateCode}-${OTHER_CITY}`, name: OTHER_CITY, stateCode, countryCode } as any);

  res.status(200).json(new ApiResponse(200, "Cities fetched successfully", cities));
});

/* ---------------- Admin: cities missing from the built-in data ---------------- */

/** GET /locations/admin/cities?stateCode=IN-DL (all states when omitted) */
export const listCustomCities = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.stateCode !== undefined) filter.stateCode = stateParam(req.query.stateCode, req.query.countryCode).stateCode;
  const cities = await CustomCity.find(filter).sort({ stateCode: 1, name: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Custom cities fetched successfully", cities));
});

/** POST /locations/admin/cities { stateCode: "IN-UP", name } */
export const createCustomCity = asyncHandler(async (req: Request, res: Response) => {
  const { countryCode, isoCode, stateCode } = stateParam(req.body?.stateCode, req.body?.countryCode);
  const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new ApiError(400, "City name is required");
  if (name.length > 100) throw new ApiError(400, "City name must be 100 characters or fewer");
  if (name.toLowerCase() === OTHER_CITY.toLowerCase()) throw new ApiError(400, `"${OTHER_CITY}" is always offered already`);
  if (City.getCitiesOfState(countryCode, isoCode).some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `${name} is already in the city list for this state`);
  }

  const city = await CustomCity.create({ countryCode, stateCode, name, isActive: req.body?.isActive ?? true }).catch(
    (error: any) => {
      if (error?.code === 11000) throw new ApiError(409, `${name} has already been added for this state`);
      throw error;
    }
  );
  res.status(201).json(new ApiResponse(201, "City added successfully", city));
});

/** PATCH /locations/admin/cities/:id { name?, isActive? } */
export const updateCustomCity = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid city id");
  const city = await CustomCity.findById(req.params.id);
  if (!city) throw new ApiError(404, "City not found");

  if (req.body?.name !== undefined) {
    const name = typeof req.body.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    if (!name) throw new ApiError(400, "City name is required");
    city.name = name;
  }
  if (req.body?.isActive !== undefined) city.isActive = Boolean(req.body.isActive);
  await city.save().catch((error: any) => {
    if (error?.code === 11000) throw new ApiError(409, "That city has already been added for this state");
    throw error;
  });
  res.status(200).json(new ApiResponse(200, "City updated successfully", city));
});

export const deleteCustomCity = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid city id");
  const city = await CustomCity.findByIdAndDelete(req.params.id);
  if (!city) throw new ApiError(404, "City not found");
  res.status(200).json(new ApiResponse(200, "City deleted successfully", null));
});

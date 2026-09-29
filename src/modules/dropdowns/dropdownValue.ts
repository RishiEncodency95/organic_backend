import DropdownOption from "../../models/dropdown/DropdownOption.model";
import { ApiError } from "../../utils/ApiError";
import { DROPDOWN_LISTS } from "./dropdownLists";

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

// Spellings some forms send that mean an existing option (matched after normalising case).
const ALIASES: Record<string, Record<string, string>> = {
  gender: { others: "other" },
};

/**
 * Maps a submitted dropdown answer to the list's stored value. Forms disagree on
 * casing ("male" vs "Male") and a few send the label instead of the value, so both
 * are matched case-insensitively; anything that is not an active option is rejected.
 * Returns "" for an empty optional answer.
 */
export const resolveDropdownValue = async (
  list: string,
  raw: unknown,
  { field, required = false }: { field: string; required?: boolean }
): Promise<string> => {
  if (!DROPDOWN_LISTS[list]) throw new Error(`Unknown dropdown list "${list}"`);

  const given = typeof raw === "string" ? raw.trim() : "";
  if (!given) {
    if (required) throw new ApiError(400, `${field} is required`);
    return "";
  }

  const options = await DropdownOption.find({ list, isActive: true }).select("label value").lean();
  const wanted = normalize(given);
  const target = ALIASES[list]?.[wanted] ?? wanted;
  const match = (options as any[]).find((o) => normalize(o.value) === target || normalize(o.label) === target);

  if (!match) throw new ApiError(400, `${field}: "${given}" is not one of the allowed options`);
  return match.value;
};

/** Resolves several answers at once and reports every invalid one together. */
export const resolveDropdownValues = async (
  payload: Record<string, unknown>,
  fields: Record<string, { list: string; label: string; required?: boolean }>
): Promise<Record<string, string>> => {
  const resolved: Record<string, string> = {};
  const errors: string[] = [];
  for (const [key, { list, label, required }] of Object.entries(fields)) {
    try {
      resolved[key] = await resolveDropdownValue(list, payload[key], { field: label, required });
    } catch (error) {
      if (error instanceof ApiError) errors.push(error.message);
      else throw error;
    }
  }
  if (errors.length) throw new ApiError(400, errors[0], errors);
  return resolved;
};

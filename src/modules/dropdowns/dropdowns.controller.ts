import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import DropdownOption from "../../models/dropdown/DropdownOption.model";
import DropdownListMeta from "../../models/dropdown/DropdownListMeta.model";
import { Admin } from "../../models/Admin.model";
import { DROPDOWN_LISTS, isDropdownList } from "./dropdownLists";

const PUBLIC_FIELDS = "label value parentValue -_id";

const text = (value: unknown, field: string, max = 200): string => {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${field} is required`);
  if (value.trim().length > max) throw new ApiError(400, `${field} must be ${max} characters or fewer`);
  return value.trim();
};

const listParam = (value: unknown): string => {
  if (!isDropdownList(value)) throw new ApiError(400, `Unknown dropdown list "${String(value)}"`);
  return value;
};

const optionId = (value: unknown): string => {
  if (!isValidObjectId(value)) throw new ApiError(400, "Invalid option id");
  return String(value);
};

/** A dependent list's option must point at an existing value of its parent list. */
const checkParent = async (list: string, parentValue: unknown): Promise<string> => {
  const parentList = DROPDOWN_LISTS[list].parent;
  if (!parentList) return "";
  const parent = text(parentValue, `Parent (${DROPDOWN_LISTS[parentList].name})`);
  const exists = await DropdownOption.exists({ list: parentList, value: parent });
  if (!exists) throw new ApiError(400, `"${parent}" is not a value of ${DROPDOWN_LISTS[parentList].name}`);
  return parent;
};

const rethrowDuplicate = (error: any): never => {
  if (error?.code === 11000) throw new ApiError(409, "This value already exists in the list");
  throw error;
};

/** Records the signed-in admin as the last one to change a list (shown as "Updated By"). */
const touchList = async (req: Request, list: string) => {
  const id = req.user?.id;
  const admin = id && isValidObjectId(id) ? await Admin.findById(id).select("name email").lean<any>() : null;
  await DropdownListMeta.updateOne(
    { list },
    { $set: { updatedBy: admin?.name || admin?.email || "Admin", updatedById: id, updatedAt: new Date() } },
    { upsert: true }
  );
};

/* ------------------------------ Public ------------------------------ */

/** GET /dropdowns?lists=gender,yes-no  → { gender: [...], "yes-no": [...] } (all lists when omitted). */
export const getDropdowns = asyncHandler(async (req: Request, res: Response) => {
  const requested =
    typeof req.query.lists === "string" && req.query.lists.trim()
      ? req.query.lists.split(",").map((key) => listParam(key.trim()))
      : Object.keys(DROPDOWN_LISTS);

  const options = await DropdownOption.find({ list: { $in: requested }, isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .select(`list ${PUBLIC_FIELDS}`)
    .lean();

  const grouped: Record<string, unknown[]> = Object.fromEntries(requested.map((key) => [key, []]));
  for (const { list, ...option } of options as any[]) grouped[list].push(option);

  res.status(200).json(new ApiResponse(200, "Dropdowns fetched successfully", grouped));
});

/** GET /dropdowns/:list?parent=<value> → active options of one list. */
export const getDropdown = asyncHandler(async (req: Request, res: Response) => {
  const list = listParam(req.params.list);
  const filter: Record<string, unknown> = { list, isActive: true };
  if (typeof req.query.parent === "string") filter.parentValue = req.query.parent;

  const options = await DropdownOption.find(filter).sort({ order: 1, createdAt: 1 }).select(PUBLIC_FIELDS).lean();
  res.status(200).json(new ApiResponse(200, "Dropdown fetched successfully", options));
});

/* ------------------------------ Admin ------------------------------ */

/** GET /dropdowns/admin/lists → every list with where it is used and how many options it has. */
export const getAdminLists = asyncHandler(async (_req: Request, res: Response) => {
  const counts = await DropdownOption.aggregate([
    { $group: { _id: "$list", total: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } },
  ]);
  const byList = Object.fromEntries(counts.map((c) => [c._id, c]));
  const metas = await DropdownListMeta.find().select("list updatedBy updatedAt -_id").lean<any[]>();
  const metaByList = Object.fromEntries(metas.map((m) => [m.list, m]));

  const lists = Object.entries(DROPDOWN_LISTS).map(([key, def]) => ({
    key,
    ...def,
    parentName: def.parent ? DROPDOWN_LISTS[def.parent].name : undefined,
    total: byList[key]?.total ?? 0,
    active: byList[key]?.active ?? 0,
    updatedBy: metaByList[key]?.updatedBy ?? null,
    updatedAt: metaByList[key]?.updatedAt ?? null,
  }));
  res.status(200).json(new ApiResponse(200, "Dropdown lists fetched successfully", lists));
});

/** GET /dropdowns/admin/options?list=<key> → all options of a list, inactive included. */
export const getAdminOptions = asyncHandler(async (req: Request, res: Response) => {
  const list = listParam(req.query.list);
  const options = await DropdownOption.find({ list }).sort({ parentValue: 1, order: 1, createdAt: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Dropdown options fetched successfully", options));
});

export const createOption = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const list = listParam(body.list);
  const label = text(body.label, "Label");
  const value = body.value === undefined || body.value === "" ? label : text(body.value, "Value");
  const parentValue = await checkParent(list, body.parentValue);

  let order = Number(body.order);
  if (!Number.isFinite(order)) {
    const last = await DropdownOption.findOne({ list, parentValue }).sort({ order: -1 }).select("order").lean();
    order = ((last as any)?.order ?? -1) + 1;
  }

  const option = await DropdownOption.create({
    list,
    label,
    value,
    parentValue,
    order,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  }).catch(rethrowDuplicate);
  await touchList(req, list);

  res.status(201).json(new ApiResponse(201, "Option created successfully", option));
});

export const updateOption = asyncHandler(async (req: Request, res: Response) => {
  const option = await DropdownOption.findById(optionId(req.params.id));
  if (!option) throw new ApiError(404, "Option not found");

  const body = req.body ?? {};
  if (body.list !== undefined && body.list !== option.list) {
    throw new ApiError(400, "An option cannot be moved to another list");
  }
  const previousValue = option.value;

  if (body.label !== undefined) option.label = text(body.label, "Label");
  if (body.value !== undefined) option.value = text(body.value, "Value");
  if (body.parentValue !== undefined) option.parentValue = await checkParent(option.list, body.parentValue);
  if (body.order !== undefined) {
    if (!Number.isFinite(Number(body.order))) throw new ApiError(400, "Order must be a number");
    option.order = Number(body.order);
  }
  if (body.isActive !== undefined) option.isActive = Boolean(body.isActive);

  await option.save().catch(rethrowDuplicate);
  await touchList(req, option.list);

  // Keep dependent options attached when a parent option's value is renamed.
  const children = Object.entries(DROPDOWN_LISTS).filter(([, def]) => def.parent === option.list).map(([key]) => key);
  if (children.length && previousValue !== option.value) {
    await DropdownOption.updateMany(
      { list: { $in: children }, parentValue: previousValue },
      { $set: { parentValue: option.value } }
    );
  }

  res.status(200).json(new ApiResponse(200, "Option updated successfully", option));
});

export const deleteOption = asyncHandler(async (req: Request, res: Response) => {
  const option = await DropdownOption.findById(optionId(req.params.id));
  if (!option) throw new ApiError(404, "Option not found");

  const children = Object.entries(DROPDOWN_LISTS).filter(([, def]) => def.parent === option.list).map(([key]) => key);
  if (children.length) {
    const dependents = await DropdownOption.countDocuments({ list: { $in: children }, parentValue: option.value });
    if (dependents) {
      throw new ApiError(409, `"${option.label}" still has ${dependents} dependent option(s). Delete or move them first.`);
    }
  }

  await option.deleteOne();
  await touchList(req, option.list);
  res.status(200).json(new ApiResponse(200, "Option deleted successfully", null));
});

/** PUT /dropdowns/admin/lists/:list/order  { ids: [...] } → saves the given order (first id = 0). */
export const reorderOptions = asyncHandler(async (req: Request, res: Response) => {
  const list = listParam(req.params.list);
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.length || !ids.every(isValidObjectId)) {
    throw new ApiError(400, "ids must be a non-empty array of option ids");
  }

  const found = await DropdownOption.countDocuments({ _id: { $in: ids }, list });
  if (found !== new Set(ids.map(String)).size) throw new ApiError(400, "Every id must belong to this list");

  await DropdownOption.bulkWrite(
    ids.map((id: string, index: number) => ({ updateOne: { filter: { _id: id, list }, update: { $set: { order: index } } } }))
  );
  await touchList(req, list);
  const options = await DropdownOption.find({ list }).sort({ parentValue: 1, order: 1 }).lean();
  res.status(200).json(new ApiResponse(200, "Order saved successfully", options));
});

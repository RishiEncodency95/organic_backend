import { Request, Response, Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import DropdownOption from "../../models/dropdown/DropdownOption.model";

/*
 * Option lists for the buyer registration forms, served in the exact shape of the
 * forms' built-in `mockConfig` (arrays of display strings) so the website can swap one
 * for the other. `options` repeats every list as { label, value } pairs for the few
 * dropdowns whose saved value differs from the text shown (e.g. business role).
 * Domestic and international buyers use the same lists.
 */
const CONFIG_KEYS: Record<string, string> = {
  primaryProductInterests: "buyer-product-category",
  secondaryProductCategories: "buyer-secondary-category",
  businessModelOptions: "buyer-business-model",
  annualPurchaseValueRanges: "buyer-value-range",
  purchaseFrequencyOptions: "buyer-purchase-frequency",
  purchaseTimelines: "buyer-purchase-timeline",
  roles: "buyer-decision-role",
  regions: "buyer-region",
  supplierTypes: "buyer-supplier-type",
  companySizes: "buyer-company-size",
  certificationOptions: "buyer-certification",
  meetingCategoryOptions: "buyer-meeting-category",
  exhibitorTypeOptions: "buyer-exhibitor-type",
  meetingObjectiveOptions: "buyer-meeting-objective",
  preferredBusinessTypeOptions: "buyer-preferred-business-type",
  meetingDayOptions: "buyer-meeting-day",
  businessRoles: "buyer-business-role",
  businessTypes: "buyer-business-type",
  timeSlots: "buyer-time-slot",
  meetingCounts: "buyer-meeting-count",
  yesNo: "yes-no",
};

const getBuyerConfig = asyncHandler(async (_req: Request, res: Response) => {
  const lists = Object.values(CONFIG_KEYS);
  const rows = await DropdownOption.find({ list: { $in: lists }, isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .select("list label value -_id")
    .lean();

  const options: Record<string, { label: string; value: string }[]> = Object.fromEntries(lists.map((l) => [l, []]));
  for (const row of rows as any[]) options[row.list].push({ label: row.label, value: row.value });

  const config: Record<string, unknown> = {};
  for (const [key, list] of Object.entries(CONFIG_KEYS)) config[key] = options[list].map((o) => o.label);
  config.options = options;

  res.status(200).json(new ApiResponse(200, "Buyer registration config fetched successfully", config));
});

const router = Router();
router.get("/buyer-registration/config", getBuyerConfig);
router.get("/international-buyer/config", getBuyerConfig);

export default router;

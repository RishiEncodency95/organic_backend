import AwardsCta from "../../../../models/awards/awardsCta.model";

const DEFAULT_AWARDS_CTA_DATA = {
  enabled: true,
  titleLine1: "Be Recognised.",
  titleLine2: "Be Celebrated.",
  titleHighlight: "Be Part of India's",
  titleLine3: "Organic Revolution.",
  description:
    "Nominate yourself or someone who inspires change in the organic and sustainable world.",
  buttonLabel: "Nominate Now",
  buttonHref: "/awards/nominations",
  deadlineText: "Deadline: 31 December 2026",
};

export const getAwardsCtaService = async () => {
  let data = await AwardsCta.findOne();
  if (!data) {
    data = await AwardsCta.create(DEFAULT_AWARDS_CTA_DATA);
  }
  return data;
};

export const updateAwardsCtaService = async (payload: any) => {
  const data = await AwardsCta.findOneAndUpdate({}, payload, {
    new: true,
    upsert: true,
  });
  return data;
};

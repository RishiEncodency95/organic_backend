import AwardsHero from "../../../../models/awards/awardsHero.model";

const DEFAULT_AWARDS_HERO_DATA = {
  enabled: true,
  tagline: "BHARAT ORGANIC",
  titlePrimary: "EXCELLENCE",
  titleSecondary: "AWARDS 2027",
  highlights: [
    { id: 1, text: "Celebrating Excellence" },
    { id: 2, text: "Innovation" },
    { id: 3, text: "Sustainability" },
  ],
  description:
    "Honouring the changemakers, organisations and innovations driving India's organic, natural and sustainable future.",
  dateLine1: "19 - 21",
  dateLine2: "February 2027",
  venueLine1: "Hall 12, Bharat Mandapam",
  venueLine2: "PRAGATI MAIDAN, NEW DELHI, INDIA",
  buttons: [
    {
      id: "nominate",
      label: "NOMINATE NOW",
      href: "/awards/nominations",
      target: "_blank",
      rel: "noopener noreferrer",
      variant: "primary",
      icon: "Award",
    },
    {
      id: "categories",
      label: "VIEW CATEGORIES",
      href: "#categories",
      variant: "secondary",
      icon: "Medal",
    },
  ],
};

export const getAwardsHeroService = async () => {
  let data = await AwardsHero.findOne();
  if (!data) {
    data = await AwardsHero.create(DEFAULT_AWARDS_HERO_DATA);
  }
  return data;
};

export const updateAwardsHeroService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.highlights === "string") {
    try {
      updateData.highlights = JSON.parse(updateData.highlights);
    } catch {}
  }
  if (typeof updateData.buttons === "string") {
    try {
      updateData.buttons = JSON.parse(updateData.buttons);
    } catch {}
  }

  const data = await AwardsHero.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

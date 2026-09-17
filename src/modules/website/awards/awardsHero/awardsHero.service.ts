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

  if (updateData.eyebrow) {
    updateData.tagline = updateData.eyebrow;
  }
  if (updateData.tagline && !updateData.eyebrow) {
    updateData.eyebrow = updateData.tagline;
  }

  if (updateData.title) {
    const parts = updateData.title.trim().split(/\s+/);
    if (!updateData.titlePrimary) updateData.titlePrimary = parts[0] || "EXCELLENCE";
    if (!updateData.titleSecondary) updateData.titleSecondary = parts.slice(1).join(" ") || "AWARDS 2027";
  }

  if (updateData.subtitle && !updateData.highlights) {
    updateData.highlights = updateData.subtitle
      .split("•")
      .map((t: string, idx: number) => ({ id: idx + 1, text: t.trim() }))
      .filter((x: any) => x.text.length > 0);
  }

  if (updateData.shortDescription && !updateData.description) {
    updateData.description = updateData.shortDescription;
  }
  if (updateData.description && !updateData.shortDescription) {
    updateData.shortDescription = updateData.description;
  }

  if (updateData.date) {
    const parts = updateData.date.trim().split(/\n/);
    if (parts.length > 1) {
      updateData.dateLine1 = parts[0].trim();
      updateData.dateLine2 = parts.slice(1).join(" ").trim();
    } else {
      const match = updateData.date.trim().match(/^(\d+(?:\s*-\s*\d+)?)\s+(.*)$/);
      if (match) {
        updateData.dateLine1 = match[1].trim();
        updateData.dateLine2 = match[2].trim();
      } else {
        updateData.dateLine1 = updateData.date.trim();
        updateData.dateLine2 = "";
      }
    }
  }

  if (updateData.location) {
    const parts = updateData.location.trim().split(/\n/);
    if (parts.length > 1) {
      updateData.venueLine1 = parts[0].trim();
      updateData.venueLine2 = parts.slice(1).join(" ").trim();
    } else if (updateData.location.toLowerCase().includes("bharat mandapam,")) {
      const idx = updateData.location.toLowerCase().indexOf("bharat mandapam,") + "bharat mandapam,".length;
      updateData.venueLine1 = updateData.location.slice(0, idx - 1).trim();
      updateData.venueLine2 = updateData.location.slice(idx).trim();
    } else {
      const commaIdx = updateData.location.indexOf(",");
      if (commaIdx !== -1) {
        updateData.venueLine1 = updateData.location.slice(0, commaIdx).trim();
        updateData.venueLine2 = updateData.location.slice(commaIdx + 1).trim();
      } else {
        updateData.venueLine1 = updateData.location.trim();
        updateData.venueLine2 = "";
      }
    }
  }

  if (updateData.buttonLabel || updateData.secondaryButtonLabel) {
    updateData.buttons = [
      {
        id: "nominate",
        label: updateData.buttonLabel || "NOMINATE NOW",
        href: updateData.buttonHref || "/awards/nominations",
        target: "_blank",
        rel: "noopener noreferrer",
        variant: "primary",
        icon: "Award",
      },
      {
        id: "categories",
        label: updateData.secondaryButtonLabel || "VIEW CATEGORIES",
        href: updateData.secondaryButtonHref || "#categories",
        variant: "secondary",
        icon: "Medal",
      },
    ];
  }

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

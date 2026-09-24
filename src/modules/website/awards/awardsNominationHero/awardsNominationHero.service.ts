import AwardsNominationHero from "../../../../models/awards/awardsNominationHero.model";

const DEFAULT_NOMINATION_HERO_DATA = {
  enabled: true,
  eyebrow: "",
  title: "Bharat Organic Excellence Awards 2027",
  titlePrefix: "Bharat Organic",
  titlePrimary: "Excellence",
  titleSecondary: "Awards 2027",
  subtitle: "Celebrating Excellence • Innovation • Sustainability",
  description:
    "Honouring the changemakers, organizations and innovations during india's organic, natural and sustainable future.",
  shortDescription:
    "Honouring the changemakers, organizations and innovations during india's organic, natural and sustainable future.",
  buttonLabel: "Submit Nomination",
  buttonHref: "#nomination-form",
  secondaryButtonLabel: "View Categories",
  secondaryButtonHref: "/awards",
  date: "19 - 21 February 2027",
  dateLine1: "19 - 21",
  dateLine2: "February 2027",
  location: "Hall 12, Bharat Mandapam, PRAGATI MAIDAN, NEW DELHI, INDIA",
  venueLine1: "Hall 12, Bharat Mandapam",
  venueLine2: "PRAGATI MAIDAN, NEW DELHI, INDIA",
  image: "",
  bgImage: "",
};

export const getAwardsNominationHeroService = async () => {
  let data = await AwardsNominationHero.findOne();
  if (!data) {
    data = await AwardsNominationHero.create(DEFAULT_NOMINATION_HERO_DATA);
  }
  return data;
};

export const updateAwardsNominationHeroService = async (payload: any) => {
  let updateData = { ...payload };

  // Parse title into prefix, primary, secondary if needed
  if (updateData.title) {
    const rawTitle = updateData.title.trim();
    if (rawTitle.toLowerCase().includes("bharat organic")) {
      updateData.titlePrefix = "Bharat Organic";
      const remaining = rawTitle.replace(/bharat\s+organic/i, "").trim();
      const parts = remaining.split(/\s+/);
      updateData.titlePrimary = parts[0] || "Excellence";
      updateData.titleSecondary = parts.slice(1).join(" ") || "Awards 2027";
    } else {
      const parts = rawTitle.split(/\s+/);
      if (parts.length >= 3) {
        updateData.titlePrefix = parts.slice(0, parts.length - 2).join(" ");
        updateData.titlePrimary = parts[parts.length - 2];
        updateData.titleSecondary = parts[parts.length - 1];
      } else if (parts.length === 2) {
        updateData.titlePrefix = "";
        updateData.titlePrimary = parts[0];
        updateData.titleSecondary = parts[1];
      } else {
        updateData.titlePrimary = rawTitle;
      }
    }
  }

  // Parse date into 2 lines
  if (updateData.date) {
    const rawDate = updateData.date.trim();
    const dateMatch = rawDate.match(/^(\d{1,2}\s*-\s*\d{1,2})\s+(.+)$/i);
    if (dateMatch) {
      updateData.dateLine1 = dateMatch[1];
      updateData.dateLine2 = dateMatch[2];
    } else {
      updateData.dateLine1 = rawDate;
      updateData.dateLine2 = "";
    }
  }

  // Parse location into venueLine1 and venueLine2
  if (updateData.location) {
    const rawLoc = updateData.location.trim();
    if (rawLoc.includes(",")) {
      const parts = rawLoc.split(",");
      updateData.venueLine1 = parts[0].trim() + (parts[1] ? `, ${parts[1].trim()}` : "");
      updateData.venueLine2 = parts.slice(2).join(",").trim() || (parts[1] ? parts[1].trim() : "");
    } else {
      updateData.venueLine1 = rawLoc;
      updateData.venueLine2 = "";
    }
  }

  // Sync shortDescription and description
  if (updateData.shortDescription && !updateData.description) {
    updateData.description = updateData.shortDescription;
  }
  if (updateData.description && !updateData.shortDescription) {
    updateData.shortDescription = updateData.description;
  }

  // Sync image and bgImage
  if (updateData.image && !updateData.bgImage) {
    updateData.bgImage = updateData.image;
  }
  if (updateData.bgImage && !updateData.image) {
    updateData.image = updateData.bgImage;
  }

  const data = await AwardsNominationHero.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

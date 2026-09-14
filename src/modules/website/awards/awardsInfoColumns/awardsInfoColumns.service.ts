import AwardsInfoColumns from "../../../../models/awards/awardsInfoColumns.model";

const DEFAULT_AWARDS_INFO_COLUMNS_DATA = {
  enabled: true,
  keyDates: {
    title: "Key Dates",
    icon: "Calendar",
    disclaimer: "*Dates are subject to change.",
    items: [
      { label: "Nominations Open", value: "1 July 2026" },
      { label: "Last Date for Nominations", value: "31 December 2026" },
      { label: "Shortlisting", value: "January 2027" },
      { label: "Awards Ceremony", value: "19–21 February 2027" },
    ],
  },
  whoCanApply: {
    title: "Who Can Apply?",
    icon: "Users",
    note: "Open to Indian & International participants.",
    items: [
      "Companies & Brands",
      "Startups & Entrepreneurs",
      "Farmers & Producer Groups",
      "Institutions, Organisations & NGOs",
      "Individuals & Professionals",
    ],
  },
  whyParticipate: {
    title: "Why Participate?",
    icon: "Star",
    items: [
      "National & Global Recognition",
      "Enhance Brand Value & Credibility",
      "Networking with Industry Leaders",
      "Business Growth Opportunities",
      "Showcase Innovation & Impact",
    ],
  },
};

export const getAwardsInfoColumnsService = async () => {
  let data = await AwardsInfoColumns.findOne();
  if (!data) {
    data = await AwardsInfoColumns.create(DEFAULT_AWARDS_INFO_COLUMNS_DATA);
  }
  return data;
};

export const updateAwardsInfoColumnsService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.keyDates === "string") {
    try {
      updateData.keyDates = JSON.parse(updateData.keyDates);
    } catch {}
  }
  if (typeof updateData.whoCanApply === "string") {
    try {
      updateData.whoCanApply = JSON.parse(updateData.whoCanApply);
    } catch {}
  }
  if (typeof updateData.whyParticipate === "string") {
    try {
      updateData.whyParticipate = JSON.parse(updateData.whyParticipate);
    } catch {}
  }

  const data = await AwardsInfoColumns.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

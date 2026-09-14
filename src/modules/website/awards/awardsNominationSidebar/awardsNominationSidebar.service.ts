import AwardsNominationSidebar from "../../../../models/awards/awardsNominationSidebar.model";

const DEFAULT_NOMINATION_SIDEBAR_DATA = {
  enabled: true,
  whyParticipate: {
    title: "WHY PARTICIPATE?",
    items: [
      "National & Global Recognition",
      "Enhance Brand Value & Credibility",
      "Networking with Industry Leaders",
      "Business Growth Opportunities",
      "Showcase Innovation & Impact",
    ],
  },
  importantDates: {
    title: "IMPORTANT DATES",
    disclaimer: "*Dates are subject to change.",
    items: [
      { label: "Nominations Open", value: "1 July 2026" },
      { label: "Last Date for Nominations", value: "31 December 2026" },
      { label: "Shortlisting", value: "January 2027" },
      { label: "Awards Ceremony", value: "19 – 21 February 2027" },
    ],
  },
  whoCanApply: {
    title: "WHO CAN APPLY?",
    note: "Open to Indian & International participants.",
    items: [
      "Companies & Brands",
      "Startups & Entrepreneurs",
      "Farmers & Producer Groups",
      "Institutions, Organisations & NGOs",
      "Individuals & Professionals",
    ],
  },
  needHelp: {
    title: "NEED HELP?",
    description: "For any assistance, feel free to contact our awards team.",
    phone: "+91 96549 00525",
    email: "awards@bharatorganicexpo.com",
    website: "www.bharatorganicexpo.com",
  },
};

export const getNominationSidebarService = async () => {
  let data = await AwardsNominationSidebar.findOne();
  if (!data) {
    data = await AwardsNominationSidebar.create(DEFAULT_NOMINATION_SIDEBAR_DATA);
  }
  return data;
};

export const updateNominationSidebarService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.whyParticipate === "string") {
    try {
      updateData.whyParticipate = JSON.parse(updateData.whyParticipate);
    } catch {}
  }
  if (typeof updateData.importantDates === "string") {
    try {
      updateData.importantDates = JSON.parse(updateData.importantDates);
    } catch {}
  }
  if (typeof updateData.whoCanApply === "string") {
    try {
      updateData.whoCanApply = JSON.parse(updateData.whoCanApply);
    } catch {}
  }
  if (typeof updateData.needHelp === "string") {
    try {
      updateData.needHelp = JSON.parse(updateData.needHelp);
    } catch {}
  }

  const data = await AwardsNominationSidebar.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

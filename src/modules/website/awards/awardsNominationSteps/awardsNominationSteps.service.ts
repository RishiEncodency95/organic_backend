import AwardsNominationSteps from "../../../../models/awards/awardsNominationSteps.model";

const DEFAULT_STEPS = [
  {
    id: 1, num: "01",
    title: "Nomination",
    desc: "Submit your nomination online in the relevant category.",
    description: "Submit your nomination online in the relevant category.",
    shortDescription: "Submit your nomination online in the relevant category.",
    image: "/assets/awards/nomination.png",
    icon: "ClipboardList",
  },
  {
    id: 2, num: "02",
    title: "Eligibility Check",
    desc: "Our team verifies eligibility and supporting documents.",
    description: "Our team verifies eligibility and supporting documents.",
    shortDescription: "Our team verifies eligibility and supporting documents.",
    image: "/assets/awards/eligibility.png",
    icon: "ClipboardCheck",
  },
  {
    id: 3, num: "03",
    title: "Evaluation",
    desc: "Nominations are evaluated by our expert jury panel based on defined criteria.",
    description: "Nominations are evaluated by our expert jury panel based on defined criteria.",
    shortDescription: "Nominations are evaluated by our expert jury panel based on defined criteria.",
    image: "/assets/awards/evaluation-jury.png",
    icon: "Users",
  },
  {
    id: 4, num: "04",
    title: "Shortlisting",
    desc: "Top nominees are shortlisted in each category.",
    description: "Top nominees are shortlisted in each category.",
    shortDescription: "Top nominees are shortlisted in each category.",
    image: "/assets/awards/shortlisting.png",
    icon: "Award",
  },
  {
    id: 5, num: "05",
    title: "Jury Assessment",
    desc: "Final assessment by the jury to select the award winners.",
    description: "Final assessment by the jury to select the award winners.",
    shortDescription: "Final assessment by the jury to select the award winners.",
    image: "/assets/awards/evaluation-jury.png",
    icon: "Star",
  },
  {
    id: 6, num: "06",
    title: "Recognition",
    desc: "Winners are honoured at the Bharat Organic Expo 2027.",
    description: "Winners are honoured at the Bharat Organic Expo 2027.",
    shortDescription: "Winners are honoured at the Bharat Organic Expo 2027.",
    image: "/assets/awards/recognition.png",
    icon: "Trophy",
  },
];

const DEFAULT_DATA = {
  enabled: true,
  title: "THE AWARD PROCESS",
  steps: DEFAULT_STEPS,
  items: DEFAULT_STEPS,
};

export const getAwardsNominationStepsService = async () => {
  let data = await AwardsNominationSteps.findOne();
  if (!data) {
    data = await AwardsNominationSteps.create(DEFAULT_DATA);
  }
  // Ensure steps/items are always populated
  if (!data.steps?.length && !data.items?.length) {
    data = await AwardsNominationSteps.findOneAndUpdate(
      {},
      { $set: { steps: DEFAULT_STEPS, items: DEFAULT_STEPS } },
      { new: true }
    );
  }
  return data;
};

export const updateAwardsNominationStepsService = async (payload: any) => {
  const updateData: any = {};

  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.enabled !== undefined) updateData.enabled = payload.enabled;

  // Accept either items or steps array
  const rawItems = payload.items || payload.steps;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const normalized = rawItems.map((item: any, idx: number) => ({
      id: item.id ?? idx + 1,
      num: item.num || String(idx + 1).padStart(2, "0"),
      title: item.title || "",
      desc: item.desc || item.description || item.shortDescription || "",
      description: item.description || item.desc || item.shortDescription || "",
      shortDescription: item.shortDescription || item.desc || item.description || "",
      image: item.image || item.img || DEFAULT_STEPS[idx]?.image || "",
      icon: item.icon || DEFAULT_STEPS[idx]?.icon || "",
    }));
    updateData.steps = normalized;
    updateData.items = normalized;
  }

  const data = await AwardsNominationSteps.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

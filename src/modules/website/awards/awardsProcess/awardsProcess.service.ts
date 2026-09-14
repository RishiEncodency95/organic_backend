import AwardsProcess from "../../../../models/awards/awardsProcess.model";

const DEFAULT_AWARDS_PROCESS_DATA = {
  enabled: true,
  title: "Our Evaluation Process",
  steps: [
    {
      id: 1,
      image: "nomination",
      title: "Nomination",
      desc: "Submit your nomination online in the relevant category.",
    },
    {
      id: 2,
      image: "eligibility",
      title: "Eligibility Check",
      desc: "Our team verifies eligibility and supporting documents.",
    },
    {
      id: 3,
      image: "evaluation",
      title: "Evaluation",
      desc: "Nominations are evaluated by our expert jury panel based on defined criteria.",
    },
    {
      id: 4,
      image: "shortlisting",
      title: "Shortlisting",
      desc: "Top nominees are shortlisted in each category.",
    },
    {
      id: 5,
      image: "evaluation",
      title: "Jury Assessment",
      desc: "Final assessment by the jury to select the award winners.",
    },
    {
      id: 6,
      image: "recognition",
      title: "Recognition",
      desc: "Winners are honoured at the Bharat Organic Expo 2027.",
    },
  ],
};

export const getAwardsProcessService = async () => {
  let data = await AwardsProcess.findOne();
  if (!data) {
    data = await AwardsProcess.create(DEFAULT_AWARDS_PROCESS_DATA);
  }
  return data;
};

export const updateAwardsProcessService = async (payload: any) => {
  let updateData = { ...payload };

  if (typeof updateData.steps === "string") {
    try {
      updateData.steps = JSON.parse(updateData.steps);
    } catch {}
  }

  const data = await AwardsProcess.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

import AwardsProcess from "../../../../models/awards/awardsProcess.model";

const DEFAULT_PROCESS_STEPS = [
  {
    id: 1,
    image: "/assets/awards/nomination.png",
    icon: "nomination",
    title: "Nomination",
    desc: "Submit your nomination online in the relevant category.",
    description: "Submit your nomination online in the relevant category.",
    shortDescription: "Submit your nomination online in the relevant category.",
  },
  {
    id: 2,
    image: "/assets/awards/eligibility.png",
    icon: "eligibility",
    title: "Eligibility Check",
    desc: "Our team verifies eligibility and supporting documents.",
    description: "Our team verifies eligibility and supporting documents.",
    shortDescription: "Our team verifies eligibility and supporting documents.",
  },
  {
    id: 3,
    image: "/assets/awards/evaluation-jury.png",
    icon: "evaluation-jury",
    title: "Evaluation",
    desc: "Nominations are evaluated by our expert jury panel based on defined criteria.",
    description: "Nominations are evaluated by our expert jury panel based on defined criteria.",
    shortDescription: "Nominations are evaluated by our expert jury panel based on defined criteria.",
  },
  {
    id: 4,
    image: "/assets/awards/shortlisting.png",
    icon: "shortlisting",
    title: "Shortlisting",
    desc: "Top nominees are shortlisted in each category.",
    description: "Top nominees are shortlisted in each category.",
    shortDescription: "Top nominees are shortlisted in each category.",
  },
  {
    id: 5,
    image: "/assets/awards/evaluation-jury.png",
    icon: "evaluation-jury",
    title: "Jury Assessment",
    desc: "Final assessment by the jury to select the award winners.",
    description: "Final assessment by the jury to select the award winners.",
    shortDescription: "Final assessment by the jury to select the award winners.",
  },
  {
    id: 6,
    image: "/assets/awards/recognition.png",
    icon: "recognition",
    title: "Recognition",
    desc: "Winners are honoured at the Bharat Organic Expo 2027.",
    description: "Winners are honoured at the Bharat Organic Expo 2027.",
    shortDescription: "Winners are honoured at the Bharat Organic Expo 2027.",
  },
];

const DEFAULT_AWARDS_PROCESS_DATA = {
  enabled: true,
  eyebrow: "EVALUATION PROCESS",
  title: "Our Evaluation Process",
  steps: DEFAULT_PROCESS_STEPS,
  items: DEFAULT_PROCESS_STEPS,
};

const normalizeProcessSteps = (raw: any[]) => {
  if (!Array.isArray(raw)) return DEFAULT_PROCESS_STEPS;
  const imageMap: Record<string, string> = {
    nomination: "nomination.png",
    eligibility: "eligibility.png",
    evaluation: "evaluation-jury.png",
    "evaluation-jury": "evaluation-jury.png",
    shortlisting: "shortlisting.png",
    jury: "evaluation-jury.png",
    recognition: "recognition.png",
  };

  return raw.map((it: any, idx: number) => {
    const fallback = DEFAULT_PROCESS_STEPS[idx % DEFAULT_PROCESS_STEPS.length];
    const title = it.title || fallback.title;
    const descText = it.description || it.desc || it.shortDescription || fallback.desc;
    let img = it.image || it.icon || "";
    if (!img || (!img.startsWith("/") && !img.startsWith("http"))) {
      if (img) {
        const mapped = imageMap[img] || (img.endsWith(".png") ? img : `${img}.png`);
        img = `/assets/awards/${mapped}`;
      } else {
        img = fallback.image;
      }
    }
    return {
      id: it.id || idx + 1,
      title,
      image: img,
      icon: img,
      desc: descText,
      description: descText,
      shortDescription: descText,
    };
  });
};

export const getAwardsProcessService = async () => {
  let data = await AwardsProcess.findOne();
  if (!data) {
    data = await AwardsProcess.create(DEFAULT_AWARDS_PROCESS_DATA);
  } else {
    let needsSave = false;
    if (!data.eyebrow) {
      data.eyebrow = "EVALUATION PROCESS";
      needsSave = true;
    }
    const rawList = (data.items && data.items.length > 0) ? data.items : data.steps;
    const normalized = normalizeProcessSteps(rawList);
    if (!data.items || data.items.length === 0) {
      data.items = normalized as any;
      needsSave = true;
    }
    if (!data.steps || data.steps.length === 0 || !data.steps[0]?.image?.startsWith("/")) {
      data.steps = normalized as any;
      needsSave = true;
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateAwardsProcessService = async (payload: any) => {
  let updateData = { ...payload };

  let rawList = updateData.items || updateData.steps;
  if (typeof rawList === "string") {
    try {
      rawList = JSON.parse(rawList);
    } catch {}
  }

  const normalized = normalizeProcessSteps(rawList);
  updateData.items = normalized;
  updateData.steps = normalized;

  if (updateData.eyebrow === undefined) {
    updateData.eyebrow = "EVALUATION PROCESS";
  }

  const data = await AwardsProcess.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};


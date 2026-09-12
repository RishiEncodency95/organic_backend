import ConferenceSeminars from "../../../../models/home/conferenceSeminars.model";

const DEFAULT_CHECKLIST = [
  "Expert-led panel discussions & keynotes",
  "Emerging trends in organic farming & retail",
  "Sustainable business & growth strategies",
];

const DEFAULT_STATS = [
  { icon: "Calendar", title: "19 – 21", sub: "FEBRUARY 2027" },
  { icon: "MapPin", title: "PRAGATI MAIDAN", sub: "NEW DELHI" },
  { icon: "Users", title: "INSIGHTS. IDEAS.", sub: "IMPACT." },
  { icon: "Mic", title: "50+ GLOBAL", sub: "SPEAKERS" },
  { icon: "BookOpen", title: "20+ KEY", sub: "SESSIONS" },
];

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (typeof updateData.checklist === "string") {
    try {
      updateData.checklist = JSON.parse(updateData.checklist);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.button === "string") {
    try {
      updateData.button = JSON.parse(updateData.button);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.eventInfo === "string") {
    try {
      updateData.eventInfo = JSON.parse(updateData.eventInfo);
    } catch {
      // keep as is
    }
  }

  // Handle keyPoint1..keyPoint3
  if (
    updateData.keyPoint1 !== undefined ||
    updateData.keyPoint2 !== undefined ||
    updateData.keyPoint3 !== undefined
  ) {
    updateData.keyPoint1 = updateData.keyPoint1 || DEFAULT_CHECKLIST[0];
    updateData.keyPoint2 = updateData.keyPoint2 || DEFAULT_CHECKLIST[1];
    updateData.keyPoint3 = updateData.keyPoint3 || DEFAULT_CHECKLIST[2];
    updateData.checklist = [
      updateData.keyPoint1,
      updateData.keyPoint2,
      updateData.keyPoint3,
    ];
  } else if (Array.isArray(updateData.checklist) && updateData.checklist.length > 0) {
    updateData.keyPoint1 = updateData.checklist[0] || DEFAULT_CHECKLIST[0];
    updateData.keyPoint2 = updateData.checklist[1] || DEFAULT_CHECKLIST[1];
    updateData.keyPoint3 = updateData.checklist[2] || DEFAULT_CHECKLIST[2];
  }

  // Handle stat1..stat5
  if (
    updateData.stat1Title !== undefined ||
    updateData.stat2Title !== undefined ||
    updateData.stat3Title !== undefined ||
    updateData.stat4Title !== undefined ||
    updateData.stat5Title !== undefined
  ) {
    updateData.stat1Title = updateData.stat1Title || DEFAULT_STATS[0].title;
    updateData.stat1Sub = updateData.stat1Sub || DEFAULT_STATS[0].sub;
    updateData.stat2Title = updateData.stat2Title || DEFAULT_STATS[1].title;
    updateData.stat2Sub = updateData.stat2Sub || DEFAULT_STATS[1].sub;
    updateData.stat3Title = updateData.stat3Title || DEFAULT_STATS[2].title;
    updateData.stat3Sub = updateData.stat3Sub || DEFAULT_STATS[2].sub;
    updateData.stat4Title = updateData.stat4Title || DEFAULT_STATS[3].title;
    updateData.stat4Sub = updateData.stat4Sub || DEFAULT_STATS[3].sub;
    updateData.stat5Title = updateData.stat5Title || DEFAULT_STATS[4].title;
    updateData.stat5Sub = updateData.stat5Sub || DEFAULT_STATS[4].sub;
    updateData.eventInfo = [
      { icon: "Calendar", title: updateData.stat1Title, sub: updateData.stat1Sub },
      { icon: "MapPin", title: updateData.stat2Title, sub: updateData.stat2Sub },
      { icon: "Users", title: updateData.stat3Title, sub: updateData.stat3Sub },
      { icon: "Mic", title: updateData.stat4Title, sub: updateData.stat4Sub },
      { icon: "BookOpen", title: updateData.stat5Title, sub: updateData.stat5Sub },
    ];
  } else if (Array.isArray(updateData.eventInfo) && updateData.eventInfo.length > 0) {
    updateData.stat1Title = updateData.eventInfo[0]?.title || DEFAULT_STATS[0].title;
    updateData.stat1Sub = updateData.eventInfo[0]?.sub || DEFAULT_STATS[0].sub;
    updateData.stat2Title = updateData.eventInfo[1]?.title || DEFAULT_STATS[1].title;
    updateData.stat2Sub = updateData.eventInfo[1]?.sub || DEFAULT_STATS[1].sub;
    updateData.stat3Title = updateData.eventInfo[2]?.title || DEFAULT_STATS[2].title;
    updateData.stat3Sub = updateData.eventInfo[2]?.sub || DEFAULT_STATS[2].sub;
    updateData.stat4Title = updateData.eventInfo[3]?.title || DEFAULT_STATS[3].title;
    updateData.stat4Sub = updateData.eventInfo[3]?.sub || DEFAULT_STATS[3].sub;
    updateData.stat5Title = updateData.eventInfo[4]?.title || DEFAULT_STATS[4].title;
    updateData.stat5Sub = updateData.eventInfo[4]?.sub || DEFAULT_STATS[4].sub;
  }

  // Sync eyebrow and sectionTag
  if (updateData.eyebrow) updateData.sectionTag = updateData.eyebrow;
  if (updateData.sectionTag && !updateData.eyebrow) updateData.eyebrow = updateData.sectionTag;

  // Sync titlePrimary and titleMain
  if (updateData.titlePrimary) updateData.titleMain = updateData.titlePrimary;
  if (updateData.titleMain && !updateData.titlePrimary) updateData.titlePrimary = updateData.titleMain;

  // Sync titleSecondary and titleHighlight
  if (updateData.titleSecondary) updateData.titleHighlight = updateData.titleSecondary;
  if (updateData.titleHighlight && !updateData.titleSecondary) updateData.titleSecondary = updateData.titleHighlight;

  // Sync button structure with buttonLabel and buttonHref
  if (!updateData.button) updateData.button = {};
  if (updateData.buttonLabel !== undefined || updateData.buttonHref !== undefined) {
    updateData.button = {
      text: updateData.buttonLabel || updateData.button?.text || "View Conference Schedule",
      link: updateData.buttonHref || updateData.button?.link || "https://arogya.namogange.org/",
    };
  }
  if (updateData.button?.text && !updateData.buttonLabel) updateData.buttonLabel = updateData.button.text;
  if (updateData.button?.link && !updateData.buttonHref) updateData.buttonHref = updateData.button.link;

  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  return updateData;
};

export const getConferenceSeminarsService = async () => {
  let data = await ConferenceSeminars.findOne();
  if (!data) {
    data = await ConferenceSeminars.create({
      enabled: true,
      sectionTag: "GLOBAL CONFERENCE & SEMINARS",
      eyebrow: "GLOBAL CONFERENCE & SEMINARS",
      titleMain: "Where Knowledge Meets",
      titlePrimary: "Where Knowledge Meets",
      titleHighlight: "the Future of Organic",
      titleSecondary: "the Future of Organic",
      description: "Join expert-led sessions, panel discussions & thought leadership talks on the latest trends shaping the future of organic, natural and sustainable living.",
      keyPoint1: DEFAULT_CHECKLIST[0],
      keyPoint2: DEFAULT_CHECKLIST[1],
      keyPoint3: DEFAULT_CHECKLIST[2],
      checklist: DEFAULT_CHECKLIST,
      buttonLabel: "View Conference Schedule",
      buttonHref: "https://arogya.namogange.org/",
      button: {
        text: "View Conference Schedule",
        link: "https://arogya.namogange.org/",
      },
      stat1Title: DEFAULT_STATS[0].title,
      stat1Sub: DEFAULT_STATS[0].sub,
      stat2Title: DEFAULT_STATS[1].title,
      stat2Sub: DEFAULT_STATS[1].sub,
      stat3Title: DEFAULT_STATS[2].title,
      stat3Sub: DEFAULT_STATS[2].sub,
      stat4Title: DEFAULT_STATS[3].title,
      stat4Sub: DEFAULT_STATS[3].sub,
      stat5Title: DEFAULT_STATS[4].title,
      stat5Sub: DEFAULT_STATS[4].sub,
      eventInfo: DEFAULT_STATS,
      imageAlt: "Conference and Seminars",
    });
  } else {
    let needsSave = false;
    if (data.enabled === undefined) { data.enabled = true; needsSave = true; }
    if (!data.eyebrow) { data.eyebrow = data.sectionTag || "GLOBAL CONFERENCE & SEMINARS"; needsSave = true; }
    if (!data.titlePrimary) { data.titlePrimary = data.titleMain || "Where Knowledge Meets"; needsSave = true; }
    if (!data.titleSecondary) { data.titleSecondary = data.titleHighlight || "the Future of Organic"; needsSave = true; }
    if (!data.buttonLabel) { data.buttonLabel = data.button?.text || "View Conference Schedule"; needsSave = true; }
    if (!data.buttonHref) { data.buttonHref = data.button?.link || "https://arogya.namogange.org/"; needsSave = true; }
    if (!data.keyPoint1) { data.keyPoint1 = data.checklist?.[0] || DEFAULT_CHECKLIST[0]; needsSave = true; }
    if (!data.keyPoint2) { data.keyPoint2 = data.checklist?.[1] || DEFAULT_CHECKLIST[1]; needsSave = true; }
    if (!data.keyPoint3) { data.keyPoint3 = data.checklist?.[2] || DEFAULT_CHECKLIST[2]; needsSave = true; }
    if (!data.stat1Title) { data.stat1Title = data.eventInfo?.[0]?.title || DEFAULT_STATS[0].title; needsSave = true; }
    if (!data.stat1Sub) { data.stat1Sub = data.eventInfo?.[0]?.sub || DEFAULT_STATS[0].sub; needsSave = true; }
    if (!data.stat2Title) { data.stat2Title = data.eventInfo?.[1]?.title || DEFAULT_STATS[1].title; needsSave = true; }
    if (!data.stat2Sub) { data.stat2Sub = data.eventInfo?.[1]?.sub || DEFAULT_STATS[1].sub; needsSave = true; }
    if (!data.stat3Title) { data.stat3Title = data.eventInfo?.[2]?.title || DEFAULT_STATS[2].title; needsSave = true; }
    if (!data.stat3Sub) { data.stat3Sub = data.eventInfo?.[2]?.sub || DEFAULT_STATS[2].sub; needsSave = true; }
    if (!data.stat4Title) { data.stat4Title = data.eventInfo?.[3]?.title || DEFAULT_STATS[3].title; needsSave = true; }
    if (!data.stat4Sub) { data.stat4Sub = data.eventInfo?.[3]?.sub || DEFAULT_STATS[3].sub; needsSave = true; }
    if (!data.stat5Title) { data.stat5Title = data.eventInfo?.[4]?.title || DEFAULT_STATS[4].title; needsSave = true; }
    if (!data.stat5Sub) { data.stat5Sub = data.eventInfo?.[4]?.sub || DEFAULT_STATS[4].sub; needsSave = true; }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateConferenceSeminarsService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await ConferenceSeminars.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  return data;
};


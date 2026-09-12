import WhyParticipate from "../../../../models/home/whyParticipate.model";
import { ApiError } from "../../../../utils/ApiError";

const DEFAULT_POINTS = [
  "Meet genuine buyers, distributors, retailers, and healthcare professionals",
  "Generate high-quality B2B & B2C leads with faster business conversions",
  "Launch new products with maximum visibility and market impact",
  "Expand your dealer, distributor, franchise, and export network",
  "Strengthen brand presence through live demos and media exposure",
  "Connect with investors, CEOs, doctors, and key decision-makers",
  "Achieve higher ROI with direct customer engagement and trust building",
];

const parseJsonFields = (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (typeof updateData.points === "string") {
    try {
      updateData.points = JSON.parse(updateData.points);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.mainPoints === "string") {
    try {
      updateData.mainPoints = JSON.parse(updateData.mainPoints);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.buttons === "string") {
    try {
      updateData.buttons = JSON.parse(updateData.buttons);
    } catch {
      // keep as is
    }
  }

  // Handle keyPoint1..keyPoint7
  if (
    updateData.keyPoint1 !== undefined ||
    updateData.keyPoint2 !== undefined ||
    updateData.keyPoint3 !== undefined ||
    updateData.keyPoint4 !== undefined ||
    updateData.keyPoint5 !== undefined ||
    updateData.keyPoint6 !== undefined ||
    updateData.keyPoint7 !== undefined
  ) {
    updateData.keyPoint1 = updateData.keyPoint1 || DEFAULT_POINTS[0];
    updateData.keyPoint2 = updateData.keyPoint2 || DEFAULT_POINTS[1];
    updateData.keyPoint3 = updateData.keyPoint3 || DEFAULT_POINTS[2];
    updateData.keyPoint4 = updateData.keyPoint4 || DEFAULT_POINTS[3];
    updateData.keyPoint5 = updateData.keyPoint5 || DEFAULT_POINTS[4];
    updateData.keyPoint6 = updateData.keyPoint6 || DEFAULT_POINTS[5];
    updateData.keyPoint7 = updateData.keyPoint7 || DEFAULT_POINTS[6];
    updateData.points = [
      updateData.keyPoint1,
      updateData.keyPoint2,
      updateData.keyPoint3,
      updateData.keyPoint4,
      updateData.keyPoint5,
      updateData.keyPoint6,
      updateData.keyPoint7,
    ];
  } else if (Array.isArray(updateData.points) && updateData.points.length > 0) {
    updateData.keyPoint1 = updateData.points[0] || DEFAULT_POINTS[0];
    updateData.keyPoint2 = updateData.points[1] || DEFAULT_POINTS[1];
    updateData.keyPoint3 = updateData.points[2] || DEFAULT_POINTS[2];
    updateData.keyPoint4 = updateData.points[3] || DEFAULT_POINTS[3];
    updateData.keyPoint5 = updateData.points[4] || DEFAULT_POINTS[4];
    updateData.keyPoint6 = updateData.points[5] || DEFAULT_POINTS[5];
    updateData.keyPoint7 = updateData.points[6] || DEFAULT_POINTS[6];
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

  // Sync buttons structure with flat button fields
  if (!updateData.buttons) updateData.buttons = {};
  if (updateData.buttonLabel !== undefined || updateData.buttonHref !== undefined) {
    updateData.buttons.stall = {
      text: updateData.buttonLabel || updateData.buttons?.stall?.text || "BOOK A STALL",
      link: updateData.buttonHref || updateData.buttons?.stall?.link || "/registration/book-a-stand",
    };
  }
  if (updateData.secondaryButtonLabel !== undefined || updateData.secondaryButtonHref !== undefined) {
    updateData.buttons.brochure = {
      text: updateData.secondaryButtonLabel || updateData.buttons?.brochure?.text || "Download Brochure",
      link: updateData.secondaryButtonHref || updateData.buttons?.brochure?.link || "/download/invited card.pdf",
    };
  }
  if (updateData.tertiaryButtonLabel !== undefined || updateData.tertiaryButtonHref !== undefined) {
    updateData.buttons.moreInfo = {
      text: updateData.tertiaryButtonLabel || updateData.buttons?.moreInfo?.text || "Why Exhibit?",
      link: updateData.tertiaryButtonHref || updateData.buttons?.moreInfo?.link || "/why-exhibit",
    };
  }

  if (updateData.enabled !== undefined) {
    updateData.enabled = updateData.enabled === true || updateData.enabled === "true";
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  if (files && files.brochure && files.brochure[0]) {
    if (!updateData.buttons) updateData.buttons = {};
    if (!updateData.buttons.brochure) updateData.buttons.brochure = {};
    updateData.buttons.brochure.link = `/uploads/organic_expo/${files.brochure[0].filename}`;
  }

  return updateData;
};

export const getWhyParticipateService = async () => {
  let data = await WhyParticipate.findOne();
  if (!data) {
    data = await WhyParticipate.create({
      enabled: true,
      sectionTag: "WHY PARTICIPATE",
      eyebrow: "WHY PARTICIPATE",
      titleMain: "Your Gateway to",
      titlePrimary: "Your Gateway to",
      titleHighlight: "Global Opportunities",
      titleSecondary: "Global Opportunities",
      description:
        "Bharat Organic Expo 2027 is a leading platform for organic products, natural health, fitness, Ayurveda, and sustainable innovation—bringing together top brands, buyers, investors, and industry leaders from India and worldwide.",
      keyPoint1: DEFAULT_POINTS[0],
      keyPoint2: DEFAULT_POINTS[1],
      keyPoint3: DEFAULT_POINTS[2],
      keyPoint4: DEFAULT_POINTS[3],
      keyPoint5: DEFAULT_POINTS[4],
      keyPoint6: DEFAULT_POINTS[5],
      keyPoint7: DEFAULT_POINTS[6],
      points: DEFAULT_POINTS,
      imageAlt: "Why Participate in Expo",
      imageBadgeText: "Build Relationships.\nGenerate Leads.\nGrow Your Business.",
      mainPoints: ["Exhibit", "Connect", "Grow"],
      buttonLabel: "BOOK A STALL",
      buttonHref: "/registration/book-a-stand",
      secondaryButtonLabel: "Download Brochure",
      secondaryButtonHref: "/download/invited card.pdf",
      tertiaryButtonLabel: "Why Exhibit?",
      tertiaryButtonHref: "/why-exhibit",
      buttons: {
        stall: { text: "BOOK A STALL", link: "/registration/book-a-stand" },
        brochure: { text: "Download Brochure", link: "/download/invited card.pdf" },
        moreInfo: { text: "Why Exhibit?", link: "/why-exhibit" },
      },
    });
  } else {
    let needsSave = false;
    if (!data.keyPoint1) { data.keyPoint1 = data.points?.[0] || DEFAULT_POINTS[0]; needsSave = true; }
    if (!data.keyPoint2) { data.keyPoint2 = data.points?.[1] || DEFAULT_POINTS[1]; needsSave = true; }
    if (!data.keyPoint3) { data.keyPoint3 = data.points?.[2] || DEFAULT_POINTS[2]; needsSave = true; }
    if (!data.keyPoint4) { data.keyPoint4 = data.points?.[3] || DEFAULT_POINTS[3]; needsSave = true; }
    if (!data.keyPoint5) { data.keyPoint5 = data.points?.[4] || DEFAULT_POINTS[4]; needsSave = true; }
    if (!data.keyPoint6) { data.keyPoint6 = data.points?.[5] || DEFAULT_POINTS[5]; needsSave = true; }
    if (!data.keyPoint7) { data.keyPoint7 = data.points?.[6] || DEFAULT_POINTS[6]; needsSave = true; }
    if (!data.eyebrow) { data.eyebrow = data.sectionTag || "WHY PARTICIPATE"; needsSave = true; }
    if (!data.titlePrimary) { data.titlePrimary = data.titleMain || "Your Gateway to"; needsSave = true; }
    if (!data.titleSecondary) { data.titleSecondary = data.titleHighlight || "Global Opportunities"; needsSave = true; }
    if (!data.buttonLabel) { data.buttonLabel = data.buttons?.stall?.text || "BOOK A STALL"; needsSave = true; }
    if (!data.buttonHref) { data.buttonHref = data.buttons?.stall?.link || "/registration/book-a-stand"; needsSave = true; }
    if (!data.secondaryButtonLabel) { data.secondaryButtonLabel = data.buttons?.brochure?.text || "Download Brochure"; needsSave = true; }
    if (!data.secondaryButtonHref) { data.secondaryButtonHref = data.buttons?.brochure?.link || "/download/invited card.pdf"; needsSave = true; }
    if (!data.tertiaryButtonLabel) { data.tertiaryButtonLabel = data.buttons?.moreInfo?.text || "Why Exhibit?"; needsSave = true; }
    if (!data.tertiaryButtonHref) { data.tertiaryButtonHref = data.buttons?.moreInfo?.link || "/why-exhibit"; needsSave = true; }
    if (!data.points || data.points.length === 0) {
      data.points = DEFAULT_POINTS;
      needsSave = true;
    }
    if (needsSave) {
      await data.save();
    }
  }
  return data;
};

export const updateWhyParticipateService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyParticipate.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  return data;
};

export const createWhyParticipateService = async (payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  return await WhyParticipate.create(updateData);
};

export const getAllWhyParticipateService = async () => {
  return await WhyParticipate.find();
};

export const getWhyParticipateByIdService = async (id: string) => {
  const data = await WhyParticipate.findById(id);
  if (!data) throw ApiError.notFound("Why Participate not found");
  return data;
};

export const updateWhyParticipateByIdService = async (id: string, payload: any, files?: any) => {
  const updateData = parseJsonFields(payload, files);
  const data = await WhyParticipate.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Why Participate not found");
  return data;
};

export const deleteWhyParticipateByIdService = async (id: string) => {
  const data = await WhyParticipate.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Why Participate not found");
  return data;
};

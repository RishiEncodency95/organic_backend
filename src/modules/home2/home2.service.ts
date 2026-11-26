import HomeHero from "../../models/home/homeHero.model";
import IntroductionSection from "../../models/home/introductionSection.model";
import WhyParticipate from "../../models/home/whyParticipate.model";
import BeyondExhibition from "../../models/home/beyondExhibition.model";
import BuyerSellerMeet from "../../models/home/buyerSellerMeet.model";
import ConferenceSeminars from "../../models/home/conferenceSeminars.model";
import GlobalPlatform from "../../models/home/globalPlatform.model";
import BecomeSponsor from "../../models/home/becomeSponsor.model";
import SponsorsAndAttend from "../../models/home/sponsorsAndAttend.model";
import SponsorshipCategories from "../../models/home/sponsorshipCategories.model";
import ExpoCategories from "../../models/home/expoCategories.model";

const HOME_SECTION_MODELS: Record<string, any> = {
  hero: HomeHero,
  introduction: IntroductionSection,
  whyParticipate: WhyParticipate,
  beyondExhibition: BeyondExhibition,
  buyerSellerMeet: BuyerSellerMeet,
  conferenceSeminars: ConferenceSeminars,
  globalPlatform: GlobalPlatform,
  becomeSponsor: BecomeSponsor,
  sponsorsAndAttend: SponsorsAndAttend,
  sponsorshipCategories: SponsorshipCategories,
  expoCategories: ExpoCategories,
};

export async function getPage(_key?: string): Promise<any> {
  const entries = await Promise.all(
    Object.entries(HOME_SECTION_MODELS).map(async ([section, Model]) => {
      try {
        const doc = await Model.findOne().sort({ updatedAt: -1 }).lean();
        return [section, doc ?? null];
      } catch {
        return [section, null];
      }
    }),
  );
  const sections: Record<string, any> = {};
  for (const [section, doc] of entries) {
    if (doc) sections[section] = doc;
  }
  return { sections, seo: {} };
}

export async function updateSection(section?: string, data?: any, _by?: string) {
  if (!section || !data || typeof data !== "object") return null;
  const Model = HOME_SECTION_MODELS[section];
  if (!Model) return null;
  const { _id, __v, createdAt, updatedAt, ...clean } = data as Record<string, unknown>;
  const existing = await Model.findOne().sort({ updatedAt: -1 });
  if (existing) {
    Object.assign(existing, clean);
    await existing.save();
    return existing.toObject();
  }
  return null;
}

export async function updateSeo(_data?: any, _by?: string) { return null; }
export async function getHome2Page() { return getPage(); }
export async function updateHome2Section(section?: string, data?: any, by?: string) { return updateSection(section, data, by); }
export async function getHome2Raw() { return getPage(); }
export async function saveHome2Raw() { return null; }

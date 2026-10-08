/**
 * Every website dropdown whose options the admin can manage. The key is what the
 * website asks for (`/api/dropdowns/<key>`); `usedIn` tells the admin where it shows.
 * A list with `parent` holds dependent options: each option's parentValue is a value
 * of the parent list (e.g. sub-categories under a primary category).
 *
 * Notice / Joining Period and Expected CTC are separate: see /api/careers/options.
 * Country / State / City come from /api/crm-countries|states|cities.
 */
export interface DropdownListDefinition {
  name: string;
  group: string;
  usedIn: string[];
  parent?: string;
}

export const DROPDOWN_LISTS: Record<string, DropdownListDefinition> = {
  // ---- Shared ----
  gender: { name: "Gender", group: "Shared", usedIn: ["MSME Enterprise Form", "Visitor Registration (General, Corporate, Group, Health Camp, International)"] },
  "yes-no": { name: "Yes / No", group: "Shared", usedIn: ["Buyer Registration", "International Visitor Registration"] },
  "india-states": { name: "Indian States & UTs", group: "Shared", usedIn: ["MSME Enterprise Form"] },
  "expo-edition": { name: "Expo Edition", group: "Shared", usedIn: ["MSME Participation Form", "Feedback"] },
  salutation: { name: "Title / Salutation", group: "Shared", usedIn: ["Book a Stand"] },
  "social-media-platform": { name: "Social Media Platform", group: "Shared", usedIn: ["Book a Stand"] },

  // ---- Awards ----
  "awards-applicant-type": { name: "Applicant Type", group: "Awards Nomination", usedIn: ["Awards Nomination"] },
  "awards-state-country": { name: "State / Country", group: "Awards Nomination", usedIn: ["Awards Nomination"] },
  "awards-category": { name: "Award Category", group: "Awards Nomination", usedIn: ["Awards Nomination"] },
  "awards-years-experience": { name: "Years of Experience", group: "Awards Nomination", usedIn: ["Awards Nomination"] },
  "awards-team-size": { name: "Team Size", group: "Awards Nomination", usedIn: ["Awards Nomination"] },

  // ---- Advisory board ----
  "advisory-industry-sector": { name: "Industry / Sector", group: "Advisory Board Nomination", usedIn: ["Advisory Board Nomination"] },
  "advisory-expertise-area": { name: "Areas of Expertise", group: "Advisory Board Nomination", usedIn: ["Advisory Board Nomination"] },
  "advisory-relationship": { name: "Relationship with Nominee", group: "Advisory Board Nomination", usedIn: ["Advisory Board Nomination"] },

  // ---- Careers ----
  "careers-current-location": { name: "Current Location", group: "Careers", usedIn: ["Careers Application Form"] },

  // ---- Enquiries & partnerships ----
  "sponsorship-category": { name: "Sponsorship Category", group: "Enquiries", usedIn: ["Home – Sponsorship Enquiry"] },
  "partnership-category": { name: "Partnership Category", group: "Enquiries", usedIn: ["Partnership Enquiry (/partnership)"] },
  "partner-preferred-category": { name: "Preferred Partner Category", group: "Enquiries", usedIn: ["Hotel, Logistics, Manpower, Printing, Stall Design & Travel partner pages"] },
  "partner-state": { name: "Partner State", group: "Enquiries", usedIn: ["Hotel, Logistics, Manpower, Printing, Stall Design & Travel partner pages"] },
  "buyer-enquiry-country": { name: "Buyer Enquiry – Country", group: "Enquiries", usedIn: ["Buyer-Seller Meet – Enquiry popup"] },
  "buyer-enquiry-type": { name: "Buyer Enquiry – Buyer Type", group: "Enquiries", usedIn: ["Buyer-Seller Meet – Enquiry popup"] },
  "buyer-enquiry-topic": { name: "Buyer Enquiry – Enquiry About", group: "Enquiries", usedIn: ["Buyer-Seller Meet – Enquiry popup"] },

  // ---- MSME ----
  "msme-enterprise-type": { name: "Enterprise Type", group: "MSME", usedIn: ["MSME Enterprise Form"] },
  "msme-major-activity": { name: "Major Activity", group: "MSME", usedIn: ["MSME Enterprise Form"] },
  "msme-constitution": { name: "Constitution / Organisation", group: "MSME", usedIn: ["MSME Enterprise Form"] },
  "msme-entrepreneur-category": { name: "Entrepreneur Category", group: "MSME", usedIn: ["MSME Enterprise Form"] },
  "msme-stall-size": { name: "Stall Size", group: "MSME", usedIn: ["MSME Participation Form", "MSME Eligibility Estimate"] },

  // ---- Buyer registration ----
  "buyer-business-role": { name: "Business Role", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-business-type": { name: "Business Type", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-product-category": { name: "Industry / Product Interest", group: "Buyer Registration", usedIn: ["Buyer Registration – Buyer Industry & Primary Product Interest"] },
  "buyer-value-range": { name: "Turnover / Purchase Value", group: "Buyer Registration", usedIn: ["Buyer Registration – Annual Turnover & Est. Annual Purchase Value"] },
  "buyer-business-model": { name: "Business Model Preference", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-purchase-frequency": { name: "Purchase Frequency", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-purchase-timeline": { name: "Purchase Timeline", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-decision-role": { name: "Role in Purchase Decision", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-company-size": { name: "Preferred Company Size", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-meeting-day": { name: "Preferred Meeting Day", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-time-slot": { name: "Meeting Time Slot", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-meeting-count": { name: "Number of Meetings", group: "Buyer Registration", usedIn: ["Buyer Registration (Domestic & International)"] },
  "buyer-secondary-category": { name: "Secondary Product Categories", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-region": { name: "Sourcing Regions", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-supplier-type": { name: "Preferred Supplier Types", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-certification": { name: "Required Certifications", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-meeting-category": { name: "Meeting Categories", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-exhibitor-type": { name: "Exhibitor Types to Meet", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-meeting-objective": { name: "Meeting Objectives", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-preferred-business-type": { name: "Preferred Business Type", group: "Buyer Registration", usedIn: ["Buyer Registration (checkboxes)"] },
  "buyer-legal-entity-type": { name: "Legal Entity Type", group: "Buyer Registration", usedIn: ["International Buyer Registration"] },
  "buyer-intl-stall-type": { name: "Preferred Stall Type (International)", group: "Buyer Registration", usedIn: ["International Buyer Registration"] },
  "buyer-intl-stall-size": { name: "Stall Size Requirement (International)", group: "Buyer Registration", usedIn: ["International Buyer Registration"] },
  "buyer-intl-stall-location": { name: "Preferred Stall Location (International)", group: "Buyer Registration", usedIn: ["International Buyer Registration"] },
  "buyer-intl-sponsorship-type": { name: "Preferred Sponsorship Type", group: "Buyer Registration", usedIn: ["International Buyer Registration"] },
  "buyer-intl-certification": { name: "Certifications (International)", group: "Buyer Registration", usedIn: ["International Buyer Registration (checkboxes)"] },
  "buyer-intl-looking-for": { name: "B2B – Looking For", group: "Buyer Registration", usedIn: ["International Buyer Registration (checkboxes)"] },
  "buyer-payment-mode": { name: "Payment Mode", group: "Buyer Registration", usedIn: ["International Buyer Registration"] },

  // ---- Visitor registration ----
  "visitor-corporate-industry": { name: "Industry Sector (Corporate)", group: "Visitor Registration", usedIn: ["Corporate Visitor Registration"] },
  "visitor-corporate-company-size": { name: "Company Size (Corporate)", group: "Visitor Registration", usedIn: ["Corporate Visitor Registration"] },
  "visitor-industry": { name: "Industry / Sector", group: "Visitor Registration", usedIn: ["Group & International Visitor Registration"] },
  "visitor-company-size": { name: "Company Size", group: "Visitor Registration", usedIn: ["Group & International Visitor Registration"] },
  "visitor-visit-days": { name: "Preferred Visit Days", group: "Visitor Registration", usedIn: ["International Visitor Registration"] },
  "visitor-conference-role": { name: "Conference – Interested As", group: "Visitor Registration", usedIn: ["International Visitor Registration"] },
  "health-camp-time-slot": { name: "Health Camp Time Slot", group: "Visitor Registration", usedIn: ["Health Camp Registration"] },

  // ---- Book a stand ----
  "exhibitor-business-type": { name: "Type of Business", group: "Book a Stand", usedIn: ["Book a Stand"] },
  "exhibitor-primary-category": { name: "Industry Sector / Primary Category", group: "Book a Stand", usedIn: ["Book a Stand – Industry Sector & Primary Category"] },
  "exhibitor-sub-category": { name: "Sub-Category", group: "Book a Stand", usedIn: ["Book a Stand"], parent: "exhibitor-primary-category" },
  "exhibitor-nature-of-business": { name: "Nature of Business", group: "Book a Stand", usedIn: ["Book a Stand"] },
  "exhibitor-referred-by": { name: "How did you hear about us?", group: "Book a Stand", usedIn: ["Book a Stand"] },
  "tds-percent": { name: "TDS %", group: "Book a Stand", usedIn: ["Book a Stand – Payment"] },
  "exhibitor-stall-type": { name: "Stall Type", group: "Book a Stand", usedIn: ["Book a Stand – Stall Category", "Stall & rate setup"] },
  "stall-pl-scheme": { name: "Stall Open Sides (PL Scheme)", group: "Book a Stand", usedIn: ["Stall setup"] },
};

export const isDropdownList = (key: unknown): key is string =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(DROPDOWN_LISTS, key);

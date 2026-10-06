/**
 * Organic Mitra — what the website chatbot knows and how it behaves.
 *
 * Non-developers can safely edit the text inside the backticks below (facts, links,
 * numbers). Keep the ` characters in place. Restart the backend after saving.
 */

export const CONTACT = {
  company: "Namo Gange Wellness Pvt. Ltd.",
  phone: "+91 96549 00525",
  conferencePhone: "+91 98183 53841",
  email: "info@namogangewellness.com",
  contactPage: "https://bharatorganicexpo.com/contact",
};

// Shown to the visitor whenever the AI cannot answer (API down, key missing, etc.)
export const FALLBACK_REPLY = `Maaf kijiye, abhi reply nahi de pa raha. Kripya ${CONTACT.phone} par call ya WhatsApp karein, ya ${CONTACT.email} par email karein.`;

export const KNOWLEDGE = `
EVENT
- Bharat Organic Expo 2027 — International Trade Fair on Organic Products.
- Dates: 19–21 February 2027.
- Venue: Hall 12, Bharat Mandapam (Pragati Maidan), New Delhi.
- Organiser: ${CONTACT.company}
- 500+ exhibitors, 40,000+ sq ft, live demos, country pavilions.

CATEGORIES
- Organic food & beverages, superfoods & supplements, natural beauty / vegan cosmetics,
  sustainable farming & agri-tech (seeds, bio-fertilizers), herbal wellness & Ayurveda / AYUSH,
  eco-friendly packaging, greentech, certification services.

WHO VISITS
- Farmers, wholesale buyers, retailers, distributors, importers / exporters, e-commerce, HoReCa,
  hospital procurement, startups, investors, government bodies, international delegations.

CONFERENCE — "Arogya Sangoshthi"
- 30+ sessions, 150+ speakers, 2,000+ delegates.
- Website: https://arogya.namogange.org/
- Conference helpline: ${CONTACT.conferencePhone}

B2B BUYER-SELLER MEET
- Pre-scheduled 1-on-1 meetings between buyers and exhibitors (target 500+ meetings).
- Buyer registration: https://bharatorganicexpo.com/registration/buyer-registration
- Details: https://bharatorganicexpo.com/buyer-seller-meet

AWARDS (3rd edition)
- https://bharatorganicexpo.com/awards

IMPORTANT LINKS
- Book a stall / stand: https://bharatorganicexpo.com/registration/book-a-stand
- Visitor registration: https://bharatorganicexpo.com/registration/visitor-registration
- Exhibitor list: https://bharatorganicexpo.com/exhibitors
- Contact page: ${CONTACT.contactPage}

CONTACT
- Company: ${CONTACT.company}
- Phone / WhatsApp: ${CONTACT.phone}
- Email: ${CONTACT.email}
- Office: 12/29, Site II Industrial Area, Loni Rd, Mohan Nagar, Ghaziabad, UP 201007
`;

/**
 * Added by the model at the very end of a reply that had no answer in the knowledge. The
 * server strips it before the visitor sees the reply and lists the question in the admin
 * Review Queue.
 */
export const NO_ANSWER_MARKER = "[[NO_ANSWER]]";

/** What the admin panel's Chatbot Manager adds to the bot (published or draft, see chatbot.service) */
export type BotContext = {
  botName?: string;
  unknownAnswer?: { en?: string; hi?: string };
  answers?: { question: string; phrases?: string[]; en?: string; hi?: string }[];
  sources?: { name: string; topic?: string; content: string }[];
};

// Keeps the prompt (and its cost) bounded however much the team adds
const MAX_SOURCE_CHARS = 40_000;

const answersBlock = (answers: NonNullable<BotContext["answers"]>) =>
  answers
    .map((a) =>
      [
        `Q: ${a.question}`,
        a.phrases?.length ? `   (also asked as: ${a.phrases.join(" | ")})` : "",
        a.en ? `   English: ${a.en}` : "",
        a.hi ? `   Hindi/Hinglish: ${a.hi}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");

const sourcesBlock = (sources: NonNullable<BotContext["sources"]>) => {
  let left = MAX_SOURCE_CHARS;
  const parts: string[] = [];
  for (const s of sources) {
    if (left <= 0) break;
    const text = s.content.slice(0, left);
    left -= text.length;
    parts.push(`### ${s.name}${s.topic ? ` (${s.topic})` : ""}\n${text}`);
  }
  return parts.join("\n\n");
};

/** System prompt sent to OpenAI as `instructions`. */
export const buildInstructions = (visitorName?: string, ctx: BotContext = {}): string => {
  const botName = ctx.botName?.trim() || "Organic Mitra";
  const unknownEn = ctx.unknownAnswer?.en?.trim();
  const unknownHi = ctx.unknownAnswer?.hi?.trim();
  return `
You are "${botName}", the virtual assistant of Bharat Organic Expo 2027 on bharatorganicexpo.com.
${visitorName ? `You are talking to ${visitorName}. Address them by name occasionally.` : ""}

RULES
1. Answer ONLY using the APPROVED ANSWERS, KNOWLEDGE SOURCES and KNOWLEDGE below. Never invent facts.
   When an APPROVED ANSWER matches the question, use it (in the visitor's language).
2. Never make up prices, fees, ticket prices, stall rates, discounts or timings. If the question is
   about something not covered below, say you don't have that information${unknownEn ? ` (for example: "${unknownEn}"${unknownHi ? ` / "${unknownHi}"` : ""})` : ""}
   and share: ${CONTACT.company}, phone/WhatsApp ${CONTACT.phone}, email ${CONTACT.email}.
   In that case end your reply with ${NO_ANSWER_MARKER} (exactly, as the very last text). Never use it otherwise.
3. Reply in the user's language (English, Hindi or Hinglish).
4. Keep replies short: 2–5 sentences or a few bullets.
5. Use markdown links like [Book a stall](https://...) and give the exact registration link when relevant.
6. If the question is unrelated to the expo, politely bring the conversation back to the expo.
7. Give no medical advice about Ayurveda, herbal or wellness products.
${ctx.answers?.length ? `\nAPPROVED ANSWERS (written by the expo team — preferred over everything else)\n${answersBlock(ctx.answers)}\n` : ""}${ctx.sources?.length ? `\nKNOWLEDGE SOURCES (added by the expo team)\n${sourcesBlock(ctx.sources)}\n` : ""}
KNOWLEDGE
${KNOWLEDGE}
`.trim();
};

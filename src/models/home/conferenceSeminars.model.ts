import mongoose, { Document, Schema } from "mongoose";

const buttonSchema = new Schema({
  text: { type: String, default: 'View Conference Schedule' },
  link: { type: String, default: 'https://arogya.namogange.org/' }
}, { _id: false });

const eventInfoSchema = new Schema({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  sub: { type: String, default: '' }
}, { _id: false });

const conferenceSeminarsSchema = new Schema({
  enabled: { type: Boolean, default: true },
  sectionTag: { type: String, default: 'GLOBAL CONFERENCE & SEMINARS' },
  eyebrow: { type: String, default: 'GLOBAL CONFERENCE & SEMINARS' },
  titleMain: { type: String, default: 'Where Knowledge Meets' },
  titlePrimary: { type: String, default: 'Where Knowledge Meets' },
  titleHighlight: { type: String, default: 'the Future of Organic' },
  titleSecondary: { type: String, default: 'the Future of Organic' },
  description: { 
    type: String, 
    default: 'Join expert-led sessions, panel discussions & thought leadership talks on the latest trends shaping the future of organic, natural and sustainable living.' 
  },
  keyPoint1: { type: String, default: 'Expert-led panel discussions & keynotes' },
  keyPoint2: { type: String, default: 'Emerging trends in organic farming & retail' },
  keyPoint3: { type: String, default: 'Sustainable business & growth strategies' },
  checklist: { 
    type: [String], 
    default: [
      "Expert-led panel discussions & keynotes",
      "Emerging trends in organic farming & retail",
      "Sustainable business & growth strategies"
    ] 
  },
  buttonLabel: { type: String, default: 'View Conference Schedule' },
  buttonHref: { type: String, default: 'https://arogya.namogange.org/' },
  button: { type: buttonSchema, default: () => ({}) },
  stat1Title: { type: String, default: '19 – 21' },
  stat1Sub: { type: String, default: 'FEBRUARY 2027' },
  stat2Title: { type: String, default: 'PRAGATI MAIDAN' },
  stat2Sub: { type: String, default: 'NEW DELHI' },
  stat3Title: { type: String, default: 'INSIGHTS. IDEAS.' },
  stat3Sub: { type: String, default: 'IMPACT.' },
  stat4Title: { type: String, default: '50+ GLOBAL' },
  stat4Sub: { type: String, default: 'SPEAKERS' },
  stat5Title: { type: String, default: '20+ KEY' },
  stat5Sub: { type: String, default: 'SESSIONS' },
  eventInfo: { 
    type: [eventInfoSchema], 
    default: [
      { icon: 'Calendar', title: '19 – 21', sub: 'FEBRUARY 2027' },
      { icon: 'MapPin', title: 'PRAGATI MAIDAN', sub: 'NEW DELHI' },
      { icon: 'Users', title: 'INSIGHTS. IDEAS.', sub: 'IMPACT.' },
      { icon: 'Mic', title: '50+ GLOBAL', sub: 'SPEAKERS' },
      { icon: 'BookOpen', title: '20+ KEY', sub: 'SESSIONS' }
    ] 
  },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: 'Conference and Seminars' }
}, { timestamps: true });

const ConferenceSeminars = mongoose.model("OrganicConferenceSeminars", conferenceSeminarsSchema);
export default ConferenceSeminars;


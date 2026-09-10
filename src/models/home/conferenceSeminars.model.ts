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
  sectionTag: { type: String, default: 'GLOBAL CONFERENCE & SEMINARS' },
  titleMain: { type: String, default: 'Where Knowledge Meets' },
  titleHighlight: { type: String, default: 'the Future of Organic' },
  description: { 
    type: String, 
    default: 'Join expert-led sessions, panel discussions & thought leadership talks on the latest trends shaping the future of organic, natural and sustainable living.' 
  },
  checklist: { 
    type: [String], 
    default: [
      "Expert-led panel discussions & keynotes",
      "Emerging trends in organic farming & retail",
      "Sustainable business & growth strategies"
    ] 
  },
  button: { type: buttonSchema, default: () => ({}) },
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

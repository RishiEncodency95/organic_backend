import mongoose, { Document, Schema } from "mongoose";

const paragraphSchema = new Schema({
  id: { type: Number },
  highlightStart: { type: String, default: '' },
  text: { type: String, default: '' },
  hasBorder: { type: Boolean, default: false }
});

const introductionSectionSchema = new Schema({
  bgColor: { type: String, default: '#ffffff' },
  subtitle: { type: String, default: 'INTRODUCTION' },
  title: {
    prefix: { type: String, default: 'WELCOME TO' },
    highlightMain: { type: String, default: 'BHARAT ORGANIC EXPO' },
    highlightYear: { type: String, default: '2027' },
    suffix: { type: String, default: "India's Premier Platform for Organic Products, Sustainable Agriculture & Natural Living" }
  },
  paragraphs: [paragraphSchema],
  button: {
    text: { type: String, default: 'Explore Exhibition' },
    link: { type: String, default: '/about' }
  },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: 'Bharat Organic Expo 2027 Introduction' }
}, { timestamps: true });

const IntroductionSection = mongoose.model("OrganicIntroductionSection", introductionSectionSchema);
export default IntroductionSection;

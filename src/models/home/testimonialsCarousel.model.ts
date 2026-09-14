import mongoose, { Document, Schema } from "mongoose";

const testimonialSchema = new Schema({
  company1: { type: String, default: '' },
  company2: { type: String, default: '' },
  location: { type: String, default: '' },
  quote: { type: String, default: '' },
  color: { type: String, default: '#1b5e20' },
  logoText: { type: String, default: '' },
  logo: { type: String, default: '' },
  status: { type: String, default: 'Published' },
  author: { type: String, default: 'Vansh Chaudhary' },
  addedOn: { type: String, default: '' },
  date: { type: String, default: '' }
}, { timestamps: true });

const videoSchema = new Schema({
  title: { type: String, default: '' },
  location: { type: String, default: '' },
  videoType: { type: String, default: 'youtube' }, // 'youtube' | 'instagram' | 'upload'
  videoUrl: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  showOverlay: { type: Boolean, default: true },
  overlayGradient: { type: String, default: 'linear-gradient(160deg, #4a5568, #1a202c)' },
  status: { type: String, default: 'Published' },
  author: { type: String, default: 'Vansh Chaudhary' },
  addedOn: { type: String, default: '' },
  date: { type: String, default: '' }
}, { timestamps: true });

const testimonialsCarouselSchema = new Schema({
  testimonials: {
    type: [testimonialSchema],
    default: []
  },
  videos: {
    type: [videoSchema],
    default: []
  }
}, { timestamps: true });

const TestimonialsCarousel = mongoose.model("OrganicTestimonialsCarousel", testimonialsCarouselSchema);
export default TestimonialsCarousel;

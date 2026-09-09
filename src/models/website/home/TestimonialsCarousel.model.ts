import mongoose, { Document, Schema } from "mongoose";

const testimonialSchema = new Schema({
  company1: { type: String, default: '' },
  company2: { type: String, default: '' },
  location: { type: String, default: '' },
  quote: { type: String, default: '' },
  color: { type: String, default: '' },
  logoText: { type: String, default: '' }
}); // Mongoose will automatically generate _id for each testimonial in the array

const testimonialsCarouselSchema = new Schema({
  testimonials: {
    type: [testimonialSchema],
    default: [
      {
        company1: "Achaspati Kulwant",
        company2: "Chancellor, University of Patanjali",
        location: "Haridwar",
        quote: "The change is organizing activities with a vision. I wish the project a great success. It's a wonderful initiative for sustainable future. We must all come together to ensure that our environment is protected and cherished by the coming generations, creating a harmonious balance.",
        color: "#1b5e20",
        logoText: "PATANJALI"
      },
      {
        company1: "Khyati Nayak",
        company2: "PRO – Gujarat Tourism",
        location: "Gujarat",
        quote: "This platform will open eyes of our new generations towards organic living. It provides a unique opportunity to learn from global experts. By adopting these sustainable methodologies, we can actively contribute to a greener ecosystem and promote healthier lifestyle choices.",
        color: "#d26019",
        logoText: "GUJARAT\nTOURISM"
      },
      {
        company1: "Mukesh Kumar",
        company2: "The Yogshala Head",
        location: "New Delhi",
        quote: "It made me realize the impact of holistic wellness in our daily decisions. Every small step taken today safeguards our natural resources. Whether it is choosing chemical-free products or supporting local farmers, these choices collectively lead to a monumental positive shift in society.",
        color: "#00643b",
        logoText: "YOGSHALA"
      },
      {
        company1: "Dr. Subramanian Swamy",
        company2: "Bharatiya Janata Party (BJP)",
        location: "New Delhi",
        quote: "The Yogshala Expo is a great step towards a healthier and self-reliant India. It beautifully bridges traditional wisdom with modern practices. The integration of Ayurveda into everyday life ensures that our citizens maintain not just physical strength but also mental and spiritual well-being.",
        color: "#23471d",
        logoText: "BJP\nINDIA"
      },
      {
        company1: "Qazhf Khan",
        company2: "Father of Kairana Model",
        location: "Kairana",
        quote: "The Yogshala Expo ensures honest and responsible contributions. The collective commitment shown here will build a robust organic market. We are witnessing an incredible movement where ethical farming and conscientious consumption are becoming the new standard for a thriving nation.",
        color: "#164429",
        logoText: "KAIRANA"
      }
    ]
  }
}, { timestamps: true });

const TestimonialsCarousel = mongoose.model("OrganicTestimonialsCarousel", testimonialsCarouselSchema);
export default TestimonialsCarousel;

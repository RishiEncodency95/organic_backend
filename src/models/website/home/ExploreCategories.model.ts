import mongoose, { Document, Schema } from "mongoose";

const exploreCategoriesSchema = new Schema({
  categoryname: { 
    type: String, 
    required: true 
  },
  logo: { 
    type: String, 
    default: '' 
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  },
  createdby: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  },
  updatedby: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  }
}, { timestamps: true });

const ExploreCategories = mongoose.model("OrganicExploreCategories", exploreCategoriesSchema);
export default ExploreCategories;

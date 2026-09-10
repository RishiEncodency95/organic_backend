import BlogExperts from "../../../../../models/blog/blogExperts.model";

export const getBlogExpertsService = async () => {
  let data = await BlogExperts.findOne();
  if (!data) {
    data = await BlogExperts.create({});
  }
  return data;
};

export const updateBlogExpertsService = async (payload: any) => {
  let data = await BlogExperts.findOne();
  if (!data) {
    data = await BlogExperts.create(payload);
  } else {
    data = await BlogExperts.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

import BlogFeatured from "../../../../../models/blog/blogFeatured.model";

export const getBlogFeaturedService = async () => {
  let data = await BlogFeatured.findOne();
  if (!data) {
    data = await BlogFeatured.create({});
  }
  return data;
};

export const updateBlogFeaturedService = async (payload: any) => {
  let data = await BlogFeatured.findOne();
  if (!data) {
    data = await BlogFeatured.create(payload);
  } else {
    data = await BlogFeatured.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

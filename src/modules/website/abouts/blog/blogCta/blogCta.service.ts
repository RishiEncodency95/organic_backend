import BlogCta from "../../../../../models/blog/blogCta.model";

export const getBlogCtaService = async () => {
  let data = await BlogCta.findOne();
  if (!data) {
    data = await BlogCta.create({});
  }
  return data;
};

export const updateBlogCtaService = async (payload: any) => {
  let data = await BlogCta.findOne();
  if (!data) {
    data = await BlogCta.create(payload);
  } else {
    data = await BlogCta.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

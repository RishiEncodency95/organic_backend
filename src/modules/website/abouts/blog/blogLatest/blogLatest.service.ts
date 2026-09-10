import BlogLatest from "../../../../../models/blog/blogLatest.model";

export const getBlogLatestService = async () => {
  let data = await BlogLatest.findOne();
  if (!data) {
    data = await BlogLatest.create({});
  }
  return data;
};

export const updateBlogLatestService = async (payload: any) => {
  let data = await BlogLatest.findOne();
  if (!data) {
    data = await BlogLatest.create(payload);
  } else {
    data = await BlogLatest.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

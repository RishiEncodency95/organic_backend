import BlogStats from "../../../../../models/blog/blogStats.model";

export const getBlogStatsService = async () => {
  let data = await BlogStats.findOne();
  if (!data) {
    data = await BlogStats.create({});
  }
  return data;
};

export const updateBlogStatsService = async (payload: any) => {
  let data = await BlogStats.findOne();
  if (!data) {
    data = await BlogStats.create(payload);
  } else {
    data = await BlogStats.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

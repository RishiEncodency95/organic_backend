import BlogVideos from "../../../../../models/blog/blogVideos.model";

export const getBlogVideosService = async () => {
  let data = await BlogVideos.findOne();
  if (!data) {
    data = await BlogVideos.create({});
  }
  return data;
};

export const updateBlogVideosService = async (payload: any) => {
  let data = await BlogVideos.findOne();
  if (!data) {
    data = await BlogVideos.create(payload);
  } else {
    data = await BlogVideos.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

import BlogSlugBottomBanner from "../../../../../models/blog_slug/blogSlugBottomBanner.model";

export const getBlogSlugBottomBannerService = async () => {
  let data = await BlogSlugBottomBanner.findOne();
  if (!data) {
    data = await BlogSlugBottomBanner.create({});
  }
  return data;
};

export const updateBlogSlugBottomBannerService = async (payload: any) => {
  let data = await BlogSlugBottomBanner.findOne();
  if (!data) {
    data = await BlogSlugBottomBanner.create(payload);
  } else {
    data = await BlogSlugBottomBanner.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

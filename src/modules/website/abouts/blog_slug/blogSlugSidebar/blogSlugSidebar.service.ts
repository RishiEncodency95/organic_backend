import BlogSlugSidebar from "../../../../../models/blog_slug/blogSlugSidebar.model";

export const getBlogSlugSidebarService = async () => {
  let data = await BlogSlugSidebar.findOne();
  if (!data) {
    data = await BlogSlugSidebar.create({});
  }
  return data;
};

export const updateBlogSlugSidebarService = async (payload: any) => {
  let data = await BlogSlugSidebar.findOne();
  if (!data) {
    data = await BlogSlugSidebar.create(payload);
  } else {
    data = await BlogSlugSidebar.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

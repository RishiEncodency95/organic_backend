import BlogSidebar from "../../../../../models/blog/blogSidebar.model";

export const getBlogSidebarService = async () => {
  let data = await BlogSidebar.findOne();
  if (!data) {
    data = await BlogSidebar.create({});
  }
  return data;
};

export const updateBlogSidebarService = async (payload: any) => {
  let data = await BlogSidebar.findOne();
  if (!data) {
    data = await BlogSidebar.create(payload);
  } else {
    data = await BlogSidebar.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

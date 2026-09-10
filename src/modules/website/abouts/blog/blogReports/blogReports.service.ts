import BlogReports from "../../../../../models/blog/blogReports.model";

export const getBlogReportsService = async () => {
  let data = await BlogReports.findOne();
  if (!data) {
    data = await BlogReports.create({});
  }
  return data;
};

export const updateBlogReportsService = async (payload: any) => {
  let data = await BlogReports.findOne();
  if (!data) {
    data = await BlogReports.create(payload);
  } else {
    data = await BlogReports.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

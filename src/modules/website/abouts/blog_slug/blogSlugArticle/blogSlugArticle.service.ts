import BlogSlugArticle from "../../../../../models/blog_slug/blogSlugArticle.model";

export const getBlogSlugArticleService = async () => {
  let data = await BlogSlugArticle.findOne();
  if (!data) {
    data = await BlogSlugArticle.create({});
  }
  return data;
};

export const updateBlogSlugArticleService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.image = `/uploads/organic_expo/${file.filename}`;
  }
  let data = await BlogSlugArticle.findOne();
  if (!data) {
    data = await BlogSlugArticle.create(updateData);
  } else {
    data = await BlogSlugArticle.findByIdAndUpdate(data._id, updateData, { new: true });
  }
  return data;
};

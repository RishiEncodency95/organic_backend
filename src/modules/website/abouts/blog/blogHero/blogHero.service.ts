import BlogHero from "../../../../../models/blog/blogHero.model";

export const getBlogHeroService = async () => {
  let data = await BlogHero.findOne();
  if (!data) {
    data = await BlogHero.create({});
  }
  return data;
};

export const updateBlogHeroService = async (payload: any, files?: any) => {
  const updateData = { ...payload };

  if (files) {
    if (files.image && files.image[0]) {
      updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
    }
    if (files.secondaryImage && files.secondaryImage[0]) {
      updateData.secondaryImage = `/uploads/organic_expo/${files.secondaryImage[0].filename}`;
    }
  }

  let data = await BlogHero.findOne();
  if (!data) {
    data = await BlogHero.create(updateData);
  } else {
    data = await BlogHero.findByIdAndUpdate(data._id, updateData, { new: true });
  }
  return data;
};

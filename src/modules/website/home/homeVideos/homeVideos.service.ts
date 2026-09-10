import HomeVideos from "../../../../models/home/homeVideos.model";

export const getHomeVideosService = async () => {
  let data = await HomeVideos.findOne();
  if (!data) {
    data = await HomeVideos.create({});
  }
  return data;
};

export const updateHomeVideosService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.videos === "string") {
    try {
      updateData.videos = JSON.parse(updateData.videos);
    } catch {
      // keep as is
    }
  }

  if (files && Array.isArray(files)) {
    files.forEach((file: any) => {
      const match = file.fieldname.match(/^video_thumbnail_(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (updateData.videos && updateData.videos[index]) {
          updateData.videos[index].thumbnail = `/uploads/organic_expo/${file.filename}`;
        }
      }
    });
  }

  const data = await HomeVideos.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

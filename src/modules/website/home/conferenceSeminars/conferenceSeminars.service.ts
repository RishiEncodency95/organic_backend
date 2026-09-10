import ConferenceSeminars from "../../../../models/home/conferenceSeminars.model";

export const getConferenceSeminarsService = async () => {
  let data = await ConferenceSeminars.findOne();
  if (!data) {
    data = await ConferenceSeminars.create({});
  }
  return data;
};

export const updateConferenceSeminarsService = async (payload: any, files?: any) => {
  let updateData = { ...payload };

  if (typeof updateData.checklist === "string") {
    try {
      updateData.checklist = JSON.parse(updateData.checklist);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.button === "string") {
    try {
      updateData.button = JSON.parse(updateData.button);
    } catch {
      // keep as is
    }
  }
  if (typeof updateData.eventInfo === "string") {
    try {
      updateData.eventInfo = JSON.parse(updateData.eventInfo);
    } catch {
      // keep as is
    }
  }

  if (files && files.image && files.image[0]) {
    updateData.image = `/uploads/organic_expo/${files.image[0].filename}`;
  }

  const data = await ConferenceSeminars.findOneAndUpdate({}, updateData, {
    new: true,
    upsert: true,
  });
  return data;
};

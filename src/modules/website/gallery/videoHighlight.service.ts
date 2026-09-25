import VideoHighlight from "../../../models/gallery/videoHighlight.model";

export const getVideoHighlights = async () => {
  // Highest order = most recently added = shown first, in both the admin table and the
  // live "Video Highlights" marquee — same convention as gallery photos.
  return VideoHighlight.find().sort({ order: -1, createdAt: -1 });
};

export const createVideoHighlight = async (data: any) => {
  const requestedOrder = data.order === undefined || data.order === null || data.order === "" ? NaN : Number(data.order);
  if (Number.isFinite(requestedOrder)) {
    data.order = requestedOrder;
  } else {
    const highest = await VideoHighlight.findOne().sort({ order: -1 });
    data.order = highest && typeof highest.order === "number" ? highest.order + 1 : 1;
  }
  if (!data.title || data.title.trim() === "") {
    data.title = data.category || "Video Highlight";
  }
  const item = new VideoHighlight(data);
  return item.save();
};

export const updateVideoHighlight = async (id: string, data: any) => {
  if (!data.title || data.title.trim() === "") {
    data.title = data.category || "Video Highlight";
  }
  return VideoHighlight.findByIdAndUpdate(id, { $set: data }, { new: true });
};

export const updateVideoHighlightStatus = async (id: string, status: "Published" | "Draft") => {
  return VideoHighlight.findByIdAndUpdate(id, { $set: { status } }, { new: true });
};

export const deleteVideoHighlight = async (id: string) => {
  return VideoHighlight.findByIdAndDelete(id);
};

export const bulkDeleteVideoHighlights = async (ids: string[]) => {
  const result = await VideoHighlight.deleteMany({ _id: { $in: ids } });
  return result.deletedCount ?? 0;
};

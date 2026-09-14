import AwardsNomination from "../../../../models/awards/awardsNomination.model";

export const createNominationService = async (payload: any, files?: any) => {
  const nominationData = { ...payload };

  if (files) {
    if (files.deckFile && files.deckFile[0]) {
      nominationData.deckFile = `/uploads/organic_expo/${files.deckFile[0].filename}`;
      nominationData.deckFileName = nominationData.deckFileName || files.deckFile[0].originalname;
    }
    if (files.certFile && files.certFile[0]) {
      nominationData.certFile = `/uploads/organic_expo/${files.certFile[0].filename}`;
      nominationData.certFileName = nominationData.certFileName || files.certFile[0].originalname;
    }
    if (files.mediaFile && files.mediaFile[0]) {
      nominationData.mediaFile = `/uploads/organic_expo/${files.mediaFile[0].filename}`;
      nominationData.mediaFileName = nominationData.mediaFileName || files.mediaFile[0].originalname;
    }
  }

  if (typeof nominationData.declaration === "string") {
    nominationData.declaration = nominationData.declaration === "true";
  }

  const nomination = await AwardsNomination.create(nominationData);
  return nomination;
};

export const getAllNominationsService = async (query: any = {}) => {
  const { page = 1, limit = 10, search = "", category = "", status = "" } = query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { orgName: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }
  if (category) {
    filter.awardCategory = category;
  }
  if (status) {
    filter.status = status;
  }

  const [nominations, total] = await Promise.all([
    AwardsNomination.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    AwardsNomination.countDocuments(filter),
  ]);

  return {
    nominations,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

export const getNominationByIdService = async (id: string) => {
  const nomination = await AwardsNomination.findById(id);
  return nomination;
};

export const updateNominationService = async (id: string, payload: any) => {
  const nomination = await AwardsNomination.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return nomination;
};

export const deleteNominationService = async (id: string) => {
  const nomination = await AwardsNomination.findByIdAndDelete(id);
  return nomination;
};

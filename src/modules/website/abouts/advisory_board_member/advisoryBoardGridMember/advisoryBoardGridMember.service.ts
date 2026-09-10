import AdvisoryBoardGridMember from "../../../../../models/advisory_board_member/advisoryBoardGridMember.model";
import { ApiError } from "../../../../../utils/ApiError";

export const createAdvisoryBoardGridMemberService = async (payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.image = `/uploads/organic_expo/${file.filename}`;
  }
  return await AdvisoryBoardGridMember.create(updateData);
};

export const getAllAdvisoryBoardGridMembersService = async () => {
  return await AdvisoryBoardGridMember.find().sort({ createdAt: -1 });
};

export const getAdvisoryBoardGridMemberByIdService = async (id: string) => {
  const data = await AdvisoryBoardGridMember.findById(id);
  if (!data) throw ApiError.notFound("Advisory Board Member not found");
  return data;
};

export const updateAdvisoryBoardGridMemberByIdService = async (id: string, payload: any, file?: Express.Multer.File) => {
  const updateData = { ...payload };
  if (file) {
    updateData.image = `/uploads/organic_expo/${file.filename}`;
  }
  const data = await AdvisoryBoardGridMember.findByIdAndUpdate(id, updateData, { new: true });
  if (!data) throw ApiError.notFound("Advisory Board Member not found");
  return data;
};

export const deleteAdvisoryBoardGridMemberByIdService = async (id: string) => {
  const data = await AdvisoryBoardGridMember.findByIdAndDelete(id);
  if (!data) throw ApiError.notFound("Advisory Board Member not found");
  return data;
};

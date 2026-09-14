import ContactEnquiry from "../../../models/contact/contactEnquiry.model";

export const createContactEnquiryService = async (payload: any) => {
  const enquiryData = {
    ...payload,
    subject: payload.subject || payload.service || "",
    service: payload.service || payload.subject || "",
  };

  const enquiry = await ContactEnquiry.create(enquiryData);
  return enquiry;
};

export const getAllContactEnquiriesService = async (query: any = {}) => {
  const { page = 1, limit = 10, search = "", status = "" } = query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
    ];
  }
  if (status) {
    filter.status = status;
  }

  const [enquiries, total] = await Promise.all([
    ContactEnquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    ContactEnquiry.countDocuments(filter),
  ]);

  return {
    enquiries,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

export const getContactEnquiryByIdService = async (id: string) => {
  const enquiry = await ContactEnquiry.findById(id);
  return enquiry;
};

export const updateContactEnquiryService = async (id: string, payload: any) => {
  const enquiry = await ContactEnquiry.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return enquiry;
};

export const deleteContactEnquiryService = async (id: string) => {
  const enquiry = await ContactEnquiry.findByIdAndDelete(id);
  return enquiry;
};

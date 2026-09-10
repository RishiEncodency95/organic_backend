import NominateBanner from "../../../../../models/advisory_board_member/nominateBanner.model";

export const getNominateBannerService = async () => {
  let data = await NominateBanner.findOne();
  if (!data) {
    data = await NominateBanner.create({});
  }
  return data;
};

export const updateNominateBannerService = async (payload: any) => {
  let data = await NominateBanner.findOne();
  if (!data) {
    data = await NominateBanner.create(payload);
  } else {
    data = await NominateBanner.findByIdAndUpdate(data._id, payload, { new: true });
  }
  return data;
};

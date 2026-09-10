import { Router } from "express";
import { getAboutVenue, updateAboutVenue } from "./aboutVenue.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("aboutvenue");

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "secondaryImage", maxCount: 1 },
]);

router.get("/", getAboutVenue);
router.put("/", uploadFields, updateAboutVenue);
router.post("/", uploadFields, updateAboutVenue);

export default router;

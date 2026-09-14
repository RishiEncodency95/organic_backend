import { Router } from "express";
import {
  submitNomination,
  getAllNominations,
  getNominationById,
  updateNomination,
  deleteNomination,
} from "./awardsNomination.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("nomination");

const nominationUploads = upload.fields([
  { name: "deckFile", maxCount: 1 },
  { name: "certFile", maxCount: 1 },
  { name: "mediaFile", maxCount: 1 },
]);

router.post("/", nominationUploads, submitNomination);
router.get("/", getAllNominations);
router.get("/:id", getNominationById);
router.put("/:id", nominationUploads, updateNomination);
router.delete("/:id", deleteNomination);

export default router;

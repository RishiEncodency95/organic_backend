import { Router } from "express";
import { getMsmeDocuments, updateMsmeDocuments } from "./msmeDocuments.controller";

const router = Router();

router.get("/", getMsmeDocuments);
router.put("/", updateMsmeDocuments);
router.post("/", updateMsmeDocuments);

export default router;

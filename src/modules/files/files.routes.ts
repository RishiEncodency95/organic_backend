import { Router } from "express";
import { streamPdf } from "./files.controller";

const router = Router();

router.get("/pdf", streamPdf);

export default router;

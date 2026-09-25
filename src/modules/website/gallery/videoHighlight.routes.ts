import { Router } from "express";
import * as videoHighlightController from "./videoHighlight.controller";

const router = Router();

router.get("/items", videoHighlightController.getItems);
router.post("/items", videoHighlightController.createItem);
router.post("/items/bulk-delete", videoHighlightController.bulkDeleteItems);
router.put("/items/:id", videoHighlightController.updateItem);
router.patch("/items/:id/status", videoHighlightController.updateStatus);
router.delete("/items/:id", videoHighlightController.deleteItem);

export default router;

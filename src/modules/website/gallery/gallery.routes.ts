import { Router } from "express";
import * as galleryController from "./gallery.controller";
import galleryHeroRouter from "./galleryHero/galleryHero.routes";
import galleryCountersRouter from "./galleryCounters/galleryCounters.routes";

const router = Router();

// Gallery Hero Section
router.use("/hero", galleryHeroRouter);

// Gallery Counters Section
router.use("/counters", galleryCountersRouter);

// Metadata: Categories and Years
router.get("/meta", galleryController.getMeta);
router.post("/meta", galleryController.saveMeta);

// Gallery Items
router.get("/items", galleryController.getItems);
router.post("/items", galleryController.createItem);
router.put("/items/:id", galleryController.updateItem);
router.patch("/items/:id/status", galleryController.updateStatus);
router.delete("/items/:id", galleryController.deleteItem);

export default router;

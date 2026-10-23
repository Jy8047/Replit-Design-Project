import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createCvExtractionRouter } from "./cv-extraction";

const router: IRouter = Router();

router.use(healthRouter);
router.use(createCvExtractionRouter());

export default router;

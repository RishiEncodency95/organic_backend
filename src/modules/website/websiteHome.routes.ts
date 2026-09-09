import { Router } from 'express';
import homeRouter from './home/home.routes';

const router = Router();

// Mount website section routers
router.use('/home', homeRouter);

export default router;

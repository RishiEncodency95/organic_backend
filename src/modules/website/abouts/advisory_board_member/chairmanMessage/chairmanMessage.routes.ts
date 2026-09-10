import express from 'express';
import {
    createChairmanMessage,
    getChairmanMessages,
    getChairmanMessageById,
    updateChairmanMessage,
    deleteChairmanMessage
} from './chairmanMessage.controller';

const router = express.Router();

router.post('/', createChairmanMessage);
router.get('/', getChairmanMessages);
router.get('/:id', getChairmanMessageById);
router.put('/:id', updateChairmanMessage);
router.delete('/:id', deleteChairmanMessage);

export default router;

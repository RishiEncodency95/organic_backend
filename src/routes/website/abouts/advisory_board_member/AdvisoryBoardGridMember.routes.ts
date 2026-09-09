import express from 'express';
import {
    createAdvisoryBoardGridMember,
    getAdvisoryBoardGridMembers,
    getAdvisoryBoardGridMemberById,
    updateAdvisoryBoardGridMember,
    deleteAdvisoryBoardGridMember
} from '../../../../controllers/website/abouts/advisory_board_member/AdvisoryBoardGridMemberController';

const router = express.Router();

router.post('/', createAdvisoryBoardGridMember);
router.get('/', getAdvisoryBoardGridMembers);
router.get('/:id', getAdvisoryBoardGridMemberById);
router.put('/:id', updateAdvisoryBoardGridMember);
router.delete('/:id', deleteAdvisoryBoardGridMember);

export default router;

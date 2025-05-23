import express from 'express'
import { approveBook, getAllPendingBooks, signupAdmin } from '../Controller/admin.controller.js';
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router()

router.post("/signup",upload.single("profilePic"),signupAdmin);
router.get("/pending-books", getAllPendingBooks);
router.post("/approve-book", approveBook);

export default router;
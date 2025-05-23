import express from "express";
import {createBook, getBook, getBookById, getUserBoughtBooks} from "../Controller/book.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { isAdminAuthenticated, isAuthenticated } from "../middlewares/auth.middleware.js";

const router= express.Router();

router.get("/",getBook);


router.post(        //admin-route
    "/create-book",
    isAdminAuthenticated,
    upload.fields([{ name: "image", maxCount: 1 }, { name: "file", maxCount: 1 }]),
    createBook
);
router.get("/user-books",isAuthenticated, getUserBoughtBooks);   //user route
router.get("/:id", getBookById);



export default router;
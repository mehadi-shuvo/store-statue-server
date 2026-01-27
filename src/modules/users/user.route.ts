import { Router } from "express";
import { userController } from "./user.controller";

const router = Router();

router.post("/register", userController.createUser);
router.post("/login", userController.login);
router.post("/forgot-password", userController.forgotPassword);
router.get("/", userController.getUsers);

export const userRouter = router;

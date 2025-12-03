const express = require("express");
const  router = express.Router();
const {librarianController} = require("../controller/librarian")

const {userAuth} = require("../middlewares/userAuth");
const {checkRole} = require("../middlewares/checkRole");

router.get("/bookissued",userAuth,checkRole(["admin", "librarian"]),librarianController.bookIssued)
router.get("/issuerequest",userAuth,checkRole("librarian"),librarianController.issueRequest)
router.get("/returnrequest",userAuth,checkRole("librarian"),librarianController.returnRequest)
router.put("/approverequest/:id",userAuth,checkRole("librarian"),librarianController.approveRequest)
// routes/librarian.js
router.put(
  "/approvereturnrequest/:id",
  userAuth,
  checkRole(["librarian", "admin"]),
  librarianController.approveReturnRequest
);




module.exports = router
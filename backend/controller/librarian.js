const { UserModel } = require("../model/UserModel");
const bcrypt = require("bcryptjs");
const JWT_SECRET = "12345@abcd12";
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { BorrowModel } = require("../model/BorrowModel");
const { BookModel } = require("../model/BookModel");
const calculateFine = require("../utils/fineCalculator");
const { clearCache } = require("../utils/cache");
const librarianController = {};

librarianController.bookIssued = async (req, res) => {
  try {
    const requests = await BorrowModel.find({ status: "Issued" })
      .populate("userId", "name email")
      .populate("bookId", "title")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ message: "Requested books fetched successfully", requests });
  } catch (err) {
    console.error("Error fetching requests", err);
    res.status(500).json({ error: "Server error" });
  }
};

librarianController.issueRequest = async (req, res) => {
  try {
    const requests = await BorrowModel.find({ status: "Requested" })
      .populate("userId", "name email")
      .populate("bookId", "title")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ message: "Requested books fetched successfully", requests });
  } catch (err) {
    console.error("Error fetching requests", err);
    res.status(500).json({ error: "Server error" });
  }
};

librarianController.approveRequest = async (req, res) => {
  const requestId = req.params.id;

  try {
    // 1) Load borrow
    const borrowRequest = await BorrowModel.findById(requestId);
    if (!borrowRequest) {
      return res.status(404).json({ error: "Borrow request not found" });
    }

    // Only approve if it's actually a "Requested"
    if (borrowRequest.status !== "Requested") {
      return res.status(400).json({ error: `Cannot approve request in status "${borrowRequest.status}"` });
    }

    // 2) Check user's issued count
    const issuedCount = await BorrowModel.countDocuments({
      userId: borrowRequest.userId,
      status: "Issued",
    });
    if (issuedCount >= 4) {
      return res.status(400).json({ error: "User already has 4 issued books" });
    }

    // 3) Load book
    const book = await BookModel.findById(borrowRequest.bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Normalize availableCopies if missing/invalid
    let available = Number.isFinite(book.availableCopies)
      ? Number(book.availableCopies)
      : Number(book.totalCopies ?? 0);

    if (!Number.isFinite(available)) available = 0;

    if (available < 1) {
      return res.status(400).json({ error: "No copies available" });
    }

    // 4) Approve the borrow
    borrowRequest.status = "Issued";
    borrowRequest.issueDate = new Date();
    // standard: 15 days loan
    borrowRequest.dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    borrowRequest.approvedBy = req.userInfo?.id;

    // Save borrow first (so we know it's valid)
    await borrowRequest.save();

    // 5) Atomically decrement availableCopies to avoid NaN races
    await BookModel.updateOne(
      { _id: book._id, availableCopies: { $gte: 1 } },
      { $inc: { availableCopies: -1 } }
    );

    clearCache("homeData");
    return res.status(200).json({ message: "Book issued successfully", borrow: borrowRequest });
  } catch (err) {
    console.error("Error approving request:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};


librarianController.returnRequest = async (req, res) => {
  try {
    const requests = await BorrowModel.find({ status: "Requested Return" })
      .populate("userId", "name email")
      .populate("bookId", "title")
      .sort({ createdAt: -1 });

    const requestsWithFine = requests.map((req) => {
      const fine = calculateFine(req.dueDate, req.returnDate);
      return { ...req.toObject(), fine };
    });

    res.status(200).json({
      message: "Requested books fetched successfully",
      requests: requestsWithFine,
    });
  } catch (err) {
    console.error("Error fetching requests", err);
    res.status(500).json({ error: "Server error" });
  }
};


librarianController.approveReturnRequest = async (req, res) => {
  try {
    const borrowId = req.params.id;

    // 1) guard invalid ids
    if (!mongoose.Types.ObjectId.isValid(borrowId)) {
      return res.status(400).json({ message: "Invalid borrow id" });
    }

    // 2) must exist and be 'Requested Return'
    const borrow = await BorrowModel.findById(borrowId);
    if (!borrow) {
      return res.status(404).json({ message: "Borrow record not found" });
    }
    if (borrow.status !== "Requested Return") {
      return res
        .status(400)
        .json({ message: "Book return not requested or already processed" });
    }

    // 3) book must exist
    const book = await BookModel.findById(borrow.bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found for this borrow" });
    }

    // 4) safely bump availableCopies (never exceed totalCopies)
    const total = Number.isFinite(book.totalCopies) ? book.totalCopies : 0;
    const avail = Number.isFinite(book.availableCopies) ? book.availableCopies : 0;
    if (avail < total) {
      book.availableCopies = avail + 1;
      await book.save();
    }
    // if avail >= total: keep it at cap and proceed (idempotent)

    // 5) finalize borrow
    borrow.status = "Returned";
    borrow.returnDate = new Date();
    if (req.userInfo?.id) borrow.approvedBy = req.userInfo.id;
    await borrow.save();

    // 6) never let cache clear crash the request
    try {
      if (typeof clearCache === "function") {
        await Promise.resolve(clearCache("homeData"));
      }
    } catch (e) {
      console.warn("clearCache failed (ignored):", e?.message || e);
    }

    return res.status(200).json({ message: "Book return approved successfully" });
  } catch (err) {
    console.error("approveReturnRequest ERROR:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
module.exports = { librarianController };

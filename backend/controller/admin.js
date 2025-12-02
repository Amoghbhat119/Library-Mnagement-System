// backend/controller/admin.js
const { UserModel } = require("../model/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const adminController = {};

adminController.addLibrarian = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // normalize email once
    const normEmail = String(email || "").trim().toLowerCase();

    const existingUser = await UserModel.findOne({ email: normEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(String(password || ""), 10);

    const user = new UserModel({
      name,
      email: normEmail,
      password: hashedPassword,
      role, // expect "librarian" (or "admin" if you're seeding)
    });

    await user.save();
    res.status(201).json({ message: "Librarian Added Successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

adminController.login = async (req, res) => {
  try {
    // normalize inputs (trim + lowercase email)
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // OPTIONAL: support ENV admin as a fallback (handy for localhost)
    const envEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const envPass = (process.env.ADMIN_PASSWORD || "").trim();
    if (envEmail && envPass && email === envEmail && password === envPass) {
      const token = jwt.sign(
        { email, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      return res.json({
        message: "Login successful",
        token,
        user: { name: "Env Admin", email, role: "admin" },
      });
    }

    // DB lookup (case-insensitive email match)
    const user = await UserModel.findOne({
      email: { $regex: `^${email}$`, $options: "i" },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!["admin", "librarian"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const payload = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });

    return res.json({
      message: "Login successful",
      token,
      user: { name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { adminController };

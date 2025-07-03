const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cors = require("cors");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const Crop = require("./models/Crop");
const Order = require("./models/Order");
const fs = require("fs");

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directory if it doesn’t exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Routes
app.get("/", (req, res) => {
  res.send("🌱 Welcome to AgroConnect API");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// Register Route
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Forgot Password Route
app.post("/api/forgot-password", async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Crop Posting Route
app.post("/api/crops", upload.single("image"), async (req, res) => {
  const { title, description, price } = req.body;
  const image = req.file;

  try {
    const crop = new Crop({
      title,
      description,
      price,
      image: image ? `/uploads/${image.filename}` : null,
    });

    await crop.save();
    res.status(201).json({ message: "Crop posted successfully", crop });
  } catch (error) {
    console.error("Crop post error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get All Crops
app.get("/api/crops", async (req, res) => {
  try {
    const crops = await Crop.find().sort({ createdAt: -1 });
    res.json(crops);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "Failed to fetch crops" });
  }
});

// Delete Crop by ID
app.delete("/api/crops/:id", async (req, res) => {
  try {
    const crop = await Crop.findByIdAndDelete(req.params.id);
    if (!crop) {
      return res.status(404).json({ message: "Crop not found" });
    }

    const imagePath = path.join(__dirname, crop.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    res.json({ message: "Crop deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Failed to delete crop" });
  }
});

// Place an Order
app.post("/api/orders", async (req, res) => {
  const { userId, cropId, quantity } = req.body;

  try {
    const newOrder = new Order({ userId, cropId, quantity });
    await newOrder.save();
    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    console.error("Order placement error:", error);
    res.status(500).json({ message: "Failed to place order" });
  }
});

// ✅ Get Orders for a User
app.get("/api/orders/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).populate("cropId");
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

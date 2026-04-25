const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        console.log("Register request body:", req.body);

        // Check if user exists by email or username
        let user = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (user) {
            if (user.email === email) {
                return res.status(400).json({ msg: "Email already exists" });
            }
        }

        // Create new user (default role is 'user' if not specified)
        user = new User({ 
            username, 
            email, 
            password,
            role: role || 'user' // Allow role specification, default to 'user'
        });
        
        await user.save();

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: "7d" }
        );
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                email: user.email,
                role: user.role 
            } 
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).send("Server error");
    }
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log("Login request body:", req.body);

        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid credentials" });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: "7d" }
        );
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                email: user.email,
                role: user.role 
            } 
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).send("Server error");
    }
});

// Get current user
router.get("/me", async (req, res) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            return res.status(401).json({ msg: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        res.json({ user });
    } catch (err) {
        console.error("Get user error:", err);
        res.status(401).json({ msg: "Invalid token" });
    }
});

module.exports = router;
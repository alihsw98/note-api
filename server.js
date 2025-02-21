const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 8000;
const SECRET_KEY = "aopfjdasojfasdojf"; // Change this in production

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/noteapp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// User Schema
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
});
const User = mongoose.model("User", UserSchema);

// Note Schema
const NoteSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    title: String,
    content: String,
    createdAt: { type: Date, default: Date.now },
});
const Note = mongoose.model("Note", NoteSchema);

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
    const authHeader = req.header("Authorization");
    console.log("Auth Header Received:", authHeader); // Debugging  

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized - No or Invalid Token Format" });
    }

    const token = authHeader.split(" ")[1]; // Extract token  
    console.log("Extracted Token:", token); // Debugging  

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log("Decoded Token:", decoded); // Debugging  

        req.user = decoded;
        next();
    } catch (err) {
        console.log("Token verification failed:", err.message); // Debugging  
        res.status(401).json({ message: "Invalid token" });
    }
};

// Authentication Endpoints
app.post("/signup", async (req, res) => {
    console.log(req.body); // Log the body to check the incoming data
    const { name, email, password } = req.body;

    // Ensure the password is passed correctly
    if (!password) {
        return res.status(400).json({ message: "Password is required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const newUser = await User.create({ name, email, password: hashedPassword });
        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        res.status(400).json({ message: "Email already exists" });
    }
});


app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "7d" });
    res.json({ token, userId: user._id, name: user.name, email: user.email });
});

// Profile Endpoint
app.get("/getProfile", authMiddleware, async (req, res) => {
    const user = await User.findById(req.user.userId).select("-password").lean();
    user.id = user._id.toString();  // Replace _id with id
    delete user._id;  // Remove _id
    res.json(user);
});

// CRUD for Notes
app.get("/getNotes", authMiddleware, async (req, res) => {
    const notes = await Note.find({ userId: req.user.userId }).lean();
    notes.forEach(note => note.id = note._id.toString());  // Replace _id with id
    notes.forEach(note => delete note._id);  // Remove _id
    res.json(notes);
});

app.get("/getNote/:id", authMiddleware, async (req, res) => {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.userId }).lean();
    if (!note) return res.status(404).json({ message: "Note not found" });
    note.id = note._id.toString();  // Replace _id with id
    delete note._id;  // Remove _id
    res.json(note);
});

app.post("/addNote", authMiddleware, async (req, res) => {
    const { title, content } = req.body;

    const newNote = await Note.create({
        userId: req.user.userId,
        title,
        content,
    }).lean();

    newNote.id = newNote._id.toString();  // Replace _id with id
    delete newNote._id;  // Remove _id
    res.status(201).json(newNote);
});

app.put("/updateNote/:id", authMiddleware, async (req, res) => {
    const { title, content } = req.body;

    const updatedNote = await Note.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.userId },
        { title, content },
        { new: true }
    ).lean();

    if (!updatedNote) return res.status(404).json({ message: "Note not found" });
    updatedNote.id = updatedNote._id.toString();  // Replace _id with id
    delete updatedNote._id;  // Remove _id
    res.json(updatedNote);
});

app.delete("/deleteNote/:id", authMiddleware, async (req, res) => {
    const deletedNote = await Note.findOneAndDelete({
        _id: req.params.id,
        userId: req.user.userId,
    }).lean();

    if (!deletedNote) return res.status(404).json({ message: "Note not found" });
    deletedNote.id = deletedNote._id.toString();  // Replace _id with id
    delete deletedNote._id;  // Remove _id
    res.json({ message: "Note deleted successfully", note: deletedNote });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

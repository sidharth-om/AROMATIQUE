const express = require("express")
const app = express()
const session = require("express-session")
const mongoose = require("mongoose")
const connectDB = require("./config/db/connectDB")
const path = require("path")
const userRoute = require("./routes/userRoute")
const adminRoute = require("./routes/adminRoute")
const passport = require("passport")
const multer = require("multer")
const flash = require('connect-flash');
require("dotenv").config()
require("./config/passport")

app.use(session({
    secret: process.env.SESSION_SECRET || "my-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
    }
}))

app.use(flash());

app.use(passport.initialize())
app.use(passport.session())

app.use(express.json())
app.use(express.urlencoded({extended: true}))

// Add cache control middleware to prevent browser back button issues
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

connectDB()

app.set("views", path.join(__dirname, "views"))
app.set("view engine", "ejs")

app.use(express.static("public"))

app.use((req, res, next) => {
    res.locals.user = req.session.user || null
    next()
})

app.use("/user", userRoute)
app.use("/admin", adminRoute)

app.listen(process.env.PORT, () => console.log("server running"))
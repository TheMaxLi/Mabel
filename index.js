const express = require("express");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const app = express();

const port = 3000;
const path = require("path");
const bcrypt = require("bcrypt");
const multer = require("multer");

const db = require("./db-pass");

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "views")));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  cookieSession({
    name: "session",
    keys: ["put_a_key_here_i_guess"],
  })
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Files will be saved in the 'photos' directory. Make sure it exists.
    cb(null, path.join(__dirname, "photos"));
  },
  filename: function (req, file, cb) {
    // Naming the file - you can include logic here to ensure filenames are unique
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Initialize multer with the storage configuration
const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/style.css", (req, res) => {
  res.sendFile("style.css");
});

app.get("/view/:category", (req, res) => {
  console.log("Going to", req.params.category);
  res.render("index", { info: req });
});

app.get("/view/:category/img", (req, res) => {
  console.log("sending file");
  const filePath = path.join(__dirname, "photos", req.params.category);

  res.sendFile(filePath);
});

app.post("/view/:category", upload.single("photo"), async (req, res) => {
  const category = req.params.category;
  const uploadDir = path.join(__dirname, "photos");

  res.redirect(`/view/${req.params.category}`);
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const user = await db.users.get_byUsername(username);

  if (user) {
    if (await bcrypt.compare(password, user.password_hash)) {
      req.session.user = req.body.username;
    }
  }
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`now listening on port ${port}`);
});

const express = require("express");
const path = require("path");
const app = express();

const port = 3000;

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "views")));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/style.css", (req, res) => {
  res.sendFile("style.css");
});

app.listen(port, () => {
  console.log(`now listening on port ${port}`);
});

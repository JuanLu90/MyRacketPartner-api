const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");

const indexRouter = require("./routes/index");
const apiAuth = require("./routes/api/apiAuth");
const apiMatches = require("./routes/api/apiMatches");
const apiUsers = require("./routes/api/apiUsers");

const app = express();

app.use(helmet());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../client/build")));

// Define routes
app.use("/", indexRouter);
app.use("/api/auth", apiAuth);
app.use("/api/matches", apiMatches);
app.use("/api/users", apiUsers);

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../client/build", "index.html"));
// });

// Set the port
const port = process.env.PORT || 8000;

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;

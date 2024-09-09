const express = require("express");
const router = express.Router();
const dbConn = require("../../config/db");
const { checkJwt } = require("../../middleware/checkJwt");

const formatDateForDB = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null; // Maneja el caso en que la fecha es inválida
  }

  // Ajustar la fecha para la zona horaria local
  const offset = date.getTimezoneOffset() * 60000; // Offset en milisegundos
  const localDate = new Date(date.getTime() - offset);

  // Devuelve la fecha en formato YYYY-MM-DD
  return localDate.toISOString().split("T")[0];
};
/* GET users listing. */
router.get("/userProfile/:userID", async function (req, res, next) {
  try {
    const userID = req.params.userID;

    const [rows] = await dbConn.promise().query(
      `SELECT email, firstName, lastName, createDate, gender, birthdate, 
        userName, profileImage, dominantHand, backhand, height, weight, country
        FROM users WHERE userID = ?`,
      [userID]
    );
    res.send(rows);
  } catch (err) {
    res.status(400).send({ e: err.errno });
  }
});

router.put(
  "/currentUserProfile/editUserProfile",
  checkJwt,
  async (req, res) => {
    const data = req.body;
    const id = req.token.payload.id;

    if (!data.firstName)
      return res.status(400).send("Please enter your first name");
    else if (data.firstName.length < 3 || data.firstName.length > 16)
      return res
        .status(400)
        .send("First name must be between 3 and 16 characters");

    if (!data.lastName) res.status(400).send("Please enter your last name");
    else if (data.lastName.length < 6 || data.lastName.length > 30)
      return res
        .status(400)
        .send("Last name must be between 6 and 30 characters");

    if ((data.height && data.height < 50) || data.height > 250)
      return res.status(400).send("Between 50 and 250 centimeters");

    if ((data.weight && data.weight < 2) || data.weight > 300)
      return res.status(400).send("Between 2 and 300 kilograms");

    if (!data.backhand)
      return res.status(400).send("Please enter your backhand");
    else if (
      data.backhand !== "ONE" &&
      data.backhand !== "TWO" &&
      data.backhand !== "NONE"
    )
      return res.status(400).send("Please enter a valid backhand");

    if (!data.dominantHand)
      return res.status(400).send("Please enter your dominantHand");
    else if (
      data.dominantHand !== "RIGHT" &&
      data.dominantHand !== "LEFT" &&
      data.dominantHand !== "BOTH"
    )
      return res.status(400).send("Please enter a valid dominant hand");

    let sql = "UPDATE users SET ";
    let values = [];

    for (let key in data) {
      if (key === "birthdate" && data[key]) {
        data[key] = formatDateForDB(data[key]);
      }

      sql += `${key} = ?, `;
      values.push(data[key]);
    }

    sql = sql.slice(0, -2);
    sql += " WHERE userID = ?";
    values.push(id);

    try {
      await dbConn.promise().execute(sql, values);
      res.send({
        type: "SUCCESS",
        message: "Updated successfully",
        data: data,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.post("/sendSuggestions", checkJwt, async function (req, res, next) {
  try {
    const userID = req.token.payload.id;
    const data = req.body;
    if (data.suggestions.length > 3000) {
      return res.status(400).send("Suggestions max length 3000 characters");
    }
    await dbConn.promise().execute(
      `INSERT INTO suggestions (suggestion, shareSuggestion, creationDate, userID)
         VALUES (?, ?, NOW(), ?)`,
      [data.suggestions, data.shareSuggestion, userID]
    );
    res.send("Thanks for your suggestion!");
  } catch (err) {
    res.status(400).send({ e: err.errno });
  }
});

router.get("/usersSearch/:username", async function (req, res) {
  const username = req.params.username;

  try {
    const [rows] = await dbConn
      .promise()
      .execute(
        "SELECT userID, email, userName, firstName, lastName, profileImage FROM users WHERE userName LIKE ?",
        [`%${username}%`]
      );
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

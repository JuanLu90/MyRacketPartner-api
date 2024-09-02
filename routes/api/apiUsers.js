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

    // Construye dinámicamente la consulta SQL y los valores
    let sql = "UPDATE users SET ";
    let values = [];

    for (let key in data) {
      if (
        (key === "firstName" || key === "lastName") &&
        data[key]?.length > 40
      ) {
        return res.status(400).send("Fields max length 40 characters");
      }

      // Convierte los campos de fecha a formato YYYY-MM-DD
      if (key === "birthdate" && data[key]) {
        data[key] = formatDateForDB(data[key]);
      }

      sql += `${key} = ?, `;
      values.push(data[key]);
    }

    sql = sql.slice(0, -2); // Elimina la última coma y espacio
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

//   "/currentUserProfile/editUserProfile",
//   checkJwt,
//   async (req, res) => {
//     const data = req.body;
//     const id = req.token.payload.id;
//     console.log(data);
//     // Construye dinámicamente la consulta SQL y los valores
//     let sql = "UPDATE users SET ";
//     let values = [];
//     for (let key in data) {
//       if (key === "userName" && data[key]?.length > 40) {
//         return res.status(400).send("Fields max length 40 characters");
//       }
//       sql += `${key} = ?, `;
//       values.push(data[key]);
//     }
//     sql = sql.slice(0, -2); // Elimina la última coma y espacio
//     sql += " WHERE userID = ?";
//     values.push(id);

//     try {
//       await dbConn.promise().execute(sql, values);
//       res.send({
//         type: "SUCCESS",
//         message: "Updated successfully",
//         data: data,
//       });
//     } catch (err) {
//       console.error(err);
//       res.status(500).send("Internal Server Error");
//     }
//   }
// );

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

const express = require("express");
const router = express.Router();
const dbConn = require("../../config/db");
const { checkJwt } = require("../../middleware/checkJwt");

/* GET users listing. */
router.get("/userProfile/:userID", async function (req, res, next) {
  try {
    const userID = req.params.userID;

    const [rows] = await dbConn.promise().query(
      `SELECT u.firstName, u.lastName, u.createDate, u.gender, u.birthdate, 
      p.playerName, p.dominantHand, p.backhand
        FROM users u 
        LEFT JOIN players p ON u.userID = p.userID 
        WHERE u.userID = ?
      `,
      [userID]
    );
    res.send(rows);
  } catch (err) {
    res.status(400).send({ e: err.errno });
  }
});

// router.put(
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
//       if (
//         (key === "firstName" || key === "lastName") &&
//         data[key]?.length > 40
//       ) {
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

// router.put(
//   "/currentUserProfile/editPlayerProfile",
//   checkJwt,
//   async (req, res) => {
//     const data = req.body;
//     const id = req.token.payload.id;
//     console.log(data);
//     // Construye dinámicamente la consulta SQL y los valores
//     let sql = "UPDATE players SET ";
//     let values = [];
//     for (let key in data) {
//       if (key === "playerName" && data[key]?.length > 40) {
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

// router.post("/sendSuggestions", checkJwt, async function (req, res, next) {
//   try {
//     const data = req.body;

//     if (data.suggestions.length > 3000) {
//       return res.status(400).send("Suggestions max length 3000 characters");
//     }

//     await dbConn.promise().execute(
//       `INSERT INTO suggestions (suggestion, shareSuggestion, creationDate, userID)
//      VALUES (?, ?, NOW(), ?)`,
//       [data.suggestions, data.shareSuggestion, req.userID]
//     );

//     res.send("Thanks for your suggestion!");
//   } catch (err) {
//     res.status(400).send({ e: err.errno });
//   }
// });

module.exports = router;

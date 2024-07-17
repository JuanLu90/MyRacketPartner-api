const express = require("express");
const router = express.Router();
const dbConn = require("../../config/db");
// const { checkJwt } = require("../../middleware/checkJwt");

//token sent, WORKS FINE!!
router.get("/matches", async (req, res, next) => {
  try {
    const [rows] = await dbConn.promise().execute(
      `SELECT 
      MR.matchID,
      DATE_FORMAT(MR.matchDate, '%Y-%m-%d %H:%i:%s') as matchDate,
      P1.playerID AS player1ID,
      P1.playerName AS player1Name,
      P2.playerID AS player2ID,
      P2.playerName AS player2Name,
      S.setID,
      S.player1Score,
      S.player2Score,
      S.winnerID
  FROM 
      matchresults MR
  JOIN 
      players P1 ON MR.player1ID = P1.playerID
  JOIN 
      players P2 ON MR.player2ID = P2.playerID
  JOIN 
      sets S ON MR.matchID = S.matchID
  JOIN 
      players PW ON MR.winnerID = PW.playerID;`
    );
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

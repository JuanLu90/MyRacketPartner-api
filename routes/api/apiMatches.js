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
      players PW ON MR.winnerID = PW.playerID
  WHERE 
      MR.tournamentID IS NULL;`
    );
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/matchDetails/:matchID", async (req, res, next) => {
  const matchID = req.params.matchID;

  try {
    // Usar parámetros en la consulta para prevenir inyecciones SQL
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
      WHERE 
        MR.matchID = ?`,
      [matchID]
    );

    // Agrupando datos
    const groupedData = {
      matchID: rows[0].matchID,
      matchDate: rows[0].matchDate,
      player1: {
        playerID: rows[0].player1ID,
        playerName: rows[0].player1Name,
      },
      player2: {
        playerID: rows[0].player2ID,
        playerName: rows[0].player2Name,
      },
      matchWinner: {},
      sets: rows.map((set) => ({
        setID: set.setID,
        player1Score: set.player1Score,
        player2Score: set.player2Score,
        winnerID: set.winnerID,
      })),
    };

    const winnerCounter = groupedData.sets.reduce((acc, set) => {
      acc[set.winnerID] = (acc[set.winnerID] || 0) + 1;
      return acc;
    }, {});

    const matchWinnerID = Number(
      Object.keys(winnerCounter).reduce((a, b) =>
        winnerCounter[a] > winnerCounter[b] ? a : b
      )
    );

    groupedData.matchWinner = {
      playerID: matchWinnerID,
      playerName:
        matchWinnerID === groupedData.player1.playerID
          ? groupedData.player1.playerName
          : groupedData.player2.playerName,
    };

    res.send(groupedData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

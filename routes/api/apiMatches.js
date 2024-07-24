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
      id: rows[0].matchID,
      date: rows[0].matchDate,
      player1: {
        id: rows[0].player1ID,
        name: rows[0].player1Name,
      },
      player2: {
        id: rows[0].player2ID,
        name: rows[0].player2Name,
      },
      winnerId: 0,
      sets: rows.map((set) => ({
        setId: set.setID,
        player1Score: set.player1Score,
        player2Score: set.player2Score,
        winnerId: set.winnerID,
      })),
      totalSetsPlayer1: 0,
      totalSetsPlayer2: 0,
    };

    const winnerCounter = groupedData.sets.reduce((acc, set) => {
      acc[set.winnerId] = (acc[set.winnerId] || 0) + 1;
      return acc;
    }, {});

    const matchWinnerID = Number(
      Object.keys(winnerCounter).reduce((a, b) =>
        winnerCounter[a] > winnerCounter[b] ? a : b
      )
    );

    groupedData.winnerId = matchWinnerID;

    groupedData.totalSetsPlayer1 = winnerCounter[groupedData.player1.id] || 0;
    groupedData.totalSetsPlayer2 = winnerCounter[groupedData.player2.id] || 0;

    res.send(groupedData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

router.get(
  "/matchDetails/headtohead/:player1Id/:player2Id",
  async (req, res, next) => {
    const data = req.params;

    try {
      const [rows] = await dbConn.promise().execute(
        `SELECT 
        MR.matchID,
        DATE_FORMAT(MR.matchDate, '%Y-%m-%d %H:%i:%s') AS matchDate,        
        P1.playerID AS player1ID,
        P1.playerName AS player1Name,
        P2.playerID AS player2ID,
        P2.playerName AS player2Name,
        S.setID,
        S.player1Score,
        S.player2Score,
        S.winnerID,
        T.name
    FROM 
        matchResults MR
    JOIN 
        players P1 ON MR.player1ID = P1.playerID
    JOIN 
        players P2 ON MR.player2ID = P2.playerID
    JOIN 
        sets S ON MR.matchID = S.matchID
    JOIN 
        players PW ON MR.winnerID = PW.playerID
    LEFT JOIN 
        Tournaments T ON MR.tournamentID = T.tournamentID
    WHERE 
        MR.tournamentID IS NULL
        AND (
            (MR.player1ID = ${data.player1Id} AND MR.player2ID = ${data.player2Id}) 
            OR (MR.player1ID = ${data.player2Id} AND MR.player2ID = ${data.player1Id})
        );
`,
        [data.player1Id, data.player2Id]
      );

      // Agrupando datos
      function processMatchData(rows) {
        if (!rows || rows.length === 0) {
          return [];
        }

        const tournaments = {
          friendly: [],
        };

        rows.forEach((row) => {
          const tournamentName = row.tournamentName || "friendly";

          if (!tournaments[tournamentName]) {
            tournaments[tournamentName] = [];
          }

          let match = tournaments[tournamentName].find(
            (match) => match.id === row.matchID
          );
          if (!match) {
            match = {
              id: row.matchID,
              date: row.matchDate,
              player1: {
                id: row.player1ID,
                name: row.player1Name,
              },
              player2: {
                id: row.player2ID,
                name: row.player2Name,
              },
              winnerId: 0,
              sets: [],
              totalSetsPlayer1: 0,
              totalSetsPlayer2: 0,
            };
            tournaments[tournamentName].push(match);
          }

          match.sets.push({
            setId: row.setID,
            player1Score: row.player1Score,
            player2Score: row.player2Score,
            winnerId: row.winnerID,
          });
        });

        Object.keys(tournaments).forEach((tournament) => {
          tournaments[tournament].forEach((match) => {
            const winnerCounter = match.sets.reduce((acc, set) => {
              acc[set.winnerId] = (acc[set.winnerId] || 0) + 1;
              return acc;
            }, {});

            const matchWinnerID = Number(
              Object.keys(winnerCounter).reduce((a, b) =>
                winnerCounter[a] > winnerCounter[b] ? a : b
              )
            );

            match.winnerId = matchWinnerID;
            match.totalSetsPlayer1 = winnerCounter[match.player1.id] || 0;
            match.totalSetsPlayer2 = winnerCounter[match.player2.id] || 0;
          });
        });

        return tournaments;
      }

      function mapMatches(processedData) {
        return Object.keys(processedData).map((tournament) => ({
          tournamentName: tournament,
          matches: processedData[tournament].map((match) => ({
            id: match.id,
            date: match.date,
            player1: match.player1,
            player2: match.player2,
            winnerId: match.winnerId,
            sets: match.sets,
            totalSetsPlayer1: match.totalSetsPlayer1,
            totalSetsPlayer2: match.totalSetsPlayer2,
          })),
        }));
      }

      const processedData = processMatchData(rows);
      const mappedMatches = mapMatches(processedData);
      res.send(mappedMatches);
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
);

module.exports = router;

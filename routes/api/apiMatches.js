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
      P1.userID AS user1ID,
      P1.userName AS user1Name,
      P2.userID AS user2ID,
      P2.userName AS user2Name,
      S.setID,
      S.user1Score,
      S.user2Score,
      S.winnerID
  FROM 
      matchresults MR
  JOIN 
      users P1 ON MR.user1ID = P1.userID
  JOIN 
      users P2 ON MR.user2ID = P2.userID
  JOIN 
      sets S ON MR.matchID = S.matchID
  JOIN 
      users PW ON MR.winnerID = PW.userID
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
        U1.userID AS user1ID,
        U1.userName AS user1Name,
        U2.userID AS user2ID,
        U2.userName AS user2Name,
        S.setID,
        S.user1Score,
        S.user2Score,
        S.winnerID
      FROM 
        matchresults MR
      JOIN 
        users U1 ON MR.user1ID = U1.userID
      JOIN 
        users U2 ON MR.user2ID = U2.userID
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
      user1: {
        id: rows[0].user1ID,
        name: rows[0].user1Name,
      },
      user2: {
        id: rows[0].user2ID,
        name: rows[0].user2Name,
      },
      winnerId: 0,
      sets: rows.map((set) => ({
        setId: set.setID,
        user1Score: set.user1Score,
        user2Score: set.user2Score,
        winnerId: set.winnerID,
      })),
      totalSetsUser1: 0,
      totalSetsUser2: 0,
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

    groupedData.totalSetsUser1 = winnerCounter[groupedData.user1.id] || 0;
    groupedData.totalSetsUser2 = winnerCounter[groupedData.user2.id] || 0;

    res.send(groupedData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

router.get(
  "/matchDetails/headtohead/:user1Id/:user2Id",
  async (req, res, next) => {
    const data = req.params;

    try {
      const [rows] = await dbConn.promise().execute(
        `SELECT 
        MR.matchID,
        DATE_FORMAT(MR.matchDate, '%Y-%m-%d %H:%i:%s') AS matchDate,        
        P1.userID AS user1ID,
        P1.userName AS user1Name,
        P2.userID AS user2ID,
        P2.userName AS user2Name,
        S.setID,
        S.user1Score,
        S.user2Score,
        S.winnerID,
        T.name
    FROM 
        matchResults MR
    JOIN 
        users P1 ON MR.user1ID = P1.userID
    JOIN 
        users P2 ON MR.user2ID = P2.userID
    JOIN 
        sets S ON MR.matchID = S.matchID
    JOIN 
        users PW ON MR.winnerID = PW.userID
    LEFT JOIN 
        Tournaments T ON MR.tournamentID = T.tournamentID
    WHERE 
        MR.tournamentID IS NULL
        AND (
            (MR.user1ID = ${data.user1Id} AND MR.user2ID = ${data.user2Id}) 
            OR (MR.user1ID = ${data.user2Id} AND MR.user2ID = ${data.user1Id})
        );
`,
        [data.user1Id, data.user2Id]
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
              user1: {
                id: row.user1ID,
                name: row.user1Name,
              },
              user2: {
                id: row.user2ID,
                name: row.user2Name,
              },
              winnerId: 0,
              sets: [],
              totalSetsUser1: 0,
              totalSetsUser2: 0,
            };
            tournaments[tournamentName].push(match);
          }

          match.sets.push({
            setId: row.setID,
            user1Score: row.user1Score,
            user2Score: row.user2Score,
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
            match.totalSetsUser1 = winnerCounter[match.user1.id] || 0;
            match.totalSetsUser2 = winnerCounter[match.user2.id] || 0;
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
            user1: match.user1,
            user2: match.user2,
            winnerId: match.winnerId,
            sets: match.sets,
            totalSetsUser1: match.totalSetsUser1,
            totalSetsUser2: match.totalSetsUser2,
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

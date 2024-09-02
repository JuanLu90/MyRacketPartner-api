const express = require("express");
const router = express.Router();
const dbConn = require("../../config/db");
const { checkJwt } = require("../../middleware/checkJwt");

//token sent, WORKS FINE!!
router.get("/matches", async (req, res, next) => {
  try {
    const [rows] = await dbConn.promise().execute(
      `SELECT 
      MR.matchID,
      DATE_FORMAT(MR.matchDate, '%Y-%m-%d %H:%i:%s') as matchDate,
      U1.userID AS user1ID,
      U1.userName AS user1Name,
      U1.profileImage AS user1ProfileImage,
      U2.userID AS user2ID,
      U2.userName AS user2Name,
      U2.profileImage AS user2ProfileImage,
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
        U1.profileImage AS user1ProfileImage,
        U2.userID AS user2ID,
        U2.userName AS user2Name,
        U2.profileImage AS user2ProfileImage,
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
        profileImage: rows[0].user1ProfileImage,
      },
      user2: {
        id: rows[0].user2ID,
        name: rows[0].user2Name,
        profileImage: rows[0].user2ProfileImage,
      },
      winnerID: 0,
      sets: rows.map((set) => ({
        setID: set.setID,
        user1Score: set.user1Score,
        user2Score: set.user2Score,
        winnerID: set.winnerID,
      })),
      totalSetsUser1: 0,
      totalSetsUser2: 0,
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

    groupedData.winnerID = matchWinnerID;

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
              winnerID: 0,
              sets: [],
              totalSetsUser1: 0,
              totalSetsUser2: 0,
            };
            tournaments[tournamentName].push(match);
          }

          match.sets.push({
            setID: row.setID,
            user1Score: row.user1Score,
            user2Score: row.user2Score,
            winnerID: row.winnerID,
          });
        });

        Object.keys(tournaments).forEach((tournament) => {
          tournaments[tournament].forEach((match) => {
            const winnerCounter = match.sets.reduce((acc, set) => {
              acc[set.winnerID] = (acc[set.winnerID] || 0) + 1;
              return acc;
            }, {});

            const matchWinnerID = Number(
              Object.keys(winnerCounter).reduce((a, b) =>
                winnerCounter[a] > winnerCounter[b] ? a : b
              )
            );

            match.winnerID = matchWinnerID;
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
            winnerID: match.winnerID,
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

router.post("/newMatch", checkJwt, (req, res) => {
  const data = req.body;

  if (data.sets.length === 3) {
    const thirdSet = data.sets[2];

    // Verificar si el tercer set no tiene información válida
    const isThirdSetInvalid =
      thirdSet.user1Score == null || thirdSet.user2Score == null;

    if (isThirdSetInvalid) {
      // Eliminar el tercer set si no es válido
      data.sets.pop();
    }
  }

  // Verifica que llegan los IDs de ambos jugadores
  if (!data.user1ID || !data.user2ID) {
    return res.status(400).send({
      error: "011",
      message: "User ID empty",
    });
  }

  // Determinar el ganador de cada set
  data.sets = data.sets.map((set) => {
    if (set.user1Score > set.user2Score) {
      return { ...set, winnerID: data.user1ID };
    } else if (set.user1Score < set.user2Score) {
      return { ...set, winnerID: data.user2ID };
    } else {
      return { ...set, winnerID: null }; // En caso de empate
    }
  });

  // Contar las victorias de cada jugador
  let user1Wins = 0;
  let user2Wins = 0;

  data.sets.forEach((set) => {
    if (set.winnerID === data.user1ID) {
      user1Wins++;
    } else if (set.winnerID === data.user2ID) {
      user2Wins++;
    }
  });

  // Determinar el ganador del partido
  if (user1Wins > user2Wins) {
    data.winnerID = data.user1ID;
  } else if (user1Wins < user2Wins) {
    data.winnerID = data.user2ID;
  } else {
    data.winnerID = null; // En caso de empate
  }

  const { sets, ...matchResultWithoutSets } = data;

  // Validar el número de sets
  if (data.sets.length < 2 || data.sets.length > 3) {
    return res.status(400).send({
      error: "010",
      message: "Error with the numbers of sets",
    });
  }

  const handleErrorSetScore = (codeError, setNumber) =>
    res.status(400).send({
      error: codeError,
      message: `Error score in set ${setNumber + 1}`,
    });

  // Validar la puntuación de cada set
  for (const [i, set] of data.sets.entries()) {
    if (set.user1Score === null || set.user2Score === null)
      return handleErrorSetScore("001", i);

    if (set.user1Score === 7 && set.user2Score < 5)
      return handleErrorSetScore("002", i);

    if (set.user2Score === 7 && set.user1Score < 5)
      return handleErrorSetScore("003", i);

    if (set.user1Score > 7 || set.user2Score > 7)
      return handleErrorSetScore("004", i);

    if (set.user1Score === 7 && set.user2Score >= 7)
      return handleErrorSetScore("005", i);

    if (set.user1Score < 6 && set.user2Score < 6)
      return handleErrorSetScore("006", i);

    if (set.user1Score === 6 && set.user2Score === 5)
      return handleErrorSetScore("007", i);

    if (set.user2Score === 6 && set.user1Score === 5)
      return handleErrorSetScore("008", i);
  }

  // Validar que no haya un tercer set si un jugador gana dos sets seguidos
  // Validar que no haya un tercer set si un jugador gana dos sets seguidos
  if (data.sets.length === 3) {
    const thirdSet = data.sets[2];

    // Verificar si el tercer set tiene información válida
    const isThirdSetValid =
      thirdSet.user1Score != null && thirdSet.user2Score != null;

    if (isThirdSetValid) {
      // Si el tercer set es válido y los dos primeros sets tienen el mismo ganador
      if (data.sets[0].winnerID === data.sets[1].winnerID) {
        return res.status(400).send({
          error: "009",
          message: "Error in the order of the sets",
        });
      }
    }
  }

  // Validar que el ganador del partido sea el mismo que el ganador de la mayoría de los sets
  const setsWonByUser1 = data.sets.filter(
    (set) => set.winnerID === data.user1ID
  ).length;
  const setsWonByUser2 = data.sets.filter(
    (set) => set.winnerID === data.user2ID
  ).length;

  if (
    (setsWonByUser1 > setsWonByUser2 && data.winnerID !== data.user1ID) ||
    (setsWonByUser2 > setsWonByUser1 && data.winnerID !== data.user2ID)
  ) {
    return res.status(400).send({
      error: "009",
      message: "Error with the winner of the match",
    });
  }

  dbConn.query(
    "INSERT INTO matchresults set ?",
    [matchResultWithoutSets],
    (err, rows) => {
      if (err) throw err;
      const matchID = rows.insertId;
      sets.forEach((element) => {
        const newElement = { ...element, matchID };
        dbConn.query("INSERT INTO sets set ?", [newElement], (err, rows) => {
          if (err) throw err;
        });
      });

      res.send("Match created successfully");
    }
  );
});

router.put("/editMatch", checkJwt, async (req, res) => {
  const data = req.body;
  console.log("data");
  console.log(data);
  try {
    // Verifica que llegan los IDs de ambos jugadores
    if (!data.user1ID || !data.user2ID) {
      return res.status(400).send({
        error: "011",
        message: "User ID empty",
      });
    }

    const updatingOnlyDate = !data.sets || data.sets.length === 0;

    // Determinar el ganador de cada set
    data.sets = data.sets.map((set) => {
      if (set.user1Score > set.user2Score) {
        return { ...set, winnerID: data.user1ID };
      } else if (set.user1Score < set.user2Score) {
        return { ...set, winnerID: data.user2ID };
      } else {
        return { ...set, winnerID: null }; // En caso de empate
      }
    });

    // Contar las victorias de cada jugador
    let user1Wins = 0;
    let user2Wins = 0;

    data.sets.forEach((set) => {
      if (set.winnerID === data.user1ID) {
        user1Wins++;
      } else if (set.winnerID === data.user2ID) {
        user2Wins++;
      }
    });

    // Determinar el ganador del partido
    if (user1Wins > user2Wins) {
      data.winnerID = data.user1ID;
    } else if (user1Wins < user2Wins) {
      data.winnerID = data.user2ID;
    } else {
      data.winnerID = null; // En caso de empate
    }

    const { sets, ...matchResultWithoutSets } = data;

    if (updatingOnlyDate) {
      const matchID = data.matchID;
      const query = "UPDATE matchresults SET matchDate = ? WHERE matchID = ?";
      const values = [data.matchDate, matchID];
      await dbConn.promise().execute(query, values);

      return res.send({
        type: "SUCCESS",
        message: "Match date updated successfully",
      });
    }

    // Validar el número de sets
    if (data.sets.length < 2 || data.sets.length > 3) {
      return res.status(400).send({
        error: "010",
        message: "Error with the numbers of sets",
      });
    }

    const handleErrorSetScore = (codeError, setNumber) =>
      res.status(400).send({
        error: codeError,
        message: `Error score in set ${setNumber + 1}`,
      });

    // Validar la puntuación de cada set
    for (const [i, set] of data.sets.entries()) {
      if (!set.user1Score || !set.user2Score)
        return handleErrorSetScore("001", i);

      if (set.user1Score === 7 && set.user2Score < 5)
        return handleErrorSetScore("002", i);

      if (set.user2Score === 7 && set.user1Score < 5)
        return handleErrorSetScore("003", i);

      if (set.user1Score > 7 || set.user2Score > 7)
        return handleErrorSetScore("004", i);

      if (set.user1Score === 7 && set.user2Score >= 7)
        return handleErrorSetScore("005", i);

      if (set.user1Score < 6 && set.user2Score < 6)
        return handleErrorSetScore("006", i);

      if (set.user1Score === 6 && set.user2Score === 5)
        return handleErrorSetScore("007", i);

      if (set.user2Score === 6 && set.user1Score === 5)
        return handleErrorSetScore("008", i);
    }

    // Validar que no haya un tercer set si un jugador gana dos sets seguidos
    if (data.sets.length === 3) {
      if (data.sets[0].winnerID === data.sets[1].winnerID) {
        return res.status(400).send({
          error: "009",
          message: "Error in the order of the sets",
        });
      }
    }

    // Validar que el ganador del partido sea el mismo que el ganador de la mayoría de los sets
    const setsWonByUser1 = data.sets.filter(
      (set) => set.winnerID === data.user1ID
    ).length;
    const setsWonByUser2 = data.sets.filter(
      (set) => set.winnerID === data.user2ID
    ).length;

    if (
      (setsWonByUser1 > setsWonByUser2 && data.winnerID !== data.user1ID) ||
      (setsWonByUser2 > setsWonByUser1 && data.winnerID !== data.user2ID)
    ) {
      return res.status(400).send({
        error: "009",
        message: "Error with the winner of the match",
      });
    }

    const matchID = data.matchID;
    const keys = Object.keys(matchResultWithoutSets);
    const values = Object.values(matchResultWithoutSets);

    let query = "UPDATE matchresults SET ";
    keys.forEach((key, i) => {
      query += `${key} = ?`;
      if (i < keys.length - 1) {
        query += ", ";
      }
    });
    query += ` WHERE matchID = ?`;

    values.push(matchID);

    console.log("aaaaaaaaa");
    console.log(query);
    console.log(values);
    await dbConn.promise().execute(query, values);
    console.log(sets);
    for (const element of sets) {
      if (element.setID) {
        console.log("if");

        const keys = Object.keys(element);
        const values = Object.values(element);

        let query = "UPDATE sets SET ";
        keys.forEach((key, i) => {
          query += `${key} = ?`;
          if (i < keys.length - 1) {
            query += ", ";
          }
        });
        query += ` WHERE setID = ?`;

        values.push(element.setID);

        await dbConn.promise().execute(query, values);
      } else {
        console.log("else");
        const newElement = { ...element, matchID };
        const keys = Object.keys(newElement);
        const values = Object.values(newElement);

        let query = "INSERT INTO sets SET ";
        keys.forEach((key, i) => {
          query += `${key} = ?`;
          if (i < keys.length - 1) {
            query += ", ";
          }
        });

        await dbConn.promise().execute(query, values);
      }
    }

    res.send({ type: "SUCCESS", message: "Match updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

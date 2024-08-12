const express = require("express");
const router = express.Router();
const dbConn = require("../../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getToken = (user, config) =>
  jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: config?.expiresIn ?? "30m",
    notBefore: config?.notBefore ?? "0", // Cannot use before now, can be configured to be deferred.
    algorithm: config?.algorithm ?? "HS256",
    audience: process.env.JWT_AUDIENCE,
    issuer: process.env.JWT_ISSUER,
  });

// own login app
router.post("/login", async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).send("Todos los campos son obligatorios");
  }

  const passwordRegex = new RegExp(
    "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{6,12}$"
  );

  if (!passwordRegex.test(password)) {
    return res
      .status(400)
      .send(
        "La contraseña no cumple con los requisitos:\n- Entre 8 caracteres y 12 caracteres\n- Al menos una mayúscula y un número"
      );
  }

  try {
    const [result] = await dbConn
      .promise()
      .execute(`SELECT * FROM users WHERE email = ?`, [email]);

    if (result.length == 0) {
      console.log("--------> User does not exist");
      res.status(500).send("Incorrect credentials");
    } else {
      const user = {
        id: result[0].userID,
        username: result[0].userName,
        email: result[0].email,
        profileImage: result[0].profileImage,
      };

      if (
        result[0]?.password &&
        (await bcrypt.compare(password, result[0]?.password))
      ) {
        console.log("---------> Login Successful");
        console.log("---------> Generating accessToken");
        res.send(getToken(user));
      } else {
        console.log("Password incorrect!");
        res.status(500).send("Password incorrect!");
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

//own register app
router.post("/register", async (req, res, next) => {
  const userInfo = req.body.user;
  const tournamentUrl = req.body.tournamentUrl;

  const user = {
    userName: userInfo.userName,
    email: userInfo.email,
    password: userInfo.password,
    userRole: userInfo.userRole,
  };

  if (
    !user.userName ||
    // !user.firstName ||
    // !user.lastName ||
    !user.email ||
    !user.password ||
    !user.userRole
  ) {
    return res.status(400).send("Todos los campos son obligatorios");
  }

  const passwordRegex = new RegExp(
    "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{6,12}$"
  );
  const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  if (!emailRegex.test(user.email)) {
    return res.status(400).send("Incorrect email format");
  } else if (!passwordRegex.test(user.password)) {
    return res
      .status(400)
      .send(
        "The password does not meet the requirements:\n- Between 8 characters and 12 characters\n- At least one capital letter and one number"
      );
  }

  const hashedPassword = await bcrypt.hash(user.password, 10); // 10 es el número de rondas de salting

  try {
    if (tournamentUrl) {
      const [tournamentResults] = await dbConn
        .promise()
        .query(
          "SELECT tournamentID, name, description, format, mode FROM tournaments WHERE url = ?",
          [tournamentUrl]
        );

      if (tournamentResults.length === 0) {
        return res.status(404).send("Tournament not found");
      }

      const [invitationResults] = await dbConn
        .promise()
        .query(
          "SELECT * FROM invitations i INNER JOIN users u ON i.userID = u.userID WHERE u.email = ? AND i.tournamentID = ? AND i.status = 'PENDING'",
          [user.email, tournamentResults[0].tournamentID]
        );

      if (invitationResults.length === 0) {
        return res
          .status(404)
          .send("No pending invitation from the tournament for this email");
      }

      const [userRegistered] = await dbConn
        .promise()
        .query("SELECT userID FROM users WHERE email = ?", [user.email]);

      const userID = userRegistered[0].userID;

      await dbConn.promise().execute(
        `UPDATE users 
         SET userName = ?, password = ?, userRole = ?, createDate = ? 
         WHERE userID = ?`,
        [user.userName, hashedPassword, user.userRole, Date.now(), userID]
      );

      await dbConn
        .promise()
        .query(
          `INSERT INTO participations (userID, tournamentID) VALUES (?, ?)`,
          [userID, tournamentResults[0].tournamentID]
        );

      await dbConn.promise().execute(
        `UPDATE invitations 
         SET status = "ACCEPTED" 
         WHERE userID = ?`,
        [userID]
      );

      console.log("--------> Invitation accepted and user created");
      res.send("Invitation accepted and user created");
    } else {
      const [resultEmail] = await dbConn
        .promise()
        .execute("SELECT userID FROM users WHERE email = ?", [user.email]);

      const [resultUserName] = await dbConn
        .promise()
        .execute("SELECT userID FROM users WHERE userName = ?", [
          user.userName,
        ]);

      console.log(user);
      console.log(resultEmail);
      console.log(resultUserName);
      if (resultEmail.length != 0) {
        console.log("------> Email already exists");
        res.status(409).send({
          errorCode: "01",
          type: "ERROR",
          message: "Email already exists. Log in.",
        });
      } else if (resultUserName.length != 0) {
        console.log("------> Username already exists");
        res.status(409).send({
          errorCode: "02",
          type: "ERROR",
          message: "Username already exists. Choose another.",
        });
      } else {
        await dbConn.promise().execute(
          `INSERT INTO users (userName, email, password, userRole, createDate)
          VALUES (?, ?, ?, ?, NOW())`, // No necesitas STR_TO_DATE aquí
          [user.userName, user.email, hashedPassword, user.userRole]
        );

        console.log("--------> Created new User");
        res.send("Registered Successfully");
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// register/login google api
router.post("/google", async (req, res, next) => {
  try {
    const { token } = req.body;
    const tournamentUrl = req.body.tournamentUrl;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleID = payload["sub"];

    const { email, picture, given_name } = payload;

    const [resultGoogle] = await dbConn
      .promise()
      .execute(`SELECT * FROM users WHERE googleID = ?`, [googleID]);

    if (!resultGoogle.length) {
      const [result] = await dbConn
        .promise()
        .execute(`SELECT * FROM users WHERE email = ?`, [email]);

      if (!result.length) {
        const user = {
          googleID: googleID,
          userName: given_name,
          email: email,
          profileImage: picture,
          userRole: "Admin",
        };

        if (tournamentUrl) {
          const [tournamentResults] = await dbConn
            .promise()
            .query(
              "SELECT tournamentID, name, description, format, mode FROM tournaments WHERE url = ?",
              [tournamentUrl]
            );

          if (tournamentResults.length === 0) {
            return res.status(404).send("Tournament not found");
          }

          const [invitationResults] = await dbConn
            .promise()
            .query(
              "SELECT * FROM invitations i INNER JOIN users u ON i.userID = u.userID WHERE u.email = ? AND i.tournamentID = ? AND i.status = 'PENDING'",
              [user.email, tournamentResults[0].tournamentID]
            );

          if (invitationResults.length === 0) {
            return res
              .status(404)
              .send("No pending invitation from the tournament for this email");
          }

          const [userRegistered] = await dbConn
            .promise()
            .query("SELECT userID FROM users WHERE email = ?", [user.email]);

          const userID = userRegistered[0].userID;

          await dbConn.promise().execute(
            `UPDATE users 
             SET userName = ?, userRole = ?, createDate = ? 
             WHERE userID = ?`,
            [user.userName, user.userRole, Date.now(), userID]
          );

          await dbConn
            .promise()
            .query(
              `INSERT INTO participations (userID, tournamentID) VALUES (?, ?)`,
              [userID, tournamentResults[0].tournamentID]
            );

          await dbConn.promise().execute(
            `UPDATE invitations 
             SET status = 'ACCEPTED' 
             WHERE userID = ?`,
            [userID]
          );

          console.log("--------> Invitation accepted and user created");
          res.send("Invitation accepted and user created");
        } else {
          const [rowUser] = await dbConn.promise().execute(
            `INSERT INTO users (userName, email, userRole, createDate, profileImage, googleID)
            VALUES (?, ?, ?, NOW(), ?, ?)`,
            [
              user.userName,
              user.email,
              user.userRole,
              user.profileImage,
              user.googleID,
            ]
          );

          const finalUser = {
            id: rowUser.insertId,
            username: given_name,
            email: email,
            profileImage: picture,
          };

          console.log("--------> Created new User");
          res.send({
            message: "Registered Successfully",
            token: getToken(finalUser),
          });
        }
        // register user with google info
      } else {
        const user = {
          id: result[0].userID,
          username: result[0].userName,
          email: result[0].email,
          profileImage: result[0].profileImage,
        };

        // link email with googleID
        await dbConn.promise().execute(
          `UPDATE users 
           SET googleID = ?
           WHERE email = ?`,
          [googleID, email]
        );

        res.send({
          message:
            "Your MyRacketPartner account has been linked with Google account",
          token: getToken(user),
        });
      }
    } else {
      // login user with google info
      const user = {
        id: resultGoogle[0].userID,
        username: resultGoogle[0].userName,
        email: resultGoogle[0].email,
        profileImage: resultGoogle[0].profileImage,
      };

      res.send({ token: getToken(user) });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});
module.exports = router;

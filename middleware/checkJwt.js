const { verify } = require("jsonwebtoken");

const checkJwt = (req, res, next) => {
  // Get the jwt token from the head.
  const token = req.headers["authorization"];
  let jwtPayload;

  // Try to validate the token and get data.
  try {
    jwtPayload = verify(token?.split(" ")[1], process.env.JWT_SECRET, {
      complete: true,
      audience: process.env.JWT_AUDIENCE,
      issuer: process.env.JWT_ISSUER,
      algorithms: ["HS256"],
      clockTolerance: 0,
      ignoreExpiration: false,
      ignoreNotBefore: false,
    });
    req.token = jwtPayload;
  } catch (error) {
    res
      .status(401)
      .type("json")
      .send(JSON.stringify("Missing or invalid token"));
    return;
  }

  // Call the next middleware or controller.
  next();
};

module.exports = { checkJwt };

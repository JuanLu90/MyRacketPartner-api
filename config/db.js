const mysql = require("mysql2");
//create connection to dabase
const dbConn = mysql.createPool({
  host: process.env.DATABASE_URL,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

//connect to database
dbConn.getConnection((err, connection) => {
  if (err) throw err;
  console.log("Connected to MyRackertPartner database: " + connection.threadId);
});

//export db to have it available
module.exports = dbConn;

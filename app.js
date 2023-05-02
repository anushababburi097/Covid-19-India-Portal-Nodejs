const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let database = null;
// Connecting the server and database(sqlite database initialization)
const initializeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error:${error.message}`);
    process.exit(1);
  }
};
initializeDatabaseAndServer();

const convertStateDbObjectToResponsiveObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponsiveObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//API 1
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const postQueryMethod = `
    SELECT * FROM user WHERE username='${username}';`;
  const dbUserQuery = await database.get(postQueryMethod);
  if (dbUserQuery === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbUserQuery.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      //   console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getUserQuery = `
    SELECT * 
    FROM 
        state;`;
  const dbUser = await database.all(getUserQuery);
  response.send(
    dbUser.map((each) => convertStateDbObjectToResponsiveObject(each))
  );
});
//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectQuery = `
    SELECT * 
    FROM 
        state
    WHERE state_id=${stateId};`;
  const dbUser = await database.get(selectQuery);
  response.send(convertStateDbObjectToResponsiveObject(dbUser));
});
//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const postDistrictsQuery = `
    INSERT INTO
        district(state_id,district_name,cases,cured,active,deaths)
    VALUES
        (${stateId},'${districtName}',${cases},${cured},${active},${deaths});`;
  await database.run(postDistrictsQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * FROM district WHERE district_id=${districtId};`;
    const district = await database.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToResponsiveObject(district));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM district WHERE district_id=${districtId};`;
    await database.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updatePutQuery = `
        UPDATE 
            district
        SET 
            district_name='${districtName}',
            state_id=${stateId},
            cases=${cases},
            cured=${cured},
            active=${active},
            deaths=${deaths}
        WHERE district_id=${districtId};`;
    await database.run(updatePutQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await database.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;

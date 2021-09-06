require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const Joi = require("joi");
var cors = require("cors");
const rateLimit = require("express-rate-limit");
const { MongoClient } = require("mongodb");
const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to {max} requests per {windowMs}
});

//  apply to all requests
app.use(limiter);

app.use(cors());


/* Connection to the database and function to find the name of the weapon one and two for a champion */

const uri = process.env.DATABASE_NAME;

const client = new MongoClient(uri);
async function getWeaponOneAndTwo(legendName) {
  try {
    await client.connect();
    const database = client.db("brawlData");
    const allLegends = database.collection("allLegends");
    // Query for a legend that has the name {legendName}
    const query = { legend_name_key: legendName };
    const options = {
      // sort matched documents in descending order by rating
      sort: { rating: -1 },

      // Include only the fields 1 in the returned document
      projection: {
        _id: 0,
        weapon_one: 1,
        weapon_two: 1,
      },
    };
    const weapons = await allLegends.findOne(query, options);
    // since this method returns the matched document, not a cursor, print it directly
    return await weapons;
  } finally {
    // await client.close();
  }
}
getWeaponOneAndTwo().catch(console.dir);


async function getCharacterById(legendID) {
  try {
    await client.connect();
    const database = client.db("brawlData");
    const allLegends = database.collection("allLegends");
    // Query for a legend that has the name {legendName}
    const query = { legend_id: legendID };
    const options = {
      // sort matched documents in descending order by rating
      sort: { rating: -1 },

      // Include only the fields 1 in the returned document
      projection: {
        _id: 0,
        bio_name: 1,
        legend_id: 1,
        picture: 1,
      },
    };
    const infos = await allLegends.findOne(query, options);
    // since this method returns the matched document, not a cursor, print it directly
    return await infos;
  } finally {
    // await client.close();
  }
}
getCharacterById().catch(console.dir);


async function getTrueLevel(xpPlayer) {
  try {
    await client.connect();
    const database = client.db("brawlData");
    const trueLevels = database.collection("trueLevels");
    // Query for a legend that has the name {legendName}
    const query = { xp: { $lt: xpPlayer } };
    const options = {
      // sort matched documents in descending order by rating
      sort: { level: -1 },
      limit: 1,
      // Include only the fields 1 in the returned document
      projection: {
        _id: 0,
        level: 1,
      },
    };
    const trueLevel = await trueLevels.findOne(query, options);
    // since this method returns the matched document, not a cursor, print it directly
    // console.log(trueLevel);
    return await trueLevel;
  } finally {
    // await client.close();
  }
}
getTrueLevel().catch(console.dir);
























/* Main API page and page for display a legend picture with a legend parameter */

//READ Request Handlers
app.get("/", (req, res) => {
  res.send("Welcome to the API");
});



app.get("/api/brawl/legends/:legend_name", function (req, res) {
  const legendName = req.params.legend_name;
  res.sendFile(__dirname + "/legends/" + legendName + ".png");
});




















app.get("/api/brawl/test/:brawlIdClient", async (req, res) => {
  try {

    const brawlIdClient = req.params.brawlIdClient;

    /* brawlhalla API calls for collect the opponent and the client infos */

    async function apiCallRanked(brawlID) {
      const playerRanked = await fetch(
        // `https://api.brawlhalla.com/player/${brawlID}/ranked?api_key=${process.env.BRAWL_API_KEY}`
        `https://brawlhalla-api.herokuapp.com/v1/ranked/id?brawlhalla_id=${brawlID}`
      );
      var playerRankedJSON = await playerRanked.json();
      playerRankedJSON = await playerRankedJSON["data"];

      return await playerRankedJSON;
    }

    const rankedClientJSON = await apiCallRanked(brawlIdClient);
    
    const ratingClient = rankedClientJSON["rating"]


    // console.log(ratingClient)
    if (ratingClient === undefined){
      var correctIdBool = false
    }else{
      var correctIdBool = true
    }

    result = {
      correctID: correctIdBool,
    };

    // console.log(brawlIdClient);

    return res.json({
      success: true,
      result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
























app.get("/api/brawl/client/:brawlIdClient", async (req, res) => {
  try {

    const brawlIdClient = req.params.brawlIdClient;

    /* brawlhalla API calls for collect the opponent and the client infos */

    async function apiCallStats(brawlID) {
      const playerStats = await fetch(
        // `https://api.brawlhalla.com/player/${brawlID}/stats?api_key=${process.env.BRAWL_API_KEY}`
        `https://brawlhalla-api.herokuapp.com/v1/stats/id?brawlhalla_id=${brawlID}`
      );
      var playerStatsJSON = await playerStats.json();
      playerStatsJSON = playerStatsJSON["data"];

      return await playerStatsJSON;

    }

    async function apiCallRanked(brawlID) {
      const playerRanked = await fetch(
        // `https://api.brawlhalla.com/player/${brawlID}/ranked?api_key=${process.env.BRAWL_API_KEY}`
        `https://brawlhalla-api.herokuapp.com/v1/ranked/id?brawlhalla_id=${brawlID}`
      );
      var playerRankedJSON = await playerRanked.json();
      playerRankedJSON = playerRankedJSON["data"];

      return await playerRankedJSON;
    }

    const statsClientJSON = await apiCallStats(brawlIdClient);
    const rankedClientJSON = await apiCallRanked(brawlIdClient);
    const usernameClient = await statsClientJSON["name"];
    const regionClient = rankedClientJSON["region"];



    const searchPlayerGlobal = await fetch(
      `https://api.brawlhalla.com/rankings/1v1/all/1?name=${usernameClient}&api_key=${process.env.BRAWL_API_KEY}`
    );
    var searchPlayerGlobalJSON = await searchPlayerGlobal.json();

    const searchPlayerRegion = await fetch(
      `https://api.brawlhalla.com/rankings/1v1/${regionClient.toLowerCase()}/1?name=${usernameClient}&api_key=${process.env.BRAWL_API_KEY}`
    );
    var searchPlayerRegionJSON = await searchPlayerRegion.json();

    console.log(searchPlayerRegionJSON, regionClient.toLowerCase())

/* functions to retrieve useful stats */
    function getInfosPlayerClient(searchPlayerGlobal, searchPlayerRegion) {
      var result = [];

      for (var k in searchPlayerGlobal) {
        console.log(usernameClient, searchPlayerGlobal[k]["name"], brawlIdClient, searchPlayerGlobal[k]["brawlhalla_id"]);

        if (usernameClient == searchPlayerGlobal[k]["name"] && brawlIdClient == searchPlayerGlobal[k]["brawlhalla_id"]) {
          result.push(searchPlayerGlobal[k]);
        }
      }

      for (var k in searchPlayerRegion) {
        if (usernameClient == searchPlayerRegion[k]["name"] && brawlIdClient == searchPlayerRegion[k]["brawlhalla_id"]) {
          
          result.push(searchPlayerRegion[k]);
        }
      }

      resultFinal = [result[0], result[1]]
      

      return resultFinal;
    }

    const infosClientJSON = await getInfosPlayerClient(await searchPlayerGlobalJSON, await searchPlayerRegionJSON);
    
    console.log(infosClientJSON)

    const globalRankClient = await infosClientJSON[0]["rank"];
    const regionRankClient = await infosClientJSON[1]["rank"];
    console.log(globalRankClient, regionRankClient)


    /* retrieve the main character of the client or the opponent */
    async function mainLevelCharacter(player) {
      var mainLevelCharacter = 0;
      var idMainLevelCharacter = 0;
      
      for (var k in player["legends"]) {
        if (player["legends"][k]["xp"] > mainLevelCharacter) {
          mainLevelCharacter = player["legends"][k]["xp"];
          idMainLevelCharacter = k;
        }
      }

      const lvlCharacter = player["legends"][idMainLevelCharacter]["level"];

      var mainLevelCharacterInfos = await getCharacterById(player["legends"][idMainLevelCharacter]["legend_id"]).then(async function (v) {
        nameCharacter = await v.bio_name;
        picture = await v.picture;
        mainLevelCharacterInfosFinal = [nameCharacter, picture]
        return await mainLevelCharacterInfosFinal;
      });

      mainLevelCharacterInfos[0] = mainLevelCharacterInfos[0] + " (Lvl " + lvlCharacter + ")"


      return await mainLevelCharacterInfos; //mettre en format json avec les autres infos obtenus
    }

    async function mainRankedCharacter(player) {
      var mainRankedCharacter = 0;
      var idMainRankedCharacter = 0;

      for (var k in player["legends"]) {
        if (player["legends"][k]["rating"] > mainRankedCharacter) {
          mainRankedCharacter = player["legends"][k]["rating"];
          idMainRankedCharacter = k;
        }
      }

      const ratingCharacter = player["legends"][idMainRankedCharacter]["rating"];

      var mainRankedCharacterInfos = await getCharacterById(player["legends"][idMainRankedCharacter]["legend_id"]).then(async function (v) {
        nameCharacter = await v.bio_name;
        picture = await v.picture;
        mainRankedCharacterInfosFinal = [nameCharacter, picture]
        return await mainRankedCharacterInfosFinal;
      });

      mainRankedCharacterInfos[0] = mainRankedCharacterInfos[0] + " (" + ratingCharacter + ")"


      return mainRankedCharacterInfos; //mettre en format json avec les autres infos obtenus
    }

    /* retrieve the main weapon of the client or the opponent */
    async function mainWeapon(player) {
      var Hammer = 0;
      var Sword = 0;
      var Pistol = 0;
      var RocketLance = 0;
      var Spear = 0;
      var Katar = 0;
      var Axe = 0;
      var Bow = 0;
      var Fists = 0;
      var Scythe = 0;
      var Cannon = 0;
      var Orb = 0;
      var Greatsword = 0;

      for (var k in player["legends"]) {
        weapon1 = getWeaponOneAndTwo(
          player["legends"][k]["legend_name_key"]
        ).then(async function (v) {
          weapon1 = await v.weapon_one;
          return weapon1;
        });
        weapon2 = getWeaponOneAndTwo(
          player["legends"][k]["legend_name_key"]
        ).then(async function (v) {
          weapon2 = await v.weapon_two;
          return weapon2;
        });
        eval(
          (await weapon1) + " += " + player["legends"][k]["timeheldweaponone"]
        );
        eval(
          (await weapon2) + " += " + player["legends"][k]["timeheldweapontwo"]
        );
      }

      const arrayWeapons = [
        { weapon: "Hammer", value: Hammer },
        { weapon: "Sword", value: Sword },
        { weapon: "Pistol", value: Pistol },
        { weapon: "RocketLance", value: RocketLance },
        { weapon: "Spear", value: Spear },
        { weapon: "Katar", value: Katar },
        { weapon: "Axe", value: Axe },
        { weapon: "Bow", value: Bow },
        { weapon: "Fists", value: Fists },
        { weapon: "Scythe", value: Scythe },
        { weapon: "Cannon", value: Cannon },
        { weapon: "Orb", value: Orb },
        { weapon: "Greatsword", value: Greatsword },
      ];

      var x = arrayWeapons.reduce((acc, i) => (i.value > acc.value ? i : acc));
      const mainWeapon = x.weapon;
      return await mainWeapon;
    }

    async function trueLevel(player) {
      var trueLevelFinal = 0;
      if (player["level"] == 100) {
        trueLevelFinal = getTrueLevel(player["xp"]).then(async function (v) {
          trueLevelFinal = await v.level;
          return trueLevelFinal;
        });
      } else {
        trueLevelFinal = player["level"];
      }
      return await trueLevelFinal;
    }

    function passiveAggressiveAndTimePlayed(player) {
      var totalMatchTime = 0;
      var passiveAgressive = "";

      for (var k in player["legends"]) {
        totalMatchTime += player["legends"][k]["matchtime"];
      }
      const totalGames = player["games"];
      const averageGameLength = totalMatchTime / totalGames;

      if (averageGameLength < 175) {
        passiveAgressive = "Agressive";
      } else if (averageGameLength < 185) {
        passiveAgressive = "Neutral";
      } else {
        passiveAgressive = "Passive";
      }

      var hours = (totalMatchTime/60)/60;
      var rhours = Math.floor(hours);
      var minutes = (hours - rhours) * 60;
      var rminutes = Math.round(minutes);
      const totalMatchTimeFinal = rhours + "h " + rminutes + "m";


      const passiveAgressivetTimePlayed = [passiveAgressive, totalMatchTimeFinal];
      return passiveAgressivetTimePlayed;
    }


    const mainLevelCharacterObjectClient = await mainLevelCharacter(statsClientJSON);
    const mainRankedCharacterClient = await mainRankedCharacter(rankedClientJSON);
    const mainRankedCharacterPictureClient = await mainRankedCharacter(rankedClientJSON);
    const passiveAgressiveAndTimePlayedClient = await passiveAggressiveAndTimePlayed(statsClientJSON);


    const mainLevelCharacterFinalClient = mainLevelCharacterObjectClient[0];
    const mainRankedCharacterFinalClient = mainRankedCharacterClient[0];
    const mainRankedCharacterPictureFinalClient = mainRankedCharacterPictureClient[1];
    const mainWeaponFinalClient = await mainWeapon(statsClientJSON);
    const trueLevelFinalClient = await trueLevel(statsClientJSON);
    const passiveAgressiveFinalClient = passiveAgressiveAndTimePlayedClient[0];
    const timePlayedFinalClient = passiveAgressiveAndTimePlayedClient[1];

    // const playerNameClient = statsClientJSON["name"]
    const levelClient = statsClientJSON["level"]
    const peakRatingClient = rankedClientJSON["peak_rating"]
    // const regionClient = rankedClientJSON["region"]
    const ratingClient = rankedClientJSON["rating"]


    dataClientJSON = {
      playerName: usernameClient,
      level: levelClient,
      region: regionClient,
      rating: ratingClient,
      peakRating: peakRatingClient,
      globalRank: globalRankClient,
      regionRank: regionRankClient,
      mainLevelCharacter: mainLevelCharacterFinalClient,
      mainRankedCharacter: mainRankedCharacterFinalClient,
      pictureMainRankedCharacter: mainRankedCharacterPictureFinalClient,
      mainWeapon: mainWeaponFinalClient,
      trueLevel: trueLevelFinalClient,
      passiveAgressive: passiveAgressiveFinalClient,
      timePlayed: timePlayedFinalClient,
    };

    console.log(brawlIdClient);

    return res.json({
      success: true,
      dataClientJSON,
      // statsClientJSON,
      // rankedClientJSON,
      // miscClientJSON,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});





























/* username = the username of the opponent / elo = the elo of the client / the bralhalla id of the client */

app.get("/api/brawl/opponent/:usernameOpponent&:brawlIdClient&:ratingClient&:regionClient", async (req, res) => {
  try {
    const usernameOpponent = req.params.usernameOpponent;
    const ratingClient = req.params.ratingClient;
    const brawlIdClient = req.params.brawlIdClient;
    const regionClient = req.params.regionClient;


    /* brawlhalla API calls for collect the opponent and the client infos */

    async function apiCallStats(brawlID) {
      const playerStats = await fetch(
        // `https://api.brawlhalla.com/player/${brawlID}/stats?api_key=${process.env.BRAWL_API_KEY}`
        `https://brawlhalla-api.herokuapp.com/v1/stats/id?brawlhalla_id=${brawlID}`
      );
      var playerStatsJSON = await playerStats.json();
      playerStatsJSON = await playerStatsJSON["data"]

      return await playerStatsJSON;
    }

    async function apiCallRanked(brawlID) {
      const playerRanked = await fetch(
        // `https://api.brawlhalla.com/player/${brawlID}/ranked?api_key=${process.env.BRAWL_API_KEY}`
        `https://brawlhalla-api.herokuapp.com/v1/ranked/id?brawlhalla_id=${brawlID}`
      );
      var playerRankedJSON = await playerRanked.json();
      playerRankedJSON = await playerRankedJSON["data"]

      return await playerRankedJSON;
    }

    const searchPlayerGlobal = await fetch(
      `https://api.brawlhalla.com/rankings/1v1/all/1?name=${usernameOpponent}&api_key=${process.env.BRAWL_API_KEY}`
    );
    var searchPlayerGlobalJSON = await searchPlayerGlobal.json();

    const searchPlayerRegion = await fetch(
      `https://api.brawlhalla.com/rankings/1v1/${regionClient.toLowerCase()}/1?name=${usernameOpponent}&api_key=${process.env.BRAWL_API_KEY}`
    );
    var searchPlayerRegionJSON = await searchPlayerRegion.json();

    // console.log(searchPlayerRegionJSON, regionClient.toLowerCase())


/* functions to retrieve useful stats */
    function getInfosPlayerGlobalOpponent(searchPlayerGlobalJSON) {
      var result = [];
      var arrayElo = [];

      for (var k in searchPlayerGlobalJSON) {
        if (usernameOpponent == searchPlayerGlobalJSON[k]["name"] && regionClient == searchPlayerGlobalJSON[k]["region"]) {

          result.push(searchPlayerGlobalJSON[k]);
        }
      }

      for (var k in result) {
        arrayElo.push(result[k]["rating"]);
      }

      const closest = arrayElo.reduce((a, b) => {
        return Math.abs(b - ratingClient) < Math.abs(a - ratingClient) ? b : a;
      });

      var indexPlayer = result.findIndex(function (result) {
        return result.rating === closest;
      });

      return result[indexPlayer];
    }

    const infosOpponentGlobalJSON = await getInfosPlayerGlobalOpponent(await searchPlayerGlobalJSON);

    const brawlIdOpponent = infosOpponentGlobalJSON["brawlhalla_id"];
    const statsOpponentJSON = await apiCallStats(brawlIdOpponent);
    const rankedOpponentJSON = await apiCallRanked(brawlIdOpponent);



    /* functions to retrieve useful stats */
    function getInfosPlayerRegionOpponent(searchPlayerRegion) {
      var result = [];

      for (var k in searchPlayerRegion) {
        if (usernameOpponent == searchPlayerRegion[k]["name"] && brawlIdOpponent == searchPlayerRegion[k]["brawlhalla_id"]) {

          result.push(searchPlayerRegion[k]);
        }
      }

      return result[0];
    }

    const infosOpponentRegionJSON = await getInfosPlayerRegionOpponent(await searchPlayerRegionJSON);
    
    // console.log(infosOpponentRegionJSON)

    const globalRankOpponent = await infosOpponentGlobalJSON["rank"];
    const regionRankOpponent = await infosOpponentRegionJSON["rank"];
    // console.log(globalRankOpponent, regionRankOpponent)






    /* retrieve the main character of the client or the opponent */
    async function mainLevelCharacter(player) {
      var mainLevelCharacter = 0;
      var idMainLevelCharacter = 0;
      
      for (var k in player["legends"]) {
        if (player["legends"][k]["xp"] > mainLevelCharacter) {
          mainLevelCharacter = player["legends"][k]["xp"];
          idMainLevelCharacter = k;
        }
      }

      const lvlCharacter = player["legends"][idMainLevelCharacter]["level"];

      var mainLevelCharacterInfos = await getCharacterById(player["legends"][idMainLevelCharacter]["legend_id"]).then(async function (v) {
        nameCharacter = await v.bio_name;
        picture = await v.picture;
        mainLevelCharacterInfosFinal = [nameCharacter, picture]
        // console.log(mainLevelCharacterInfosFinal)
        return await mainLevelCharacterInfosFinal;
      });

      mainLevelCharacterInfos[0] = mainLevelCharacterInfos[0] + " (Lvl " + lvlCharacter + ")"

      // const mainLevelCharacterFinal = player["legends"][idMainLevelCharacter]["legend_name_key"].charAt(0).toUpperCase() + player["legends"][idMainLevelCharacter]["legend_name_key"].slice(1);

      return await mainLevelCharacterInfos; //mettre en format json avec les autres infos obtenus
    }

    async function mainRankedCharacter(player) {
      var mainRankedCharacter = 0;
      var idMainRankedCharacter = 0;

      for (var k in player["legends"]) {
        if (player["legends"][k]["rating"] > mainRankedCharacter) {
          mainRankedCharacter = player["legends"][k]["rating"];
          idMainRankedCharacter = k;
        }
      }

      const ratingCharacter = player["legends"][idMainRankedCharacter]["rating"];

      var mainRankedCharacterInfos = await getCharacterById(player["legends"][idMainRankedCharacter]["legend_id"]).then(async function (v) {
        nameCharacter = await v.bio_name;
        picture = await v.picture;
        mainRankedCharacterInfosFinal = [nameCharacter, picture]
        return await mainRankedCharacterInfosFinal;
      });

      mainRankedCharacterInfos[0] = mainRankedCharacterInfos[0] + " (" + ratingCharacter + ")"

      return mainRankedCharacterInfos;
    }

    /* retrieve the main weapon of the client or the opponent */
    async function mainWeapon(player) {
      var Hammer = 0;
      var Sword = 0;
      var Pistol = 0;
      var RocketLance = 0;
      var Spear = 0;
      var Katar = 0;
      var Axe = 0;
      var Bow = 0;
      var Fists = 0;
      var Scythe = 0;
      var Cannon = 0;
      var Orb = 0;
      var Greatsword = 0;

      for (var k in player["legends"]) {
        weapon1 = getWeaponOneAndTwo(
          player["legends"][k]["legend_name_key"]
        ).then(async function (v) {
          weapon1 = await v.weapon_one;
          return weapon1;
        });
        weapon2 = getWeaponOneAndTwo(
          player["legends"][k]["legend_name_key"]
        ).then(async function (v) {
          weapon2 = await v.weapon_two;
          return weapon2;
        });
        // console.log(await weapon1,await weapon2,k,player["legends"][k]["timeheldweaponone"],player["legends"][k]["timeheldweapontwo"]);
        eval(
          (await weapon1) + " += " + player["legends"][k]["timeheldweaponone"]
        );
        eval(
          (await weapon2) + " += " + player["legends"][k]["timeheldweapontwo"]
        );
      }

      const arrayWeapons = [
        { weapon: "Hammer", value: Hammer },
        { weapon: "Sword", value: Sword },
        { weapon: "Pistol", value: Pistol },
        { weapon: "RocketLance", value: RocketLance },
        { weapon: "Spear", value: Spear },
        { weapon: "Katar", value: Katar },
        { weapon: "Axe", value: Axe },
        { weapon: "Bow", value: Bow },
        { weapon: "Fists", value: Fists },
        { weapon: "Scythe", value: Scythe },
        { weapon: "Cannon", value: Cannon },
        { weapon: "Orb", value: Orb },
        { weapon: "Greatsword", value: Greatsword },
      ];

      var x = arrayWeapons.reduce((acc, i) => (i.value > acc.value ? i : acc));
      const mainWeapon = x.weapon;
      return await mainWeapon;
    }

    async function trueLevel(player) {
      var trueLevelFinal = 0;
      if (player["level"] == 100) {
        trueLevelFinal = getTrueLevel(player["xp"]).then(async function (v) {
          trueLevelFinal = await v.level;
          return trueLevelFinal;
        });
      } else {
        trueLevelFinal = player["level"];
      }
      return await trueLevelFinal;
    }

    function passiveAggressiveAndTimePlayed(player) {
      var totalMatchTime = 0;
      var passiveAgressive = "";

      for (var k in player["legends"]) {
        totalMatchTime += player["legends"][k]["matchtime"];
      }
      const totalGames = player["games"];
      const averageGameLength = totalMatchTime / totalGames;

      if (averageGameLength < 175) {
        passiveAgressive = "Agressive";
      } else if (averageGameLength < 185) {
        passiveAgressive = "Neutral";
      } else {
        passiveAgressive = "Passive";
      }

      var hours = (totalMatchTime/60)/60;
      var rhours = Math.floor(hours);
      var minutes = (hours - rhours) * 60;
      var rminutes = Math.round(minutes);
      const totalMatchTimeFinal = rhours + "h " + rminutes + "m";


      const passiveAgressivetTimePlayed = [passiveAgressive, totalMatchTimeFinal];
      return passiveAgressivetTimePlayed;
    }



    const mainLevelCharacterObjectOpponent = await mainLevelCharacter(statsOpponentJSON);
    const mainRankedCharacterOpponent = await mainRankedCharacter(rankedOpponentJSON);
    const mainRankedCharacterPictureOpponent = await mainRankedCharacter(rankedOpponentJSON);
    const passiveAgressiveAndTimePlayedOpponent = await passiveAggressiveAndTimePlayed(statsOpponentJSON);



    const mainLevelCharacterFinalOpponent = mainLevelCharacterObjectOpponent[0];
    const mainRankedCharacterFinalOpponent = mainRankedCharacterOpponent[0];
    const mainRankedCharacterPictureFinalOpponent = mainRankedCharacterPictureOpponent[1];
    const mainWeaponFinalOpponent = await mainWeapon(statsOpponentJSON);
    const trueLevelFinalOpponent = await trueLevel(statsOpponentJSON);
    const passiveAgressiveFinalOpponent = passiveAgressiveAndTimePlayedOpponent[0];
    const timePlayedFinalOpponent = passiveAgressiveAndTimePlayedOpponent[1];

    const levelOpponent = statsOpponentJSON["level"]
    const regionOpponent = rankedOpponentJSON["region"]
    const ratingOpponent = rankedOpponentJSON["rating"]
    const peakRatingOpponent = rankedOpponentJSON["peak_rating"]


    dataOpponentJSON = {
      playerName: usernameOpponent,
      level: levelOpponent,
      region: regionOpponent,
      rating: ratingOpponent,
      peakRating: peakRatingOpponent,
      globalRank: globalRankOpponent,
      regionRank: regionRankOpponent,
      mainLevelCharacter: mainLevelCharacterFinalOpponent,
      mainRankedCharacter: mainRankedCharacterFinalOpponent,
      pictureMainRankedCharacter: mainRankedCharacterPictureFinalOpponent,
      mainWeapon: mainWeaponFinalOpponent,
      trueLevel: trueLevelFinalOpponent,
      passiveAgressive: passiveAgressiveFinalOpponent,
      timePlayed: timePlayedFinalOpponent,
    };

    console.log(usernameOpponent, brawlIdClient);

    return res.json({
      success: true,
      dataOpponentJSON,
      // statsOpponentJSON,
      // infosOpponentJSON,
      // miscOpponentJSON,

    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

//PORT ENVIRONMENT VARIABLE
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}...`));

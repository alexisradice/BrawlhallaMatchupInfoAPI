require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const Joi = require("joi");
var cors = require("cors");
const utf8 = require('utf8');
const rateLimit = require("express-rate-limit");
const { MongoClient } = require("mongodb");
const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // limit each IP to {max} requests per {windowMs}
});

//  apply to all requests
app.use(limiter);
app.use(cors());

const bh_open_api = process.env.BRAWL_OPEN_API;

/* Connection to the database */
const uri = process.env.DATABASE_NAME;
const client = new MongoClient(uri);

/*get the name of the two weapons of a character */
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

/*get the name, id and image of a character */
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
    const info = await allLegends.findOne(query, options);
    // since this method returns the matched document, not a cursor, print it directly
    return await info;
  } finally {
    // await client.close();
  }
}
getCharacterById().catch(console.dir);

/*get the true level of a player according to his xp */
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



/* calls the API to retrieve a player's statistics (ranked) */
async function apiCallRanked(brawlID) {
  const playerRanked = await fetch(
    // `https://api.brawlhalla.com/player/${brawlID}/ranked?api_key=${process.env.BRAWL_API_KEY}`
    `${bh_open_api}/ranked/id?brawlhalla_id=${brawlID}`
  );
  var playerRankedJSON = await playerRanked.json();
  playerRankedJSON = await playerRankedJSON["data"];

  return await playerRankedJSON;
}

/* calls the API to retrieve a player's statistics (stats) */
async function apiCallStats(brawlID) {
  const playerStats = await fetch(
    // `https://api.brawlhalla.com/player/${brawlID}/stats?api_key=${process.env.BRAWL_API_KEY}`
    `${bh_open_api}/stats/id?brawlhalla_id=${brawlID}`
  );
  var playerStatsJSON = await playerStats.json();
  playerStatsJSON = playerStatsJSON["data"];
  playerStatsJSON['name'] = utf8.decode(playerStatsJSON['name']);
  playerStatsJSON['name'] = playerStatsJSON['name'].replace(/#/g, "%23").replace(/&/g, "%26");

  return await playerStatsJSON;

}

/* retrieve the global rank of a player */
async function apiCallSearchPlayerGlobal(usernamePlayer){
  const searchPlayerGlobal = await fetch(
    `https://api.brawlhalla.com/rankings/1v1/all/1?name=${usernamePlayer}&api_key=${process.env.BRAWL_API_KEY}`
  );


  var searchPlayerGlobalJSON = await searchPlayerGlobal.json();

  searchPlayerGlobalJSON[0]['name'] = utf8.decode(searchPlayerGlobalJSON[0]['name']);
  searchPlayerGlobalJSON[0]['name'] = searchPlayerGlobalJSON[0]['name'].replace(/#/g, "%23").replace(/&/g, "%26");

  return searchPlayerGlobalJSON;
}

/* retrieve the regional rank of a player */
async function apiCallSearchPlayerRegion(usernamePlayer, regionClient){
  const searchPlayerRegion = await fetch(
    `https://api.brawlhalla.com/rankings/1v1/${regionClient.toLowerCase()}/1?name=${usernamePlayer}&api_key=${process.env.BRAWL_API_KEY}`
  );
  var searchPlayerRegionJSON = await searchPlayerRegion.json();
  searchPlayerRegionJSON[0]['name'] = utf8.decode(searchPlayerRegionJSON[0]['name']);
  searchPlayerRegionJSON[0]['name'] = searchPlayerRegionJSON[0]['name'].replace(/#/g, "%23").replace(/&/g, "%26");

  return searchPlayerRegionJSON;
}

/* function to retrieve useful stats */
function getInfoPlayerClient(usernameClient, brawlIdClient, searchPlayerGlobal, searchPlayerRegion) {
  var result = [];

  for (var k in searchPlayerGlobal) {
    // console.log(usernameClient, searchPlayerGlobal[k]["name"], brawlIdClient, searchPlayerGlobal[k]["brawlhalla_id"]);

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

/* finds a player's main (lvl) */
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

  var mainLevelCharacterInfo = await getCharacterById(player["legends"][idMainLevelCharacter]["legend_id"]).then(async function (v) {
    nameCharacter = await v.bio_name;
    picture = await v.picture;
    mainLevelCharacterInfoFinal = [nameCharacter, picture]
    return await mainLevelCharacterInfoFinal;
  });

  mainLevelCharacterInfo[0] = mainLevelCharacterInfo[0] + " (Lvl " + lvlCharacter + ")"


  return await mainLevelCharacterInfo; //put in json format with the other info obtained 
}

/* finds a player's main (elo) */
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

  var mainRankedCharacterInfo = await getCharacterById(player["legends"][idMainRankedCharacter]["legend_id"]).then(async function (v) {
    nameCharacter = await v.bio_name;
    picture = await v.picture;
    mainRankedCharacterInfoFinal = [nameCharacter, picture]
    return await mainRankedCharacterInfoFinal;
  });

  mainRankedCharacterInfo[0] = mainRankedCharacterInfo[0] + " (" + ratingCharacter + ")"


  return mainRankedCharacterInfo; //put in json format with the other info obtained 
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
  var Boots = 0;
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
    { weapon: "Boots", value: Boots },
  ];
  var x = arrayWeapons.reduce((acc, i) => (i.value > acc.value ? i : acc));
  const mainWeapon = x.weapon;
  return await mainWeapon;
}

function totalCharactersLevels(player) {
  var totalLevel = 0;

  for (var k in player["legends"]) {
    totalLevel += player["legends"][k]["level"];
  }
  return totalLevel;
}

/* retrieve the true level of a player */
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

/* finds if the player is passive or aggressive with his average game length */
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

function getClan(player)
{
  var clanClient = "";
  if (player["clan"] !== undefined)
  {
    clanClient = player["clan"]["clan_name"];
  }
  else
  {
    clanClient = "No Clan";
  }
  return clanClient;
}

/* function to retrieve useful stats */
function getInfoPlayerGlobalOpponent(usernameOpponent, regionClient, ratingClient, searchPlayerGlobalJSON) {
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

/* function to retrieve useful stats */
function getInfoPlayerRegionOpponent(usernameOpponent, brawlIdOpponent, searchPlayerRegion) {
  var result = [];

  for (var k in searchPlayerRegion) {
    if (usernameOpponent == searchPlayerRegion[k]["name"] && brawlIdOpponent == searchPlayerRegion[k]["brawlhalla_id"]) {

      result.push(searchPlayerRegion[k]);
    }
  }

  return result[0];
}




/* Main API page and page for display a legend picture with a legend parameter */

//READ Request Handlers

/* api homepage */
app.get("/", (req, res) => {
  res.send("Welcome to the Brawlhalla Matchup Info API");
});

/* all legends pictures */
app.get("/api/brawl/legends/:legend_name", function (req, res) {
  const legendName = req.params.legend_name;
  res.sendFile(__dirname + "/img/legends/" + legendName + ".png");
});

/* screenshots */
app.get("/api/brawl/screenshots/:screenshot_number", function (req, res) {
  const screenshotNumber = req.params.screenshot_number;
  res.sendFile(__dirname + "/img/screenshots/screenshot" + screenshotNumber +".jpg");
});

/* access to the loading image */
app.get("/api/brawl/img/imgLoading", function (req, res) {
  res.sendFile(__dirname + "/img/imgLoading.jpg");
});

/* access to the swf mod */
app.get("/api/brawl/mod/UI_1.swf", function (req, res) {
  res.sendFile(__dirname + "/mod/UI_1.swf");
});

/* access to the BrawlhallaModLoader mod */
app.get("/api/brawl/mod/BrawlhallaMatchupInfoMod.bmod", function (req, res) {
  res.sendFile(__dirname + "/mod/BrawlhallaMatchupInfoMod.bmod");
});

/* test if a player exists with his brawlhalla id */
app.get("/api/brawl/test/:brawlIdClient", async (req, res) => {
  try {

    const brawlIdClient = req.params.brawlIdClient;


    const rankedClientJSON = await apiCallRanked(brawlIdClient);
    var ratingClient = 0;
    try {
      ratingClient = rankedClientJSON["rating"]
    } catch (error) {
      ratingClient = undefined
    }

    if (ratingClient === undefined){
      var correctIdBool = false
    }else{
      var correctIdBool = true
    }

    result = {
      correctID: correctIdBool,
      waitingTime: 10,
    };

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



/* prepare the desired statistics for the client */
app.get("/api/brawl/client/:brawlIdClient", async (req, res) => {
  try {

    const brawlIdClient = req.params.brawlIdClient;

    const statsClientJSON = await apiCallStats(brawlIdClient);
    const rankedClientJSON = await apiCallRanked(brawlIdClient);

    const usernameClient = await statsClientJSON["name"];
    const regionClient = rankedClientJSON["region"];

    const gamesClient =  await rankedClientJSON["games"]
    const winsClient =  await rankedClientJSON["wins"]
    const losesClient =  await rankedClientJSON["games"] - await rankedClientJSON["wins"]
    const winrateClient =  (winsClient / gamesClient * 100).toFixed(2) + "% (" + winsClient + "-" + losesClient + ")";
    


    const searchPlayerGlobalJSON = await apiCallSearchPlayerGlobal(usernameClient);
    const searchPlayerRegionJSON = await apiCallSearchPlayerRegion(usernameClient, regionClient);

    const infoClientJSON = await getInfoPlayerClient(usernameClient, brawlIdClient, await searchPlayerGlobalJSON, await searchPlayerRegionJSON);

    const globalRankClient = await infoClientJSON[0]["rank"];
    const regionRankClient = await infoClientJSON[1]["rank"];
 
    const mainLevelCharacterClient = await mainLevelCharacter(statsClientJSON);
    const mainRankedCharacterClient = await mainRankedCharacter(rankedClientJSON);
    const passiveAgressiveAndTimePlayedClient = await passiveAggressiveAndTimePlayed(statsClientJSON);

    const mainLevelCharacterFinalClient = mainLevelCharacterClient[0];
    const mainLevelCharacterPictureFinalClient = mainLevelCharacterClient[1];
    const mainRankedCharacterFinalClient = mainRankedCharacterClient[0];
    const mainRankedCharacterPictureFinalClient = mainRankedCharacterClient[1];

    const mainWeaponFinalClient = await mainWeapon(statsClientJSON);

    const trueLevelFinalClient = await trueLevel(statsClientJSON);

    const passiveAgressiveFinalClient = passiveAgressiveAndTimePlayedClient[0];
    const timePlayedFinalClient = passiveAgressiveAndTimePlayedClient[1];

    const levelClient = statsClientJSON["level"];
    const peakRatingClient = rankedClientJSON["peak_rating"];
    const ratingClient = rankedClientJSON["rating"];
    const clanClient = getClan(statsClientJSON);
    const totalCharactersLevelsClient = totalCharactersLevels(statsClientJSON);

    dataClientJSON = {
      playerName: usernameClient.replace(/%23/g, "#").replace(/%26/g, "&"),
      level: levelClient,
      region: regionClient,
      rating: ratingClient,
      peakRating: peakRatingClient,
      globalRank: globalRankClient,
      regionRank: regionRankClient,
      mainLevelCharacter: mainLevelCharacterFinalClient,
      mainRankedCharacter: mainRankedCharacterFinalClient,
      pictureMainLevelCharacter: mainLevelCharacterPictureFinalClient.replace(/ /g, "_"),
      pictureMainRankedCharacter: mainRankedCharacterPictureFinalClient.replace(/ /g, "_"),
      mainWeapon: mainWeaponFinalClient,
      trueLevel: trueLevelFinalClient,
      passiveAgressive: passiveAgressiveFinalClient,
      timePlayed: timePlayedFinalClient,
      winrate: winrateClient,
      clan: clanClient,
      totalCharactersLevels: totalCharactersLevelsClient,
    };

    console.log(usernameClient, brawlIdClient);

    return res.json({
      success: true,
      dataClientJSON,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});



/* prepare the desired statistics for the opponent */
app.get("/api/brawl/opponent/:usernameOpponent&:ratingClient&:regionClient", async (req, res) => {
  try {
    const usernameOpponent = req.params.usernameOpponent;
    const ratingClient = req.params.ratingClient;
    const regionClient = req.params.regionClient;

    const searchPlayerGlobalJSON = await apiCallSearchPlayerGlobal(usernameOpponent);
    const searchPlayerRegionJSON = await apiCallSearchPlayerRegion(usernameOpponent, regionClient);

    const infoOpponentGlobalJSON = await getInfoPlayerGlobalOpponent(usernameOpponent, regionClient, ratingClient, await searchPlayerGlobalJSON);

    const brawlIdOpponent = infoOpponentGlobalJSON["brawlhalla_id"];
    const statsOpponentJSON = await apiCallStats(brawlIdOpponent);
    const rankedOpponentJSON = await apiCallRanked(brawlIdOpponent);

    const gamesOpponent =  await rankedOpponentJSON["games"]
    const winsOpponent =  await rankedOpponentJSON["wins"]
    const losesOpponent =  await rankedOpponentJSON["games"] - await rankedOpponentJSON["wins"]
    const winrateOpponent =  (winsOpponent / gamesOpponent * 100).toFixed(2) + "% (" + winsOpponent + "-" + losesOpponent + ")";

    const infoOpponentRegionJSON = await getInfoPlayerRegionOpponent(usernameOpponent, brawlIdOpponent, await searchPlayerRegionJSON);

    const globalRankOpponent = await infoOpponentGlobalJSON["rank"];
    const regionRankOpponent = await infoOpponentRegionJSON["rank"];

    const mainLevelCharacterOpponent = await mainLevelCharacter(statsOpponentJSON);
    const mainRankedCharacterOpponent = await mainRankedCharacter(rankedOpponentJSON);
    const passiveAgressiveAndTimePlayedOpponent = await passiveAggressiveAndTimePlayed(statsOpponentJSON);

    const mainLevelCharacterFinalOpponent = mainLevelCharacterOpponent[0];
    const mainLevelCharacterPictureFinalOpponent = mainLevelCharacterOpponent[1];
    const mainRankedCharacterFinalOpponent = mainRankedCharacterOpponent[0];
    const mainRankedCharacterPictureFinalOpponent = mainRankedCharacterOpponent[1];
    const mainWeaponFinalOpponent = await mainWeapon(statsOpponentJSON);
    const trueLevelFinalOpponent = await trueLevel(statsOpponentJSON);
    const passiveAgressiveFinalOpponent = passiveAgressiveAndTimePlayedOpponent[0];
    const timePlayedFinalOpponent = passiveAgressiveAndTimePlayedOpponent[1];

    const levelOpponent = statsOpponentJSON["level"]
    const regionOpponent = rankedOpponentJSON["region"]
    const ratingOpponent = rankedOpponentJSON["rating"]
    const peakRatingOpponent = rankedOpponentJSON["peak_rating"]

    const clanOpponent = getClan(statsOpponentJSON);
    const totalCharactersLevelsOpponent = totalCharactersLevels(statsOpponentJSON);


    dataOpponentJSON = {
      playerName: usernameOpponent.replace(/%23/g, "#").replace(/%26/g, "&"),
      brawlID: brawlIdOpponent,
      level: levelOpponent,
      region: regionOpponent,
      rating: ratingOpponent,
      peakRating: peakRatingOpponent,
      globalRank: globalRankOpponent,
      regionRank: regionRankOpponent,
      mainLevelCharacter: mainLevelCharacterFinalOpponent,
      mainRankedCharacter: mainRankedCharacterFinalOpponent,
      pictureMainLevelCharacter: mainLevelCharacterPictureFinalOpponent.replace(/ /g, "_"),
      pictureMainRankedCharacter: mainRankedCharacterPictureFinalOpponent.replace(/ /g, "_"),
      mainWeapon: mainWeaponFinalOpponent,
      trueLevel: trueLevelFinalOpponent,
      passiveAgressive: passiveAgressiveFinalOpponent,
      timePlayed: timePlayedFinalOpponent,
      winrate: winrateOpponent,
      clan: clanOpponent,
      totalCharactersLevels: totalCharactersLevelsOpponent,
    };

    console.log(usernameOpponent, brawlIdOpponent);

    return res.json({
      success: true,
      dataOpponentJSON,

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

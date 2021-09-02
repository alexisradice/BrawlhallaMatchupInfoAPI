require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const Joi = require("joi");
const puppeteer = require("puppeteer");
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

const uri =
  "mongodb+srv://alexis:rooot@cluster0.puhjk.mongodb.net/brawlData?retryWrites=true&w=majority";

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




/* corehalla scraping for the ids because for the moment no offsets or other strat */
/* username = the username of the opponent / elo = the elo of the client / the bralhalla id of the client */

app.get("/api/brawl/:usernameOpponent&:brawlIDClient", async (req, res) => {
  try {
    const username = req.params.usernameOpponent;
    // const elo = req.params.elo;
    const brawlIDClient = req.params.brawlIDClient;


    /* brawlhalla API calls for collect the opponent and the client infos */

    async function apiCallStats(brawlID) {
      const playerStats = await fetch(
        `https://api.brawlhalla.com/player/${brawlID}/stats?api_key=${process.env.BRAWL_API_KEY}`
      );
      var playerStatsJSON = await playerStats.json();

      return await playerStatsJSON;

      // const playerRanked = await fetch(
      //   `https://api.brawlhalla.com/player/${BrawlIDFinal}/ranked?api_key=${process.env.BRAWL_API_KEY}`
      // );
      // var playerRankedJSON = await playerRanked.json();

      // const playerClientStats = await fetch(
      //   `https://api.brawlhalla.com/player/${brawlIDClient}/stats?api_key=${process.env.BRAWL_API_KEY}`
      // );
      // var playerClientStatsJSON = await playerClientStats.json();

      // const playerClientRanked = await fetch(
      //   `https://api.brawlhalla.com/player/${brawlIDClient}/ranked?api_key=${process.env.BRAWL_API_KEY}`
      // );
      // var playerClientRankedJSON = await playerClientRanked.json();
    }

    async function apiCallRanked(brawlID) {
      const playerRanked = await fetch(
        `https://api.brawlhalla.com/player/${brawlID}/ranked?api_key=${process.env.BRAWL_API_KEY}`
      );
      var playerRankedJSON = await playerRanked.json();

      return await playerRankedJSON;
    }

    const statsClientJSON = await apiCallStats(brawlIDClient);
    const rankedClientJSON = await apiCallRanked(brawlIDClient);
    const regionClient = rankedClientJSON["region"];
    const ratingClient = rankedClientJSON["rating"];

    const searchPlayer = await fetch(
      `https://api.brawlhalla.com/rankings/1v1/all/1?name=${username}&api_key=${process.env.BRAWL_API_KEY}`
    );
    var searchPlayerJSON = await searchPlayer.json();
    // console.log(searchPlayerJSON);


    function getInfoPlayers(searchPlayerJSON) {
      var result = [];
      var arrayElo = [];

      for (var k in searchPlayerJSON) {
        if (username == searchPlayerJSON[k]["name"] && regionClient == searchPlayerJSON[k]["region"]) {
          // console.log(searchPlayerJSON[k]);
          result.push(searchPlayerJSON[k]);
        }
      }

      // console.log(result[1])

      for (var k in result) {
        arrayElo.push(result[k]["rating"]);
      }

      const closest = arrayElo.reduce((a, b) => {
        return Math.abs(b - ratingClient) < Math.abs(a - ratingClient) ? b : a;
      });

      // console.log(closest);

      var indexPlayer = result.findIndex(function (result) {
        return result.rating === closest;
      });

      // console.log(indexElo);

      return result[indexPlayer];
    }

    const infosOpponentJSON = await getInfoPlayers(await searchPlayerJSON);

    const brawlIdOpponent = infosOpponentJSON["brawlhalla_id"];
    const statsOpponentJSON = await apiCallStats(brawlIdOpponent);
    const rankedOpponentJSON = await apiCallRanked(brawlIdOpponent);
    // const ratingOpponent = infosOpponentJSON["rating"];
    // const peakRatingOpponent = infosOpponentJSON["peak_rating"];

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

      // const mainRankedCharacterFinal = player["legends"][idMainRankedCharacter]["legend_name_key"].charAt(0).toUpperCase() + player["legends"][idMainRankedCharacter]["legend_name_key"].slice(1);

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

/*
    var mainRankedCharacterInfos = await getCharacterById(infosOpponentJSON["best_legend"]).then(async function (v) {
      nameCharacter = await v.bio_name;
      idCharacter = await v.legend_id;
      picture = await v.picture;


      // mainRankedCharacterInfos[0] = mainRankedCharacterInfos[0] + " (" + ratingCharacter + ")";

      var mainRankedCharacterInfosFinal = [nameCharacter, picture, idCharacter];

      return await mainRankedCharacterInfosFinal;
    });
*/



    const mainLevelCharacterObjectOpponent = await mainLevelCharacter(statsOpponentJSON);
    const mainLevelCharacterObjectClient = await mainLevelCharacter(statsClientJSON);
    const mainRankedCharacterOpponent = await mainRankedCharacter(rankedOpponentJSON);
    const mainRankedCharacterClient = await mainRankedCharacter(rankedClientJSON);
    const mainRankedCharacterPictureOpponent = await mainRankedCharacter(rankedOpponentJSON);
    const mainRankedCharacterPictureClient = await mainRankedCharacter(rankedClientJSON);
    const passiveAgressiveAndTimePlayedOpponent = await passiveAggressiveAndTimePlayed(statsOpponentJSON);
    const passiveAgressiveAndTimePlayedClient = await passiveAggressiveAndTimePlayed(statsClientJSON);




    const mainLevelCharacterFinalOpponent = mainLevelCharacterObjectOpponent[0];
    const mainLevelCharacterFinalClient = mainLevelCharacterObjectClient[0];

    // const mainRankedCharacterFinalOpponent = mainRankedCharacterInfos[0];
    const mainRankedCharacterFinalOpponent = mainRankedCharacterOpponent[0];
    const mainRankedCharacterFinalClient = mainRankedCharacterClient[0];

    // const mainRankedCharacterPictureFinalOpponent = mainRankedCharacterInfos[1];
    const mainRankedCharacterPictureFinalOpponent = mainRankedCharacterPictureOpponent[1];
    const mainRankedCharacterPictureFinalClient = mainRankedCharacterPictureClient[1];

    const mainWeaponFinalOpponent = await mainWeapon(statsOpponentJSON);
    const mainWeaponFinalClient = await mainWeapon(statsClientJSON);

    const trueLevelFinalOpponent = await trueLevel(statsOpponentJSON);
    const trueLevelFinalClient = await trueLevel(statsClientJSON);

    const passiveAgressiveFinalOpponent = passiveAgressiveAndTimePlayedOpponent[0];
    const passiveAgressiveFinalClient = passiveAgressiveAndTimePlayedClient[0];

    const timePlayedFinalOpponent = passiveAgressiveAndTimePlayedOpponent[1];
    const timePlayedFinalClient = passiveAgressiveAndTimePlayedClient[1];


    miscOpponentJSON = {
      mainLevelCharacter: mainLevelCharacterFinalOpponent,
      mainRankedCharacter: mainRankedCharacterFinalOpponent,
      pictureMainRankedCharacter: mainRankedCharacterPictureFinalOpponent,
      mainWeapon: mainWeaponFinalOpponent,
      trueLevel: trueLevelFinalOpponent,
      passiveAgressive: passiveAgressiveFinalOpponent,
      timePlayed: timePlayedFinalOpponent,
    };

    miscClientJSON = {
      mainLevelCharacter: mainLevelCharacterFinalClient,
      mainRankedCharacter: mainRankedCharacterFinalClient,
      pictureMainRankedCharacter: mainRankedCharacterPictureFinalClient,
      mainWeapon: mainWeaponFinalClient,
      trueLevel: trueLevelFinalClient,
      passiveAgressive: passiveAgressiveFinalClient,
      timePlayed: timePlayedFinalClient,
    };

    console.log(username, brawlIDClient);

    return res.json({
      success: true,
      statsOpponentJSON,
      infosOpponentJSON,
      // playerRankedJSON,
      miscOpponentJSON,
      statsClientJSON,
      rankedClientJSON,
      miscClientJSON,
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

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
async function weaponOneAndTwoNames(legendName) {
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
weaponOneAndTwoNames().catch(console.dir);











/* Main API page and page for display a legend picture with a legend parameter */

//READ Request Handlers
app.get("/", (req, res) => {
  res.send("Welcome to the API");
});

console.log();

app.get("/api/brawl/legends/:legend_name", function (req, res) {
  const legendName = req.params.legend_name;
  res.sendFile(__dirname + "/legends/" + legendName + ".png");
});




/* corehalla scraping for the ids because for the moment no offsets or other strat */
/* username = the username of the opponent / elo = the elo of the client / the bralhalla id of the client */

app.get("/api/brawl/:username&:elo&:brawlIDClient", async (req, res) => {
  try {
    const username = req.params.username;
    const elo = req.params.elo;
    const brawlIDClient = req.params.brawlIDClient;

    var BrawlID = (async function main() {
      try {
        const browser = await puppeteer.launch();
        const [page] = await browser.pages();

        await page.goto("http://corehalla.com/leaderboard?p=" + username + "", {
          waitUntil: "networkidle0",
        });

        // const data = await page.evaluate(() =>(data = document.querySelector(".leaderboard_table_container").querySelectorAll(".even_row").innerHTML));

        const data = await page.evaluate(() => {
          return {
            // names: Array.from(
            //   document.querySelectorAll(".dotted_underline"),
            //   (e) => e.text
            // ),
            ids: Array.from(
              document.querySelectorAll(".dotted_underline"),
              (e) => e.href
            ),
            allData: Array.from(document.querySelectorAll("table tr td")).map(
              (td) => td.innerText
            ),
          };
        });

        idsBH = data.ids;
        idsBH.splice(0, 12);
        idsBHFinal = [];

        for (var i = 0; i < idsBH.length; i++) {
          var split = idsBH[i].split("/");
          idsBHFinal.push(split[5]);
        }

        allData = data.allData;

        // Rank = 0
        // Region = 1
        // Name = 2
        // Tier = 3
        // Games = 4
        // Win-Loss = 5
        // Rating = 6
        // Peak Rating = 7

        const names = getInfoPlayers(2);
        const ratings = getInfoPlayers(6);

        function getInfoPlayers(index) {
          var result = [];
          for (var i = index; i < allData.length; i = i + 8) {
            result.push(allData[i]);
          }
          return result;
        }

        arrayPlayersBhID = [names, idsBHFinal, ratings];
        arrayPlayersBhIDFinal = [[], [], []];

        for (var i = 0; i < arrayPlayersBhID[0].length; i++) {
          if (arrayPlayersBhID[0][i] == username) {
            arrayPlayersBhIDFinal[0].push(arrayPlayersBhID[0][i]);
            arrayPlayersBhIDFinal[1].push(arrayPlayersBhID[1][i]);
            arrayPlayersBhIDFinal[2].push(arrayPlayersBhID[2][i]);
          }
        }
        const ratingsFinal = arrayPlayersBhIDFinal[2];

        const closest = ratingsFinal.reduce((a, b) => {
          return Math.abs(b - elo) < Math.abs(a - elo) ? b : a;
        });

        var indexElo = arrayPlayersBhIDFinal[2].indexOf(closest);
        BrawlID = arrayPlayersBhIDFinal[1][indexElo];

        await browser.close();
        return BrawlID;
      } catch (err) {
        console.error(err);
      }
    })();

    /* brawlhalla API calls for collect the opponent and the client infos */

    const BrawlIDFinal = await BrawlID;
    const playerStats = await fetch(
      `https://api.brawlhalla.com/player/${BrawlIDFinal}/stats?api_key=${process.env.BRAWL_API_KEY}`
    );
    var playerStatsJSON = await playerStats.json();

    const playerRanked = await fetch(
      `https://api.brawlhalla.com/player/${BrawlIDFinal}/ranked?api_key=${process.env.BRAWL_API_KEY}`
    );
    var playerRankedJSON = await playerRanked.json();

    const playerClientStats = await fetch(
      `https://api.brawlhalla.com/player/${brawlIDClient}/stats?api_key=${process.env.BRAWL_API_KEY}`
    );
    var playerClientStatsJSON = await playerClientStats.json();

    const playerClientRanked = await fetch(
      `https://api.brawlhalla.com/player/${brawlIDClient}/ranked?api_key=${process.env.BRAWL_API_KEY}`
    );
    var playerClientRankedJSON = await playerClientRanked.json();

    /* retrieve the main character of the client or the opponent */

    function mainCharacter(player) {
      var bestLevelCharacter = 0;
      var idBestCharacter = 0;

      for (var k in player["legends"]) {
        if (player["legends"][k]["xp"] > bestLevelCharacter) {
          bestLevelCharacter = player["legends"][k]["xp"];
          idBestCharacter = k;
        }
      }
      const mainCharacter =
        player["legends"][idBestCharacter]["legend_name_key"]
          .charAt(0)
          .toUpperCase() +
        player["legends"][idBestCharacter]["legend_name_key"].slice(1);

      return mainCharacter; //mettre en format json avec les autres infos obtenus
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
        weapon1 = weaponOneAndTwoNames(
          player["legends"][k]["legend_name_key"]
        ).then(async function (v) {
          weapon1 = await v.weapon_one;
          return weapon1;
        });
        weapon2 = weaponOneAndTwoNames(
          player["legends"][k]["legend_name_key"]
        ).then(async function (v) {
          weapon2 = await v.weapon_two;
          return weapon2;
        });
        // console.log(await weapon1, await weapon2, k, player["legends"][k]["timeheldweaponone"], player["legends"][k]["timeheldweapontwo"]);
        eval(weapon1 + " += " + player["legends"][k]["timeheldweaponone"]);
        eval(weapon2 + " += " + player["legends"][k]["timeheldweapontwo"]);
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

    const mainCharacterFinal = mainCharacter(playerStatsJSON);
    const mainCharacterFinalClient = mainCharacter(playerClientStatsJSON);

    const mainWeaponFinal = await mainWeapon(playerStatsJSON);
    const mainWeaponFinalClient = await mainWeapon(playerClientStatsJSON);

    playerOtherJSON = {
      mainCharacterFinal: mainCharacterFinal,
      mainWeaponFinal: mainWeaponFinal,
    };

    playerClientOtherJSON = {
      mainCharacterFinal: mainCharacterFinalClient,
      mainWeaponFinal: mainWeaponFinalClient,
    };

    return res.json({
      success: true,
      playerStatsJSON,
      playerRankedJSON,
      playerOtherJSON,
      playerClientStatsJSON,
      playerClientRankedJSON,
      playerClientOtherJSON,
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

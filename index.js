require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const Joi = require("joi"); //used for validation
const puppeteer = require("puppeteer");
var cors = require("cors");
const rateLimit = require("express-rate-limit");
const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to {max} requests per {windowMs}
});

//  apply to all requests
app.use(limiter);

app.use(cors());


//READ Request Handlers
app.get("/", (req, res) => {
  res.send("Welcome to the API");
});


app.get("/api/brawl/:username&:elo", async (req, res) => {
  try {
    const username = req.params.username;
    const elo = req.params.elo;

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

    const BrawlIDFinal = await BrawlID;
    const playerStats = await fetch(
      `https://api.brawlhalla.com/player/${BrawlIDFinal}/stats?api_key=${process.env.BRAWL_API_KEY}`
    );
    var playerStatsJSON = await playerStats.json();

    const playerRanked = await fetch(
      `https://api.brawlhalla.com/player/${BrawlIDFinal}/ranked?api_key=${process.env.BRAWL_API_KEY}`
    );
    var playerRankedJSON = await playerRanked.json();


    console.log(playerStatsJSON["xp"]);

    var bestLevelCharacter = 0;
    var idBestCharacter = 0;

    for (var k in playerStatsJSON["legends"]) {
        if (playerStatsJSON["legends"][k]["level"] > bestLevelCharacter) {
          bestLevelCharacter = playerStatsJSON["legends"][k]["level"];
          idBestCharacter = k;
        }
      }
      const bestCharacter =
        playerStatsJSON["legends"][idBestCharacter]["legend_name_key"]
          .charAt(0)
          .toUpperCase() +
        playerStatsJSON["legends"][idBestCharacter]["legend_name_key"].slice(1);

      console.log(bestCharacter); //mettre en format json avec les autres infos obtenus

    // console.log(arrayPlayersBhIDFinal);

    return res.json({
      success: true,
      playerStatsJSON,
      playerRankedJSON,
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

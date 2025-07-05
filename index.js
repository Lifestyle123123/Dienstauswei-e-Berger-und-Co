const express = require("express");
const axios = require("axios");
const sharp = require("sharp");

const app = express();
app.use(express.urlencoded({ extended: true }));

const USER = "Test";
const PASS = "TestPW";

// Minimal CSS
const css = `
body {
  font-family: sans-serif;
  background: #eef;
  display: flex; justify-content: center; align-items: center; height: 100vh;
}
.container {
  background: #fff; padding: 20px; border-radius: 8px;
  box-shadow: 0 0 8px rgba(0,0,0,0.2);
}
.error { color: red; margin-top: 10px; }
`;

// Middleware
function basicAuth(req, res, next) {
  if (req.headers.authorization) {
    const auth = Buffer.from(req.headers.authorization.split(" ")[1], "base64").toString().split(":");
    if (auth[0] === USER && auth[1] === PASS) {
      return next();
    }
  }
  res.setHeader("WWW-Authenticate", "Basic realm=\"Login\"");
  res.status(401).send("Authentication required.");
}

// Login/Startseite
app.get("/", (req, res) => {
  const msg = req.query.msg ? `<div class="error">${req.query.msg}</div>` : "";
  res.send(`
<html><head><style>${css}</style><title>Generator</title></head><body>
<div class="container">
<h2>Dienstausweis Generator</h2>
<form method="POST" action="/generate">
  <input name="name" placeholder="Name" required><br>
  <input name="dienstnummer" placeholder="Dienstnummer" required><br>
  <input name="rang" placeholder="Rang" required><br>
  <input name="unterschrift" placeholder="Unterschrift" required><br>
  <input name="robloxLink" placeholder="Roblox Profil-Link" required><br>
  <button>Generieren</button>
</form>
${msg}
</div></body></html>
  `);
});

// Roblox ID
function getRobloxUserId(url) {
  const match = url.match(/users\/(\d+)\//);
  return match ? match[1] : null;
}

// Karte generieren
async function createCard(data, avatarBuffer) {
  const width = 600, height = 360;
  const bg = "#fff", navy = "#334", gold = "#fc0";

  const svgText = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="${bg}"/>
<rect y="0" width="100%" height="60" fill="${gold}"/>
<text x="20" y="40" font-size="24" font-family="sans-serif" fill="${navy}">Dienstausweis</text>
<text x="220" y="100" font-size="16" font-family="sans-serif" fill="${navy}">Name: ${data.name}</text>
<text x="220" y="130" font-size="16" font-family="sans-serif" fill="${navy}">Dienstnummer: ${data.dienstnummer}</text>
<text x="220" y="160" font-size="16" font-family="sans-serif" fill="${navy}">Rang: ${data.rang}</text>
<text x="220" y="190" font-size="16" font-family="sans-serif" fill="${navy}">Unterschrift: ${data.unterschrift}</text>
</svg>
`;

  const circleAvatar = await sharp(avatarBuffer)
    .resize(180, 180)
    .composite([{ input: Buffer.from(`<svg><circle cx="90" cy="90" r="90"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer();

  const buffer = await sharp({
    create: { width, height, channels: 4, background: bg }
  })
    .composite([
      { input: Buffer.from(svgText) },
      { input: circleAvatar, top: 100, left: 20 }
    ])
    .jpeg()
    .toBuffer();

  return buffer;
}

app.post("/generate", basicAuth, async (req, res) => {
  const { name, dienstnummer, rang, unterschrift, robloxLink } = req.body;
  const userId = getRobloxUserId(robloxLink);

  if (!userId) {
    return res.redirect("/?msg=Ungültiger Roblox Link!");
  }

  const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;

  try {
    const avatarResp = await axios.get(avatarUrl, { responseType: "arraybuffer" });
    const ausweisBuffer = await createCard({ name, dienstnummer, rang, unterschrift }, avatarResp.data);

    res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/\s+/g, "_")}_ausweis.jpg"`);
    res.setHeader("Content-Type", "image/jpeg");
    res.send(ausweisBuffer);
  } catch (err) {
    console.error(err);
    res.redirect("/?msg=Fehler: " + encodeURIComponent(err.message));
  }
});

module.exports = app;

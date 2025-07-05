const express = require("express");
const session = require("express-session");
const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "supergeheimesessionsecret123",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 }, // 30 Minuten
  })
);

const USER = "Test";
const PASS = "TestPW";

// Minimal CSS
const css = `
body {
  font-family: sans-serif;
  background: #eef;
  margin: 0; padding: 0;
  display: flex; justify-content: center; align-items: center; height: 100vh;
}
.container {
  background: #fff; border-radius: 8px; padding: 20px;
  box-shadow: 0 0 8px rgba(0,0,0,0.2);
  max-width: 400px; width: 100%;
}
.error { color: red; text-align: center; margin-top: 10px; }
.logout { text-align: right; margin-bottom: 10px; }
`;

// Middleware
function checkAuth(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect("/login");
}

// Login
app.get("/login", (req, res) => {
  const error = req.query.error ? `<div class="error">Ungültige Anmeldedaten!</div>` : "";
  res.send(`
<html><head><style>${css}</style><title>Login</title></head><body>
<div class="container">
<h2>Login</h2>
<form method="POST" action="/login">
  <input name="username" placeholder="Benutzer" required><br>
  <input name="password" type="password" placeholder="Passwort" required><br>
  <button>Login</button>
</form>
${error}
</div></body></html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === USER && password === PASS) {
    req.session.loggedIn = true;
    res.redirect("/");
  } else {
    res.redirect("/login?error=1");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Dashboard
app.get("/", checkAuth, (req, res) => {
  const msg = req.query.msg ? `<div class="error">${req.query.msg}</div>` : "";
  res.send(`
<html><head><style>${css}</style><title>Generator</title></head><body>
<div class="container">
<div class="logout"><a href="/logout">Logout</a></div>
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
async function createCard(data, avatarBuffer, outputPath) {
  const width = 600;
  const height = 360;
  const bg = "#fff";
  const navy = "#334";
  const gold = "#fc0";

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

  await sharp({
    create: { width, height, channels: 4, background: bg },
  })
    .composite([
      { input: Buffer.from(svgText) },
      { input: circleAvatar, top: 100, left: 20 },
    ])
    .jpeg()
    .toFile(outputPath);
}

app.post("/generate", checkAuth, async (req, res) => {
  const { name, dienstnummer, rang, unterschrift, robloxLink } = req.body;
  const userId = getRobloxUserId(robloxLink);

  if (!userId) {
    return res.redirect("/?msg=Ungültiger Roblox Link!");
  }

  const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
  const filename = `public/${name.replace(/\s+/g, "_")}_ausweis.jpg`;
  const downloadPath = `/download/${path.basename(filename)}`;

  try {
    const avatarResp = await axios.get(avatarUrl, { responseType: "arraybuffer" });
    await createCard({ name, dienstnummer, rang, unterschrift }, avatarResp.data, filename);

    res.redirect(downloadPath);
  } catch (err) {
    console.error(err);
    res.redirect("/?msg=Fehler: " + encodeURIComponent(err.message));
  }
});

// Datei-Download
app.use("/download", express.static(path.join(__dirname, "public")));

// Server
const PORT = process.env.PORT || 3000;

if (!fs.existsSync("public")) {
  fs.mkdirSync("public");
}

app.listen(PORT, () => {
  console.log(`Server läuft: http://localhost:${PORT}`);
});

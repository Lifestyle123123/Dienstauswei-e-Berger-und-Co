const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const basicAuth = require("express-basic-auth");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

const USER = "Test";
const PASS = "TestPW";

// Login
app.use(basicAuth({
  users: { [USER]: PASS },
  challenge: true,
  unauthorizedResponse: () => "Zugang verweigert."
}));

const css = `
body {
  font-family: Arial, sans-serif;
  background: linear-gradient(135deg, #74ABE2, #5563DE);
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #fff;
}
.container {
  background: rgba(0,0,0,0.6);
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  max-width: 400px;
  width: 90%;
}
input, label {
  width: 100%;
  display: block;
  padding: 10px;
  margin: 8px 0;
  border: none;
  border-radius: 4px;
}
button {
  background: #FFD700;
  color: #333;
  padding: 10px;
  width: 100%;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.error {
  color: #FFAAAA;
  margin-top: 10px;
  text-align: center;
}
`;

app.get("/", (req, res) => {
  const msg = req.query.msg ? `<div class="error">${req.query.msg}</div>` : "";
  res.send(`
<html><head><title>Ausweis Generator</title><style>${css}</style></head><body>
<div class="container">
<h2>Dienstausweis Generator</h2>
<p>📷 <b>Anleitung:</b> Gehe auf dein <a href="https://www.roblox.com/" target="_blank" style="color:#FFD700;">Roblox-Profil</a>, mach einen Screenshot von deinem Avatar, oder lade dein Profilbild herunter. Lade das Bild hier hoch:</p>
<form method="POST" action="/generate" enctype="multipart/form-data">
<input name="name" placeholder="Name" required>
<input name="dienstnummer" placeholder="Dienstnummer" required>
<input name="rang" placeholder="Rang" required>
<input name="unterschrift" placeholder="Unterschrift" required>
<label>Avatar Bild: <input type="file" name="avatar" accept="image/*" required></label>
<button>Generieren</button>
${msg}
</form>
</div></body></html>
`);
});

async function createCard(data, avatarBuffer) {
  const width = 600, height = 360;

  const svgText = `
<svg width="${width}" height="${height}">
<rect width="100%" height="100%" fill="#fff"/>
<rect y="0" width="100%" height="60" fill="#FFD700"/>
<text x="20" y="40" font-size="24" font-family="sans-serif" fill="#333">Dienstausweis</text>
<text x="220" y="100" font-size="16" font-family="sans-serif" fill="#000">Name: ${data.name}</text>
<text x="220" y="130" font-size="16" font-family="sans-serif" fill="#000">Dienstnummer: ${data.dienstnummer}</text>
<text x="220" y="160" font-size="16" font-family="sans-serif" fill="#000">Rang: ${data.rang}</text>
<text x="220" y="190" font-size="16" font-family="sans-serif" fill="#000">Unterschrift: ${data.unterschrift}</text>
</svg>`;

  const circleAvatar = await sharp(avatarBuffer)
    .resize(180, 180)
    .composite([{ input: Buffer.from(`<svg><circle cx="90" cy="90" r="90"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer();

  const buffer = await sharp({
    create: { width, height, channels: 4, background: "#fff" }
  })
    .composite([
      { input: Buffer.from(svgText) },
      { input: circleAvatar, top: 100, left: 20 }
    ])
    .jpeg()
    .toBuffer();

  return buffer;
}

app.post("/generate", upload.single("avatar"), async (req, res) => {
  const { name, dienstnummer, rang, unterschrift } = req.body;
  const avatarPath = req.file?.path;

  if (!avatarPath) {
    return res.redirect("/?msg=Bitte lade ein Avatar-Bild hoch.");
  }

  try {
    const avatar = fs.readFileSync(avatarPath);
    const ausweis = await createCard({ name, dienstnummer, rang, unterschrift }, avatar);

    // Aufräumen
    fs.unlinkSync(avatarPath);

    res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/\s+/g, "_")}_ausweis.jpg"`);
    res.setHeader("Content-Type", "image/jpeg");
    res.send(ausweis);
  } catch (err) {
    console.error(err);
    res.redirect(`/?msg=Fehler: ${encodeURIComponent(err.message)}`);
  }
});

module.exports = app;
